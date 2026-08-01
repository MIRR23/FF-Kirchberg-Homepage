import { Link } from "wouter";
import { AlertTriangle, Home } from "lucide-react";
import { PublicLayout } from "@/components/site";
import { usePageTitle } from "@/lib/seo";

export default function NotFound() {
  usePageTitle("Seite nicht gefunden");
  return (
    <PublicLayout>
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-6 font-display text-5xl font-semibold text-primary">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">Seite nicht gefunden</h1>
        <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
          Die aufgerufene Seite existiert nicht (mehr). Möglicherweise wurde der Link
          geändert oder der Beitrag entfernt.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <Home className="h-4 w-4" aria-hidden="true" /> Zur Startseite
        </Link>
      </div>
    </PublicLayout>
  );
}
