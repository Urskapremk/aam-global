import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'African Adventures Madagascar',
    short_name: 'AAM',
    description:
      'AAM — African Adventures Madagascar. Sport fishing, private charters, marine services, and a gear store on Nosy Komba.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1c2d4c',
    theme_color: '#1c2d4c',
    icons: [
      {
        src: '/images/aam-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/images/aam-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
