'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, BellOff, Mail, Ship, X } from 'lucide-react'
import {
  getAdminNotificationCounts,
  type AdminNotificationCounts,
} from '@/app/actions/notifications'
import { cn } from '@/lib/utils'

const POLL_MS = 20_000
const MUTE_KEY = 'aam-admin-notify-muted'
const BASE_TITLE = 'AAM Admin'

type Kind = 'email' | 'booking' | 'transfer'

type Alert = {
  id: number
  kind: Kind
  count: number
}

/**
 * Always-mounted admin poller. Detects new inbound emails, boat-booking
 * requests and transfer requests, then signals the phone that something
 * happened: an on-screen toast, a sound, device vibration, a tab-title badge
 * and (if allowed) a system notification. Audio is unlocked on the first user
 * gesture because mobile browsers block sound until then.
 */
export function AdminNotifier() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [muted, setMuted] = useState(false)

  // Previous per-category counts. `null` until the first poll establishes a
  // baseline, so an existing backlog never triggers an alert on load.
  const prevRef = useRef<AdminNotificationCounts | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const mutedRef = useRef(false)
  const alertSeq = useRef(0)

  // ----- sound -----
  const ensureAudio = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (Ctx) audioRef.current = new Ctx()
    }
    return audioRef.current
  }, [])

  const playChime = useCallback(() => {
    if (mutedRef.current) return
    const ctx = ensureAudio()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const now = ctx.currentTime
    // Two short rising tones — a friendly "ding-dong".
    const tones = [
      { f: 880, t: 0 },
      { f: 1320, t: 0.16 },
    ]
    for (const { f, t } of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = now + t
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32)
      osc.start(start)
      osc.stop(start + 0.34)
    }
  }, [ensureAudio])

  // ----- mute state (persisted) -----
  useEffect(() => {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
    setMuted(stored)
    mutedRef.current = stored
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      mutedRef.current = next
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (!next) {
        // Unmuting is a user gesture — unlock audio and play a confirmation.
        ensureAudio()?.resume().catch(() => {})
        playChime()
      }
      return next
    })
  }, [ensureAudio, playChime])

  // ----- unlock audio + ask for notification permission on first gesture -----
  useEffect(() => {
    const unlock = () => {
      ensureAudio()?.resume().catch(() => {})
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'default'
      ) {
        Notification.requestPermission().catch(() => {})
      }
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [ensureAudio])

  // ----- fire the full "something happened" signal -----
  const signal = useCallback(
    (newAlerts: Alert[], total: number) => {
      setAlerts((prev) => [...prev, ...newAlerts])
      playChime()
      // Vibrate (Android/Chrome). iOS ignores this silently.
      try {
        navigator.vibrate?.([200, 100, 200])
      } catch {
        /* ignore */
      }
      // System notification (best effort).
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const label = newAlerts
            .map((a) => `${a.count} ${LABEL[a.kind].toLowerCase()}`)
            .join(', ')
          new Notification('New activity — AAM', { body: label })
        }
      } catch {
        /* ignore */
      }
      // Tab-title badge so a backgrounded tab shows the count.
      if (typeof document !== 'undefined') {
        document.title = `(${total}) ${BASE_TITLE}`
      }
    },
    [playChime],
  )

  // ----- poll -----
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function tick() {
      try {
        const counts = await getAdminNotificationCounts()
        if (!active) return
        const prev = prevRef.current
        if (prev) {
          const diffs: Alert[] = []
          if (counts.unread > prev.unread)
            diffs.push({ id: ++alertSeq.current, kind: 'email', count: counts.unread - prev.unread })
          if (counts.pendingBookings > prev.pendingBookings)
            diffs.push({ id: ++alertSeq.current, kind: 'booking', count: counts.pendingBookings - prev.pendingBookings })
          if (counts.pendingTransfers > prev.pendingTransfers)
            diffs.push({ id: ++alertSeq.current, kind: 'transfer', count: counts.pendingTransfers - prev.pendingTransfers })
          if (diffs.length > 0) signal(diffs, counts.total)
        }
        prevRef.current = counts
      } catch {
        /* keep polling */
      } finally {
        if (active) timer = setTimeout(tick, POLL_MS)
      }
    }

    tick()

    // Poll immediately when the tab/app regains focus (e.g. phone unlocked).
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer)
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [signal])

  const dismiss = useCallback((id: number) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id)
      if (next.length === 0 && typeof document !== 'undefined') {
        document.title = BASE_TITLE
      }
      return next
    })
  }, [])

  const dismissAll = useCallback(() => {
    setAlerts([])
    if (typeof document !== 'undefined') document.title = BASE_TITLE
  }, [])

  return (
    <>
      {/* Mute toggle — fixed, unobtrusive */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute notification sound' : 'Mute notification sound'}
        className="fixed bottom-4 left-4 z-[80] inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:text-foreground"
      >
        {muted ? <BellOff className="h-5 w-5" strokeWidth={1.5} /> : <Bell className="h-5 w-5" strokeWidth={1.5} />}
      </button>

      {/* Alert stack */}
      {alerts.length > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-[90] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-80">
          {alerts.length > 1 && (
            <button
              type="button"
              onClick={dismissAll}
              className="self-end rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-background shadow"
            >
              Dismiss all
            </button>
          )}
          {alerts.map((a) => {
            const meta = LABEL_META[a.kind]
            const Icon = meta.icon
            return (
              <div
                key={a.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xl',
                  'animate-in slide-in-from-bottom-2 fade-in',
                  meta.ring,
                )}
                role="alert"
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', meta.badge)}>
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {a.count} new {a.count > 1 ? meta.plural : meta.singular}
                  </p>
                  <Link
                    href={meta.href}
                    onClick={() => dismiss(a.id)}
                    className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                  >
                    View {meta.viewLabel}
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(a.id)}
                  aria-label="Dismiss"
                  className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

const LABEL: Record<Kind, string> = {
  email: 'Emails',
  booking: 'Boat requests',
  transfer: 'Transfer requests',
}

const LABEL_META: Record<
  Kind,
  {
    icon: typeof Mail
    singular: string
    plural: string
    href: string
    viewLabel: string
    badge: string
    ring: string
  }
> = {
  email: {
    icon: Mail,
    singular: 'email',
    plural: 'emails',
    href: '/admin/inbox',
    viewLabel: 'inbox',
    badge: 'bg-sky-100 text-sky-700',
    ring: 'border-sky-300',
  },
  booking: {
    icon: Ship,
    singular: 'boat request',
    plural: 'boat requests',
    href: '/admin/bookings',
    viewLabel: 'bookings',
    badge: 'bg-accent/15 text-accent',
    ring: 'border-accent/40',
  },
  transfer: {
    icon: Ship,
    singular: 'transfer request',
    plural: 'transfer requests',
    href: '/admin/bookings',
    viewLabel: 'transfers',
    badge: 'bg-emerald-100 text-emerald-700',
    ring: 'border-emerald-300',
  },
}
