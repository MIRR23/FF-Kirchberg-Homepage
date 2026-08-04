import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, User } from "lucide-react";
import type { Post } from "@shared/schema";
import { cleanHtml } from "@/lib/sanitize";
import { LocationView } from "@/components/map";
import { usePageTitle } from "@/lib/seo";
import { formatDateLong, formatTime, yearOf } from "@/lib/format";
import { PublicLayout, PostCard, EmptyState, CategoryBadge, useCategories, categoryById, useSiteSettings } from "@/components/site";
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

function FilterChips({
  options, value, onChange,
}: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          data-testid={`button-filter-${o.value || "alle"}`}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PostGrid({ posts, loading }: { posts: Post[] | undefined; loading: boolean }) {
  const { data: categories } = useCategories();
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
    );
  }
  if (!posts?.length) return <EmptyState text="Keine Beiträge gefunden." />;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} category={categoryById(categories, p.categoryId)} />
      ))}
    </div>
  );
}

const PAGE_SIZE = 12;

export function Aktuelles() {
  usePageTitle("Aktuelles");
  const [cat, setCat] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const { data: categories } = useCategories();
  const key = cat ? `/api/posts?category=${cat}` : "/api/posts";
  const { data: posts, isLoading } = useQuery<Post[]>({ queryKey: [key] });

  const options = [
    { value: "", label: "Alle" },
    ...(categories ?? []).map((c) => ({ value: c.slug, label: c.name })),
  ];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <PageTitle
          kicker="Aktuelles"
          title="Einsätze & Neuigkeiten"
          intro="Alle Berichte unserer Feuerwehr – von Einsätzen über Übungen bis zu Veranstaltungen. Nach Kategorien filterbar."
        />
        <FilterChips options={options} value={cat} onChange={(v) => { setCat(v); setShown(PAGE_SIZE); }} />
        <PostGrid posts={posts?.slice(0, shown)} loading={isLoading} />
        {posts && posts.length > shown && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setShown(shown + PAGE_SIZE)}
              data-testid="button-mehr-laden"
              className="rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-secondary"
            >
              Weitere Beiträge laden ({posts.length - shown} weitere)
            </button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export function Einsaetze() {
  usePageTitle("Einsatzberichte");
  const [year, setYear] = useState("");
  const { data: years } = useQuery<string[]>({ queryKey: ["/api/posts/years"] });
  const key = `/api/posts?einsatz=1${year ? `&year=${year}` : ""}`;
  const { data: posts, isLoading } = useQuery<Post[]>({ queryKey: [key] });
  const [shown, setShown] = useState(PAGE_SIZE);

  const options = [
    { value: "", label: "Alle Jahre" },
    ...(years ?? []).map((y) => ({ value: y, label: y })),
  ];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <PageTitle
          kicker="Einsätze"
          title="Einsatzberichte"
          intro="Brände, technische Hilfeleistungen und First-Responder-Einsätze der Feuerwehr Kirchberg."
        />
        <FilterChips options={options} value={year} onChange={(v) => { setYear(v); setShown(PAGE_SIZE); }} />
        <PostGrid posts={posts?.slice(0, shown)} loading={isLoading} />
        {posts && posts.length > shown && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setShown(shown + PAGE_SIZE)}
              className="rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-secondary"
            >
              Weitere Einsätze laden ({posts.length - shown} weitere)
            </button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export function Archiv() {
  usePageTitle("Beitragsarchiv");
  const { data: years } = useQuery<string[]>({ queryKey: ["/api/posts/years"] });
  const { data: allPosts } = useQuery<Post[]>({ queryKey: ["/api/posts"] });
  const [year, setYear] = useState<string>("");

  const counts = new Map<string, number>();
  allPosts?.forEach((p) => {
    const y = yearOf(p.publishedAt);
    counts.set(y, (counts.get(y) ?? 0) + 1);
  });

  const yearPosts = year ? allPosts?.filter((p) => yearOf(p.publishedAt) === year) : undefined;

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <PageTitle
          kicker="Archiv"
          title="Beitragsarchiv"
          intro="Alle Beiträge und Einsatzberichte seit Bestehen der Homepage – geordnet nach Jahren."
        />
        {!years ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <>
            <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(year === y ? "" : y)}
                  data-testid={`button-jahr-${y}`}
                  className={`rounded-xl border p-4 text-center transition-colors ${
                    year === y ? "border-primary bg-primary/10" : "border-card-border bg-card hover:border-border"
                  }`}
                >
                  <span className="block font-display text-xl font-semibold">{y}</span>
                  <span className="text-xs text-muted-foreground">{counts.get(y) ?? 0} Beiträge</span>
                </button>
              ))}
            </div>
            {year ? (
              <PostGrid posts={yearPosts} loading={!yearPosts} />
            ) : (
              <p className="text-center text-sm text-muted-foreground">Jahr auswählen, um die Beiträge anzuzeigen.</p>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}

export function PostDetail() {
  const [, params] = useRoute("/beitrag/:slug");
  const slug = params?.slug ?? "";
  const { data: post, isLoading, error } = useQuery<Post>({ queryKey: [`/api/posts/slug/${slug}`] });
  const { data: categories } = useCategories();
  const { data: site } = useSiteSettings();
  usePageTitle(post?.title);

  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <Link href="/aktuelles" className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Zurück zur Übersicht
        </Link>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40" />
          </div>
        ) : error || !post ? (
          <EmptyState text="Beitrag nicht gefunden." />
        ) : (
          <>
            <div className="mb-3">
              <CategoryBadge category={categoryById(categories, post.categoryId)} stichwort={post.stichwort} />
            </div>
            <h1 data-testid="text-post-title" className="font-display text-3xl font-semibold leading-tight md:text-4xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-b border-border pb-6 text-sm text-muted-foreground">
              <span>{formatDateLong(post.publishedAt)}{formatTime(post.publishedAt) ? ` · ${formatTime(post.publishedAt)}` : ""}</span>
              {post.ort && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{post.ort}</span>}
              {post.authorName && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{post.authorName}</span>}
            </div>
            <div
              className="prose-content mt-8"
              data-testid="text-post-content"
              dangerouslySetInnerHTML={{ __html: cleanHtml(post.content, { linksNewTab: site?.linksNewTab }) }}
            />
            <LocationView lat={post.lat} lng={post.lng} label={post.ort} heading="Standort" />
          </>
        )}
      </article>
    </PublicLayout>
  );
}
