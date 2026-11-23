import { cookies } from 'next/headers'

import { isLang, LANG_COOKIE, translate, type Lang } from './translations'

// Server-side language read from the cookie the toggle also writes, so server
// components translate the same as client components. Defaults to English.
export async function getLang(fallback: Lang = 'en'): Promise<Lang> {
  const store = await cookies()
  const v = store.get(LANG_COOKIE)?.value
  return isLang(v) ? v : fallback
}

// Returns a translate function bound to the current request's language, for use
// in server components: `const t = await getT()` then `t('English source')`.
export async function getT(
  fallback: Lang = 'en',
): Promise<(s: string) => string> {
  const lang = await getLang(fallback)
  return (s: string) => translate(lang, s)
}
