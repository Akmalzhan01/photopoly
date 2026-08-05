"use client";

import { deleteAttire, renameAttire, setAttireActive } from "@/app/actions/attire";
import { Button } from "@/components/site/ui";
import { ActionForm } from "./ActionForm";

export type AttireRowData = {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  active: boolean;
};

/** A light chequerboard, so transparent areas read as transparent rather than dark. */
const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, #2a2c31 25%, transparent 25%), linear-gradient(-45deg, #2a2c31 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2c31 75%), linear-gradient(-45deg, transparent 75%, #2a2c31 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
  backgroundColor: "#3a3d43",
};

export function AttireRow({ asset }: { asset: AttireRowData }) {
  return (
    <div className="flex flex-wrap items-center gap-4 bg-slab p-4">
      <div
        className="flex h-20 w-20 shrink-0 items-center justify-center border border-line"
        style={CHECKER}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a Storage URL on an
            admin-only page; the Image loader would add a proxy hop for no gain. */}
        <img
          src={asset.url}
          alt={asset.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="min-w-[180px] flex-1">
        <ActionForm action={renameAttire} fields={{ id: asset.id }} className="flex gap-2">
          {(pending) => (
            <>
              <input
                type="text"
                name="name"
                defaultValue={asset.name}
                maxLength={60}
                aria-label={`Название: ${asset.name}`}
                className="min-w-0 flex-1 border border-line bg-pit px-2.5 py-1.5 font-mono text-[12px] text-chalk outline-none transition-colors focus:border-safe/50"
              />
              <Button type="submit" tone="ghost" disabled={pending}>
                {pending ? "…" : "Сохранить"}
              </Button>
            </>
          )}
        </ActionForm>
        <p className="mt-1.5 font-mono text-[10px] text-dust tabular-nums">
          {asset.width}×{asset.height} · {(asset.bytes / 1024).toFixed(0)} KB
          {asset.active ? "" : " · скрыт"}
        </p>
      </div>

      <ActionForm
        action={setAttireActive}
        fields={{ id: asset.id, active: asset.active ? "0" : "1" }}
      >
        {(pending) => (
          <Button type="submit" tone="ghost" disabled={pending}>
            {asset.active ? "Скрыть" : "Показать"}
          </Button>
        )}
      </ActionForm>

      <ActionForm
        action={deleteAttire}
        fields={{ id: asset.id }}
        confirm={`Удалить «${asset.name}» навсегда? Отменить будет нельзя.`}
      >
        {(pending) => (
          <Button type="submit" tone="ghost" disabled={pending}>
            {pending ? "…" : "Удалить"}
          </Button>
        )}
      </ActionForm>
    </div>
  );
}
