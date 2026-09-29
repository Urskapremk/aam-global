// HR department — pure helpers shared by the server actions and the admin UI.
// Kept out of the 'use server' action file on purpose: that file may only
// export async functions, and these are plain constants and sync maths.

export type EmploymentType = 'regular' | 'contract' | 'intern'
export type ContractType = 'CDI' | 'CDD' | 'trial'
export type LeaveKind = 'annual' | 'sick' | 'unpaid' | 'other'
export type RecordKind = 'warning' | 'sanction' | 'commendation'

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  regular: 'Regular employee',
  contract: 'Contract',
  intern: 'Intern',
}

export const CONTRACT_LABELS: Record<ContractType, string> = {
  CDI: 'Permanent (CDI)',
  CDD: 'Fixed-term (CDD)',
  trial: 'Trial period',
}

export const LEAVE_LABELS: Record<LeaveKind, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  unpaid: 'Unpaid leave',
  other: 'Other absence',
}

export const RECORD_LABELS: Record<RecordKind, string> = {
  warning: 'Warning',
  sanction: 'Sanction',
  commendation: 'Commendation',
}

// Madagascar labour code: 2.5 days of paid leave accrue per month worked.
export const LEAVE_DAYS_PER_MONTH = 2.5

// --- Madagascar payroll (same model as the Komba Cabana "Obračun plač MG") ---
// Base salary is the NET the worker receives. Employee CNAPS/OMINO and IRSA are
// grossed up on top of it and then shown as deductions, so the payout equals
// base + additions − advances − other deductions. Employer contributions are a
// cost to the company only and are never taken from the worker.

export const MG_MONTHLY_HOURS = 173.33
export const MG_DEFAULT_IRSA = 3000

export const MG_CONTRIBUTIONS = [
  { id: 'cnaps', name: 'CNAPS', employeeRate: 0.01, employerRate: 0.13 },
  { id: 'omino', name: 'OMINO', employeeRate: 0.01, employerRate: 0.065 },
  { id: 'fmfp', name: 'FMFP', employeeRate: 0, employerRate: 0.01 },
] as const

export const MG_RATES = { sunday: 0.4, holiday: 0.4, overtime: 0.3 }

// Seniority bonus (prime d'ancienneté): 3 % after 2 full years, +1 % a year.
export function seniorityRateForYears(years: number): number {
  if (years < 2) return 0
  return 0.03 + (Math.floor(years) - 2) * 0.01
}

export function fullYearsBetween(fromIso: string | null, toIso: string): number {
  if (!fromIso) return 0
  const a = new Date(fromIso)
  const b = new Date(toIso)
  if (isNaN(a.getTime())) return 0
  let y = b.getFullYear() - a.getFullYear()
  if (
    b.getMonth() < a.getMonth() ||
    (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())
  )
    y -= 1
  return Math.max(0, y)
}

export type PayslipInput = {
  baseSalary: number
  sundayHours?: number
  holidayHours?: number
  overtimeHours?: number
  otherBonuses?: number
  irsa?: number | null
  advances?: number
  otherDeductions?: number
  seniorityYears?: number
}

export type Payslip = {
  baseSalary: number
  hourlyRate: number
  sundayAmount: number
  holidayAmount: number
  overtimeAmount: number
  seniorityRate: number
  seniorityAmount: number
  otherBonuses: number
  totalAdditions: number
  contributions: {
    id: string
    name: string
    employeeRate: number
    employerRate: number
    employeeAmount: number
    employerAmount: number
  }[]
  totalEmployeeContributions: number
  irsa: number
  grossPay: number
  advances: number
  otherDeductions: number
  totalDeductions: number
  netToPay: number
  employerContributions: number
  totalEmployerCost: number
}

const num = (v: number | null | undefined) => (v == null || isNaN(v) ? 0 : v)

export function calcPayslip(input: PayslipInput): Payslip {
  const baseSalary = Math.round(num(input.baseSalary))
  const hourlyRate = baseSalary / MG_MONTHLY_HOURS

  const sundayAmount = Math.round(num(input.sundayHours) * hourlyRate * MG_RATES.sunday)
  const holidayAmount = Math.round(num(input.holidayHours) * hourlyRate * MG_RATES.holiday)
  const overtimeAmount = Math.round(num(input.overtimeHours) * hourlyRate * MG_RATES.overtime)
  const seniorityRate = seniorityRateForYears(num(input.seniorityYears))
  const seniorityAmount = Math.round(baseSalary * seniorityRate)
  const otherBonuses = Math.round(num(input.otherBonuses))
  const totalAdditions =
    sundayAmount + holidayAmount + overtimeAmount + seniorityAmount + otherBonuses

  const contributions = MG_CONTRIBUTIONS.map((c) => ({
    id: c.id,
    name: c.name,
    employeeRate: c.employeeRate,
    employerRate: c.employerRate,
    employeeAmount: Math.round(baseSalary * c.employeeRate),
    employerAmount: Math.round(baseSalary * c.employerRate),
  }))
  const totalEmployeeContributions = contributions.reduce((s, c) => s + c.employeeAmount, 0)
  const employerContributions = contributions.reduce((s, c) => s + c.employerAmount, 0)

  const hasEarnings = baseSalary > 0 || totalAdditions > 0
  const irsa = hasEarnings
    ? Math.round(input.irsa != null ? num(input.irsa) : MG_DEFAULT_IRSA)
    : 0

  const advances = Math.round(num(input.advances))
  const otherDeductions = Math.round(num(input.otherDeductions))
  const grossPay = baseSalary + totalAdditions + totalEmployeeContributions + irsa
  const totalDeductions = totalEmployeeContributions + irsa + advances + otherDeductions
  const netToPay = grossPay - totalDeductions

  return {
    baseSalary,
    hourlyRate,
    sundayAmount,
    holidayAmount,
    overtimeAmount,
    seniorityRate,
    seniorityAmount,
    otherBonuses,
    totalAdditions,
    contributions,
    totalEmployeeContributions,
    irsa,
    grossPay,
    advances,
    otherDeductions,
    totalDeductions,
    netToPay,
    employerContributions,
    totalEmployerCost: grossPay + employerContributions,
  }
}

// Inclusive calendar-day count of a leave period.
export function leaveDays(startIso: string, endIso: string): number {
  const a = Date.parse(`${startIso}T00:00:00Z`)
  const b = Date.parse(`${endIso}T00:00:00Z`)
  if (isNaN(a) || isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

// Leave accrued in `year`, counting only the months worked since hire.
export function accruedLeave(hireIso: string | null, year: number, todayIso: string): number {
  const today = new Date(todayIso)
  const lastMonth = today.getFullYear() > year ? 12 : today.getMonth() + 1
  let firstMonth = 1
  if (hireIso) {
    const h = new Date(hireIso)
    if (isNaN(h.getTime())) firstMonth = 1
    else if (h.getFullYear() > year) return 0
    else if (h.getFullYear() === year) firstMonth = h.getMonth() + 1
  }
  const months = Math.max(0, lastMonth - firstMonth + 1)
  return months * LEAVE_DAYS_PER_MONTH
}

export const ariary = (n: number) =>
  `${new Intl.NumberFormat('en-GB').format(Math.round(n))} Ar`
