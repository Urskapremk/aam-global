'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  FileText,
  Loader2,
  Mail,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react'

import {
  addRectificatif,
  createVoyageJournal,
  deleteVoyageJournal,
  sendVoyageJournalEmail,
} from '@/app/actions/voyage-journal'
import {
  OPERATOR_NAME,
  optionLabel,
  PURPOSES,
  STATUS_LABELS,
  type VoyageJournalRow,
  type VoyageStatus,
} from '@/lib/voyage-journal'
import { cn } from '@/lib/utils'
import { VoyageJournalForm } from './voyage-journal-form'

type BoatOpt = { boat: string; label: string }

function StatusBadge({ status }: { status: VoyageStatus }) {
  const l = STATUS_LABELS[status]
  const cls =
    status === 'cloture'
      ? 'bg-[#4f7a54]/12 text-[#3a5c3f] dark:bg-[#8fae92]/15 dark:text-[#8fae92]'
      : status === 'valide'
        ? 'bg-[#1f6f96]/12 text-[#1f6f96] dark:bg-[#9ecbdd]/15 dark:text-[#9ecbdd]'
        : 'bg-muted text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em]',
        cls,
      )}
    >
      {l.fr}
    </span>
  )
}

export function VoyageJournalManager({
  boats,
  entries,
}: {
  boats: BoatOpt[]
  entries: VoyageJournalRow[]
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  const [newBoat, setNewBoat] = useState(boats[0]?.boat ?? '')
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  // Set right after creating so we can scroll + highlight once the new row lands.
  const justCreatedId = useRef<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

  // When an entry is opened (or the newly created one appears after refresh),
  // scroll it into view. The archive list sits far below the button, so without
  // this the form opens off-screen and looks like nothing happened.
  useEffect(() => {
    if (!openId) return
    const el = document.getElementById(`voyage-card-${openId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [openId])

  // Filters
  const [fBoat, setFBoat] = useState('')
  const [fCaptain, setFCaptain] = useState('')
  const [fDestination, setFDestination] = useState('')
  const [fVoyage, setFVoyage] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fIncident, setFIncident] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  // Email modal
  const [emailFor, setEmailFor] = useState<VoyageJournalRow | null>(null)
  // Rectificatif modal
  const [rectFor, setRectFor] = useState<VoyageJournalRow | null>(null)

  const filtered = useMemo(() => {
    return entries.filter((r) => {
      if (fBoat && r.boat !== fBoat) return false
      if (fStatus && r.status !== fStatus) return false
      if (fCaptain && !(r.captainName ?? '').toLowerCase().includes(fCaptain.toLowerCase()))
        return false
      if (
        fDestination &&
        !(r.destination ?? '').toLowerCase().includes(fDestination.toLowerCase())
      )
        return false
      if (fVoyage && !r.voyageNumber.toLowerCase().includes(fVoyage.toLowerCase()))
        return false
      if (fIncident === 'with' && r.noIncident) return false
      if (fIncident === 'without' && !r.noIncident) return false
      if (fFrom && (r.voyageDate ?? '') < fFrom) return false
      if (fTo && (r.voyageDate ?? '') > fTo) return false
      return true
    })
  }, [entries, fBoat, fStatus, fCaptain, fDestination, fVoyage, fIncident, fFrom, fTo])

  async function create() {
    if (!newBoat) return
    setCreating(true)
    try {
      const res = await createVoyageJournal(newBoat)
      justCreatedId.current = res.id
      setOpenId(res.id)
      refresh()
    } finally {
      setCreating(false)
    }
  }

  // Once the freshly created draft arrives in `entries` (after refresh), scroll
  // to it and flash a ring so the user sees the new voyage form appear.
  useEffect(() => {
    const id = justCreatedId.current
    if (!id) return
    if (!entries.some((e) => e.id === id)) return
    justCreatedId.current = null
    const el = document.getElementById(`voyage-card-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashId(id)
    const t = setTimeout(() => setFlashId(null), 2000)
    return () => clearTimeout(t)
  }, [entries])

  async function remove(id: string) {
    if (!confirm('Supprimer ce brouillon ? · Delete this draft?')) return
    await deleteVoyageJournal(id)
    if (openId === id) setOpenId(null)
    refresh()
  }

  const inputCls =
    'min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground'

  return (
    <div className="flex flex-col gap-6">
      {/* Create new */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Nouveau journal de bord · New logbook entry
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={newBoat}
            onChange={(e) => setNewBoat(e.target.value)}
            className={inputCls}
          >
            {boats.map((b) => (
              <option key={b.boat} value={b.boat}>
                {b.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="flex min-h-10 items-center gap-2 rounded-full bg-accent px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            Nouveau voyage · New voyage
          </button>
          <p className="text-xs text-muted-foreground">
            Le n° de voyage est généré automatiquement (ex. ODYSSEY-II-2026-0001).
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Archive · Filtres
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select value={fBoat} onChange={(e) => setFBoat(e.target.value)} className={inputCls}>
            <option value="">Tous les navires · All vessels</option>
            {boats.map((b) => (
              <option key={b.boat} value={b.boat}>
                {b.label}
              </option>
            ))}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={inputCls}>
            <option value="">Tous les statuts · All statuses</option>
            <option value="brouillon">BROUILLON</option>
            <option value="valide">VALIDÉ</option>
            <option value="cloture">CLÔTURÉ</option>
          </select>
          <select
            value={fIncident}
            onChange={(e) => setFIncident(e.target.value)}
            className={inputCls}
          >
            <option value="">Incident: tous · all</option>
            <option value="with">Avec incident · with</option>
            <option value="without">Sans incident · without</option>
          </select>
          <input
            value={fVoyage}
            onChange={(e) => setFVoyage(e.target.value)}
            placeholder="N° voyage"
            className={inputCls}
          />
          <input
            value={fCaptain}
            onChange={(e) => setFCaptain(e.target.value)}
            placeholder="Capitaine · Captain"
            className={inputCls}
          />
          <input
            value={fDestination}
            onChange={(e) => setFDestination(e.target.value)}
            placeholder="Destination"
            className={inputCls}
          />
          <label className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Du
            </span>
            <input
              type="date"
              value={fFrom}
              onChange={(e) => setFFrom(e.target.value)}
              className={cn(inputCls, 'flex-1')}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Au
            </span>
            <input
              type="date"
              value={fTo}
              onChange={(e) => setFTo(e.target.value)}
              className={cn(inputCls, 'flex-1')}
            />
          </label>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun journal de bord. · No logbook entries yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((r) => {
            const open = openId === r.id
            const purposeFr = optionLabel(PURPOSES, r.purpose)?.fr
            const pdfUrl = `/voyage-journal/${r.id}`
            return (
              <div
                key={r.id}
                id={`voyage-card-${r.id}`}
                className={cn(
                  'rounded-xl border bg-card transition-colors',
                  flashId === r.id
                    ? 'border-accent ring-2 ring-accent'
                    : 'border-border',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : r.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">
                        {r.voyageNumber}
                      </span>
                      <StatusBadge status={r.status} />
                      {!r.noIncident && r.status !== 'brouillon' && (
                        <span className="rounded-full bg-[#b0203a]/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#8f1a2f] dark:text-[#f0a8b4]">
                          Incident
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {r.voyageDate ?? '—'} · {r.boatLabel} · {r.departureLocation ?? '—'}
                      {' → '}
                      {r.destination ?? r.arrivalLocation ?? '—'} ·{' '}
                      {r.captainName ?? '—'} · {r.passengerCount ?? 0} pax
                      {purposeFr ? ` · ${purposeFr}` : ''}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform',
                      open && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>

                {open && (
                  <div className="border-t border-border p-4">
                    {/* Actions for closed entries */}
                    {r.status === 'cloture' && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary"
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          Voir le PDF
                        </a>
                        <a
                          href={`${pdfUrl}?print=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary"
                        >
                          <Printer className="h-4 w-4" aria-hidden />
                          Imprimer
                        </a>
                        <button
                          type="button"
                          onClick={() => setEmailFor(r)}
                          className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary"
                        >
                          <Mail className="h-4 w-4" aria-hidden />
                          Envoyer par e-mail
                        </button>
                        <a
                          href={`${pdfUrl}?print=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary"
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          Télécharger PDF
                        </a>
                      </div>
                    )}

                    {r.status === 'brouillon' && (
                      <div className="mb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-[#b0203a]/40 hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          Supprimer · Delete
                        </button>
                      </div>
                    )}

                    <VoyageJournalForm entry={r} onChanged={refresh} />

                    {/* Rectificatifs */}
                    {r.locked && (
                      <div className="mt-6 border-t border-border pt-4">
                        <div className="flex items-center justify-between">
                          <p className="font-serif text-base text-foreground">
                            Rectificatifs
                          </p>
                          <button
                            type="button"
                            onClick={() => setRectFor(r)}
                            className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                            Ajouter un rectificatif
                          </button>
                        </div>
                        {r.rectificatifs.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Aucun rectificatif. L&apos;entrée d&apos;origine reste
                            inchangée. · No corrections; the original entry is
                            unchanged.
                          </p>
                        ) : (
                          <ul className="mt-2 flex flex-col gap-2">
                            {r.rectificatifs.map((rc) => (
                              <li
                                key={rc.id}
                                className="rounded-lg border border-border bg-muted/40 p-3 text-sm"
                              >
                                <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                                  {rc.date} · {rc.addedBy} · {rc.reason}
                                </p>
                                <p className="mt-1 text-foreground">{rc.text}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Email log */}
                    {r.emailLog.length > 0 && (
                      <div className="mt-4 text-xs text-muted-foreground">
                        <p className="font-medium uppercase tracking-[0.1em]">
                          Envois · Sends
                        </p>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {r.emailLog.map((m) => (
                            <li key={m.id}>
                              {new Date(m.at).toLocaleString('fr-FR')} → {m.to}
                              {m.copyToOperator ? ` (+ ${OPERATOR_NAME})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {emailFor && (
        <EmailModal
          entry={emailFor}
          onClose={() => setEmailFor(null)}
          onSent={() => {
            setEmailFor(null)
            refresh()
          }}
        />
      )}
      {rectFor && (
        <RectificatifModal
          entry={rectFor}
          onClose={() => setRectFor(null)}
          onSaved={() => {
            setRectFor(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-serif text-lg text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

function EmailModal({
  entry,
  onClose,
  onSent,
}: {
  entry: VoyageJournalRow
  onClose: () => void
  onSent: () => void
}) {
  const dateStr = entry.voyageDate ?? entry.createdAt.slice(0, 10)
  const [to, setTo] = useState('')
  const [copy, setCopy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const subject = `Journal de bord – ${entry.boatLabel} – ${dateStr} – ${entry.voyageNumber}`
  const inputCls =
    'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground'

  async function send() {
    if (!to.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await sendVoyageJournalEmail(entry.id, {
        to: to.trim(),
        copyToOperator: copy,
      })
      if (res.ok) {
        onSent()
      } else {
        setMsg(res.error || 'Erreur')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Envoyer le journal de bord"
      subtitle="Send the logbook"
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <label>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Destinataire · Recipient
          </span>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="apmf@example.mg"
            className={inputCls}
          />
        </label>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Objet · Subject</p>
          <p className="mt-0.5">{subject}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={copy}
            onChange={(e) => setCopy(e.target.checked)}
            className="h-4 w-4"
          />
          Envoyer une copie à l&apos;exploitant · Copy the operator
        </label>
        {msg && <p className="text-sm text-[#b0203a] dark:text-[#f0a8b4]">{msg}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy || !to.trim()}
            className="flex min-h-10 items-center gap-2 rounded-full bg-accent px-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Envoyer
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function RectificatifModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: VoyageJournalRow
  onClose: () => void
  onSaved: () => void
}) {
  const [reason, setReason] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const inputCls =
    'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground'

  async function save() {
    if (!reason.trim() || !text.trim()) return
    setBusy(true)
    try {
      await addRectificatif(entry.id, { reason: reason.trim(), text: text.trim() })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Ajouter un rectificatif"
      subtitle="Add a correction — the original entry stays unchanged"
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <label>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Raison du rectificatif · Reason
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
          />
        </label>
        <label>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Texte du rectificatif · Correction text
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className={inputCls}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !reason.trim() || !text.trim()}
            className="flex min-h-10 items-center gap-2 rounded-full bg-accent px-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Enregistrer
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
