import { Clock } from 'lucide-react'
import { ExcursionInquiry } from '@/components/excursion-inquiry'

export type PublicExcursion = {
  id: number
  title: string
  description: string
  duration: string
  price: number
  priceUnit: string
  image: string | null
}

function formatEur(price: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function ExcursionsSection({
  excursions,
}: {
  excursions: PublicExcursion[]
}) {
  if (excursions.length === 0) return null

  return (
    <section className="bg-secondary py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-10 bg-accent" />
            Excursions
          </p>
          <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
            Trips you can book with us
          </h2>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {excursions.map((exc) => (
            <article
              key={exc.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                <img
                  src={
                    exc.image ||
                    `/placeholder.svg?height=600&width=800&query=${encodeURIComponent(exc.title)}`
                  }
                  alt={exc.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-serif text-xl font-medium leading-snug text-foreground">
                  {exc.title}
                </h3>
                {exc.duration && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" strokeWidth={1.5} />
                    {exc.duration}
                  </p>
                )}
                {exc.description && (
                  <p className="mt-3 flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {exc.description}
                  </p>
                )}
                <div className="mt-5 flex items-baseline gap-1.5 border-t border-border pt-4">
                  <span className="font-serif text-2xl font-medium tabular-nums text-foreground">
                    {exc.price > 0 ? formatEur(exc.price) : 'On request'}
                  </span>
                  {exc.price > 0 && exc.priceUnit && (
                    <span className="text-sm text-muted-foreground">
                      {exc.priceUnit}
                    </span>
                  )}
                </div>
                <ExcursionInquiry title={exc.title} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
