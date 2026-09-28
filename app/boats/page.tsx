import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Contact } from '@/components/contact'
import { BoatBooking } from '@/components/boats/boat-booking'
import { TransferRequest } from '@/components/boats/transfer-request'
import { BUSINESSES, getBusiness } from '@/lib/businesses'

const business = getBusiness('boats')!

export const metadata: Metadata = {
  title: { absolute: `${business.fullName} — ${business.eyebrow}` },
  description: business.description,
}

export default function BoatsPage() {
  const others = BUSINESSES.filter((b) => b.slug !== business.slug)

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative min-h-[70vh] overflow-hidden">
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

          <div className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-center px-6 pb-16 pt-32 lg:px-10">
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
                href="#booking"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-background px-7 py-3.5 text-sm font-medium tracking-wide text-primary transition-all hover:bg-background/90"
              >
                {business.ctaLabel}
              </a>
            </div>
          </div>
        </section>

        {/* Booking system: boats + availability calendar + request form */}
        <BoatBooking />

        {/* Island transfers: route price list + request form (Odyssey II) */}
        <TransferRequest />

        {/* Meet our captain */}
        <section className="bg-background py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            {/* Intro: portrait + lead */}
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="overflow-hidden rounded-3xl border border-border">
                <img
                  src="/images/captain-mike.png"
                  alt="Captain Mike Schneider in his captain's cap and AAM polo shirt aboard the boat at sunset"
                  className="aspect-[4/5] h-full w-full object-cover"
                />
              </div>

              <div>
                <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
                  <span className="h-px w-10 bg-accent" />
                  Meet your captain
                </p>
                <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
                  Mike Schneider
                </h2>
                <p className="mt-3 text-pretty font-serif text-2xl italic text-muted-foreground">
                  Decades of experience. A lifetime on the ocean.
                </p>
                <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
                  For Captain Mike Schneider, sport fishing is far more than a
                  profession. It is a way of life shaped by decades spent on the
                  ocean, a passion for big-game fishing, and the experience that
                  can only come from thousands of hours on the water.
                </p>
                <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                  With more than 25 years of deep-sea fishing experience,
                  Captain Mike has established himself as an accomplished
                  big-game fisherman and highly experienced captain. His
                  knowledge was built on the waters off South Africa, where
                  challenging offshore conditions and some of the world&apos;s
                  most exciting game fish provided the perfect environment for a
                  lifetime dedicated to sport fishing.
                </p>
              </div>
            </div>

            {/* Achievement stats */}
            <div className="mt-16 grid gap-6 border-y border-border py-10 sm:grid-cols-3">
              {[
                { value: '25+', label: 'Years of deep-sea experience' },
                {
                  value: '79.2 kg',
                  label: 'Yellowfin tuna — 2018 Mercury Ski-Boat Festival',
                },
                { value: '146 kg', label: 'Black marlin aboard Must Byt' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-serif text-4xl font-medium text-foreground lg:text-5xl">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Story */}
            <div className="mt-16 grid gap-x-16 gap-y-12 md:grid-cols-2">
              <div>
                <h3 className="font-serif text-2xl font-medium text-foreground">
                  Proven big-game experience
                </h3>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  Captain Mike&apos;s background goes far beyond recreational
                  fishing. Over the years, he has been actively involved in
                  South Africa&apos;s competitive sport-fishing scene aboard{' '}
                  <span className="italic">Must Byt</span>, taking part in major
                  offshore fishing events along the KwaZulu-Natal coast.
                </p>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  One standout achievement came at the 2018 Mercury Ski-Boat
                  Fishing Festival, when the team landed an exceptional 79.2 kg
                  yellowfin tuna — caught more than 35 kilometres offshore,
                  beyond the 2,000-metre depth contour, securing top honours. He
                  also has extensive experience targeting marlin, with the
                  team&apos;s history including an impressive 146 kg black
                  marlin.
                </p>
              </div>

              <div>
                <h3 className="font-serif text-2xl font-medium text-foreground">
                  Experience that makes the difference
                </h3>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  Anyone can take a boat offshore. Finding fish consistently is
                  another matter. Successful sport fishing requires an
                  understanding of the ocean — its currents, water temperature,
                  weather, baitfish movements, and the behaviour of the species
                  being targeted. It means knowing when to travel further, when
                  to change tactics, and when patience is the most important
                  strategy of all.
                </p>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  That knowledge cannot be learned overnight. It comes from
                  experience — and Captain Mike brings decades of it to every
                  fishing trip.
                </p>
              </div>

              <div>
                <h3 className="font-serif text-2xl font-medium text-foreground">
                  Fishing with Captain Mike
                </h3>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  Whether you are an experienced angler looking for your next
                  serious offshore challenge or experiencing big-game fishing
                  for the first time, Captain Mike&apos;s approach remains the
                  same: professional, personal, and focused on giving every
                  guest an authentic sport-fishing experience.
                </p>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  There are no guarantees when fishing wild waters — and that is
                  exactly what makes it exciting. Every departure is different,
                  every day brings new conditions, and every strike tells a new
                  story. From powerful yellowfin tuna to the unforgettable
                  moment a marlin appears behind the boat, it is the
                  anticipation of what might happen next that keeps him
                  returning to the ocean.
                </p>
              </div>

              <div>
                <h3 className="font-serif text-2xl font-medium text-foreground">
                  The Must Byt legacy
                </h3>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  The name <span className="italic">Must Byt</span> has
                  accompanied Captain Mike through years of offshore adventures,
                  competitions, and memorable catches in South Africa. It
                  represents the same philosophy he brings to the ocean today:
                  serious fishing, genuine experience, respect for the ocean,
                  and a passion for the pursuit of extraordinary fish.
                </p>
                <p className="mt-4 text-pretty font-serif text-xl italic leading-relaxed text-foreground">
                  Because somewhere beyond the horizon, the fish of a lifetime
                  may be waiting. Welcome aboard with Captain Mike Schneider.
                </p>
              </div>
            </div>

            {/* Operations & guest experience */}
            <div className="mt-16 border-t border-border pt-16">
              <p className="mb-8 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
                <span className="h-px w-10 bg-accent" />
                Meet the team
              </p>
              <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                <div className="overflow-hidden rounded-3xl border border-border">
                  <img
                    src="/images/team-spela-retelj.png"
                    alt="Špela Retelj in her AAM cap and polo shirt aboard the boat at sunset"
                    className="aspect-[4/5] h-full w-full object-cover"
                  />
                </div>

                <div>
                  <h3 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
                    Špela Retelj
                  </h3>
                  <p className="mt-3 text-pretty font-serif text-2xl italic text-muted-foreground">
                    Operations Manager
                  </p>
                  <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
                    Špela keeps everything running smoothly behind the scenes —
                    from bookings and transfers to guest requests and day-to-day
                    coordination. Whatever you need before, during, or after your
                    time on the water, she makes sure it is taken care of.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cross-links to other ventures */}
        <section className="bg-secondary py-24 lg:py-32">
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

            <div className="mt-14 grid gap-6 sm:grid-cols-3">
              {others.map((b) => (
                <Link
                  key={b.slug}
                  href={`/${b.slug}`}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-8 transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-primary/5"
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
