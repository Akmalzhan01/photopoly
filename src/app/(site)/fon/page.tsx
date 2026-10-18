import type { Metadata } from "next";
import { requireUser } from "@/lib/server/dal";
import { Eyebrow } from "@/components/site/ui";
import { BackgroundStudio } from "@/components/background/BackgroundStudio";

export const metadata: Metadata = { title: "Убрать фон с фото — photopoly" };

/**
 * Background removal on its own, without the editor's sizes and sheets. The
 * same model as the editor's, running on the visitor's device; the download is
 * an export, like every other page's.
 */
export default async function BackgroundPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <Eyebrow>Фон</Eyebrow>
      <h1 className="mt-2 text-[clamp(30px,4.5vw,42px)] leading-[1.05] font-bold tracking-tight text-chalk">
        Убрать фон с фото
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ash">
        Нейросеть сама отделяет человека или предмет от фона. Оставьте фон
        прозрачным, залейте любым цветом или размойте — и скачайте готовый файл.
      </p>

      <div className="mt-10">
        <BackgroundStudio />
      </div>
    </div>
  );
}
