import type { Metadata } from "next";
import { AuthForm } from "@/components/site/AuthForm";
import { Eyebrow, Notice, Panel } from "@/components/site/ui";

export const metadata: Metadata = { title: "Вход — photopoly" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ keyin?: string; sessiya?: string }>;
}) {
  const { keyin, sessiya } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md px-5 py-16">
      <div className="mb-6 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Вход в аккаунт</Eyebrow>
      </div>
      <h1 className="mb-8 font-display text-[34px] leading-[1.1] text-chalk">
        Рады видеть вас снова.
      </h1>
      {sessiya ? (
        <div className="mb-6">
          <Notice tone="warn">
            Сессия истекла. Войдите заново.
          </Notice>
        </div>
      ) : null}
      <Panel className="p-6">
        <AuthForm mode="login" next={keyin} />
      </Panel>
    </div>
  );
}
