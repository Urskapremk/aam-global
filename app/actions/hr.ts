'use server'

import { revalidatePath } from 'next/cache'

import { pool } from '@/lib/db'
import { isAdmin } from '@/lib/admin-auth'
import { getCrewMonth, getKnownWorkers } from '@/app/actions/crew'

// HR department. People are keyed by NAME, the same unit the crew payroll uses
// (captains carry a name, crew are free-text names on a trip), so every known
// captain and crew member automatically gets an HR card here.

export type HrStaff = {
  id: string
  name: string
  role: 'captain' | 'crew' | 'staff'
  source: 'crew' | 'manual'
  position: string
  employmentType: string
  birthDate: string
  birthPlace: string
  cin: string
  cnaps: string
  address: string
  phone: string
  paymentMethod: string
  bankAccount: string
  hireDate: string
  baseSalaryAr: number
  contractType: string
  contractStart: string
  contractEnd: string
  active: boolean
  notes: string
}

export type HrLeave = {
  id: string
  staffId: string
  startDate: string
  endDate: string
  kind: string
  note: string
}

export type HrRecord = {
  id: string
  staffId: string
  date: string
  kind: string
  description: string
}

export type HrPayrollEntry = {
  staffId: string
  month: string
  sundayHours: number
  holidayHours: number
  overtimeHours: number
  otherBonuses: number
  irsa: number | null
  advances: number
  otherDeductions: number
}

