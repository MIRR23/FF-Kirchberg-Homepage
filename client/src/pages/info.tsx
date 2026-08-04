import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, UserRound } from "lucide-react";
import type { Vehicle, Member, Page, Event } from "@shared/schema";
import { withBase } from "@/lib/auth";
import { cleanHtml } from "@/lib/sanitize";
import { LocationView } from "@/components/map";
import { usePageTitle } from "@/lib/seo";
import { formatDate, dayOfMonth, monthShort } from "@/lib/format";
import { PublicLayout, EmptyState, useSiteSettings } from "@/components/site";
import { Skeleton } from "@/components/ui/skeleton";

function PageTitle({ kicker, title, intro }: { kicker: string; title: string; intro?: string }) {
  return (
    <div className="mb-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-chart-2">{kicker}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">{title}</h1>
      {intro && <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{intro}</p>}
    </div>
  );
}

// ---------- Gerätehaus / Fahrzeuge ----------
export function Geraetehaus() {
  usePageTitle("Gerätehaus & Fahrzeuge");
  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: site } = useSiteSettings();

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <PageTitle
          kicker="Gerätehaus"
          title="Unsere Fahrzeuge & Ausrüstung"
          intro="Im Gerätehaus der Feuerwehr Kirchberg stehen unsere Einsatzfahrzeuge – jedes mit eigener Aufgabe im Einsatzfall."
        />
        {isLoading ? (
          <div className="space-y-10">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
        ) : !vehicles?.length ? (
          <EmptyState text="Noch keine Fahrzeuge eingetragen." />
        ) : (
          <div className="space-y-10">
            {vehicles.map((v, i) => (
              <div
                key={v.id}
                data-testid={`card-vehicle-${v.id}`}
                className={`grid items-stretch gap-0 overflow-hidden rounded-2xl border border-card-border bg-card md:grid-cols-2 ${
                  i % 2 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                {v.image ? (
                  <img src={withBase(v.image)} alt={v.name} loading="lazy" className="h-64 w-full object-cover md:h-full" />
                ) : (
                  <div className="flex h-64 items-center justify-center bg-secondary/50 md:h-full">
                    <span className="text-muted-foreground/50">Kein Bild</span>
                  </div>
                )}
                <div className="p-6 md:p-9">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">{v.type}</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold">{v.name}</h2>
                  <div
                    className="prose-content mt-4 text-sm text-foreground/90"
                    dangerouslySetInnerHTML={{ __html: cleanHtml(v.description, { linksNewTab: site?.linksNewTab }) }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

// ---------- Über uns ----------
export function UeberUns() {
  usePageTitle("Über uns");
  const { data: page } = useQuery<Page>({ queryKey: ["/api/pages/ueber-uns"] });
  const { data: members, isLoading } = useQuery<Member[]>({ queryKey: ["/api/members"] });
  const { data: site } = useSiteSettings();

  const vorstand = members?.filter((m) => m.gruppe === "vorstandschaft") ?? [];
  const aktive = members?.filter((m) => m.gruppe === "aktive") ?? [];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <PageTitle kicker="Über uns" title={page?.title || "Die Feuerwehr Kirchberg"} />
        {page ? (
          <div className="prose-content max-w-3xl" dangerouslySetInnerHTML={{ __html: cleanHtml(page.content, { linksNewTab: site?.linksNewTab }) }} />
        ) : (
          <Skeleton className="h-40 max-w-3xl" />
        )}

        <h2 className="mb-6 mt-16 font-display text-2xl font-semibold">Vorstandschaft & Kommandanten</h2>
        {isLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : !vorstand.length ? (
          <EmptyState text="Noch keine Einträge." />
        ) : (
          <MemberGrid members={vorstand} />
        )}

        {/* Aktive Mannschaft nur zeigen, wenn tatsächlich Mitglieder gepflegt sind */}
        {(isLoading || aktive.length > 0) && (
          <>
            <h2 className="mb-6 mt-16 font-display text-2xl font-semibold">Aktive Mannschaft</h2>
            {isLoading ? <Skeleton className="h-40 rounded-2xl" /> : <MemberGrid members={aktive} />}
          </>
        )}
      </div>
    </PublicLayout>
  );
}

function MemberGrid({ members }: { members: Member[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {members.map((m) => (
        <div key={m.id} data-testid={`card-member-${m.id}`} className="rounded-2xl border border-card-border bg-card p-5 text-center">
          {m.image ? (
            <img src={withBase(m.image)} alt={m.name} className="mx-auto h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
              <UserRound className="h-8 w-8 text-muted-foreground/60" />
            </div>
          )}
          <h3 className="mt-3 font-semibold leading-tight">{m.name}</h3>
          {m.funktion && <p className="mt-1 text-sm text-muted-foreground">{m.funktion}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------- Termine ----------
export function Termine() {
  usePageTitle("Termine & Veranstaltungen");
  const { data: events, isLoading } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (events ?? []).filter((e) => e.date >= today);
  const past = (events ?? []).filter((e) => e.date < today).reverse();

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        <PageTitle
          kicker="Termine"
          title="Termine & Veranstaltungen"
          intro="Übungen, Versammlungen und Feste der Feuerwehr Kirchberg."
        />
        {isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : (
          <>
            <h2 className="mb-5 font-display text-xl font-semibold">Anstehende Termine</h2>
            {!upcoming.length ? (
              <EmptyState text="Aktuell sind keine Termine eingetragen." />
            ) : (
              <div className="grid gap-4">{upcoming.map((e) => <EventRow key={e.id} event={e} />)}</div>
            )}
            {past.length > 0 && (
              <>
                <h2 className="mb-5 mt-14 font-display text-xl font-semibold text-muted-foreground">Vergangene Termine</h2>
                <div className="grid gap-4 opacity-65">{past.slice(0, 10).map((e) => <EventRow key={e.id} event={e} />)}</div>
              </>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}

function EventRow({ event: e }: { event: Event }) {
  return (
    <div data-testid={`row-event-${e.id}`} className="flex items-center gap-5 rounded-2xl border border-card-border bg-card px-5 py-4">
      <div className={`min-w-[64px] rounded-xl px-3 py-2 text-center ${e.kind === "uebung" ? "bg-secondary" : "bg-primary text-primary-foreground"}`}>
        <span className="block font-display text-xl font-semibold leading-none">{dayOfMonth(e.date)}</span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider">{monthShort(e.date)} {e.date.slice(0, 4)}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {e.kind === "uebung" ? "Übung" : "Veranstaltung"}
        </p>
        <h3 className="font-display text-base font-semibold md:text-lg">{e.title}</h3>
        <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {e.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{e.location}</span>}
          {e.time && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{e.time} Uhr</span>}
          <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(e.date)}</span>
        </p>
        {e.description && <p className="mt-1.5 text-sm text-muted-foreground">{e.description}</p>}
        <LocationView lat={e.lat} lng={e.lng} label={e.location} compact />
      </div>
    </div>
  );
}

// ---------- Statische Seiten ----------
export function StaticPage({ slug, kicker }: { slug: string; kicker: string }) {
  const { data: page, isLoading, error } = useQuery<Page>({ queryKey: [`/api/pages/${slug}`] });
  const { data: site } = useSiteSettings();
  usePageTitle(page?.title ?? kicker);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-64" />
          </div>
        ) : error || !page ? (
          <EmptyState text="Seite nicht gefunden." />
        ) : (
          <>
            <PageTitle kicker={kicker} title={page.title} />
            <div
              className="prose-content"
              data-testid={`text-page-${slug}`}
              dangerouslySetInnerHTML={{ __html: cleanHtml(page.content, { linksNewTab: site?.linksNewTab }) }}
            />
          </>
        )}
      </div>
    </PublicLayout>
  );
}
