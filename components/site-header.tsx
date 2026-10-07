'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X, Anchor, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BUSINESSES } from '@/lib/businesses'
import { useCart } from '@/components/cart-context'

// Shop always comes last among ventures; Blog sits after the business links.
const NAV_LINKS = [
  ...[...BUSINESSES]
    .sort((a, b) => {
      if (a.slug === 'shop') return 1
      if (b.slug === 'shop') return -1
      return 0
    })
    .map((b) => ({
      label: b.name,
      href: `/${b.slug}`,
    })),
  { label: 'Blog', href: '/blog' },
]

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { count, openCart } = useCart()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-border/60 bg-background/85 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2.5 transition-colors',
            scrolled ? 'text-foreground' : 'text-background',
          )}
        >
          <Anchor className="h-5 w-5" strokeWidth={1.5} />
          <span className="font-serif text-2xl font-semibold leading-none tracking-[0.2em]">
            AAM
          </span>
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm tracking-wide transition-colors',
                scrolled
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-background/80 hover:text-background',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open cart${count > 0 ? `, ${count} items` : ''}`}
            className={cn(
              'relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors',
              scrolled || open
                ? 'text-foreground hover:bg-secondary'
                : 'text-background hover:bg-background/10',
            )}
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-accent-foreground">
                {count}
              </span>
            )}
          </button>

          <a
            href="#contact"
            className={cn(
              'hidden rounded-full px-5 py-2.5 text-sm font-medium tracking-wide transition-all md:inline-flex',
              scrolled
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-background/95 text-primary hover:bg-background',
            )}
          >
            Get in touch
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className={cn(
              'inline-flex md:hidden',
              scrolled || open ? 'text-foreground' : 'text-background',
            )}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-md md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-3 text-base text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Get in touch
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
