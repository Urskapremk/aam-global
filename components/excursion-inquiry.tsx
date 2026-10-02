'use client'

import { useState, type FormEvent } from 'react'
import { X, Check, Compass } from 'lucide-react'
import { saveInboundMessage } from '@/app/actions/messages'

export function ExcursionInquiry({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = String(data.get('name') || '')
    const email = String(data.get('email') || '')
    const phone = String(data.get('phone') || '')
    const date = String(data.get('date') || '')
    const people = String(data.get('people') || '')
    const message = String(data.get('message') || '')

    setSending(true)
    setError(null)
    const res = await saveInboundMessage({
      source: 'excursion',
      name,
      email,
      phone,
      subject: `Excursion enquiry: ${title}`,
      body:
        `Excursion: ${title}\n` +
        `Preferred date: ${date || '—'}\n` +
        `People: ${people || '—'}\n\n` +
        (message || '(no message)'),
      meta: { excursion: title, date, people },
    })
    setSending(false)
    if (res.ok) setDone(true)
    else setError(res.error ?? 'Something went wrong. Please try again.')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Compass className="h-4 w-4" strokeWidth={1.5} />
        Enquire
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 lg:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>

            {done ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Check className="h-7 w-7" strokeWidth={2} />
                </div>
                <h3 className="mt-5 font-serif text-2xl text-foreground">
                  Enquiry sent
                </h3>
                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                  Thanks! We&apos;ll get back to you shortly about{' '}
                  <span className="text-foreground">{title}</span>.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm uppercase tracking-[0.2em] text-accent">
                  Excursion
                </p>
                <h3 className="mt-1 font-serif text-2xl text-foreground">
                  {title}
                </h3>
                <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      name="name"
                      required
                      autoComplete="name"
                      placeholder="Full name *"
                      className="input"
                    />
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      placeholder="Email *"
                      className="input"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input name="phone" placeholder="Phone / WhatsApp" className="input" />
                    <input name="people" type="number" min={1} placeholder="No. of people" className="input" />
                  </div>
                  <input name="date" type="date" className="input" aria-label="Preferred date" />
                  <textarea
                    name="message"
                    rows={3}
                    placeholder="Anything else we should know?"
                    className="input resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {sending ? 'Sending…' : 'Send enquiry'}
                  </button>
                  {error && (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
