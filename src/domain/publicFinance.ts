// National government budget, in KES billions. Rounded estimates for illustration,
// shaped on Kenya's published budget estimates. Replace with National Treasury
// figures (treasury.go.ke) for anything official.

export interface BudgetLine { key: string; label: string; amount: number; note?: string }

export const FISCAL_YEAR = '2024/25'

export const REVENUE: BudgetLine[] = [
  { key: 'income', label: 'Income tax', amount: 1250, note: 'PAYE and corporate tax' },
  { key: 'vat', label: 'VAT', amount: 760, note: '16% on most goods and services' },
  { key: 'ain', label: 'Ministry fees & A-in-A', amount: 420, note: 'Fees and charges kept by agencies' },
  { key: 'excise', label: 'Excise duty', amount: 330, note: 'Fuel, alcohol, tobacco, airtime, betting' },
  { key: 'import', label: 'Import duty', amount: 160 },
  { key: 'other', label: 'Other revenue', amount: 160, note: 'Fines, dividends, licences' },
]

export const FINANCING: BudgetLine[] = [
  { key: 'domestic', label: 'Domestic borrowing', amount: 400, note: 'Treasury bills and bonds' },
  { key: 'external', label: 'External borrowing', amount: 360, note: 'Loans from lenders and partners' },
]

export const SPENDING: BudgetLine[] = [
  { key: 'debt', label: 'Debt interest', amount: 1000, note: 'Interest on domestic and external debt' },
  { key: 'education', label: 'Education', amount: 700, note: 'Teachers, capitation, universities, HELB' },
  { key: 'infrastructure', label: 'Roads, energy & transport', amount: 450 },
  { key: 'counties', label: 'Counties (equitable share)', amount: 400, note: 'Shared across all 47 counties' },
  { key: 'security', label: 'Defence & police', amount: 360 },
  { key: 'governance', label: 'Governance, justice & admin', amount: 250 },
  { key: 'pensions', label: 'Pensions & constitutional offices', amount: 230 },
  { key: 'health', label: 'Health', amount: 130, note: 'National share; counties fund most clinics' },
  { key: 'environment', label: 'Water & environment', amount: 120 },
  { key: 'agriculture', label: 'Agriculture', amount: 80 },
  { key: 'social', label: 'Social protection', amount: 70, note: 'Inua Jamii cash transfers' },
  { key: 'other', label: 'Other', amount: 50 },
]

export const HISTORY = [
  { year: '20/21', revenue: 1800, spending: 2900 },
  { year: '21/22', revenue: 2200, spending: 3100 },
  { year: '22/23', revenue: 2360, spending: 3350 },
  { year: '23/24', revenue: 2600, spending: 3600 },
  { year: '24/25', revenue: 3080, spending: 3840 },
]

export const COUNTIES = [
  { name: 'Nairobi', amount: 21.4 }, { name: 'Turkana', amount: 13.9 }, { name: 'Kakamega', amount: 13.2 },
  { name: 'Mandera', amount: 12.4 }, { name: 'Bungoma', amount: 11.4 }, { name: 'Kilifi', amount: 11.7 },
  { name: 'Nakuru', amount: 10.9 }, { name: 'Kiambu', amount: 10.7 }, { name: 'Meru', amount: 9.4 }, { name: 'Kisumu', amount: 9.0 },
]

export const VAT_RATE = 0.16
// Recorded categories where VAT is usually charged. Rent and most fresh food are exempt or zero-rated.
export const VAT_CATEGORIES = ['Transport', 'Entertainment', 'Subscriptions', 'Shopping', 'Utilities', 'Business', 'Other']

export const sum = (l: BudgetLine[]) => l.reduce((a, x) => a + x.amount, 0)
