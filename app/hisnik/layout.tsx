import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Hišnik — Gorivo',
  description: 'AAM hišnik: izdaja in tehtanje goriva (Odyssey II / III).',
  robots: { index: false, follow: false },
  manifest: '/hisnik/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Hišnik',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0d2233',
  viewportFit: 'cover',
}

export default function HisnikLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-dvh text-white antialiased"
      style={{
        background: '#0d2233',
        // Keep cart drawer / public chrome from feeling like part of this tool.
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}
