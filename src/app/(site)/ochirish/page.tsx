import type { Metadata } from "next";
import { requireUser } from "@/lib/server/dal";
import { Eyebrow } from "@/components/site/ui";
import { EraserStudio } from "@/components/eraser/EraserStudio";

export const metadata: Metadata = { title: "Удалить объект с фото — photopoly" };

/**
 * The magic eraser. Gated and metered like the other tools; the work runs on
 * the visitor's own GPU or CPU.
 */
export default async function EraserPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <Eyebrow>Ластик</Eyebrow>
      <h1 className="mt-2 text-[clamp(30px,4.5vw,42px)] leading-[1.05] font-bold tracking-tight text-chalk">
        Удалить лишнее с фото
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ash">
        Закрасьте прохожего, провод, надпись или пятно — нейросеть уберёт их и
        дорисует фон так, будто их там не было.
      </p>

      <div className="mt-10">
        <EraserStudio />
      </div>
    </div>
  );
}
