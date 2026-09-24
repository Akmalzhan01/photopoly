import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/server/dal";
import { Eyebrow } from "@/components/site/ui";
import { BoxStudio } from "@/components/box/BoxStudio";

export const metadata: Metadata = { title: "Коробки — photopoly" };

/**
 * Renders nothing about the account beyond the gate.
 *
 * A dieline is arithmetic: the same three numbers give the same blank for
 * everyone, so there is nothing to look up and nothing to store. The whole page
 * runs in the browser once it arrives.
 */
export default async function BoxPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">04</span>
        <Eyebrow>Коробки</Eyebrow>
      </div>
      <h1 className="font-display text-[clamp(30px,4.5vw,42px)] leading-[1.05] text-chalk">
        Чертёж коробки
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ash">
        Размеры коробки — развёртка с размерами и файл для типографии. Считается
        по толщине материала, поэтому коробка закрывается, а не оказывается
        тесной на миллиметр.
      </p>

      <div className="mt-10">
        <BoxStudio />
      </div>

      <p className="mt-10 max-w-2xl text-[12px] leading-relaxed text-dust">
        Работу можно завести в{" "}
        <Link href="/zakazlar/yangi" className="text-safe-soft underline-offset-2 hover:underline">
          заказы
        </Link>{" "}
        как «Коробки и упаковка» — тогда она пройдёт через тот же список и ту же
        кассу, что и печать.
      </p>
    </div>
  );
}
