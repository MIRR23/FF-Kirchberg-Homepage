import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { Aktuelles, Einsaetze, Archiv, PostDetail } from "@/pages/posts";
import { Geraetehaus, UeberUns, Termine, StaticPage } from "@/pages/info";
import { AdminLogin, AdminDashboard, AdminKonto } from "@/pages/admin/core";
import { AdminPosts, AdminPostEditor } from "@/pages/admin/posts";
import { AdminEvents, AdminVehicles, AdminMembers } from "@/pages/admin/content";
import { AdminPages, AdminMedia, AdminUsers } from "@/pages/admin/manage";

function AppRouter() {
  return (
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
      <Route path="/intern/seiten" component={AdminPages} />
      <Route path="/intern/medien" component={AdminMedia} />
      <Route path="/intern/benutzer" component={AdminUsers} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
