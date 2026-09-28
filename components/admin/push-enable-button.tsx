'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, BellRing } from 'lucide-react'

type State = 'loading' | 'unsupported' | 'off' | 'on' | 'busy'

/**
 * Lets the admin turn on phone alerts (Web Push). Once enabled, the device
 * rings with a system notification for new emails / bookings / transfers even
 * when the app is closed or the phone is locked. Registers a service worker
 * and stores the push subscription on the server.
 */
export function PushEnableButton() {
  const [state, setState] = useState<State>('loading')
  const [msg, setMsg] = useState('')

  // Detect current subscription status on mount.
  useEffect(() => {
    let active = true
    async function init() {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        typeof Notification === 'undefined'
      ) {
        if (active) setState('unsupported')
        return
      }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        const sub = await reg.pushManager.getSubscription()
        if (active) setState(sub ? 'on' : 'off')
      } catch {
        if (active) setState('off')
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  const enable = useCallback(async () => {
    setState('busy')
    setMsg('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('off')
        setMsg('Notifications were blocked. Allow them in your browser settings.')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const res = await fetch('/api/push/public-key')
      const { publicKey } = (await res.json()) as { publicKey: string }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), userAgent: navigator.userAgent }),
      })

      setState('on')
      setMsg('Phone alerts are on. Sending a test…')
      await fetch('/api/push/test', { method: 'POST' })
      setMsg('Phone alerts are on. You should have received a test alert.')
    } catch (e) {
      setState('off')
      setMsg('Could not enable phone alerts. Please try again.')
    }
  }, [])

  const disable = useCallback(async () => {
    setState('busy')
    setMsg('')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('off')
      setMsg('Phone alerts turned off.')
    } catch {
      setState('off')
    }
  }, [])

  if (state === 'unsupported') return null

  const label =
    state === 'on'
      ? 'Phone alerts on'
      : state === 'busy'
        ? 'Working…'
        : 'Enable phone alerts'

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-[80] flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={state === 'on' ? disable : enable}
        disabled={state === 'busy' || state === 'loading'}
        aria-label={label}
        className={
          state === 'on'
            ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 shadow-lg transition-colors disabled:opacity-60'
            : 'inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xl ring-2 ring-primary/30 transition-transform hover:scale-[1.03] disabled:opacity-60'
        }
      >
        {state === 'busy' || state === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : state === 'on' ? (
          <Check className="h-4 w-4" strokeWidth={2} />
        ) : (
          <BellRing className="h-4 w-4" strokeWidth={2} />
        )}
        <span>{label}</span>
      </button>
      {state === 'on' && (
        <button
          type="button"
          onClick={() => fetch('/api/push/test', { method: 'POST' })}
          className="inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs text-muted-foreground shadow transition-colors hover:text-foreground"
        >
          <BellRing className="h-3 w-3" strokeWidth={1.5} />
          Send test
        </button>
      )}
      {msg && (
        <p className="max-w-[220px] rounded-lg bg-card/95 px-2.5 py-1.5 text-xs text-muted-foreground shadow">
          {msg}
        </p>
      )}
    </div>
  )
}

// Convert a base64url VAPID key to the Uint8Array the Push API expects.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
