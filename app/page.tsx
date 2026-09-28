import { SiteHeader } from '@/components/site-header'
import { UmbrellaHero } from '@/components/umbrella-hero'
import { Divisions } from '@/components/divisions'
import { GroupAbout } from '@/components/group-about'
import { Contact } from '@/components/contact'
import { SiteFooter } from '@/components/site-footer'
import { TempAdminLink } from '@/components/temp-admin-link'

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <UmbrellaHero />
        <Divisions />
        <GroupAbout />
        <Contact />
      </main>
      <SiteFooter />
      <TempAdminLink />
    </>
  )
}
