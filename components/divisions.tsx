import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { BUSINESSES } from '@/lib/businesses'

export function Divisions() {
  // On the landing page, the Shop always comes last — after Marine life.
  const ventures = [...BUSINESSES].sort((a, b) => {
    if (a.slug === 'shop') return 1
    if (b.slug === 'shop') return -1
    return 0
  })
  return (
    <section id="ventures" className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-10 bg-accent" />
            The ventures
          </p>
          <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
            Our ventures and the coast around them
          </h2>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
            Each part of AAM runs on its own, yet shares the same people, boats,
            and standards. Choose where you want to start.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {ventures.map((b) => (
            <Link
              key={b.slug}
              href={`/${b.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-all hover:border-accent/40 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={
                    b.cardImage ??
                    b.heroImage ??
                    `/placeholder.svg?height=500&width=800&query=${encodeURIComponent(b.heroAlt)}`
                  }
                  alt={b.heroAlt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
                <div className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-xl bg-background/90 text-primary backdrop-blur">
                  <b.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
              </div>

              <div className="flex flex-1 flex-col p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-accent">
                      {b.eyebrow}
                    </p>
                    <h3 className="mt-2 font-serif text-2xl font-medium text-foreground">
                      {b.fullName}
                    </h3>
                  </div>
                  <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-accent-foreground">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  {b.summary}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
