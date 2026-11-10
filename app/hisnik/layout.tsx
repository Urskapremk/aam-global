import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Hišnik — Gorivo',
  description: 'AAM hišnik: izdaja in tehtanje goriva (Odyssey II / III).',
  robots: { index: false, follow: false },
  manifest: '/hisnik/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Hišnik',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  // Light like the main AAM admin, with a deeper navy theme tint for caretaker.
  colorScheme: 'light',
  themeColor: '#132a42',
  viewportFit: 'cover',
}

/**
 * Caretaker shell: same AAM token family as the main app, but `--primary` /
 * `--panel-header` are shifted to a darker ocean navy so /hisnik reads as
 * related yet distinct from admin.
 */
export default function HisnikLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="hisnik-shell min-h-dvh bg-background text-foreground antialiased"
      style={
        {
          // Main app navy is oklch(0.36 0.07 248) ≈ #1b4060. Caretaker sits
          // darker so headers / CTAs don't collide with admin chrome.
          ['--primary' as string]: 'oklch(0.26 0.065 248)',
          ['--primary-foreground' as string]: 'oklch(0.99 0.004 240)',
          ['--panel-header' as string]: 'oklch(0.26 0.065 248)',
          ['--panel-header-hover' as string]: 'oklch(0.31 0.065 248)',
          ['--panel-header-foreground' as string]: 'oklch(0.97 0.005 240)',
          isolation: 'isolate',
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
