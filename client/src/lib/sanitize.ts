import DOMPurify from "dompurify";
import { rewriteContent } from "@/lib/auth";

// Nur diese Hosts dürfen als <iframe> eingebettet werden (Videos in Beiträgen).
const ALLOWED_IFRAME_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
];

function isAllowedIframeSrc(src: string): boolean {
  try {
    // Protokoll-relative URLs ("//www.youtube.com/…") kommen aus alten WordPress-Inhalten
    const url = new URL(src, "https://www.ff-kirchberg.de");
    return (url.protocol === "https:" || url.protocol === "http:") && ALLOWED_IFRAME_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

// Iframes grundsätzlich zulassen, aber nur mit erlaubter Video-Quelle behalten
DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "iframe") {
    const src = (node as Element).getAttribute?.("src") ?? "";
    if (!isAllowedIframeSrc(src)) {
      node.parentNode?.removeChild(node);
    }
  }
});

// Wird pro cleanHtml()-Aufruf gesetzt (DOMPurify-Hooks kennen keine eigenen Optionen)
let linksNewTab = true;

// Links in Inhalten je nach Website-Einstellung in neuem Tab öffnen
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && linksNewTab && (node as Element).getAttribute("href")) {
    (node as Element).setAttribute("target", "_blank");
    (node as Element).setAttribute("rel", "noopener noreferrer");
  }
});

export interface CleanHtmlOptions {
  /** Links in neuem Tab öffnen (Website-Einstellung, Standard: an) */
  linksNewTab?: boolean;
}

/**
 * Bereinigt gespeichertes HTML vor der Anzeige:
 * 1. rewriteContent() passt /uploads/- und /dateien/-Pfade für das Deployment hinter einem Proxy an.
 * 2. DOMPurify entfernt potenziell gefährliche Inhalte (Scripts, Event-Handler, …)
 *    und schützt so vor XSS – auch bei migrierten WordPress-Inhalten.
 *    Video-Einbettungen von YouTube/Vimeo bleiben erhalten.
 * 3. Links erhalten je nach Website-Einstellung target="_blank" (Standard: an).
 *
 * Das Ergebnis ist für die Verwendung mit dangerouslySetInnerHTML gedacht.
 */
export function cleanHtml(html: string | null | undefined, opts?: CleanHtmlOptions): string {
  if (!html) return "";
  linksNewTab = opts?.linksNewTab ?? true;
  const rewritten = rewriteContent(html);
  return DOMPurify.sanitize(rewritten, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["target", "rel", "allow", "allowfullscreen", "frameborder", "loading"],
  });
}
