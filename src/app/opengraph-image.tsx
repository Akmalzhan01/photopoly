import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "photopoly — фото на документы и инструменты для фото онлайн";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The picture a link to the site unfolds into on Telegram, WhatsApp and the
 * rest. Rendered once at build time.
 *
 * The renderer's own font has no Cyrillic, so Onest is passed in. The Latin
 * and Cyrillic subsets go in as two families named in the font stack: given
 * one family, the renderer falls back for a missing glyph to the next font in
 * the list whatever its weight, and every Russian heading came out regular.
 */
export default async function OpenGraphImage() {
  const files = join(process.cwd(), "node_modules/@fontsource/onest/files");
  const face = (subset: "latin" | "cyrillic", weight: 400 | 700) =>
    readFile(join(files, `onest-${subset}-${weight}-normal.woff`)).then((data) => ({
      name: subset === "latin" ? "Onest" : "Onest Cyrillic",
      data,
      weight,
      style: "normal" as const,
    }));
  const fonts = await Promise.all([
    face("latin", 400),
    face("cyrillic", 400),
    face("latin", 700),
    face("cyrillic", 700),
  ]);

  const tools = ["Фото 3×4", "Убрать фон", "Удалить лишнее", "Увеличить ×4", "HEIC → JPG"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #f6f7f9 0%, #e8eefc 100%)",
          fontFamily: "Onest, Onest Cyrillic",
          color: "#0f1729",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            p
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>photopoly</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.08, maxWidth: 1056 }}>
            Фото на документы и инструменты для фото — онлайн
          </div>
          <div style={{ fontSize: 30, color: "#4a5466" }}>
            Бесплатно, прямо в браузере. Фото не уходят на сервер.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {tools.map((tool) => (
            <div
              key={tool}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                background: "white",
                border: "2px solid #dbe3f5",
                fontSize: 24,
                color: "#1d4ed8",
              }}
            >
              {tool}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
