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

/**
 * Bereinigt gespeichertes HTML vor der Anzeige:
 * 1. rewriteContent() passt /uploads/-Pfade für das Deployment hinter einem Proxy an.
 * 2. DOMPurify entfernt potenziell gefährliche Inhalte (Scripts, Event-Handler, …)
 *    und schützt so vor XSS – auch bei migrierten WordPress-Inhalten.
 *    Video-Einbettungen von YouTube/Vimeo bleiben erhalten.
 *
 * Das Ergebnis ist für die Verwendung mit dangerouslySetInnerHTML gedacht.
 */
export function cleanHtml(html: string | null | undefined): string {
  if (!html) return "";
  const rewritten = rewriteContent(html);
  return DOMPurify.sanitize(rewritten, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["target", "rel", "allow", "allowfullscreen", "frameborder", "loading"],
  });
}
