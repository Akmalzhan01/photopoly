import type { Metadata } from "next";
import { Eyebrow } from "@/components/site/ui";
import { pageMetadata } from "@/lib/site";
import { ToolInfo } from "@/components/site/ToolInfo";
import { ConvertStudio } from "@/components/convert/ConvertStudio";

const TITLE = "HEIC в JPG онлайн и сжатие фото бесплатно — photopoly";
const DESCRIPTION =
  "Конвертируйте фото с iPhone из HEIC в JPG, PNG или WebP и уменьшите размер файлов. Сразу много файлов, скачивание архивом. Бесплатно, без регистрации и загрузки на сервер.";

export const metadata: Metadata = pageMetadata("/konvert", TITLE, DESCRIPTION);

/**
 * Conversion and compression, open to everyone and never counted as exports:
 * it is housekeeping on phone photos before the real work, often dozens at a
 * time, and it is what most often brings someone to a site like this.
 */
export default function ConvertPage() {
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

      <ToolInfo
        path="/konvert"
        name="HEIC в JPG и сжатие фото — photopoly"
        description={DESCRIPTION}
        steps={[
          { title: "Добавьте фото", body: "До 50 файлов за раз: HEIC и HEIF с iPhone, JPG, PNG, WebP." },
          { title: "Выберите формат и размер", body: "JPG, PNG или WebP, качество и максимальная длинная сторона — 3000, 2000 или 1280 пикселей." },
          { title: "Скачайте", body: "По одному файлу или всё сразу одним ZIP-архивом. Видно, сколько места сэкономлено." },
        ]}
        faq={[
          { q: "Что такое HEIC и почему его не открывает компьютер?", a: "HEIC — формат, в котором iPhone сохраняет фото по умолчанию. Он экономит место, но многие программы, принтеры и фотокиоски его не понимают. JPG открывается везде." },
          { q: "Это бесплатно и без регистрации?", a: "Да, конвертер полностью бесплатный и работает без регистрации, без ограничения размера." },
          { q: "Мои фото куда-то загружаются?", a: "Нет. Всё происходит в вашем браузере, файлы не покидают устройство." },
          { q: "Удаляется ли геолокация из фото?", a: "Да. При конвертации удаляются данные камеры и GPS-координаты, которые телефон записывает в каждый снимок. Поворот фото при этом сохраняется." },
          { q: "Какой формат выбрать?", a: "JPG — если фото нужно распечатать или отправить кому угодно. WebP — если важен самый маленький размер. PNG — если нужна прозрачность или сжатие без потерь." },
        ]}
      />
    </div>
  );
}
