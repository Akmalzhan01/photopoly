/**
 * Printing at a guaranteed physical size.
 *
 * Downloading a PNG and printing it leaves the scale up to whatever the print
 * dialog feels like doing. Instead we hand the browser a page whose `@page size`
 * is the exact millimetre dimensions of the result, with an image sized in
 * millimetres to match — so 10 × 15 cm comes out of the printer at 10 × 15 cm.
 */

const STYLE_ID = "photopoly-print-style";
const SHEET_ID = "photopoly-print-sheet";

function buildStyle(widthMm: number, heightMm: number): HTMLStyleElement {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    #${SHEET_ID} { display: none; }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      /* Hide the app itself, and the page-wide film grain overlay. */
      body > *:not(#${SHEET_ID}) { display: none !important; }
      body::after { display: none !important; }
      #${SHEET_ID} {
        display: block !important;
        position: absolute;
        top: 0;
        left: 0;
      }
      #${SHEET_ID} img {
        display: block;
        width: ${widthMm}mm;
        height: ${heightMm}mm;
      }
    }
  `;
  return style;
}

/**
 * Opens the print dialog for `blob`, laid out at exactly `widthMm` × `heightMm`.
 * Resolves once the dialog has been dismissed and the scaffolding is cleaned up.
 */
export async function printAtSize(
  blob: Blob,
  widthMm: number,
  heightMm: number,
): Promise<void> {
  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(SHEET_ID)?.remove();

  const url = URL.createObjectURL(blob);
  const style = buildStyle(widthMm, heightMm);
  const holder = document.createElement("div");
  holder.id = SHEET_ID;

  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  holder.append(image);
  document.body.append(style, holder);

  const cleanUp = () => {
    style.remove();
    holder.remove();
    URL.revokeObjectURL(url);
  };

  try {
    // Chrome prints a blank page if the image has not decoded yet.
    await image.decode();
  } catch {
    cleanUp();
    throw new Error("Не удалось подготовить изображение к печати.");
  }

  await new Promise<void>((resolve) => {
    // `afterprint` is the reliable signal; the timeout covers browsers that
    // never fire it, so the scaffolding can't be left behind.
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("afterprint", done);
      clearTimeout(fallback);
      cleanUp();
      resolve();
    };
    const fallback = setTimeout(done, 60_000);
    window.addEventListener("afterprint", done);
    window.print();
    // Blocking implementations return here only once the dialog is closed.
    setTimeout(done, 500);
  });
}
