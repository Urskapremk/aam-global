import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Contact } from '@/components/contact'
import { BUSINESSES, type Business } from '@/lib/businesses'
import {
  ExcursionsSection,
  type PublicExcursion,
} from '@/components/excursions-section'

export function DivisionPage({
  business,
  excursions = [],
}: {
  business: Business
  excursions?: PublicExcursion[]
}) {
  const others = BUSINESSES.filter((b) => b.slug !== business.slug)

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative min-h-[85vh] overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={
                business.heroImage ??
                `/placeholder.svg?height=1400&width=2200&query=${encodeURIComponent(business.heroAlt)}`
              }
              alt={business.heroAlt}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/75 via-primary/45 to-primary/85" />
          </div>

          <div className="relative mx-auto flex min-h-[85vh] max-w-7xl flex-col justify-center px-6 pb-16 pt-32 lg:px-10">
            <nav className="mb-6 flex items-center gap-2 text-sm text-background/70">
              <Link href="/" className="transition-colors hover:text-background">
                AAM
              </Link>
              <span aria-hidden>/</span>
              <span className="text-background">{business.name}</span>
            </nav>

            <p className="mb-5 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-background/70">
              <business.icon className="h-5 w-5" strokeWidth={1.5} />
              {business.eyebrow}
            </p>
            <h1 className="max-w-4xl text-balance font-serif text-5xl font-medium leading-[1.05] text-background sm:text-6xl lg:text-7xl">
              {business.tagline}
            </h1>
            <p className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-background/85">
              {business.description}
            </p>

            <div className="mt-10">
              <a
                href="#contact"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-background px-7 py-3.5 text-sm font-medium tracking-wide text-primary transition-all hover:bg-background/90"
              >
                {business.ctaLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-4 border-t border-background/20 pt-8 sm:mt-16 sm:gap-8">
              {business.stats.map((stat) => (
                <div key={stat.label}>
                  <div className="font-serif text-3xl font-medium text-background sm:text-4xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-background/70">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Offerings */}
        <section className="bg-background py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="max-w-2xl">
              <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
                <span className="h-px w-10 bg-accent" />
                What we offer
              </p>
              <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
                {business.summary}
              </h2>
            </div>

            <div className="mt-10 grid gap-6 sm:mt-16 sm:grid-cols-2">
              {business.offerings.map((offering) => (
                <article
                  key={offering.title}
                  className="flex gap-5 rounded-2xl border border-border bg-card p-6 transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-primary/5 sm:p-8"
                >
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-accent">
                    <Check className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="font-serif text-xl font-medium text-foreground">
                      {offering.title}
                    </h3>
                    <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
                      {offering.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Excursions (Charters only) */}
        <ExcursionsSection excursions={excursions} />

        {/* Editorial feature bands (image side alternates for rhythm) */}
        {[
          ...(business.feature ? [business.feature] : []),
          ...(business.features ?? []),
        ].map((feature, i) => {
          const imageRight = i % 2 === 1
          return (
            <section key={feature.title} className="relative overflow-hidden">
              <div className="grid lg:grid-cols-2">
                <div
                  className={`relative min-h-[340px] lg:min-h-[560px] ${
                    imageRight ? 'lg:order-2' : ''
                  }`}
                >
                  <img
                    src={feature.image || '/placeholder.svg'}
                    alt={feature.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div
                  className={`flex flex-col justify-center bg-primary px-6 py-14 sm:py-16 lg:px-16 lg:py-24 ${
                    imageRight ? 'lg:order-1' : ''
                  }`}
                >
                  <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-background/70">
                    <span className="h-px w-10 bg-background/40" />
                    {feature.eyebrow}
                  </p>
                  <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-background lg:text-5xl">
                    {feature.title}
                  </h2>
                  <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-background/80">
                    {feature.text}
                  </p>
                </div>
              </div>
            </section>
          )
        })}

        {/* Cross-links to other ventures */}
        <section className="bg-secondary py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="max-w-2xl">
              <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
                <span className="h-px w-10 bg-accent" />
                More from AAM
              </p>
              <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
                Explore the rest of the group
              </h2>
            </div>

            <div className="mt-10 grid gap-6 sm:mt-14 sm:grid-cols-3">
              {others.map((b) => (
                <Link
                  key={b.slug}
                  href={`/${b.slug}`}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-primary/5 sm:p-8"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <b.icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-accent" />
                  </div>
                  <h3 className="mt-6 font-serif text-xl font-medium text-foreground">
                    {b.fullName}
                  </h3>
                  <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
                    {b.summary}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <Contact />
      </main>
      <SiteFooter />
    </>
  )
}
