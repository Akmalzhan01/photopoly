import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/dal";
import { ATTIRE_BUCKET, getStorageConfig } from "@/lib/server/storage";
import { Eyebrow, Notice, Panel } from "@/components/site/ui";
import { AttireUpload } from "@/components/admin/AttireUpload";
import { AttireRow } from "@/components/admin/AttireRow";

export default async function AttirePage() {
  await requireAdmin();

  const [assets, storage] = await Promise.all([
    db.attireAsset.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        url: true,
        width: true,
        height: true,
        bytes: true,
        active: true,
      },
    }),
    Promise.resolve(getStorageConfig()),
  ]);

  return (
    <>
      <div className="mb-6 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Костюмы</Eyebrow>
      </div>

      {!storage ? (
        <div className="mb-6">
          <Notice tone="warn">
            Supabase Storage не настроен, поэтому загрузка не работает.{" "}
            <code className="font-mono text-chalk">SUPABASE_URL</code> va{" "}
            <code className="font-mono text-chalk">SUPABASE_SERVICE_ROLE_KEY</code> в{" "}
            <code className="font-mono text-chalk">.env</code>, а в панели Supabase
            создайте <strong>public</strong>-bucket с именем{" "}
            <code className="font-mono text-chalk">{ATTIRE_BUCKET}</code>.
          </Notice>
        </div>
      ) : (
        <div className="mb-6">
          <Notice>
            Загруженные сюда костюмы видны всем в редакторе. Выбора цвета
            нет — изображение рисуется как есть, поэтому цвет решайте в самом
            файле. Если ничего не загружено, раздел одежды в редакторе пуст.
          </Notice>
        </div>
      )}

      <AttireUpload />

      <section className="mt-10">
        <div className="mb-4 flex items-baseline gap-2.5">
          <span className="font-mono text-[10px] text-ember">02</span>
          <Eyebrow>Загруженные</Eyebrow>
        </div>

        {assets.length === 0 ? (
          <Panel className="p-6">
            <p className="text-[13px] text-ash">
              Костюмы пока не загружены, поэтому в редакторе нечего выбирать.
            </p>
          </Panel>
        ) : (
          <div className="flex flex-col gap-px bg-line">
            {assets.map((asset) => (
              <AttireRow key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
