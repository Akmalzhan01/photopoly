import type { Metadata } from "next";
import { Eyebrow } from "@/components/site/ui";
import { pageMetadata } from "@/lib/site";
import { ToolInfo } from "@/components/site/ToolInfo";
import { ScannerStudio } from "@/components/scanner/ScannerStudio";

const TITLE = "Сканер документов онлайн — фото в PDF бесплатно — photopoly";
const DESCRIPTION =
  "Сделайте из фото документа ровный скан: выравнивание по углам, белая бумага без теней, чёрно-белый режим и PDF из нескольких страниц. Бесплатно, без регистрации, без загрузки на сервер.";

export const metadata: Metadata = pageMetadata("/skaner", TITLE, DESCRIPTION);

/**
 * The document scanner. Open to everyone and not counted as exports: it runs
 * on the visitor's device and costs nothing, and a scan to PDF is exactly the
 * errand that brings people to a site like this.
 */
export default function ScannerPage() {
  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <Eyebrow>Сканер</Eyebrow>
      <h1 className="mt-2 text-[clamp(30px,4.5vw,42px)] leading-[1.05] font-bold tracking-tight text-chalk">
        Сканер документов онлайн
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ash">
        Сфотографируйте паспорт, справку или договор на телефон — лист выровняется
        по углам, бумага станет белой, а страницы соберутся в один PDF.
      </p>

      <div className="mt-10">
        <ScannerStudio />
      </div>

      <ToolInfo
        path="/skaner"
        name="Сканер документов — photopoly"
        description={DESCRIPTION}
        steps={[
          { title: "Добавьте фото страниц", body: "Снимки с телефона, можно сразу несколько. Подходят JPG, PNG и HEIC с iPhone." },
          { title: "Проверьте углы", body: "Лист находится автоматически. Если рамка легла неточно, перетащите углы на края бумаги." },
          { title: "Скачайте PDF", body: "Выберите режим — скан, чёрно-белый или серый — и сохраните все страницы одним PDF." },
        ]}
        faq={[
          { q: "Это бесплатно?", a: "Да, сканер полностью бесплатный и работает без регистрации и без ограничений на количество документов." },
          { q: "Куда загружаются мои документы?", a: "Никуда. Фото обрабатываются прямо в браузере и не покидают устройство — это важно для паспортов и личных справок." },
          { q: "Как сделать из нескольких фото один PDF?", a: "Добавьте все страницы, расставьте их по порядку стрелками под миниатюрами и нажмите «Скачать PDF». Каждая страница ляжет на лист A4." },
          { q: "Как убрать тень и желтизну с фото документа?", a: "Режим «Скан» выравнивает освещение: бумага становится белой, тень от телефона и тёплый свет лампы исчезают, текст остаётся чётким." },
          { q: "Лист нашёлся неправильно — что делать?", a: "Перетащите углы рамки на края листа вручную или нажмите «Весь кадр». Лучше всего лист находится, если снимать его на тёмном столе." },
        ]}
      />
    </div>
  );
}
