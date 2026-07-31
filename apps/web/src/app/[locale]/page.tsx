import {
  ArrowRight,
  BrainCircuit,
  Check,
  Clock3,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingFooter } from "@/components/shell/marketing-footer";
import { MarketingHeader } from "@/components/shell/marketing-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isLocale } from "@/i18n/config";
import { getSiteCopy } from "@/i18n/site-copy";
import { cn } from "@/lib/utils";

interface LandingPageProps {
  readonly params: Promise<{ locale: string }>;
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const copy = getSiteCopy(locale);
  const isBangla = locale === "bn-BD";

  const features = [
    { icon: Clock3, title: copy.focusTitle, body: copy.focusBody },
    { icon: Target, title: copy.planTitle, body: copy.planBody },
    { icon: BrainCircuit, title: copy.coachTitle, body: copy.coachBody },
  ] as const;

  return (
    <div
      className={cn(
        "min-h-svh overflow-hidden",
        isBangla && "focused-bangla-copy",
      )}
    >
      <MarketingHeader locale={locale} copy={copy} />
      <main id="main-content">
        <section className="relative isolate">
          <div
            className="page-grid pointer-events-none absolute inset-0 -z-20"
            aria-hidden="true"
          />
          <div
            className="bg-primary/12 pointer-events-none absolute top-12 left-1/2 -z-10 size-[28rem] -translate-x-1/2 rounded-full blur-3xl sm:size-[38rem]"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-32">
            <div className="max-w-3xl">
              <p className="border-primary/20 bg-primary/8 mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-[var(--primary-text)]">
                <Sparkles className="size-4" aria-hidden="true" />
                {copy.eyebrow}
              </p>
              <h1 className="text-4xl font-bold tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                {copy.title}
              </h1>
              <p className="text-muted-foreground mt-7 max-w-2xl text-base leading-8 text-balance sm:text-lg sm:leading-9">
                {copy.subtitle}
              </p>
              <div id="start" className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/${locale}#features`}
                  className={buttonVariants({
                    variant: "primary",
                    size: "large",
                  })}
                >
                  {copy.primaryAction}
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link
                  href={`/${locale}#principles`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "large",
                  })}
                >
                  {copy.secondaryAction}
                </Link>
              </div>
              <p className="text-muted-foreground mt-6 flex max-w-xl items-start gap-2 text-sm leading-6">
                <ShieldCheck
                  className="text-success mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {copy.privacyNote}
              </p>
            </div>

            <div
              className="relative mx-auto w-full max-w-lg"
              aria-label={copy.previewLabel}
            >
              <div
                className="focused-brand-gradient absolute -inset-1 -z-10 rounded-[1.75rem] opacity-25 blur-xl"
                aria-hidden="true"
              />
              <Card className="focused-glass-strong overflow-hidden rounded-[1.5rem] border-white/20 p-2">
                <CardHeader className="p-5 pb-3 sm:p-7 sm:pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-[var(--primary-text)]">
                      {copy.previewLabel}
                    </p>
                    <span className="bg-success/12 text-success rounded-full px-3 py-1 text-xs font-semibold">
                      01
                    </span>
                  </div>
                  <CardTitle className="text-2xl text-balance sm:text-3xl">
                    {copy.previewTitle}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {copy.previewTime}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-3 sm:p-7 sm:pt-4">
                  <div
                    className="bg-muted mb-7 h-2 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-label={copy.previewLabel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={60}
                  >
                    <div className="focused-brand-gradient h-full w-3/5 rounded-full" />
                  </div>
                  <div className="border-border bg-card/75 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border p-4">
                    <span className="focused-brand-gradient text-primary-foreground grid size-12 place-items-center rounded-xl shadow-[var(--shadow-brand)]">
                      <Clock3 className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold">{copy.previewAction}</p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        50:00
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="border-border bg-card/40 border-y py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold tracking-[-0.035em] text-balance sm:text-4xl">
                {copy.featureHeading}
              </h2>
              <p className="text-muted-foreground mt-5 text-base leading-8 sm:text-lg">
                {copy.featureIntro}
              </p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="group transition-transform duration-240 hover:-translate-y-1 motion-reduce:transform-none"
                >
                  <CardHeader>
                    <span className="bg-secondary text-accent group-hover:bg-primary group-hover:text-primary-foreground mb-3 grid size-11 place-items-center rounded-xl transition-colors">
                      <feature.icon aria-hidden="true" />
                    </span>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-[0.9375rem] leading-7">
                      {feature.body}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="principles" className="py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
            <div>
              <p className="mb-4 text-sm font-bold tracking-[0.16em] text-[var(--primary-text)] uppercase">
                FocusOS
              </p>
              <h2 className="text-3xl font-bold tracking-[-0.035em] text-balance sm:text-4xl">
                {copy.principleHeading}
              </h2>
              <p className="text-muted-foreground mt-6 text-base leading-8 sm:text-lg">
                {copy.principleBody}
              </p>
            </div>
            <ul className="space-y-4" aria-label={copy.principles}>
              {[copy.principleOne, copy.principleTwo, copy.principleThree].map(
                (principle) => (
                  <li
                    key={principle}
                    className="border-border bg-card flex items-center gap-4 rounded-2xl border p-5 shadow-[var(--shadow-xs)]"
                  >
                    <span className="bg-success/12 text-success grid size-8 shrink-0 place-items-center rounded-full">
                      <Check className="size-4" aria-hidden="true" />
                    </span>
                    <span className="font-semibold">{principle}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>
      </main>
      <MarketingFooter copy={copy} />
    </div>
  );
}
