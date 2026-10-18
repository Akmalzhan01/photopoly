import type { Metadata } from "next";
import { requireUser } from "@/lib/server/dal";
import { Eyebrow } from "@/components/site/ui";
import { ConvertStudio } from "@/components/convert/ConvertStudio";

export const metadata: Metadata = { title: "HEIC в JPG и сжатие фото — photopoly" };

/**
 * Conversion and compression. Not counted as exports: it is housekeeping a
 * shop does on a customer's phone photos before the real work, often dozens
 * at a time, and metering it per file would spend an allowance on nothing.
 */
export default async function ConvertPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <Eyebrow>Конвертер</Eyebrow>
      <h1 className="mt-2 text-[clamp(30px,4.5vw,42px)] leading-[1.05] font-bold tracking-tight text-chalk">
        HEIC в JPG и сжатие фото
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ash">
        Фото с iPhone (HEIC) превращаются в обычные JPG, тяжёлые снимки —
        в лёгкие. Можно сразу несколько файлов и скачать всё одним архивом.
      </p>

      <div className="mt-10">
        <ConvertStudio />
      </div>
    </div>
  );
}
