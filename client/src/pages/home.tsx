import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, MapPin, Clock } from "lucide-react";
import type { Post, Event } from "@shared/schema";
import { withBase } from "@/lib/auth";
import { formatDate, dayOfMonth, monthShort } from "@/lib/format";
import { PublicLayout, PostCard, SectionHead, EmptyState, useCategories, categoryById } from "@/components/site";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  einsaetzeGesamt: number;
  einsaetzeJahr: number;
  fahrzeuge: number;
  aktive: number;
}

export default function Home() {
  const { data: latest } = useQuery<Post[]>({ queryKey: ["/api/posts?limit=6"] });
  const { data: einsaetze } = useQuery<Post[]>({ queryKey: ["/api/posts?einsatz=1&limit=4"] });
  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/stats"] });
  const { data: categories } = useCategories();

  const heroPost = einsaetze?.find((p) => p.featuredImage) ?? latest?.find((p) => p.featuredImage);
  const upcoming = (events ?? [])
    .filter((e) => e.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 3);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        {heroPost?.featuredImage && (
          <img
            src={withBase(heroPost.featuredImage)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(228 11% 7% / .65) 0%, hsl(228 11% 7% / .35) 40%, hsl(228 11% 7% / .94) 88%, hsl(228 11% 7%) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-24 md:px-8 md:pb-24 md:pt-36">
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-chart-2">
            <span className="inline-block h-0.5 w-7 bg-chart-2" />
            Freiwillige Feuerwehr Kirchberg · seit 1874
          </p>
          <h1 className="mt-4 max-w-[14ch] font-display text-4xl font-semibold leading-[1.05] md:text-6xl">
            Wenn jede <em className="not-italic text-primary">Minute</em> zählt.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/80 md:text-lg">
            Aktive Einsatzkräfte, moderne Fahrzeuge und eine eigene First-Responder-Einheit –
            rund um die Uhr einsatzbereit für Kirchberg und das Erdinger Holzland.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/einsaetze"
              data-testid="button-hero-einsaetze"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Aktuelle Einsätze
            </Link>
            <Link
              href="/ueber-uns"
              data-testid="button-hero-ueberuns"
              className="rounded-lg border border-border bg-card/60 px-6 py-3 text-sm font-semibold backdrop-blur-sm hover:bg-card"
            >
              Über uns
            </Link>
          </div>
        </div>
      </section>

      {/* Ticker / Stats */}
      <div className="border-y border-border bg-sidebar">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-10 gap-y-2 px-4 py-4 text-sm text-muted-foreground md:px-8">
          {einsaetze?.[0] && (
            <span data-testid="text-letzter-einsatz" className="flex items-center gap-2">
              <span className="text-primary">●</span>
              <span className="font-semibold text-foreground">Letzter Einsatz:</span>
              <Link href={`/beitrag/${einsaetze[0].slug}`} className="underline-offset-2 hover:underline">
                {einsaetze[0].title}
              </Link>
              <span>· {formatDate(einsaetze[0].publishedAt)}</span>
            </span>
          )}
          {stats && (
            <>
              {stats.einsaetzeJahr > 0 && (
                <span><b className="text-foreground">{stats.einsaetzeJahr}</b> Einsätze {new Date().getFullYear()}</span>
              )}
              <span><b className="text-foreground">{stats.einsaetzeGesamt}</b> dokumentierte Einsätze</span>
              <span><b className="text-foreground">{stats.fahrzeuge}</b> Fahrzeuge</span>
            </>
          )}
        </div>
      </div>

      {/* Neuigkeiten */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <SectionHead
          title="Einsätze & Neuigkeiten"
          action={
            <Link href="/aktuelles" data-testid="link-alle-beitraege" className="flex items-center gap-1 text-sm font-bold text-primary">
              Alle Beiträge <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        {!latest ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : latest.length === 0 ? (
          <EmptyState text="Noch keine Beiträge vorhanden." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.slice(0, 6).map((p, i) => (
              <PostCard key={p.id} post={p} category={categoryById(categories, p.categoryId)} eager={i < 3} />
            ))}
          </div>
        )}
      </section>

      {/* Termine */}
      <section className="border-t border-border bg-sidebar/60">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
          <SectionHead
            title="Termine & Veranstaltungen"
            action={
              <Link href="/termine" data-testid="link-alle-termine" className="flex items-center gap-1 text-sm font-bold text-primary">
                Alle Termine <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          {!events ? (
            <Skeleton className="h-24 rounded-2xl" />
          ) : upcoming.length === 0 ? (
            <EmptyState text="Aktuell sind keine Termine eingetragen." />
          ) : (
            <div className="grid gap-4">
              {upcoming.map((e) => (
                <div
                  key={e.id}
                  data-testid={`row-event-${e.id}`}
                  className="flex items-center gap-5 rounded-2xl border border-card-border bg-card px-5 py-4"
                >
                  <div className="min-w-[64px] rounded-xl bg-primary px-3 py-2 text-center text-primary-foreground">
                    <span className="block font-display text-xl font-semibold leading-none">{dayOfMonth(e.date)}</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider">{monthShort(e.date)}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold md:text-lg">{e.title}</h3>
                    <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {e.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{e.location}</span>}
                      {e.time && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{e.time} Uhr</span>}
                      <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(e.date)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