let ensured: Promise<void> | null = null
function ensureTables(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_staff (
          id text PRIMARY KEY,
          name text NOT NULL UNIQUE,
          role text NOT NULL DEFAULT 'staff',
          source text NOT NULL DEFAULT 'manual',
          position text NOT NULL DEFAULT '',
          "employmentType" text NOT NULL DEFAULT 'regular',
          "birthDate" text NOT NULL DEFAULT '',
          "birthPlace" text NOT NULL DEFAULT '',
          cin text NOT NULL DEFAULT '',
          cnaps text NOT NULL DEFAULT '',
          address text NOT NULL DEFAULT '',
          phone text NOT NULL DEFAULT '',
          "paymentMethod" text NOT NULL DEFAULT '',
          "bankAccount" text NOT NULL DEFAULT '',
          "hireDate" text NOT NULL DEFAULT '',
          "baseSalaryAr" double precision NOT NULL DEFAULT 0,
          "contractType" text NOT NULL DEFAULT 'CDI',
          "contractStart" text NOT NULL DEFAULT '',
          "contractEnd" text NOT NULL DEFAULT '',
          active boolean NOT NULL DEFAULT true,
          notes text NOT NULL DEFAULT '',
          "createdAt" timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS hr_leave (
          id text PRIMARY KEY,
          "staffId" text NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
          "startDate" text NOT NULL,
          "endDate" text NOT NULL,
          kind text NOT NULL DEFAULT 'annual',
          note text NOT NULL DEFAULT '',
          "createdAt" timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS hr_records (
          id text PRIMARY KEY,
          "staffId" text NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
          date text NOT NULL,
          kind text NOT NULL DEFAULT 'warning',
          description text NOT NULL DEFAULT '',
          "createdAt" timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS hr_payroll (
          "staffId" text NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
          month text NOT NULL,
          "sundayHours" double precision NOT NULL DEFAULT 0,
          "holidayHours" double precision NOT NULL DEFAULT 0,
          "overtimeHours" double precision NOT NULL DEFAULT 0,
          "otherBonuses" double precision NOT NULL DEFAULT 0,
          irsa double precision,
          advances double precision NOT NULL DEFAULT 0,
          "otherDeductions" double precision NOT NULL DEFAULT 0,
          PRIMARY KEY ("staffId", month)
        );
      `)
    })().catch((e) => {
      ensured = null
      throw e
    })
  }
  return ensured
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function guard() {
  if (!(await isAdmin())) throw new Error('Not authorised')
  await ensureTables()
}

function rowToStaff(r: Record<string, unknown>): HrStaff {
  return {
    id: String(r.id),
    name: String(r.name),
    role: (r.role as HrStaff['role']) ?? 'staff',
    source: (r.source as HrStaff['source']) ?? 'manual',
    position: String(r.position ?? ''),
    employmentType: String(r.employmentType ?? 'regular'),
    birthDate: String(r.birthDate ?? ''),
    birthPlace: String(r.birthPlace ?? ''),
    cin: String(r.cin ?? ''),
    cnaps: String(r.cnaps ?? ''),
    address: String(r.address ?? ''),
    phone: String(r.phone ?? ''),
    paymentMethod: String(r.paymentMethod ?? ''),
    bankAccount: String(r.bankAccount ?? ''),
    hireDate: String(r.hireDate ?? ''),
    baseSalaryAr: Number(r.baseSalaryAr ?? 0),
    contractType: String(r.contractType ?? 'CDI'),
    contractStart: String(r.contractStart ?? ''),
    contractEnd: String(r.contractEnd ?? ''),
    active: r.active !== false,
    notes: String(r.notes ?? ''),
  }
}

/**
 * Every HR card. Known captains and crew (from Crew payroll) are added on the
 * fly, so the HR list always starts from the real crew and never duplicates
 * a name the office already typed on a trip.
 */
export async function getHrStaff(): Promise<HrStaff[]> {
  await guard()
  const known = await getKnownWorkers()
  for (const w of known) {
    await pool.query(
      `INSERT INTO hr_staff (id, name, role, source, position)
       VALUES ($1, $2, $3, 'crew', $4)
       ON CONFLICT (name) DO NOTHING`,
      [newId('hr'), w.name, w.role, w.role === 'captain' ? 'Captain' : 'Deckhand'],
    )
  }
  const { rows } = await pool.query(
    `SELECT * FROM hr_staff ORDER BY active DESC, (role = 'captain') DESC, name ASC`,
  )
  return rows.map(rowToStaff)
}

const STAFF_FIELDS = [
  'name',
  'position',
  'employmentType',
  'birthDate',
  'birthPlace',
  'cin',
  'cnaps',
  'address',
  'phone',
  'paymentMethod',
  'bankAccount',
  'hireDate',
  'baseSalaryAr',
  'contractType',
  'contractStart',
  'contractEnd',
  'active',
  'notes',
] as const

export async function addHrStaff(name: string, position: string): Promise<{ id: string }> {
  await guard()
  const clean = name.trim()
  if (!clean) throw new Error('Name required')
  const id = newId('hr')
  await pool.query(
    `INSERT INTO hr_staff (id, name, role, source, position) VALUES ($1, $2, 'staff', 'manual', $3)`,
    [id, clean, position.trim()],
  )
  revalidatePath('/admin/hr')
  return { id }
}

export async function updateHrStaff(
  id: string,
  patch: Partial<Omit<HrStaff, 'id' | 'role' | 'source'>>,
): Promise<{ ok: true }> {
  await guard()
  const sets: string[] = []
  const values: unknown[] = []
  for (const key of STAFF_FIELDS) {
    if (key in patch) {
      let v = patch[key as keyof typeof patch] as unknown
      if (key === 'baseSalaryAr') v = Math.max(0, Number(v) || 0)
      if (key === 'name') {
        v = String(v ?? '').trim()
        if (!v) throw new Error('Name required')
      }
      if (typeof v === 'string') v = v.slice(0, 2000)
      values.push(v)
      sets.push(`"${key}" = $${values.length}`)
    }
  }
  if (sets.length === 0) return { ok: true }
  values.push(id)
  await pool.query(`UPDATE hr_staff SET ${sets.join(', ')} WHERE id = $${values.length}`, values)
  revalidatePath('/admin/hr')
  return { ok: true }
}

export async function deleteHrStaff(id: string): Promise<{ ok: true }> {
  await guard()
  // Crew-linked cards would reappear from the trips, so they are only
  // deactivated; manually added cards are removed.
  const { rows } = await pool.query(`SELECT source FROM hr_staff WHERE id = $1`, [id])
  if (rows[0]?.source === 'crew') {
    await pool.query(`UPDATE hr_staff SET active = false WHERE id = $1`, [id])
  } else {
    await pool.query(`DELETE FROM hr_staff WHERE id = $1`, [id])
  }
  revalidatePath('/admin/hr')
  return { ok: true }
}

// --- Leave ---------------------------------------------------------------

export async function getHrLeave(): Promise<HrLeave[]> {
  await guard()
  const { rows } = await pool.query(`SELECT * FROM hr_leave ORDER BY "startDate" DESC`)
  return rows.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    startDate: r.startDate,
    endDate: r.endDate,
    kind: r.kind,
    note: r.note ?? '',
  }))
}

export async function addHrLeave(input: Omit<HrLeave, 'id'>): Promise<{ ok: true }> {
  await guard()
  if (!input.staffId || !input.startDate || !input.endDate) throw new Error('Missing fields')
  if (input.endDate < input.startDate) throw new Error('End date is before start date')
  await pool.query(
    `INSERT INTO hr_leave (id, "staffId", "startDate", "endDate", kind, note) VALUES ($1,$2,$3,$4,$5,$6)`,
    [newId('lv'), input.staffId, input.startDate, input.endDate, input.kind || 'annual', input.note.trim().slice(0, 500)],
  )
  revalidatePath('/admin/hr')
  return { ok: true }
}

export async function deleteHrLeave(id: string): Promise<{ ok: true }> {
  await guard()
  await pool.query(`DELETE FROM hr_leave WHERE id = $1`, [id])
  revalidatePath('/admin/hr')
  return { ok: true }
}

// --- Disciplinary / commendation records -----------------------------------

export async function getHrRecords(): Promise<HrRecord[]> {
  await guard()
  const { rows } = await pool.query(`SELECT * FROM hr_records ORDER BY date DESC`)
  return rows.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    date: r.date,
    kind: r.kind,
    description: r.description ?? '',
  }))
}

export async function addHrRecord(input: Omit<HrRecord, 'id'>): Promise<{ ok: true }> {
  await guard()
  if (!input.staffId || !input.date || !input.description.trim()) throw new Error('Missing fields')
  await pool.query(
    `INSERT INTO hr_records (id, "staffId", date, kind, description) VALUES ($1,$2,$3,$4,$5)`,
    [newId('rec'), input.staffId, input.date, input.kind || 'warning', input.description.trim().slice(0, 2000)],
  )
  revalidatePath('/admin/hr')
  return { ok: true }
}

export async function deleteHrRecord(id: string): Promise<{ ok: true }> {
  await guard()
  await pool.query(`DELETE FROM hr_records WHERE id = $1`, [id])
  revalidatePath('/admin/hr')
  return { ok: true }
}

// --- MG payroll --------------------------------------------------------------

export type HrPayrollMonth = {
  month: string
  entries: HrPayrollEntry[]
  // Already paid out in the Crew payroll ledger this month, by name, so the
  // payslip can be compared with what actually left the cash box.
  paidByName: Record<string, number>
}

export async function getHrPayrollMonth(month: string): Promise<HrPayrollMonth> {
  await guard()
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Bad month')
  const [{ rows }, crew] = await Promise.all([
    pool.query(`SELECT * FROM hr_payroll WHERE month = $1`, [month]),
    getCrewMonth(month),
  ])
  const paidByName: Record<string, number> = {}
  for (const r of crew.rows) if (r.paidAr > 0) paidByName[r.name] = r.paidAr
  return {
    month,
    entries: rows.map((r) => ({
      staffId: r.staffId,
      month: r.month,
      sundayHours: Number(r.sundayHours),
      holidayHours: Number(r.holidayHours),
      overtimeHours: Number(r.overtimeHours),
      otherBonuses: Number(r.otherBonuses),
      irsa: r.irsa == null ? null : Number(r.irsa),
      advances: Number(r.advances),
      otherDeductions: Number(r.otherDeductions),
    })),
    paidByName,
  }
}

export async function upsertHrPayrollEntry(entry: HrPayrollEntry): Promise<{ ok: true }> {
  await guard()
  if (!/^\d{4}-\d{2}$/.test(entry.month)) throw new Error('Bad month')
  const n = (v: number) => Math.max(0, Number(v) || 0)
  await pool.query(
    `INSERT INTO hr_payroll ("staffId", month, "sundayHours", "holidayHours", "overtimeHours", "otherBonuses", irsa, advances, "otherDeductions")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT ("staffId", month) DO UPDATE SET
       "sundayHours" = EXCLUDED."sundayHours",
       "holidayHours" = EXCLUDED."holidayHours",
       "overtimeHours" = EXCLUDED."overtimeHours",
       "otherBonuses" = EXCLUDED."otherBonuses",
       irsa = EXCLUDED.irsa,
       advances = EXCLUDED.advances,
       "otherDeductions" = EXCLUDED."otherDeductions"`,
    [
      entry.staffId,
      entry.month,
      n(entry.sundayHours),
      n(entry.holidayHours),
      n(entry.overtimeHours),
      n(entry.otherBonuses),
      entry.irsa == null ? null : n(entry.irsa),
      n(entry.advances),
      n(entry.otherDeductions),
    ],
  )
  revalidatePath('/admin/hr')
  return { ok: true }
}
