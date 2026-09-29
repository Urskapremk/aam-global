'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Anchor, ArrowLeft, LogOut, ExternalLink } from 'lucide-react'
import { logoutAction } from '@/app/actions/admin-auth'
import { AdminNotifier } from '@/components/admin/admin-notifier'
import { PushEnableButton } from '@/components/admin/push-enable-button'
import { useLang } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

export function AdminShell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useLang()
  const pathname = usePathname()
  const isHome = pathname === '/admin' || pathname === '/admin/'

  // Fixed admin look: navy sidebar (brand chrome) + a warm sandy page
  // background. There is no dark mode here — nothing in the app sets the `.dark`
  // class, so the admin always renders this one way.
  // Cards are re-tinted from pure white (a glare trigger for dyslexic readers)
  // to a pale sand, kept a touch LIGHTER than the #efe8da page so cards still
  // lift off the background. Borders/thin dividers move from pale grey to a
  // navy line (the brand navy at partial alpha) so every outline reads as dark
  // blue on the sand without looking heavy. Scoped to the wrapper via the
  // --card/--popover/--border/--input tokens so the public site is untouched.
  return (
    <div
      className="flex min-h-screen flex-col bg-[#efe8da]"
      style={
        {
          '--card': '#f6f1e6',
          '--popover': '#f6f1e6',
          '--border': 'oklch(0.36 0.07 248 / 0.45)',
          '--input': 'oklch(0.36 0.07 248 / 0.45)',
        } as React.CSSProperties
      }
    >
      <AdminNotifier />
      <PushEnableButton />

      {/* Top bar (all viewports). Row 1: brand + controls. Row 2: the nav as a
          horizontal, scrollable strip of navy pills on the sand background.
          Fleet is a click-to-open dropdown popover rather than an inline
          group. The navy uses the panel-header token (no dark override) so the
          blue never flips in the preview's dark frame. */}
      <header className="sticky top-0 z-20 border-b border-border bg-[#efe8da]">
        {/* Row 1: only the brand logo, centered, on the navy brand bar. The
            navy bleeds up into the iPhone notch/Dynamic Island area via the
            safe-area top inset (0 on Samsung/Android, so no change there). */}
        <div className="flex justify-center bg-panel-header px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          {/* The logo doubles as the home link back to the Overview landing. */}
          <Link
            href="/admin"
            aria-label={t('Overview')}
            className="inline-flex items-center gap-2 rounded-lg text-panel-header-foreground transition-opacity hover:opacity-70"
          >
            <Anchor className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            <span className="font-serif text-lg">AAM Admin</span>
          </Link>
        </div>
        {/* Row 2: controls, centered, below a divider. */}
        <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-2 sm:gap-3">
            {/* Language toggle. Two pills so the current choice is always
                visible (not a single button showing the OTHER language). */}
            <div
              className="flex items-center gap-1 rounded-lg border border-panel-header/25 p-0.5"
              role="group"
              aria-label={t('Language')}
            >
              {(['en', 'sl'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={cn(
                    'min-h-8 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors',
                    lang === l
                      ? 'bg-panel-header text-panel-header-foreground'
                      : 'text-panel-header/60 hover:text-panel-header',
                  )}
                >
                  {l === 'en' ? 'EN' : 'SL'}
                </button>
              ))}
            </div>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('View site')}
              className="flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-sm text-panel-header/75 transition-colors hover:bg-panel-header/10 hover:text-panel-header lg:justify-start"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden lg:inline">{t('View site')}</span>
            </a>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label={t('Sign out')}
                className="flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-sm text-panel-header/75 transition-colors hover:bg-panel-header/10 hover:text-panel-header lg:justify-start"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden lg:inline">{t('Sign out')}</span>
              </button>
            </form>
        </div>
      </header>

      {/* pb keeps the last row clear of the fixed "Enable phone alerts" button
          pinned to the bottom-right, plus the iPhone home-indicator inset. */}
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:p-8 lg:pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {!isHome && (
          <Link
            href="/admin"
            className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-panel-header px-4 py-2 text-sm font-medium text-panel-header-foreground transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            {t('Command centre')}
          </Link>
        )}
        {children}
      </main>
    </div>
  )
}
