import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Post, Category } from "@shared/schema";
import { withBase } from "@/lib/auth";
import { formatDate, stripHtml, truncate } from "@/lib/format";

const NAV = [
  { href: "/", label: "Aktuelles" },
  { href: "/einsaetze", label: "Einsätze" },
  { href: "/geraetehaus", label: "Gerätehaus" },
  { href: "/ueber-uns", label: "Über uns" },
  { href: "/termine", label: "Termine" },
  { href: "/archiv", label: "Archiv" },
];

/** Hero-Titel rendern: Text zwischen zwei Sternchen ("*Minute*") wird farblich hervorgehoben. */
export function renderHeroTitle(title: string): ReactNode {
  return title.split(/\*([^*]+)\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <em key={i} className="not-italic text-primary">
        {part}
      </em>
    ) : (
      part
    )
  );
}

export function SiteHeader() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-8">
        <Link href="/" data-testid="link-home-logo" className="flex items-center gap-3">
          <img src="wappen.png" alt="Wappen der Feuerwehr Kirchberg" className="h-10 w-auto md:h-11" />
          <span className="leading-tight">
            <span className="block font-display text-base font-semibold md:text-lg">FF Kirchberg</span>
            <span className="block text-[11px] text-muted-foreground md:text-xs">im Erdinger Holzland</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Hauptnavigation">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              data-testid={`link-nav-${n.label.toLowerCase().replace(/[^a-z]/g, "")}`}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(n.href) ? "text-primary" : "text-foreground/80 hover:text-foreground"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <a
          href="tel:112"
          data-testid="link-notruf"
          className="ml-auto hidden items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm font-bold lg:ml-2 lg:flex"
        >
          <Phone className="h-3.5 w-3.5 text-primary" /> Notruf 112
        </a>

        <button
          className="ml-auto rounded-md p-2 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menü öffnen"
          data-testid="button-mobile-menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-4 pb-4 pt-2 lg:hidden" aria-label="Mobile Navigation">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              data-testid={`link-mobilenav-${n.label.toLowerCase().replace(/[^a-z]/g, "")}`}
              className={`block rounded-md px-3 py-2.5 text-base font-medium ${
                isActive(n.href) ? "bg-secondary text-primary" : "text-foreground/85"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <a href="tel:112" className="mt-2 flex items-center gap-2 rounded-md bg-primary px-3 py-2.5 font-bold text-primary-foreground">
            <Phone className="h-4 w-4" /> Notruf 112
          </a>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-sidebar">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:px-8 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <img src="wappen.png" alt="" className="h-10 w-auto" />
            <span className="font-display font-semibold">Freiwillige Feuerwehr Kirchberg</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Seit 1874 für die Sicherheit in Kirchberg und dem Erdinger Holzland im Einsatz.
          </p>
        </div>
        <div className="text-sm">
          <h3 className="mb-3 font-semibold">Kontakt</h3>
          <p className="leading-relaxed text-muted-foreground">
            Freiwillige Feuerwehr Kirchberg<br />
            84434 Kirchberg · Erdinger Holzland<br />
            <a className="underline underline-offset-2" href="mailto:webmaster@ff-kirchberg.de">webmaster@ff-kirchberg.de</a>
          </p>
          <p className="mt-3 flex items-center gap-2 font-bold text-foreground">
            <Flame className="h-4 w-4 text-primary" /> Im Notfall: 112
          </p>
        </div>
        <div className="text-sm">
          <h3 className="mb-3 font-semibold">Seiten</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">
                {n.label}
              </Link>
            ))}
            <Link href="/chronik" className="text-muted-foreground hover:text-foreground">Chronik</Link>
            <Link href="/links" className="text-muted-foreground hover:text-foreground">Links</Link>
            <Link href="/impressum" data-testid="link-impressum" className="text-muted-foreground hover:text-foreground">Impressum</Link>
            <Link href="/datenschutz" className="text-muted-foreground hover:text-foreground">Datenschutz</Link>
            <Link href="/intern" data-testid="link-intern" className="text-muted-foreground hover:text-foreground">Interner Bereich</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Freiwillige Feuerwehr Kirchberg
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  red: "bg-primary/15 text-primary",
  amber: "bg-chart-2/15 text-chart-2",
  blue: "bg-chart-4/15 text-chart-4",
  green: "bg-chart-3/15 text-chart-3",
  gray: "bg-secondary text-muted-foreground",
};

export function CategoryBadge({ category, stichwort }: { category?: Category | null; stichwort?: string | null }) {
  const color = BADGE_COLORS[category?.color ?? "gray"] ?? BADGE_COLORS.gray;
  const label = [category?.name, stichwort].filter(Boolean).join(" · ");
  if (!label) return null;
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${color}`}>
      {label}
    </span>
  );
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: ["/api/categories"] });
}

export function categoryById(categories: Category[] | undefined, id: number): Category | null {
  return categories?.find((c) => c.id === id) ?? null;
}

export function PostCard({ post, category, eager = false }: { post: Post; category: Category | null; eager?: boolean }) {
  const text = post.excerpt ? truncate(stripHtml(post.excerpt), 140) : "";
  return (
    <Link
      href={`/beitrag/${post.slug}`}
      data-testid={`card-post-${post.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-card-border bg-card transition-transform hover:-translate-y-0.5"
    >
      {post.featuredImage ? (
        <div className="aspect-[3/2] overflow-hidden">
          <img
            src={withBase(post.featuredImage)}
            alt={post.title}
            loading={eager ? "eager" : "lazy"}
            className="h-full w-full object-cover opacity-95 transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="flex aspect-[3/2] items-center justify-center bg-secondary/50">
          <Flame className="h-10 w-10 text-muted-foreground/40" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div>
          <CategoryBadge category={category} stichwort={post.stichwort} />
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{post.title}</h3>
        {text && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>}
        <div className="mt-auto pt-4 font-mono text-xs text-muted-foreground/80">
          {formatDate(post.publishedAt)}
          {post.ort ? ` · ${post.ort}` : ""}
        </div>
      </div>
    </Link>
  );
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <h2 className="font-display text-xl font-semibold md:text-2xl">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
