import DOMPurify from "dompurify";
import { rewriteContent } from "@/lib/auth";

/**
 * Bereinigt gespeichertes HTML vor der Anzeige:
 * 1. rewriteContent() passt /uploads/-Pfade für das Deployment hinter einem Proxy an.
 * 2. DOMPurify entfernt potenziell gefährliche Inhalte (Scripts, Event-Handler, …)
 *    und schützt so vor XSS – auch bei migrierten WordPress-Inhalten.
 *
 * Das Ergebnis ist für die Verwendung mit dangerouslySetInnerHTML gedacht.
 */
export function cleanHtml(html: string | null | undefined): string {
  if (!html) return "";
  const rewritten = rewriteContent(html);
  return DOMPurify.sanitize(rewritten, {
    ADD_ATTR: ["target", "rel"],
  });
}
