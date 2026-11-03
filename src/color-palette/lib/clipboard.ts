/**
 * Clipboard helpers with a graceful fallback.
 *
 * The modern async Clipboard API is preferred; when it is unavailable (older
 * browsers or insecure contexts) we fall back to the deprecated synchronous
 * `document.execCommand("copy")`. Either path returns a boolean so the UI can
 * show a friendly "Copy not available" state instead of crashing.
 */

export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }

  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  return false;
}
