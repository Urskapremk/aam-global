'use client'

import { useState, type FormEvent } from 'react'
import { Mail, Phone, MapPin, Check, MessageCircle } from 'lucide-react'
import { saveInboundMessage } from '@/app/actions/messages'

const CONTACT_DETAILS = [
  {
    icon: Phone,
    label: 'Phone',
    value: '+261 32 43 872 14',
    href: 'tel:+261324387214',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: '+261 38 61 298 69',
    href: 'https://wa.me/261386129869',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'info@aamglobalgroup.com',
    href: 'mailto:info@aamglobalgroup.com',
  },
  {
    icon: MapPin,
    label: 'Base',
    value: 'Nosy Komba, Madagascar',
    href: undefined,
  },
]

export function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') || '')
    const email = String(data.get('email') || '')
    const service = String(data.get('service') || 'General enquiry')
    const date = String(data.get('date') || '')
    const message = String(data.get('message') || '')

    setSending(true)
    setError(null)
    const res = await saveInboundMessage({
      source: 'contact',
      name,
      email,
      subject: `${service}${date ? ` — ${date}` : ''}`,
      body: message || '(no message)',
      meta: { service, date },
    })
    setSending(false)

    if (res.ok) {
      setSubmitted(true)
    } else {
      setError(res.error ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <section id="contact" className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* Left: intro + details */}
          <div>
            <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
              <span className="h-px w-10 bg-accent" />
              Get in touch
            </p>
            <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
              Plan your next trip on the water
            </h2>
            <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
              Tell us your dates and what you have in mind — fishing, transfer,
              or a sunset cruise. We will get back to you within 24 hours.
            </p>

            <div className="mt-12 space-y-6">
              {CONTACT_DETAILS.map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                    <item.icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </div>
                    {item.href ? (
                      <a
                        href={item.href}
                        target={item.href.startsWith('http') ? '_blank' : undefined}
                        rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="text-base font-medium text-foreground transition-colors hover:text-accent"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <div className="text-base font-medium text-foreground">
                        {item.value}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-10">
            {submitted ? (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Check className="h-7 w-7" strokeWidth={2} />
                </div>
                <h3 className="mt-6 font-serif text-2xl font-medium text-foreground">
                  Message sent
                </h3>
                <p className="mt-2 max-w-xs text-pretty text-muted-foreground">
                  Thanks for reaching out. Our crew will be in touch shortly to
                  confirm your trip.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="name" required>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Jane Doe"
                      className="input-base"
                    />
                  </Field>
                  <Field label="Email" htmlFor="email" required>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      placeholder="jane@email.com"
                      className="input-base"
                    />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Service" htmlFor="service">
                    <select id="service" name="service" className="input-base">
                      <option>AAM Fishing</option>
                      <option>AAM Charters</option>
                      <option>AAM Marine</option>
                      <option>AAM Shop</option>
                      <option>General enquiry</option>
                    </select>
                  </Field>
                  <Field label="Preferred date" htmlFor="date">
                    <input
                      id="date"
                      name="date"
                      type="date"
                      className="input-base"
                    />
                  </Field>
                </div>

                <Field label="Message" htmlFor="message">
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Tell us about your group and what you're hoping for..."
                    className="input-base resize-none"
                  />
                </Field>

                <button
                  type="submit"
                  disabled={sending}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-medium tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {sending ? 'Sending…' : 'Send inquiry'}
                </button>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  )
}
