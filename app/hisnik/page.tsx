import { HisnikApp } from '@/components/hisnik/hisnik-app'
import { caretakerSession } from '@/app/actions/hisnik-fuel'
import { LanguageProvider } from '@/lib/i18n/context'
import { getLang } from '@/lib/i18n/server'

export default async function HisnikPage() {
  const [session, lang] = await Promise.all([
    caretakerSession(),
    // Caretaker default is Slovenian when no cookie is set yet.
    getLang('sl'),
  ])
  return (
    <LanguageProvider initialLang={lang}>
      <HisnikApp initiallyAuthed={session.authenticated} />
    </LanguageProvider>
  )
}
