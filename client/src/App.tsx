import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { apiFetch } from "@/lib/auth";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { Aktuelles, Einsaetze, Archiv, PostDetail } from "@/pages/posts";
import { Geraetehaus, UeberUns, Termine, StaticPage } from "@/pages/info";

// Interner Bereich wird erst geladen, wenn er aufgerufen wird (kleineres
// Startpaket für normale Besucher). Alle Admin-Module landen im selben Chunk.
const AdminLogin = lazy(() => import("@/pages/admin/core").then((m) => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import("@/pages/admin/core").then((m) => ({ default: m.AdminDashboard })));
const AdminKonto = lazy(() => import("@/pages/admin/core").then((m) => ({ default: m.AdminKonto })));
const AdminPosts = lazy(() => import("@/pages/admin/posts").then((m) => ({ default: m.AdminPosts })));
const AdminPostEditor = lazy(() => import("@/pages/admin/posts").then((m) => ({ default: m.AdminPostEditor })));
const AdminEvents = lazy(() => import("@/pages/admin/content").then((m) => ({ default: m.AdminEvents })));
const AdminVehicles = lazy(() => import("@/pages/admin/content").then((m) => ({ default: m.AdminVehicles })));
const AdminMembers = lazy(() => import("@/pages/admin/content").then((m) => ({ default: m.AdminMembers })));
const AdminPages = lazy(() => import("@/pages/admin/manage").then((m) => ({ default: m.AdminPages })));
const AdminMedia = lazy(() => import("@/pages/admin/manage").then((m) => ({ default: m.AdminMedia })));
const AdminDocuments = lazy(() => import("@/pages/admin/manage").then((m) => ({ default: m.AdminDocuments })));
const AdminUsers = lazy(() => import("@/pages/admin/manage").then((m) => ({ default: m.AdminUsers })));
const AdminStartseite = lazy(() => import("@/pages/admin/startseite").then((m) => ({ default: m.AdminStartseite })));

// Externe Herkunft (document.referrer) nur beim ersten Aufruf mitschicken –
// bei Navigation innerhalb der Seite ist sie nicht mehr aussagekräftig.
let referrerSent = false;

/**
 * Meldet jeden Seitenaufruf anonym an den eigenen Server (cookielose
 * Besucherstatistik). Angemeldete Redakteure und der interne Bereich
 * werden nicht gezählt.
 */
function VisitTracker() {
  const [location] = useLocation();
  useEffect(() => {
    if (location.startsWith("/intern")) return;
    try {
      if (localStorage.getItem("ffk_token")) return; // Redakteure nicht mitzählen
    } catch {
      /* localStorage gesperrt -> normal zählen */
    }
    const referrer = referrerSent ? "" : document.referrer;
    referrerSent = true;
    apiFetch("/api/stats/hit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location, referrer }),
    }).catch(() => {
      /* Zählung darf das Surfen nie stören */
    });
  }, [location]);
  return null;
}

function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Wird geladen …
        </div>
      }
    >
    <Switch>
      {/* Öffentliche Website */}
      <Route path="/" component={Home} />
      <Route path="/aktuelles" component={Aktuelles} />
      <Route path="/einsaetze" component={Einsaetze} />
      <Route path="/archiv" component={Archiv} />
      <Route path="/beitrag/:slug" component={PostDetail} />
      <Route path="/geraetehaus" component={Geraetehaus} />
      <Route path="/ueber-uns" component={UeberUns} />
      <Route path="/termine" component={Termine} />
      <Route path="/first-responder">
        {() => (
          <StaticPage
            slug="first-responder"
            kicker="First Responder"
            logo={{ src: "/uploads/first-responder-logo.png", alt: "Logo der First Responder Kirchberg" }}
          />
        )}
      </Route>
      <Route path="/chronik">{() => <StaticPage slug="chronik" kicker="Chronik" />}</Route>
      <Route path="/historische-braende">{() => <StaticPage slug="historische-braende" kicker="Chronik" />}</Route>
      <Route path="/impressum">{() => <StaticPage slug="impressum" kicker="Rechtliches" />}</Route>
      <Route path="/datenschutz">{() => <StaticPage slug="datenschutz" kicker="Rechtliches" />}</Route>
      <Route path="/links">{() => <StaticPage slug="links" kicker="Links" />}</Route>

      {/* Interner Bereich */}
      <Route path="/intern" component={AdminLogin} />
      <Route path="/intern/dashboard" component={AdminDashboard} />
      <Route path="/intern/konto" component={AdminKonto} />
      <Route path="/intern/beitraege" component={AdminPosts} />
      <Route path="/intern/beitraege/:id" component={AdminPostEditor} />
      <Route path="/intern/termine" component={AdminEvents} />
      <Route path="/intern/fahrzeuge" component={AdminVehicles} />
      <Route path="/intern/mitglieder" component={AdminMembers} />
      <Route path="/intern/startseite" component={AdminStartseite} />
      <Route path="/intern/seiten" component={AdminPages} />
      <Route path="/intern/medien" component={AdminMedia} />
      <Route path="/intern/dateien" component={AdminDocuments} />
      <Route path="/intern/benutzer" component={AdminUsers} />

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <VisitTracker />
            <AppRouter />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
