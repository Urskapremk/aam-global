import Link from 'next/link'
import { CommandCenter } from '@/components/command-center'
import { NAV, isGroup, type NavLeaf } from '@/components/admin/nav'
import { getUnreadCount } from '@/app/actions/messages'
import { getPendingBookingsCount } from '@/app/actions/boat-bookings'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const [t, unread, pendingBookings] = await Promise.all([
    getT(),
    getUnreadCount().catch(() => 0),
    getPendingBookingsCount().catch(() => 0),
  ])

  // This grid is the only navigation now (there is no top bar). Standalone
  // leaves (Overview skipped) show first as a plain row; each group becomes a
  // labelled sub-section so the pages stay sorted the way the old dropdowns
  // grouped them.
  const standalone = NAV.filter(
    (n): n is NavLeaf => !isGroup(n) && n.href !== '/admin',
  )
  const groups = NAV.filter(isGroup)

  const badgeFor = (leaf: NavLeaf) =>
    leaf.badge ? unread : leaf.bookingBadge ? pendingBookings : 0

  // Small navy pill-tile matching the brand chrome the old top bar used.
  const Tile = ({ leaf }: { leaf: NavLeaf }) => {
    const badge = badgeFor(leaf)
    return (
      <Link
        href={leaf.href}
        className="flex min-h-11 items-center gap-2.5 rounded-xl border border-transparent bg-panel-header px-3.5 py-2.5 text-panel-header-foreground transition-colors hover:border-panel-header-foreground/30 hover:bg-panel-header-hover"
      >
        <leaf.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="min-w-0 flex-1 truncate text-sm">{t(leaf.label)}</span>
        {badge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-accent-foreground">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 h-px w-8 bg-accent" aria-hidden />
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {t('Command centre')}
        </p>
        <h1 className="mt-1 font-serif text-3xl text-foreground">
          {t('Welcome back')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'Where the boats are, then every section of the admin in one place.',
          )}
        </p>
      </div>

      {/* Operational state first: this is the screen you land on, so a boat at
          sea or an open alert must be visible without scrolling. */}
      <CommandCenter />

      <p className="mb-3 mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {t('All sections')}
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {standalone.map((leaf) => (
          <Tile key={leaf.href} leaf={leaf} />
        ))}
      </div>

      {groups.map((group) => (
        <div key={group.label} className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <group.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t(group.label)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {group.children.map((leaf) => (
              <Tile key={leaf.href} leaf={leaf} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
