import { useEffect } from "react";

const SITE_NAME = "Freiwillige Feuerwehr Kirchberg";
const DEFAULT_TITLE = `${SITE_NAME} – im Erdinger Holzland`;

/**
 * Setzt den Dokumenttitel (Browser-Tab, Lesezeichen, Suchmaschinen) je Seite.
 * Ohne Argument wird der Standardtitel verwendet.
 */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} – ${SITE_NAME}` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
