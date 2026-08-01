import { useRef, useEffect, useState } from "react";
import { Bold, Italic, List, Heading2, Link2, ImagePlus, Loader2 } from "lucide-react";
import { useAuth, uploadFiles, withBase } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

/** Entfernt den Deployment-Prefix aus Bild-URLs, damit relative Pfade gespeichert werden. */
function normalizeHtml(html: string): string {
  if (!API_BASE) return html;
  return html.split(API_BASE).join("");
}

interface EditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/**
 * Einfacher, mobiltauglicher Rich-Text-Editor.
 * Fett, kursiv, Zwischenüberschrift, Liste, Link und Bild-Upload.
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 260 }: EditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { token } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Initialen Wert setzen (nur wenn sich der Inhalt von außen ändert)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      // Anzeigen mit absoluten Pfaden
      ref.current.innerHTML = value
        ? value.replace(/src="(\/uploads\/[^"]+)"/g, (_m, p) => `src="${withBase(p)}"`)
        : "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    if (ref.current) onChange(normalizeHtml(ref.current.innerHTML));
  };

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const addLink = () => {
    const url = window.prompt("Link-Adresse (https://…):");
    if (url) exec("createLink", url);
  };

  const addImage = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const created = await uploadFiles(token, files);
      ref.current?.focus();
      for (const m of created) {
        // Alt-Text aus dem Dateinamen ableiten (Endung/Trennzeichen entfernt) – für Barrierefreiheit
        const alt = String(m.title || "")
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/[_-]+/g, " ")
          .trim()
          .replace(/"/g, "&quot;");
        document.execCommand("insertHTML", false, `<img src="${withBase(m.url)}" alt="${alt}" /><p></p>`);
      }
      emit();
    } catch (err: any) {
      toast({ title: "Upload fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const btn = "rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground";

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/40 px-1.5 py-1">
        <button type="button" className={btn} onClick={() => exec("bold")} title="Fett" data-testid="button-editor-bold">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" className={btn} onClick={() => exec("italic")} title="Kursiv" data-testid="button-editor-italic">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" className={btn} onClick={() => exec("formatBlock", "<h3>")} title="Zwischenüberschrift" data-testid="button-editor-heading">
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button" className={btn} onClick={() => exec("insertUnorderedList")} title="Aufzählung" data-testid="button-editor-list">
          <List className="h-4 w-4" />
        </button>
        <button type="button" className={btn} onClick={addLink} title="Link einfügen" data-testid="button-editor-link">
          <Link2 className="h-4 w-4" />
        </button>
        <button
          type="button" className={btn} title="Bild hochladen & einfügen"
          onClick={() => fileRef.current?.click()} disabled={uploading}
          data-testid="button-editor-image"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </button>
        <input
          ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => addImage(e.target.files)}
        />
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? "Textinhalt bearbeiten"}
        data-placeholder={placeholder ?? "Text eingeben …"}
        onInput={emit}
        onBlur={emit}
        className="prose-content w-full px-4 py-3 text-sm outline-none"
        style={{ minHeight }}
        data-testid="editor-content"
      />
    </div>
  );
}
