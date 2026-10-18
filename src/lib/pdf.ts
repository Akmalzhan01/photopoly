/**
 * The smallest PDF writer that does the job: one JPEG per A4 page.
 *
 * A JPEG can go into a PDF as it is — the format's DCTDecode filter is the
 * JPEG codec — so nothing is re-encoded and no library is needed. Each image
 * is fitted inside the page, centred, in the page's orientation.
 */

export type PdfPage = { jpeg: Uint8Array; width: number; height: number };

/** A4 in points. */
const A4 = { w: 595.28, h: 841.89 };

const encoder = new TextEncoder();

export function makePdf(pages: PdfPage[]): Blob {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const write = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: () => void) => {
    offsets[id] = length;
    write(`${id} 0 obj\n`);
    body();
    write("\nendobj\n");
  };

  // The binary comment tells transfer tools the file is not plain text.
  write("%PDF-1.4\n%âãÏÓ\n");

  // 1: catalog, 2: page tree, then three objects per page.
  const pageIds = pages.map((_, i) => 3 + i * 3);
  object(1, () => write("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () => write(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`));

  pages.forEach((page, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const landscape = page.width > page.height;
    const pw = landscape ? A4.h : A4.w;
    const ph = landscape ? A4.w : A4.h;
    const scale = Math.min(pw / page.width, ph / page.height);
    const dw = page.width * scale;
    const dh = page.height * scale;
    const dx = (pw - dw) / 2;
    const dy = (ph - dh) / 2;
    const draw = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Im0 Do Q`;

    object(pageId, () =>
      write(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] ` +
          `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
    object(contentId, () => write(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    object(imageId, () => {
      write(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      );
      write(page.jpeg);
      write("\nendstream");
    });
  });

  const count = 3 + pages.length * 3;
  const xref = length;
  write(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) write(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  write(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
