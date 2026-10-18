import { SITE_NAME, SITE_URL } from "@/lib/site";

export type Faq = { q: string; a: string };

/**
 * Structured data for search engines, as the Next docs recommend: a plain
 * script tag, with `<` escaped so nothing in the text can close it early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/**
 * The part of a tool page written for people arriving from a search: how it
 * works, why it is safe, and the questions they would otherwise leave to ask.
 * Also tells search engines the page is a free web application with an FAQ.
 */
export function ToolInfo({
  path,
  name,
  description,
  steps,
  faq,
}: {
  path: string;
  name: string;
  description: string;
  steps: { title: string; body: string }[];
  faq: Faq[];
}) {
  const url = `${SITE_URL}${path}`;

  return (
    <>
      <section className="mt-20">
        <h2 className="text-[26px] font-bold tracking-tight text-chalk">Как это работает</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-line bg-slab p-5 shadow-card">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-safe/10 text-[14px] font-semibold text-safe-soft">
                {index + 1}
              </span>
              <h3 className="mt-3 text-[16px] font-semibold text-chalk">{step.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ash">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 max-w-3xl">
        <h2 className="text-[26px] font-bold tracking-tight text-chalk">Частые вопросы</h2>
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-slab">
          {faq.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-chalk">
                {item.q}
                <span aria-hidden className="text-dust transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-ash">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              name,
              url,
              description,
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Any (web browser)",
              inLanguage: "ru",
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "KGS" },
              publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
            },
            {
              "@type": "FAQPage",
              mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ],
        }}
      />
    </>
  );
}
