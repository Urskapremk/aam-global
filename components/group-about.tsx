const PILLARS = [
  {
    title: 'One crew',
    description:
      'The same captains and technicians stand behind every venture — people who live on this coast.',
  },
  {
    title: 'One standard',
    description:
      'Whether it is a charter, a service, or a sale, the care and precision never change.',
  },
  {
    title: 'One place',
    description:
      'Fishing, transfers, marine work, and gear — all handled from a single base on Nosy Komba.',
  },
]

export function GroupAbout() {
  return (
    <section id="about" className="bg-secondary py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="relative overflow-hidden rounded-3xl">
            <img
              src="/images/crew-odyssey.png"
              alt="An AAM crew member in a blue Odyssey shirt tending trolling rods from the stern while running across deep blue water"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col justify-center">
            <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
              <span className="h-px w-10 bg-accent" />
              About AAM
            </p>
            <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
              Built by people who never left the water
            </h2>
            <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
              African Adventures Madagascar grew out of a simple idea:
              everything you need on the water off Nosy Komba should come from
              one trusted name. What started with fishing now spans charters,
              marine services, and a gear store — each run with the same
              hands-on care.
            </p>

            <div className="mt-10 space-y-6">
              {PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="border-l-2 border-accent/40 pl-5"
                >
                  <h3 className="font-serif text-xl font-medium text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-1 text-pretty leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
