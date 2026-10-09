// Kenyan statutory payroll deductions (monthly), as in force from early 2025:
//  - NSSF (Act 2013, year 3 rates): 6% employee + 6% employer, Tier I up to KES 8,000, Tier II up to KES 72,000
//  - SHIF: 2.75% of gross, minimum KES 300
//  - Affordable Housing Levy: 1.5% employee + 1.5% employer
//  - PAYE on gross less NSSF, SHIF and AHL (Tax Laws (Amendment) Act 2024), less KES 2,400 personal relief
// These are estimates for planning. Employers should confirm current rates with KRA.
import type { Employee, PayrollLine } from './types'

export const NSSF = { rate: 0.06, lower: 8000, upper: 72000 }
export const SHIF = { rate: 0.0275, min: 300 }
export const HOUSING_LEVY = 0.015
export const PERSONAL_RELIEF = 2400
export const PAYE_BANDS: [width: number, rate: number][] = [[24000, 0.1], [8333, 0.25], [467667, 0.3], [300000, 0.325], [Infinity, 0.35]]

const r2 = (n: number) => Math.round(n * 100) / 100

export function incomeTax(taxable: number) {
  let left = Math.max(0, taxable), tax = 0
  for (const [width, rate] of PAYE_BANDS) {
    const slice = Math.min(left, width)
    tax += slice * rate
    left -= slice
    if (left <= 0) break
  }
  return r2(Math.max(0, tax - PERSONAL_RELIEF))
}

export function payslip(gross: number) {
  const nssf = r2(Math.min(gross, NSSF.upper) * NSSF.rate)
  const shif = r2(Math.max(SHIF.min, gross * SHIF.rate))
  const housing_levy = r2(gross * HOUSING_LEVY)
  const paye = incomeTax(gross - nssf - shif - housing_levy)
  const net = r2(gross - nssf - shif - housing_levy - paye)
  return { gross, nssf, shif, housing_levy, paye, net, employer_nssf: nssf, employer_housing_levy: housing_levy }
}

export const payrollLine = (e: Employee): PayrollLine => ({ employee_id: e.id, full_name: e.full_name, role: e.role, pay_method: e.pay_method, ...payslip(e.gross_salary) })

export function payrollTotals(lines: PayrollLine[]) {
  const sum = (k: keyof PayrollLine) => r2(lines.reduce((a, l) => a + (l[k] as number), 0))
  const total_gross = sum('gross')
  const total_net = sum('net')
  const employer_cost = r2(total_gross + sum('employer_nssf') + sum('employer_housing_levy'))
  const statutory = r2(total_gross - total_net + sum('employer_nssf') + sum('employer_housing_levy'))
  return { total_gross, total_net, employer_cost, statutory, paye: sum('paye') }
}
