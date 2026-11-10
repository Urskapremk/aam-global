import { cookies } from 'next/headers'

const COOKIE_NAME = 'aam_caretaker'
// Safe local/dev fallback — override with CARETAKER_PIN in production.
const CARETAKER_PIN = process.env.CARETAKER_PIN ?? '4242'

function token() {
  return `ok:${CARETAKER_PIN}`
}

export function getCaretakerPin(): string {
  return CARETAKER_PIN
}

export function checkCaretakerPin(pin: string): boolean {
  return pin.trim() === CARETAKER_PIN
}

export async function isCaretaker(): Promise<boolean> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === token()
}

export async function signInCaretaker(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, token(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days — phone stays signed in
  })
}

export async function signOutCaretaker(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
