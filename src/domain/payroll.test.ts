import { describe, expect, it } from 'vitest'
import { incomeTax, payrollTotals, payslip } from './payroll'

describe('payroll', () => {
  it('computes statutory deductions for a mid salary', () => {
    const p = payslip(50000)
    expect(p.nssf).toBe(3000)
    expect(p.shif).toBe(1375)
    expect(p.housing_levy).toBe(750)
    expect(p.paye).toBe(5845.85)
    expect(p.net).toBe(39029.15)
  })
  it('applies the SHIF minimum and leaves low earners with no PAYE', () => {
    const p = payslip(10000)
    expect(p.shif).toBe(300)
    expect(p.paye).toBe(0)
    expect(p.net).toBe(10000 - 600 - 300 - 150)
  })
  it('caps NSSF at the upper earnings limit', () => {
    expect(payslip(200000).nssf).toBe(4320)
  })
  it('taxes across bands and subtracts personal relief', () => {
    expect(incomeTax(24000)).toBe(0)
    expect(incomeTax(32333)).toBe(2083.25)
  })
  it('totals employer cost including employer contributions', () => {
    const lines = [50000, 20000].map((g, i) => ({ employee_id: String(i), full_name: 'x', role: null, pay_method: 'mpesa' as const, ...payslip(g) }))
    const t = payrollTotals(lines)
    expect(t.total_gross).toBe(70000)
    expect(t.employer_cost).toBe(70000 + 3000 + 1200 + 750 + 300)
  })
})
