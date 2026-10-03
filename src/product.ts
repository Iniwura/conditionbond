export const ROUTES = ['dashboard', 'create', 'bond', 'review', 'settlement', 'audit'] as const
export type Route = (typeof ROUTES)[number]

export type BondStatus = 'DRAFT' | 'FUNDED' | 'ACTIVE' | 'RETURN_SUBMITTED' | 'REVIEWED' | 'SETTLED' | 'UNDETERMINED' | 'EXPIRED' | 'REFUNDED'
export type BondAction = 'fund' | 'activate' | 'submit_return' | 'review' | 'settle'
export type Verdict = 'UNCHANGED' | 'ACCEPTABLE_WEAR' | 'MATERIAL_DAMAGE' | 'UNDETERMINED'

export type CreateBondInput = {
  item: string
  amount: string
  counterparty: string
  beforeUrl?: string
}

export type BondParties = {
  status: BondStatus
  owner: string
  custodian: string
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const VERDICTS = new Set<Verdict>(['UNCHANGED', 'ACCEPTABLE_WEAR', 'MATERIAL_DAMAGE', 'UNDETERMINED'])

export function validateCreateBondInput(input: CreateBondInput): string | null {
  if (!input.item.trim()) return 'Add the item being bonded.'
  if (!ADDRESS.test(input.counterparty.trim())) return 'Enter a valid custodian wallet address.'
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a bond amount greater than zero.'
  if (amount > 1_000_000) return 'Bond amount exceeds the protocol limit.'
  if (input.beforeUrl?.trim()) {
    try {
      const parsed = new URL(input.beforeUrl.trim())
      if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.hash || parsed.username || parsed.password) return 'Before evidence must be an HTTPS URL without credentials or fragments.'
    } catch {
      return 'Before evidence must be a valid HTTPS URL.'
    }
  }
  return null
}

export function comparableEvidence(beforeUrl: string, afterUrl: string): boolean {
  try {
    const before = new URL(beforeUrl)
    const after = new URL(afterUrl)
    return before.protocol === 'https:' && after.protocol === 'https:' && before.href !== after.href
  } catch {
    return false
  }
}

export function normalizeVerdict(value: unknown): Verdict {
  return typeof value === 'string' && VERDICTS.has(value as Verdict) ? value as Verdict : 'UNDETERMINED'
}

export function settlementFor(verdict: Verdict, amountWei: bigint, damageBps: bigint): { damageCharge: bigint; ownerReceipt: bigint; custodianReceipt: bigint } | null {
  if (verdict === 'UNDETERMINED') return null
  const damageCharge = verdict === 'MATERIAL_DAMAGE' ? amountWei * damageBps / 10_000n : 0n
  return { damageCharge, ownerReceipt: damageCharge, custodianReceipt: amountWei - damageCharge }
}

export function canPerformBondAction(action: BondAction, viewer: string | null, bond: BondParties): boolean {
  if (!viewer || ['SETTLED', 'UNDETERMINED', 'EXPIRED', 'REFUNDED'].includes(bond.status)) return false
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase()
  if (action === 'fund') return bond.status === 'DRAFT' && same(viewer, bond.owner)
  if (action === 'activate') return bond.status === 'FUNDED' && same(viewer, bond.custodian)
  if (action === 'submit_return') return bond.status === 'ACTIVE' && same(viewer, bond.custodian)
  if (action === 'review') return bond.status === 'RETURN_SUBMITTED' && same(viewer, bond.owner)
  return bond.status === 'REVIEWED' && (same(viewer, bond.owner) || same(viewer, bond.custodian))
}

export function routeForPath(pathname: string): Route {
  const path = pathname.replace(/^\//, '').replace(/\/$/, '')
  return (ROUTES as readonly string[]).includes(path) ? path as Route : 'dashboard'
}
