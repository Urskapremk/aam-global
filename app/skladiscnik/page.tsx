import { redirect } from 'next/navigation'

/** Soft alias — canonical storekeeper PWA stays at `/hisnik`. */
export default function SkladiscnikAliasPage() {
  redirect('/hisnik')
}
