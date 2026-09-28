import { ArrowRight } from 'lucide-react'

export function UmbrellaHero() {
  return (
    <section id="top" className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/images/fishing-sailfish.png"
          alt="A sailfish with its sail fin raised breaking the surface of choppy blue water on the hook"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/75 via-primary/45 to-primary/85" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 pb-16 pt-32 lg:px-10">
        <p className="mb-6 flex items-center gap-3 text-sm uppercase tracking-[0.35em] text-background/70">
          <span className="h-px w-10 bg-background/50" />
          Nosy Komba · Madagascar
        </p>
        <h1 className="max-w-4xl text-balance font-serif text-5xl font-medium leading-[1.05] text-background sm:text-6xl lg:text-8xl">
          A coastal group built around the water.
        </h1>
        <p className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-background/85">
          African Adventures Madagascar brings together sport fishing, private
          charters, marine services, and a gear store — separate ventures, one
          standard of care, all from our base on Nosy Komba.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <a
            href="#ventures"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-background px-7 py-3.5 text-sm font-medium tracking-wide text-primary transition-all hover:bg-background/90"
          >
            Explore the group
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#contact"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-background/40 px-7 py-3.5 text-sm font-medium tracking-wide text-background transition-colors hover:bg-background/10"
          >
            Get in touch
          </a>
        </div>
      </div>
    </section>
  )
}
