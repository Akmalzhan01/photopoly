import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/server/dal";
import { Eyebrow } from "@/components/site/ui";
import { UpscaleStudio } from "@/components/upscale/UpscaleStudio";

export const metadata: Metadata = { title: "Увеличить фото — photopoly" };

/**
 * The neural upscaler. Gated like the quality page and for the same reason:
 * the download is an export. The work itself costs the server nothing — it
 * runs on the visitor's own GPU or CPU.
 */
export default async function UpscalePage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <Eyebrow>Увеличение</Eyebrow>
      <h1 className="mt-2 text-[clamp(30px,4.5vw,42px)] leading-[1.05] font-bold tracking-tight text-chalk">
        Увеличить фото без потери качества
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ash">
        Нейросеть Real-ESRGAN увеличивает снимок в 2 или 4 раза и восстанавливает
        резкость: убирает размытие и квадраты от сжатия. Подходит для мелких фото из
        мессенджеров, старых снимков и картинок для печати.
      </p>

      <div className="mt-10">
        <UpscaleStudio />
      </div>

      <p className="mt-10 max-w-2xl text-[13px] leading-relaxed text-dust">
        Нужно фото на документы? Лицо там менять нельзя, поэтому для него есть{" "}
        <Link href="/sifat" className="text-safe-soft underline-offset-2 hover:underline">
          улучшение без нейросети
        </Link>{" "}
        и{" "}
        <Link href="/studio" className="text-safe-soft underline-offset-2 hover:underline">
          редактор
        </Link>
        .
      </p>
    </div>
  );
}
