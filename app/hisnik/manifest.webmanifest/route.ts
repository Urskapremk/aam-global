import { NextResponse } from 'next/server'

export function GET() {
  const manifest = {
    name: 'AAM Hišnik — Gorivo',
    short_name: 'Hišnik',
    description: 'Vnos izdaje in tehtanja goriva za Odyssey II / III.',
    start_url: '/hisnik',
    scope: '/hisnik',
    display: 'standalone',
    orientation: 'portrait',
    // Darker caretaker navy (matches /hisnik layout themeColor).
    background_color: '#132a42',
    theme_color: '#132a42',
    lang: 'sl',
    icons: [
      {
        src: '/images/aam-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/aam-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
