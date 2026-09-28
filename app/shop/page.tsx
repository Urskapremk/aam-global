import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { ShopStorefront } from '@/components/shop-storefront'
import { getBusiness } from '@/lib/businesses'

const business = getBusiness('shop')!

export const metadata: Metadata = {
  title: { absolute: `${business.fullName} — ${business.eyebrow}` },
  description:
    'Shop sport fishing tackle, apparel, and accessories from AAM on Nosy Komba — rods, reels, lures, terminal tackle, and more, with prices in EUR.',
}

export default function ShopPage() {
  return (
    <>
      <SiteHeader />
      <ShopStorefront />
      <SiteFooter />
    </>
  )
}
