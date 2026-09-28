import Link from 'next/link'
import { Anchor } from 'lucide-react'
import { BUSINESSES } from '@/lib/businesses'

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <Anchor className="h-5 w-5" strokeWidth={1.5} />
              <span className="font-serif text-2xl font-semibold tracking-[0.2em]">
                AAM
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-pretty leading-relaxed text-primary-foreground/70">
              African Adventures Madagascar Sarl — a group of coastal ventures
              based on Nosy Komba: sport fishing, private charters, marine
              services, and a gear store for life on the water.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/60">
              Our ventures
            </h4>
            <ul className="mt-4 space-y-3">
              {BUSINESSES.map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/${b.slug}`}
                    className="text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                  >
                    {b.fullName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/60">
              Company
            </h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/#about"
                  className="text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                >
                  About AAM
                </Link>
              </li>
              <li>
                <a
                  href="#contact"
                  className="text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-primary-foreground/15 pt-8 text-sm text-primary-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} African Adventures Madagascar Sarl.
            All rights reserved.
          </p>
          <p>Nosy Komba, Madagascar · info@aamglobalgroup.com</p>
        </div>
      </div>
    </footer>
  )
}
