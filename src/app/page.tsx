import { SiteHeader } from "@/components/site-header";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { getI18n } from "@/i18n/server";

const icons = [
  "M8 2v3M16 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  "M3 7h18v10H3zM3 11h18M7 15h3",
  "M6 6l12 12M18 6 6 18",
  "M4 20V10M10 20V4M16 20v-7M22 20H2",
  "M3 5h12M9 3v2m1.5 9A18 18 0 0 1 6 7m7 11 4-9 4 9m-7-2h6",
];

export default async function Home() {
  const { t } = await getI18n();
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <Badge tone="brand">{t.landing.badge}</Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t.landing.heroTitle}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted text-pretty">{t.landing.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" className="px-5 py-3 text-base">
                {t.landing.ctaPrimary}
              </ButtonLink>
              <ButtonLink href="/b/studio-fade" variant="secondary" className="px-5 py-3 text-base">
                {t.landing.ctaDemo} →
              </ButtonLink>
            </div>
          </div>
          <HeroMock />
        </section>

        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">{t.landing.featuresTitle}</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.landing.features.map((f, i) => (
                <li key={f.title}>
                  <Card className="h-full">
                    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-brand" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d={icons[i]} />
                    </svg>
                    <h3 className="mt-3 font-medium">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted">{f.body}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{t.landing.howTitle}</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {t.landing.how.map((step, i) => (
              <li key={step} className="flex items-start gap-4 rounded-2xl border border-border p-5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-contrast">
                  {i + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="border-t border-border py-8 text-center text-sm text-muted">{t.landing.footer}</footer>
    </>
  );
}

function HeroMock() {
  const times = ["09:00", "09:30", "10:00", "11:30", "13:00", "13:30", "14:00", "15:30", "16:00"];
  return (
    <div aria-hidden className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-soft via-transparent to-accent/20 blur-2xl" />
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Studio Fade</p>
            <p className="font-semibold">Haircut + Beard · 45 min</p>
          </div>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-strong">$35</span>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-xs">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className={`rounded-lg py-2 ${i === 2 ? "bg-brand text-brand-contrast" : i > 5 ? "text-muted line-through" : "bg-surface-muted"}`}>
              <div>{d}</div>
              <div className="font-semibold">{12 + i}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {times.map((time, i) => (
            <div
              key={time}
              className={`rounded-lg border py-2 text-center text-sm ${i === 4 ? "border-brand bg-brand-soft font-semibold text-brand-strong" : "border-border"}`}
            >
              {time}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
