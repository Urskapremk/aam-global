import { HisnikApp } from '@/components/hisnik/hisnik-app'
import { caretakerSession } from '@/app/actions/hisnik-fuel'

export default async function HisnikPage() {
  const session = await caretakerSession()
  return <HisnikApp initiallyAuthed={session.authenticated} />
}
