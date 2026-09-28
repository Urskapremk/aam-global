import { cookies } from 'next/headers'

const COOKIE_NAME = 'aam_admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '9999'

// A lightweight signed-ish token. This is a temporary gate while building;
// swap for Better Auth email login later.
function token() {
  return `ok:${ADMIN_PASSWORD}`
}

export async function isAdmin() {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === token()
}

export function checkPassword(password: string) {
  return password === ADMIN_PASSWORD
}

export async function signInAdmin() {
  const store = await cookies()
  // The v0 preview renders the app inside a cross-site iframe. A `sameSite:'lax'`
  // cookie is dropped on those cross-site navigations, so the admin session would
  // appear to "log out" on the next page load. Using `sameSite:'none'` + `secure`
  // keeps the cookie in the iframe. (In production the app is same-origin, but
  // none/secure is still valid over HTTPS.)
  store.set(COOKIE_NAME, token(), {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

export async function signOutAdmin() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
