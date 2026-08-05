import type { Metadata } from "next";
import { AuthForm } from "@/components/site/AuthForm";
import { Eyebrow, Panel } from "@/components/site/ui";
import { getFreeExportLimit } from "@/lib/server/settings-store";

export const metadata: Metadata = { title: "Регистрация — photopoly" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ keyin?: string }>;
}) {
  const [{ keyin }, free] = await Promise.all([searchParams, getFreeExportLimit()]);

  return (
    <div className="mx-auto w-full max-w-md px-5 py-16">
      <div className="mb-6 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Новый аккаунт</Eyebrow>
      </div>
      <h1 className="mb-3 font-display text-[34px] leading-[1.1] text-chalk">
        {free > 0 ? (
          <>
            Сначала попробуйте
            <br />
            {free} фото бесплатно.
          </>
        ) : (
          "Создать аккаунт"
        )}
      </h1>
      <p className="mb-8 text-[13px] leading-relaxed text-ash">
        Данные карты не запрашиваем. Ваши фотографии не покидают браузер.
      </p>
      <Panel className="p-6">
        <AuthForm mode="signup" next={keyin} />
      </Panel>
    </div>
  );
}
