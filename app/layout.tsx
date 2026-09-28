import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Cormorant_Garamond } from 'next/font/google'
import './globals.css'
import { CartProvider } from '@/components/cart-context'
import { CartDrawer } from '@/components/cart-drawer'
import { getPublishedProducts } from '@/app/actions/shop-products'
import { toProduct, PRODUCTS } from '@/lib/products'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'AAM — African Adventures Madagascar · Nosy Komba',
    template: '%s · AAM',
  },
  description:
    'African Adventures Madagascar Sarl (AAM) is a coastal group based on Nosy Komba: sport fishing, private charters, marine services, and a gear store. One name, one crew, one standard of care.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#1e3a5f',
  // iPhone notch / Dynamic Island: let the app extend under the safe areas so
  // env(safe-area-inset-*) resolves to real values (0 on Samsung/Android).
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const dbCatalog = (await getPublishedProducts()).map(toProduct)
  const catalog = dbCatalog.length > 0 ? dbCatalog : PRODUCTS
  return (
    <html lang="en" className={`${geistSans.variable} ${cormorant.variable} bg-background`}>
      <body className="font-sans antialiased">
        <CartProvider catalog={catalog}>
          {children}
          <CartDrawer />
        </CartProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
