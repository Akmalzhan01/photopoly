import type { Metadata } from "next";
import { Eyebrow } from "@/components/site/ui";
import { pageMetadata } from "@/lib/site";
import { ToolInfo } from "@/components/site/ToolInfo";
import { BackgroundStudio } from "@/components/background/BackgroundStudio";

const TITLE = "Убрать фон с фото онлайн бесплатно — photopoly";
const DESCRIPTION =
  "Удалите фон с фотографии за пару секунд: прозрачный PNG, белый или цветной фон, размытие. Работает в браузере, фото не загружается на сервер. Без регистрации.";

export const metadata: Metadata = pageMetadata("/fon", TITLE, DESCRIPTION);

/**
 * Background removal on its own, without the editor's sizes and sheets. Open
 * to visitors: the same model as the editor's runs on their device, and a
 * download is a reduced copy until they sign up.
 */
export default function BackgroundPage() {
  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <Eyebrow>Фон</Eyebrow>
      <h1 className="mt-2 text-[clamp(30px,4.5vw,42px)] leading-[1.05] font-bold tracking-tight text-chalk">
        Убрать фон с фото онлайн
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ash">
        Нейросеть сама отделяет человека или предмет от фона. Оставьте фон
        прозрачным, залейте любым цветом или размойте — и скачайте готовый файл.
        Бесплатно и без загрузки фото на сервер.
      </p>

      <div className="mt-10">
        <BackgroundStudio />
      </div>

      <ToolInfo
        path="/fon"
        name="Убрать фон с фото — photopoly"
        description={DESCRIPTION}
        steps={[
          { title: "Загрузите фото", body: "Перетащите снимок или выберите файл: JPG, PNG или WebP. Подойдёт фото с телефона." },
          { title: "Фон уходит сам", body: "Нейросеть находит человека или предмет и убирает всё вокруг. Края можно поправить кистью." },
          { title: "Выберите новый фон", body: "Прозрачный для PNG, белый для документов, любой цвет или мягкое размытие — и скачайте." },
        ]}
        faq={[
          { q: "Это бесплатно?", a: "Да. Без регистрации можно скачать результат до 1000 пикселей по длинной стороне. После бесплатной регистрации доступен полный размер в рамках бесплатного лимита." },
          { q: "Куда загружается моё фото?", a: "Никуда. Нейросеть работает прямо в вашем браузере, снимок не покидает устройство и не сохраняется на наших серверах." },
          { q: "Как сделать прозрачный фон?", a: "Выберите прозрачный фон (клетчатый квадрат) — файл сохранится в PNG с прозрачностью. Его можно вставить в документ, презентацию или на сайт." },
          { q: "Можно ли сделать белый фон для документов?", a: "Да, выберите белый цвет. Для фото на паспорт или визу с точным размером 3×4 или 3,5×4,5 воспользуйтесь редактором — там фон убирается так же, а кадр подгоняется под требования." },
          { q: "Что делать, если нейросеть ошиблась на краях?", a: "Нажмите «Поправить края кистью»: режим «Стереть» убирает остатки фона, «Вернуть» восстанавливает срезанные волосы или плечи." },
        ]}
      />
    </div>
  );
}
