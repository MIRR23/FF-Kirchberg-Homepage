<?php
/**
 * Anonyme Besucherstatistik – Parität zu server/routes.ts.
 *
 * Zählung ohne Cookies: Besucher werden pro Tag über einen Hash aus IP +
 * Browser-Kennung + täglich wechselndem Zufallswert (Salt) erkannt. Das Salt
 * des Vortags wird verworfen, damit niemand über Tage hinweg verfolgbar ist.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

/** Erkennung automatisierter Zugriffe (werden nicht gezählt). */
const FFK_BOT_UA = '/bot|crawl|spider|slurp|preview|fetch|monitor|lighthouse|headless|python|curl|wget|scrapy|httpclient|feed/i';

/** Anzeigename für gezählte Pfade im Dashboard. */
const FFK_STATIC_PAGE_LABELS = [
    '/' => 'Startseite',
    '/aktuelles' => 'Aktuelles',
    '/einsaetze' => 'Einsätze',
    '/archiv' => 'Archiv',
    '/geraetehaus' => 'Gerätehaus',
    '/ueber-uns' => 'Über uns',
    '/termine' => 'Termine',
    '/first-responder' => 'First Responder',
    '/chronik' => 'Chronik',
    '/historische-braende' => 'Historische Brände',
    '/impressum' => 'Impressum',
    '/datenschutz' => 'Datenschutz',
    '/links' => 'Links',
];

/** Heutiges Datum (JJJJ-MM-TT) in deutscher Zeitzone – Tagesgrenzen wie erwartet. */
function ffk_stats_today(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('Europe/Berlin')))->format('Y-m-d');
}

/**
 * Salt des Tages. Beim Tageswechsel wird ein neues erzeugt und die
 * Hash-Tabelle des Vortags gelöscht.
 */
function ffk_stats_daily_salt(string $today): string
{
    $raw = ffk_get_setting('stats_salt');
    if ($raw !== null) {
        $parsed = json_decode($raw, true);
        if (is_array($parsed) && ($parsed['date'] ?? null) === $today && !empty($parsed['salt'])) {
            return (string) $parsed['salt'];
        }
    }
    $salt = bin2hex(random_bytes(16));
    ffk_set_setting('stats_salt', json_encode(['date' => $today, 'salt' => $salt], JSON_UNESCAPED_UNICODE));
    ffk_purge_stats_seen_before($today); // Tageswechsel: alte Hashes löschen
    return $salt;
}

/** Anzeigename für einen gezählten Pfad (z. B. Beitragstitel statt Slug). */
function ffk_stats_path_label(string $p): string
{
    if (isset(FFK_STATIC_PAGE_LABELS[$p])) {
        return FFK_STATIC_PAGE_LABELS[$p];
    }
    if (preg_match('#^/beitrag/(.+)$#', $p, $m) === 1) {
        $post = ffk_get_post_by_slug($m[1]);
        if ($post !== null) {
            return 'Beitrag: ' . $post['title'];
        }
    }
    return $p;
}

/**
 * Schließt die Antwort ab, damit die anschließende Zählung den Besucher nicht
 * ausbremst. Unter FastCGI/PHP-FPM (Timme) geht das direkt; sonst wird der
 * Puffer geleert und die Verarbeitung läuft trotz Verbindungsabbruch weiter.
 */
function ffk_finish_request(): void
{
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
        return;
    }
    ignore_user_abort(true);
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @flush();
}

/**
 * Verarbeitet den Zähl-Ping der öffentlichen Seite.
 * Antwortet immer sofort mit 204 – die Zählung passiert danach.
 */
function ffk_handle_stats_hit(): void
{
    $body = ffk_body();

    http_response_code(204);
    header('Content-Length: 0');
    ffk_finish_request();

    try {
        $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
        if ($ua === '' || preg_match(FFK_BOT_UA, $ua) === 1) {
            return;
        }
        $p = (string) ($body['path'] ?? '');
        if (!str_starts_with($p, '/') || strlen($p) > 200) {
            return;
        }
        $p = explode('?', $p)[0];
        if (str_starts_with($p, '/intern')) {
            return; // interner Bereich wird nicht gezählt
        }
        // Sicherheitsnetz für die Spaltenbreite (Pfade sind real deutlich kürzer)
        $p = mb_substr($p, 0, 191, 'UTF-8');

        // Externe Herkunft (nur der Hostname, z. B. "www.google.com")
        $refHost = null;
        $ref = (string) ($body['referrer'] ?? '');
        if ($ref !== '') {
            $host = parse_url($ref, PHP_URL_HOST);
            $ownHost = explode(':', (string) ($_SERVER['HTTP_HOST'] ?? ''))[0];
            if (is_string($host) && $host !== '' && $host !== $ownHost) {
                $refHost = mb_substr($host, 0, 100, 'UTF-8');
            }
        }

        $today = ffk_stats_today();
        $salt = ffk_stats_daily_salt($today);
        $hash = hash('sha256', $salt . '|' . ffk_client_ip() . '|' . $ua);
        ffk_record_page_view($today, $p, $refHost, $hash, preg_match('/Mobi/i', $ua) === 1);
    } catch (Throwable $e) {
        error_log('[FFK] Statistik-Zählung fehlgeschlagen: ' . $e->getMessage());
    }
}

/**
 * Daten für das Statistik-Dashboard: lückenlose Tagesreihe, Summen,
 * meistbesuchte Seiten (mit Titel-Auflösung) und verweisende Websites.
 */
function ffk_admin_stats(int $days): array
{
    $days = min(365, max(1, $days));
    $today = ffk_stats_today();

    $from = new DateTimeImmutable($today . ' 12:00:00', new DateTimeZone('UTC'));
    $from = $from->modify('-' . ($days - 1) . ' days');
    $fromDate = $from->format('Y-m-d');

    // Lückenlose Tagesreihe (Tage ohne Aufrufe mit 0), damit das Diagramm stimmt
    $byDate = [];
    foreach (ffk_get_stats_days($fromDate) as $d) {
        $byDate[$d['date']] = $d;
    }
    $series = [];
    $cursor = $from;
    for ($i = 0; $i < $days; $i++) {
        $date = $cursor->format('Y-m-d');
        $row = $byDate[$date] ?? null;
        $series[] = [
            'date' => $date,
            'views' => (int) ($row['views'] ?? 0),
            'visitors' => (int) ($row['visitors'] ?? 0),
            'mobile' => (int) ($row['mobile'] ?? 0),
        ];
        $cursor = $cursor->modify('+1 day');
    }

    $totals = ['views' => 0, 'visitors' => 0, 'mobile' => 0];
    foreach ($series as $d) {
        $totals['views'] += $d['views'];
        $totals['visitors'] += $d['visitors'];
        $totals['mobile'] += $d['mobile'];
    }
    $totals['today'] = (int) ($byDate[$today]['views'] ?? 0);

    $topPages = array_map(
        static fn (array $r) => $r + ['label' => ffk_stats_path_label($r['path'])],
        ffk_get_stats_top_pages($fromDate, 10)
    );

    return [
        'days' => $series,
        'totals' => $totals,
        'topPages' => $topPages,
        'referrers' => ffk_get_stats_top_referrers($fromDate, 10),
    ];
}
