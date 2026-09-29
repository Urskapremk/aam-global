'use server'

import { revalidatePath } from 'next/cache'

import { pool } from '@/lib/db'
import { isAdmin } from '@/lib/admin-auth'
import { getHrStaff } from '@/app/actions/hr'
import {
  OFF,
  SHIFT_COLORS,
  type ScheduleCell,
  type ScheduleGroup,
  type ScheduleShift,
} from '@/lib/hr-schedule'

let ensured: Promise<void> | null = null
function ensureTables(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      // getHrStaff creates the base hr_* tables (hr_staff, hr_payroll) first.
      await getHrStaff()
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_schedule_groups (
          id text PRIMARY KEY,
          name text NOT NULL,
          shifts jsonb NOT NULL DEFAULT '[]'::jsonb,
          "memberIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "createdAt" timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS hr_schedule_cells (
          "groupId" text NOT NULL REFERENCES hr_schedule_groups(id) ON DELETE CASCADE,
          "staffId" text NOT NULL,
          date text NOT NULL,
          shift text NOT NULL,
          PRIMARY KEY ("groupId", "staffId", date)
        );
        ALTER TABLE hr_schedule_groups ADD COLUMN IF NOT EXISTS "fixedShifts" jsonb NOT NULL DEFAULT '{}'::jsonb;
      `)
    })().catch((e) => {
      ensured = null
      throw e
    })
  }
  return ensured
}

async function guard() {
  if (!(await isAdmin())) throw new Error('Not authorised')
  await ensureTables()
}

function isMonth(v: string): boolean {
  return /^\d{4}-\d{2}$/.test(v)
}

function isDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function cleanShifts(shifts: ScheduleShift[]): ScheduleShift[] {
  return shifts
    .slice(0, 6)
    .map((s, i) => ({
      code: String(s.code || `S${i + 1}`).slice(0, 12),
      label: String(s.label ?? '').trim().slice(0, 60) || `Shift ${i + 1}`,
      hours: Math.min(24, Math.max(0, Number(s.hours) || 0)),
      color: SHIFT_COLORS.includes(s.color) ? s.color : SHIFT_COLORS[i % SHIFT_COLORS.length],
    }))
    .filter((s) => s.code !== OFF)
}

export async function getScheduleGroups(): Promise<ScheduleGroup[]> {
  await guard()
  const { rows } = await pool.query(`SELECT * FROM hr_schedule_groups ORDER BY "createdAt" ASC`)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    shifts: Array.isArray(r.shifts) ? r.shifts : [],
    memberIds: Array.isArray(r.memberIds) ? r.memberIds : [],
    fixedShifts:
      r.fixedShifts && typeof r.fixedShifts === 'object' && !Array.isArray(r.fixedShifts) ? r.fixedShifts : {},
  }))
}

export async function saveScheduleGroup(input: {
  id?: string
  name: string
  shifts: ScheduleShift[]
  memberIds: string[]
  fixedShifts?: Record<string, string>
}): Promise<{ id: string }> {
  await guard()
  const name = input.name.trim().slice(0, 80)
  if (!name) throw new Error('Name required')
  const shifts = cleanShifts(input.shifts)
  if (shifts.length === 0) throw new Error('At least one shift is required')
  const memberIds = [...new Set(input.memberIds.map(String))].slice(0, 60)
  const codes = new Set(shifts.map((s) => s.code))
  const fixedShifts: Record<string, string> = {}
  for (const [staffId, code] of Object.entries(input.fixedShifts ?? {})) {
    if (memberIds.includes(staffId) && codes.has(String(code))) fixedShifts[staffId] = String(code)
  }
  const id = input.id || `sg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  await pool.query(
    `INSERT INTO hr_schedule_groups (id, name, shifts, "memberIds", "fixedShifts") VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, shifts = EXCLUDED.shifts, "memberIds" = EXCLUDED."memberIds", "fixedShifts" = EXCLUDED."fixedShifts"`,
    [id, name, JSON.stringify(shifts), JSON.stringify(memberIds), JSON.stringify(fixedShifts)],
  )
  // Cells whose shift no longer exists become OFF.
  await pool.query(
    `UPDATE hr_schedule_cells SET shift = $2 WHERE "groupId" = $1 AND shift <> $2 AND NOT (shift = ANY($3::text[]))`,
    [id, OFF, shifts.map((s) => s.code)],
  )
  revalidatePath('/admin/hr')
  return { id }
}

export async function deleteScheduleGroup(id: string): Promise<{ ok: true }> {
  await guard()
  await pool.query(`DELETE FROM hr_schedule_groups WHERE id = $1`, [id])
  revalidatePath('/admin/hr')
  return { ok: true }
}

export async function getScheduleMonth(groupId: string, month: string): Promise<ScheduleCell[]> {
  await guard()
  if (!isMonth(month)) throw new Error('Invalid month')
  const { rows } = await pool.query(
    `SELECT "staffId", date, shift FROM hr_schedule_cells WHERE "groupId" = $1 AND date LIKE $2`,
    [groupId, `${month}-%`],
  )
  return rows.map((r) => ({ staffId: r.staffId, date: r.date, shift: r.shift }))
}

export async function setScheduleCell(
  groupId: string,
  staffId: string,
  date: string,
  shift: string,
): Promise<{ ok: true }> {
  await guard()
  if (!isDate(date)) throw new Error('Invalid date')
  await pool.query(
    `INSERT INTO hr_schedule_cells ("groupId", "staffId", date, shift) VALUES ($1, $2, $3, $4)
     ON CONFLICT ("groupId", "staffId", date) DO UPDATE SET shift = EXCLUDED.shift`,
    [groupId, staffId, date, String(shift).slice(0, 12)],
  )
  return { ok: true }
}

export async function replaceScheduleMonth(
  groupId: string,
  month: string,
  cells: ScheduleCell[],
): Promise<{ ok: true }> {
  await guard()
  if (!isMonth(month)) throw new Error('Invalid month')
  const valid = cells.filter((c) => isDate(c.date) && c.date.startsWith(month)).slice(0, 5000)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM hr_schedule_cells WHERE "groupId" = $1 AND date LIKE $2`, [
      groupId,
      `${month}-%`,
    ])
    if (valid.length > 0) {
      await client.query(
        `INSERT INTO hr_schedule_cells ("groupId", "staffId", date, shift)
         SELECT $1, s, d, sh FROM unnest($2::text[], $3::text[], $4::text[]) AS t(s, d, sh)`,
        [groupId, valid.map((c) => c.staffId), valid.map((c) => c.date), valid.map((c) => String(c.shift).slice(0, 12))],
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  return { ok: true }
}

/** Writes Sunday and holiday hours into the month's payroll, leaving the rest untouched. */
export async function sendScheduleHoursToPayroll(
  month: string,
  rows: { staffId: string; sundayHours: number; holidayHours: number }[],
): Promise<{ updated: number }> {
  await guard()
  if (!isMonth(month)) throw new Error('Invalid month')
  for (const r of rows) {
    await pool.query(
      `INSERT INTO hr_payroll ("staffId", month, "sundayHours", "holidayHours") VALUES ($1, $2, $3, $4)
       ON CONFLICT ("staffId", month) DO UPDATE SET "sundayHours" = EXCLUDED."sundayHours", "holidayHours" = EXCLUDED."holidayHours"`,
      [r.staffId, month, Math.max(0, Number(r.sundayHours) || 0), Math.max(0, Number(r.holidayHours) || 0)],
    )
  }
  revalidatePath('/admin/hr')
  return { updated: rows.length }
}
