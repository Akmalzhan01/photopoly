import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/site/ui";
import { pageMetadata } from "@/lib/site";
import { ToolInfo } from "@/components/site/ToolInfo";
import { UpscaleStudio } from "@/components/upscale/UpscaleStudio";

const TITLE = "Увеличить фото без потери качества онлайн ×2 ×4 — photopoly";
const DESCRIPTION =
  "Увеличьте фото в 2 или 4 раза нейросетью Real-ESRGAN: резкие края, без размытия и квадратов от сжатия. Бесплатно, прямо в браузере, без загрузки на сервер.";

export const metadata: Metadata = pageMetadata("/kattalashtirish", TITLE, DESCRIPTION);

/**
 * The neural upscaler. Open to visitors; the work runs on their own GPU or
 * CPU, and a download is a reduced copy until they sign up.
 */
export default function UpscalePage() {
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
        <Link href="/studio" className="text-safe-soft underline-offset-2 hover:underline">
          редактор
        </Link>{" "}
        — он улучшает снимок без нейросети.
      </p>

      <ToolInfo
        path="/kattalashtirish"
        name="Увеличить фото — photopoly"
        description={DESCRIPTION}
        steps={[
          { title: "Загрузите фото", body: "Маленькое фото из мессенджера, старый снимок или картинку до 2 мегапикселей." },
          { title: "Выберите ×2 или ×4", body: "Нейросеть дорисует детали: края станут резкими, квадраты от сжатия исчезнут." },
          { title: "Сравните и скачайте", body: "Ползунок «до и после» показывает разницу один к одному. Скачайте JPG или PNG." },
        ]}
        faq={[
          { q: "Чем это лучше обычного увеличения?", a: "Обычное увеличение просто растягивает пиксели, и фото становится мыльным. Нейросеть Real-ESRGAN обучена восстанавливать резкие края и текстуру, поэтому результат выглядит чётким." },
          { q: "Это бесплатно?", a: "Да. Без регистрации можно скачать результат до 1000 пикселей по длинной стороне, после бесплатной регистрации — в полном размере в рамках бесплатного лимита." },
          { q: "Моё фото загружается на сервер?", a: "Нет. Нейросеть работает в браузере на вашей видеокарте или процессоре, фото не покидает устройство." },
          { q: "Какой максимальный размер?", a: "Исходное фото — до 2 мегапикселей, результат — до 6000 пикселей по длинной стороне. Если ×4 выходит за предел, выберите ×2." },
          { q: "Можно ли увеличивать фото на паспорт?", a: "Не рекомендуем: нейросеть дорисовывает детали, и лицо может немного измениться. Для документов используйте редактор — он улучшает фото без нейросети." },
        ]}
      />
    </div>
  );
}
