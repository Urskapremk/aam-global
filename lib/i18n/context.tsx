'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { LANG_COOKIE, translate, type Lang } from './translations'

export type { Lang }

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (s: string) => string
}

const LanguageContext = createContext<Ctx | null>(null)

export function LanguageProvider({
  initialLang = 'en',
  children,
}: {
  initialLang?: Lang
  children: ReactNode
}) {
  // Seed from the server-read cookie so the first client render already matches
  // what server components rendered (no flash, no hydration mismatch).
  const [lang, setLangState] = useState<Lang>(initialLang)
  const router = useRouter()

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_COOKIE)
      if ((stored === 'sl' || stored === 'en') && stored !== lang) {
        setLangState(stored)
      }
    } catch {
      // Private mode / storage disabled — keep the server-provided language.
    }
    // Only reconcile once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l)
      try {
        localStorage.setItem(LANG_COOKIE, l)
      } catch {
        // Ignore storage failures; the choice still applies this session.
      }
      // Mirror the choice into a cookie so SERVER components re-render in the
      // new language, then refresh the route so they actually re-run.
      document.cookie = `${LANG_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`
      router.refresh()
    },
    [router],
  )

  const t = useCallback((s: string) => translate(lang, s), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang(): Ctx {
  const ctx = useContext(LanguageContext)
  // Safe English no-op when rendered outside the provider.
  if (!ctx) return { lang: 'en', setLang: () => {}, t: (s: string) => s }
  return ctx
}

export function useT(): (s: string) => string {
  return useLang().t
}
