"use client";

import { uploadAttire } from "@/app/actions/attire";
import { Button } from "@/components/site/ui";
import { ActionForm } from "./ActionForm";

const input =
  "border border-line bg-pit px-3 py-2 font-mono text-sm text-chalk outline-none transition-colors focus:border-safe/50";

export function AttireUpload() {
  return (
    <div className="border border-line bg-slab p-5">
      <ActionForm action={uploadAttire} className="flex flex-wrap items-end gap-3">
        {(pending) => (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">
                Название
              </span>
              <input
                type="text"
                name="name"
                required
                maxLength={60}
                placeholder="Чёрный костюм"
                aria-label="Название костюма"
                className={`w-52 ${input}`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">
                Файл PNG
              </span>
              <input
                type="file"
                name="file"
                required
                accept="image/png"
                aria-label="Файл костюма"
                className={`w-72 file:mr-3 file:border-0 file:bg-riser file:px-2.5 file:py-1 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.14em] file:text-chalk ${input}`}
              />
            </label>

            <Button type="submit" tone="ghost" disabled={pending}>
              {pending ? "Загрузка…" : "Загрузить"}
            </Button>

            <p className="w-full max-w-2xl font-mono text-[10px] leading-relaxed text-dust">
              PNG должен быть с прозрачным фоном — если фон белый, на фото
              появится прямоугольник. Линия плеч должна касаться верхнего края
              изображения; размер и положение настраиваются в редакторе.
              Максимум 4000 px и 4 МБ.
            </p>
          </>
        )}
      </ActionForm>
    </div>
  );
}
