import { cookies } from 'next/headers'

import { LANG_COOKIE, translate, type Lang } from './translations'

// Server-side language read from the cookie the toggle also writes, so server
// components translate the same as client components. Defaults to English.
export async function getLang(): Promise<Lang> {
  const store = await cookies()
  const v = store.get(LANG_COOKIE)?.value
  return v === 'sl' ? 'sl' : 'en'
}

// Returns a translate function bound to the current request's language, for use
// in server components: `const t = await getT()` then `t('English source')`.
export async function getT(): Promise<(s: string) => string> {
  const lang = await getLang()
  return (s: string) => translate(lang, s)
}
