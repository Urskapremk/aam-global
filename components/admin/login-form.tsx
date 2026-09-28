'use client'

import { useActionState } from 'react'
import { loginAction } from '@/app/actions/admin-auth'
import { Anchor } from 'lucide-react'

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null)

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4">
      <div className="w-full max-w-sm rounded-2xl border border-background/10 bg-background/[0.03] p-8 backdrop-blur">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-background/20 text-background">
            <Anchor className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <h1 className="font-serif text-2xl font-medium text-background">
            AAM Admin
          </h1>
          <p className="mt-1 text-sm text-background/60">
            Enter the access code to continue
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="sr-only">
              Access code
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              autoComplete="off"
              placeholder="Access code"
              className="w-full rounded-lg border border-background/20 bg-background/10 px-4 py-3 text-center text-lg tracking-[0.4em] text-background placeholder:tracking-normal placeholder:text-background/40 focus:border-background/50 focus:outline-none"
            />
          </div>

          {state?.error && (
            <p className="text-center text-sm text-red-300">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-background px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-background/90 disabled:opacity-60"
          >
            {pending ? 'Signing in…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
