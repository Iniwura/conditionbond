export const ROUTES = ['dashboard', 'create', 'audit'] as const
export type StaticRoute = (typeof ROUTES)[number]

export type Route =
  | { kind: 'dashboard' }
  | { kind: 'create' }
  | { kind: 'audit' }
  | { kind: 'bond'; bondId: string }
  | { kind: 'review'; bondId: string }
  | { kind: 'settlement'; bondId: string }

export type BondStatus = 'DRAFT' | 'FUNDED' | 'ACTIVE' | 'RETURN_SUBMITTED' | 'REVIEWED' | 'SETTLED' | 'UNDETERMINED' | 'EXPIRED' | 'REFUNDED'
export type BondAction = 'fund' | 'activate' | 'submit_return' | 'review' | 'settle'
export type Verdict = 'UNCHANGED' | 'ACCEPTABLE_WEAR' | 'MATERIAL_DAMAGE' | 'UNDETERMINED'

export type CreateBondInput = {
  item: string
  amount: string
  counterparty: string
  beforeUrl: string
  criteria: string[]
  acceptableWear: string
  materialDamage: string
  damageBps: string
  deadline: string
}

export type BondParties = {
  status: BondStatus
  owner: string
  custodian: string
}

export type ChainBond = Record<string, any> & {
  bond_id: string
  owner: string
  custodian: string
  amount: string | number | bigint
  damage_bps: string | number | bigint
  deadline_utc: string
  before_manifest: string
  criteria: string
  acceptable_wear: string
  material_damage: string
  after_manifest: string
  verdict: Verdict | string
  reasoning: string
  damage_charge: string | number | bigint
  owner_receipt: string | number | bigint
  custodian_receipt: string | number | bigint
  status: BondStatus | string
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const VERDICTS = new Set<Verdict>(['UNCHANGED', 'ACCEPTABLE_WEAR', 'MATERIAL_DAMAGE', 'UNDETERMINED'])

export function validateCreateBondInput(input: CreateBondInput): string | null {
  if (!input.item.trim()) return 'Add the item being bonded.'
  if (!ADDRESS.test(input.counterparty.trim())) return 'Enter a valid custodian wallet address.'
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a bond amount greater than zero.'
  if (amount > 1_000_000) return 'Bond amount exceeds the protocol limit.'
  const validateUrl = (value: string, label: string) => {
    try {
      const parsed = new URL(value.trim())
      if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.hash || parsed.username || parsed.password) return `${label} must be an HTTPS URL without credentials or fragments.`
    } catch { return `${label} must be a valid HTTPS URL.` }
    return null
  }
  const urlError = validateUrl(input.beforeUrl, 'Before evidence')
  if (urlError) return urlError
  if (!input.criteria.length || input.criteria.some((criterion) => !criterion.trim())) return 'Add at least one non-empty condition criterion.'
  if (!input.acceptableWear.trim()) return 'Define acceptable wear before freezing the policy.'
  if (!input.materialDamage.trim()) return 'Define material damage before freezing the policy.'
  const bps = Number(input.damageBps)
  if (!Number.isInteger(bps) || bps < 1 || bps > 10_000) return 'Damage policy must be an integer from 1 to 10000 BPS.'
  if (!input.deadline.trim()) return 'Set a UTC deadline before creating the bond.'
  if (Number.isNaN(Date.parse(input.deadline))) return 'Deadline must be a valid UTC date/time.'
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
  const parts = pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  if (!parts.length) return { kind: 'dashboard' }
  if (parts[0] === 'create') return { kind: 'create' }
  if (parts[0] === 'audit') return { kind: 'audit' }
  if (parts[0] === 'bonds' && parts[1]) {
    if (parts[2] === 'review') return { kind: 'review', bondId: parts[1] }
    if (parts[2] === 'settlement') return { kind: 'settlement', bondId: parts[1] }
    return { kind: 'bond', bondId: parts[1] }
  }
  return { kind: 'dashboard' }
}

export function pathForRoute(route: Route): string {
  if (route.kind === 'dashboard') return '/'
  if (route.kind === 'create') return '/create'
  if (route.kind === 'audit') return '/audit'
  return `/bonds/${encodeURIComponent(route.bondId)}${route.kind === 'bond' ? '' : `/${route.kind}`}`
}
