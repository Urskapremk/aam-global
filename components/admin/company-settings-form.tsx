'use client'

import { useState } from 'react'
import { Loader2, Building2, Check } from 'lucide-react'
import {
  updateCompanySettings,
  type CompanySettings,
} from '@/app/actions/transfers'

export function CompanySettingsForm({ initial }: { initial: CompanySettings }) {
  const [form, setForm] = useState<CompanySettings>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    await updateCompanySettings({
      name: form.name,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      country: form.country,
      taxId: form.taxId,
      iban: form.iban,
      bankName: form.bankName,
      email: form.email,
      phone: form.phone,
      invoicePrefix: form.invoicePrefix,
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-medium text-foreground">
          Company details
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These appear on every invoice you send. The invoice prefix is combined
          with the year and a running number, e.g.{' '}
          <span className="font-medium text-foreground">
            {form.invoicePrefix || 'AAM'}-{new Date().getFullYear()}-0001
          </span>
          .
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
          <Building2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
          Business
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name" wide>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="African Adventures Madagascar" />
          </Field>
          <Field label="Address line 1">
            <input value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Address line 2">
            <input value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} className={inputCls} />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls} placeholder="Nosy Komba" />
          </Field>
          <Field label="Country">
            <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} placeholder="Madagascar" />
          </Field>
          <Field label="Tax / company reg. number">
            <input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Invoice prefix">
            <input value={form.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value)} className={inputCls} placeholder="AAM" />
          </Field>
        </div>

        <div className="mb-4 mt-6 flex items-center gap-2 text-sm font-medium text-foreground">
          <Building2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
          Contact &amp; payment
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Bank name">
            <input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} className={inputCls} />
          </Field>
          <Field label="IBAN">
            <input value={form.iban} onChange={(e) => set('iban', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" strokeWidth={2} />
          ) : null}
          {saved ? 'Saved' : 'Save details'}
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent'

function Field({
  label,
  wide,
  children,
}: {
  label: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={wide ? 'sm:col-span-2' : undefined}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
