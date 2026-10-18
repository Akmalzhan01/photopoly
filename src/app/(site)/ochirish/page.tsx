import type { Metadata } from "next";
import { Eyebrow } from "@/components/site/ui";
import { pageMetadata } from "@/lib/site";
import { ToolInfo } from "@/components/site/ToolInfo";
import { EraserStudio } from "@/components/eraser/EraserStudio";

const TITLE = "Удалить лишнее с фото онлайн — ластик для фото бесплатно — photopoly";
const DESCRIPTION =
  "Уберите с фотографии прохожих, провода, надписи и пятна: закрасьте их кистью, и нейросеть дорисует фон. Бесплатно, прямо в браузере, без загрузки на сервер.";

export const metadata: Metadata = pageMetadata("/ochirish", TITLE, DESCRIPTION);

/**
 * The magic eraser. Open to visitors; the work runs on their own GPU or CPU,
 * and a download is a reduced copy until they sign up.
 */
export default function EraserPage() {
  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <Eyebrow>Ластик</Eyebrow>
      <h1 className="mt-2 text-[clamp(30px,4.5vw,42px)] leading-[1.05] font-bold tracking-tight text-chalk">
        Удалить лишнее с фото онлайн
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ash">
        Закрасьте прохожего, провод, надпись или пятно — нейросеть уберёт их и
        дорисует фон так, будто их там не было.
      </p>

      <div className="mt-10">
        <EraserStudio />
      </div>

      <ToolInfo
        path="/ochirish"
        name="Удалить лишнее с фото — photopoly"
        description={DESCRIPTION}
        steps={[
          { title: "Загрузите фото", body: "Перетащите снимок или выберите файл. Большие фото уменьшаются до 4000 пикселей для скорости." },
          { title: "Закрасьте лишнее", body: "Проведите кистью по предмету, который нужно убрать. Размер кисти настраивается." },
          { title: "Готово", body: "Как только вы отпустите кнопку, нейросеть сотрёт выделенное и дорисует фон. Можно повторять и отменять." },
        ]}
        faq={[
          { q: "Что можно удалить с фото?", a: "Лучше всего получается с небольшими и средними предметами: прохожие на заднем плане, провода, мусор, надписи, водяные знаки, пятна и царапины на старых снимках." },
          { q: "Это бесплатно?", a: "Да. Без регистрации можно скачать результат до 1000 пикселей по длинной стороне, после бесплатной регистрации — в полном размере в рамках бесплатного лимита." },
          { q: "Моё фото загружается на сервер?", a: "Нет. Нейросеть MI-GAN работает в вашем браузере: снимок не покидает устройство." },
          { q: "Получилось не идеально — что делать?", a: "Закрасьте это место ещё раз: каждый проход улучшает результат. Если стало хуже, нажмите «Отменить» или Ctrl+Z." },
          { q: "Почему первый раз дольше?", a: "При первом использовании браузер загружает нейросеть (около 30 МБ) и подготавливает её. Дальше она берётся из кэша, и стирание занимает около секунды." },
        ]}
      />
    </div>
  );
}
