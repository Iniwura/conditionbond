import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  Gavel,
  Info,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react'
import './styles.css'
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  SOURCE_SHA256,
  connectWallet,
  errorMessage,
  formatGen,
  readBond,
  readBondIds,
  readContractBalance,
  short,
  watchWallet,
  writeAndFinalize,
} from './genlayer'
import {
  canPerformBondAction,
  comparableEvidence,
  normalizeVerdict,
  pathForRoute,
  routeForPath,
  validateCreateBondInput,
  type BondAction,
  type BondStatus,
  type ChainBond,
  type CreateBondInput,
  type Route,
  type Verdict,
} from './product'

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue'
type RecordMap = Record<string, ChainBond>

const KNOWN_AUDIT_HASHES = [
  { label: 'Production deployment', hash: '0x7ed51eee49ea1dbaebc49c5a7f0428b57f963105cdd25182b5d362e641e5e1db' },
  { label: 'UNDETERMINED bond creation', hash: '0xc86c67e9ec5ceee5b04c65b12866cd6386e19c770cf815fe18d332a992aaa098' },
]

function iconForTone(tone: Tone) {
  if (tone === 'green') return <CheckCircle2 size={15} />
  if (tone === 'amber') return <Clock3 size={15} />
  if (tone === 'red') return <X size={15} />
  return <Info size={15} />
}

function statusTone(status: string): Tone {
  if (status === 'SETTLED' || status === 'REVIEWED') return 'green'
  if (status === 'UNDETERMINED' || status === 'EXPIRED') return 'amber'
  if (status === 'RETURN_SUBMITTED' || status === 'ACTIVE') return 'blue'
  if (status === 'DRAFT' || status === 'FUNDED') return 'neutral'
  return 'red'
}

function verdictTone(verdict: Verdict): Tone {
  if (verdict === 'MATERIAL_DAMAGE') return 'red'
  if (verdict === 'UNDETERMINED') return 'amber'
  if (verdict === 'UNCHANGED' || verdict === 'ACCEPTABLE_WEAR') return 'green'
  return 'neutral'
}

function labelForStatus(value: string) { return value.replace(/_/g, ' ') }
function labelForVerdict(value: string) { return value.replace(/_/g, ' ') }

function toBigInt(value: unknown): bigint {
  try { return BigInt(String(value ?? 0)) } catch { return 0n }
}

function genToWei(value: string): bigint {
  const normalized = value.trim()
  if (!/^\d+(\.\d{1,18})?$/.test(normalized)) throw new Error('Bond amount must be a decimal GEN value with at most 18 decimals.')
  const parts = normalized.split('.')
  return BigInt(parts[0]) * 1_000_000_000_000_000_000n + BigInt((parts[1] || '').padEnd(18, '0') || 0)
}

function parseJson(value: unknown): any {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return null }
}

function parseManifest(value: unknown): Array<{ evidence_id?: string; url?: string; sha256?: string }> {
  const parsed = parseJson(value)
  return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : []
}

function parsePolicy(value: unknown): Record<string, any> {
  const parsed = parseJson(value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function criteriaFor(bond: ChainBond) {
  const parsed = parseJson(bond.criteria)
  return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : []
}

function itemDescription(bond: ChainBond) {
  const acceptable = parsePolicy(bond.acceptable_wear)
  const material = parsePolicy(bond.material_damage)
  return String(acceptable.asset_description || material.asset_description || bond.bond_id)
}

function policyDefinition(value: unknown) {
  const policy = parsePolicy(value)
  return String(policy.definition || policy.rule || JSON.stringify(policy))
}

function beforeUrlFor(bond: ChainBond) {
  return String(parseManifest(bond.before_manifest)[0]?.url || '')
}

function afterUrlFor(bond: ChainBond) {
  return String(parseManifest(bond.after_manifest)[0]?.url || '')
}

function isValidEvidenceUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.hash && !url.username && !url.password
  } catch { return false }
}

function utcDeadline(value: string) {
  if (/Z$/.test(value)) return value
  return value.length === 16 ? value + ':00Z' : value
}

function readAuthoritativeState() {
  return Promise.all([readBondIds(), readContractBalance()]).then(async ([ids, balance]) => {
    const pairs = await Promise.all(ids.map(async (id) => [id, await readBond(id)] as const))
    return {
      ids,
      balance,
      records: pairs.reduce<RecordMap>((result, [id, record]) => {
        result[id] = record as ChainBond
        return result
      }, {}),
    }
  })
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeForPath(window.location.pathname))
  const [bondIds, setBondIds] = useState<string[]>([])
  const [records, setRecords] = useState<RecordMap>({})
  const [contractBalance, setContractBalance] = useState(0n)
  const [account, setAccount] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [readError, setReadError] = useState('')
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [copied, setCopied] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }

  const refresh = async () => {
    setLoading(true)
    setReadError('')
    try {
      const state = await readAuthoritativeState()
      setBondIds(state.ids)
      setRecords(state.records)
      setContractBalance(toBigInt(state.balance))
    } catch (error) {
      setReadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [refreshNonce])

  useEffect(() => {
    const onPopState = () => setRoute(routeForPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => watchWallet(
    (address) => setAccount(address),
    () => {
      setAccount(null)
      showToast('Wallet network changed; reconnect on Studio Dev.')
    },
  ), [])

  const navigate = (next: Route) => {
    const path = pathForRoute(next)
    window.history.pushState({}, '', path)
    setRoute(next)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const copyValue = (value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const writeForBond = async (
    bondId: string | null,
    functionName: string,
    args: any[],
    value: bigint,
    success: string,
  ): Promise<boolean> => {
    if (!account) {
      showToast('Connect a Studio Dev wallet before writing.')
      return false
    }
    try {
      const result = await writeAndFinalize(account, functionName, args, value)
      setRefreshNonce((nonce) => nonce + 1)
      await refresh()
      showToast(success + ' · ' + short(result.hash))
      return true
    } catch (error) {
      showToast(errorMessage(error))
      return false
    }
  }

  const createBond = async (input: CreateBondInput) => {
    const validation = validateCreateBondInput(input)
    if (validation) {
      showToast(validation)
      return false
    }
    if (!account) {
      showToast('Connect a Studio Dev wallet before creating a bond.')
      return false
    }
    try {
      const bondId = 'CB-' + Date.now().toString(36).toUpperCase()
      const amountWei = genToWei(input.amount)
      const criteria = input.criteria.map((requirement, index) => ({
        criterion_id: 'criterion_' + String(index + 1),
        requirement: requirement.trim(),
      }))
      const beforeManifest = JSON.stringify([{ evidence_id: 'before-1', url: input.beforeUrl.trim(), sha256: '' }])
      const acceptableWear = JSON.stringify({ asset_description: input.item.trim(), definition: input.acceptableWear.trim() })
      const materialDamage = JSON.stringify({ asset_description: input.item.trim(), definition: input.materialDamage.trim() })
      const result = await writeAndFinalize(account, 'create_bond', [
        bondId,
        input.counterparty.trim(),
        amountWei,
        beforeManifest,
        JSON.stringify(criteria),
        acceptableWear,
        materialDamage,
        BigInt(input.damageBps),
        utcDeadline(input.deadline.trim()),
      ])
      setRefreshNonce((nonce) => nonce + 1)
      await refresh()
      showToast('Bond created · ' + short(result.hash))
      navigate({ kind: 'bond', bondId })
      return true
    } catch (error) {
      showToast(errorMessage(error))
      return false
    }
  }

  const selectedId = route.kind === 'bond' || route.kind === 'review' || route.kind === 'settlement' ? route.bondId : null
  const selectedBond = selectedId ? records[selectedId] : undefined

  const content = route.kind === 'dashboard'
    ? <Dashboard ids={bondIds} records={records} balance={contractBalance} loading={loading} error={readError} navigate={navigate} />
    : route.kind === 'create'
      ? <CreateBond onCancel={() => navigate({ kind: 'dashboard' })} onCreate={createBond} />
      : route.kind === 'audit'
        ? <Audit ids={bondIds} records={records} balance={contractBalance} loading={loading} error={readError} copyValue={copyValue} />
        : route.kind === 'bond'
          ? <BondDetail bond={selectedBond} loading={loading} error={readError} account={account} navigate={navigate} copyValue={copyValue} copied={copied} onWrite={writeForBond} />
          : route.kind === 'review'
            ? <Review bond={selectedBond} loading={loading} error={readError} account={account} navigate={navigate} onReview={(id) => writeForBond(id, 'review_bond', [id], 0n, 'GenLayer review finalized')} />
            : <Settlement bond={selectedBond} loading={loading} error={readError} account={account} navigate={navigate} onSettle={(id) => writeForBond(id, 'settle_bond', [id], 0n, 'Settlement finalized')} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate({ kind: 'dashboard' })} aria-label="ConditionBond home">
          <span className="brand-mark"><span /></span>
          <span>ConditionBond</span>
        </button>
        <nav className={'main-nav ' + (mobileNav ? 'is-open' : '')}>
          <NavLink active={route.kind === 'dashboard'} onClick={() => navigate({ kind: 'dashboard' })} icon={<LayoutDashboard size={15} />} label="Overview" />
          <NavLink active={route.kind === 'create'} onClick={() => navigate({ kind: 'create' })} icon={<Plus size={15} />} label="Create bond" />
          <NavLink active={route.kind === 'audit'} onClick={() => navigate({ kind: 'audit' })} icon={<Fingerprint size={15} />} label="Audit" />
        </nav>
        <div className="topbar-actions">
          <button className="network-pill"><span className="pulse-dot" /> Studio Dev <ChevronDown size={13} /></button>
          <button className="icon-button notification" aria-label="Notifications"><Bell size={17} /><span /></button>
          <button
            className="wallet-button"
            onClick={async () => {
              try {
                const connected = await connectWallet()
                setAccount(connected.address)
                showToast('Studio Dev wallet connected')
              } catch (error) { showToast(errorMessage(error)) }
            }}
          >
            <Wallet size={15} /> {account ? short(account) : 'Connect wallet'}
          </button>
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open menu"><Menu size={19} /></button>
        </div>
      </header>
      <main className="page-wrap">{content}</main>
      <footer className="footer">
        <span>ConditionBond © 2026</span>
        <span className="footer-links"><span>Production contract</span><span>Studio Dev</span><span>Source verified</span></span>
        <span className="footer-status"><span className="pulse-dot" /> Reads latest-nonfinal</span>
      </footer>
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </div>
  )
}

function NavLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button className={'nav-link ' + (active ? 'active' : '')} onClick={onClick}>{icon}<span>{label}</span></button>
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="header-action">{action}</div>}</div>
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: Tone }) {
  return <div className="metric"><div className="metric-top"><span className="eyebrow">{label}</span>{tone && <span className={'metric-dot ' + tone} />}</div><strong>{value}</strong><span>{detail}</span></div>
}

function Status({ tone, label }: { tone: Tone; label: string }) {
  return <span className={'status ' + tone}>{iconForTone(tone)}{label}</span>
}

function Dashboard({ ids, records, balance, loading, error, navigate }: { ids: string[]; records: RecordMap; balance: bigint; loading: boolean; error: string; navigate: (route: Route) => void }) {
  const [query, setQuery] = useState('')
  const visible = ids.filter((id) => {
    const bond = records[id]
    const text = [id, bond && itemDescription(bond), bond && bond.status].join(' ').toLowerCase()
    return text.includes(query.toLowerCase())
  })
  const counts = ids.reduce<Record<string, number>>((result, id) => {
    const status = records[id]?.status || 'UNKNOWN'
    result[status] = (result[status] || 0) + 1
    return result
  }, {})
  return <>
    <PageHeader eyebrow="Production / Overview" title="Trust, with a paper trail." subtitle="Authoritative records from the deployed ConditionBond contract." action={<button className="button primary" onClick={() => navigate({ kind: 'create' })}><Plus size={16} /> Create bond</button>} />
    {error && <div className="attention-banner"><div className="attention-icon"><X size={20} /></div><div><span className="eyebrow">Read failed</span><h3>Contract state is unavailable</h3><p>{error}</p></div></div>}
    <section className="metric-grid">
      <Metric label="Bonds on contract" value={loading ? '…' : String(ids.length)} detail="get_bond_ids()" tone="green" />
      <Metric label="Contract balance" value={loading ? '…' : formatGen(balance)} detail="latest balance read" />
      <Metric label="Active records" value={loading ? '…' : String((counts.ACTIVE || 0) + (counts.RETURN_SUBMITTED || 0) + (counts.REVIEWED || 0))} detail="derived from bond status" tone="blue" />
      <Metric label="Undetermined" value={loading ? '…' : String(counts.UNDETERMINED || 0)} detail="settlement blocked" tone="amber" />
    </section>
    <div className="section-heading"><div><span className="eyebrow">Authoritative records</span><h2>Bond registry</h2></div><button className="text-button" onClick={() => navigate({ kind: 'audit' })}>View audit <ChevronRight size={14} /></button></div>
    <section className="bond-table-wrap">
      <div className="table-toolbar"><div className="search-field"><Search size={15} /><input aria-label="Search bonds" placeholder="Search bond IDs or items" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="muted-small">Source: get_bond_ids() → get_bond()</span></div>
      <div className="bond-table">
        <div className="table-row table-head"><span>Bond</span><span>Custodian</span><span>Amount</span><span>State</span><span>Deadline</span><span /></div>
        {visible.map((id) => {
          const bond = records[id]
          if (!bond) return null
          const before = beforeUrlFor(bond)
          return <div className="table-row" key={id} onClick={() => navigate({ kind: 'bond', bondId: id })}>
            <div className="item-cell"><img src={before} alt="" /><div><strong>{itemDescription(bond)}</strong><span>{id}</span></div></div>
            <div className="person-cell"><span className="avatar">{short(bond.custodian, 2, 0).toUpperCase()}</span><span>{short(bond.custodian)}</span></div>
            <strong className="amount-cell">{formatGen(toBigInt(bond.amount))}</strong>
            <Status tone={statusTone(String(bond.status))} label={labelForStatus(String(bond.status))} />
            <span className="due-cell">{String(bond.deadline_utc || '—')}</span>
            <button className="row-menu" aria-label={'Open ' + id}><ChevronRight size={16} /></button>
          </div>
        })}
      </div>
      {!loading && visible.length === 0 && <div className="empty-state"><Fingerprint size={22} /><strong>No production bond records found.</strong><span>Create a bond or inspect the audit page once the deployed registry has records.</span></div>}
      <div className="table-footer"><span>Showing <strong>{visible.length}</strong> of {ids.length} authoritative records</span><span className="muted-small">No fixture records are rendered.</span></div>
    </section>
  </>
}

function CreateBond({ onCancel, onCreate }: { onCancel: () => void; onCreate: (input: CreateBondInput) => Promise<boolean> }) {
  const [step, setStep] = useState(1)
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [beforeUrl, setBeforeUrl] = useState('')
  const [criteria, setCriteria] = useState([''])
  const [acceptableWear, setAcceptableWear] = useState('')
  const [materialDamage, setMaterialDamage] = useState('')
  const [damageBps, setDamageBps] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await onCreate({ item, amount, counterparty, beforeUrl, criteria, acceptableWear, materialDamage, damageBps, deadline })
    } finally { setSubmitting(false) }
  }

  return <>
    <PageHeader eyebrow="Production / Create bond" title="Make the condition explicit." subtitle="Every field below is frozen by the deployed contract when the bond is created." action={<span className="draft-state"><span className="status-dot" /> Unsaved until submitted</span>} />
    <div className="create-layout">
      <div className="stepper"><Step number="01" label="Asset & parties" active={step === 1} done={step > 1} /><Step number="02" label="Frozen policy" active={step === 2} done={step > 2} /><Step number="03" label="Bond amount" active={step === 3} done={false} /></div>
      <div className="create-main">
        {step === 1 && <div className="form-section"><FormIntro number="01" title="Asset & parties" detail="Use the exact item description and wallets that should become part of the record." />
          <div className="form-grid">
            <Field label="Item / asset description" hint="Stored inside the frozen policy JSON." value={item} onChange={setItem} placeholder="e.g. red ceramic mug" />
            <Field label="Custodian wallet" hint="This wallet activates the funded bond and submits return evidence." value={counterparty} onChange={setCounterparty} placeholder="0x…" />
            <Field label="BEFORE image URL" hint="Required HTTPS evidence. It is immutable after create_bond." value={beforeUrl} onChange={setBeforeUrl} placeholder="https://…" />
            <Field label="Deadline (UTC)" hint="The deployed contract expects YYYY-MM-DDTHH:MM:SSZ." value={deadline} onChange={setDeadline} placeholder="2026-12-31T23:59" type="datetime-local" />
          </div>
          <div className="form-actions"><button className="button subtle" onClick={onCancel}>Cancel</button><button className="button primary" onClick={() => setStep(2)}>Continue <ChevronRight size={16} /></button></div>
        </div>}
        {step === 2 && <div className="form-section"><FormIntro number="02" title="Frozen condition policy" detail="Write the criteria and deterministic rule exactly as both parties intend to use them." />
          <div className="policy-editor"><div className="policy-editor-head"><div><strong>Inspection criteria</strong><p>These values are encoded into criteria_json without fixture replacement.</p></div><button className="text-button" onClick={() => setCriteria((items) => [...items, ''])}><Plus size={14} /> Add criterion</button></div>
            {criteria.map((value, index) => <div className="criterion-input" key={index}><span className="criterion-index">{String(index + 1).padStart(2, '0')}</span><input aria-label={'Criterion ' + String(index + 1)} value={value} onChange={(event) => setCriteria((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="Describe a condition requirement" />{criteria.length > 1 && <button aria-label={'Remove criterion ' + String(index + 1)} onClick={() => setCriteria((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button>}</div>)}
            <div className="form-grid policy-fields"><Field label="Acceptable wear definition" hint="Stored in acceptable_wear_json." value={acceptableWear} onChange={setAcceptableWear} placeholder="e.g. light surface scuffs that do not affect function" multiline /><Field label="Material damage definition" hint="Stored in material_damage_json." value={materialDamage} onChange={setMaterialDamage} placeholder="e.g. cracks, breaks, missing parts, or unusable function" multiline /></div>
            <div className="form-grid policy-fields"><Field label="Damage charge (BPS)" hint="1–10000 BPS; 2500 means 25% of the frozen amount." value={damageBps} onChange={(value) => setDamageBps(value.replace(/[^0-9]/g, ''))} placeholder="e.g. 2500" /><div /></div>
            <div className="policy-note"><Info size={15} /><span>The deployed contract stores a policy fingerprint and rejects changes after creation.</span></div>
          </div>
          <div className="form-actions"><button className="button subtle" onClick={() => setStep(1)}>Back</button><button className="button primary" onClick={() => setStep(3)}>Continue <ChevronRight size={16} /></button></div>
        </div>}
        {step === 3 && <div className="form-section"><FormIntro number="03" title="Bond amount" detail="Create the draft with the exact amount and frozen deadline. Funding is a separate owner-only transaction." />
          <div className="fund-card"><div><span className="eyebrow">Bond amount</span><h3>How much should be held?</h3><p>The amount is passed as the exact payable value when the owner funds the draft.</p></div><div className="amount-input"><input aria-label="Bond amount in GEN" autoFocus value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" /><span>GEN</span></div></div>
          <div className="settlement-preview"><div><span className="eyebrow">Settlement policy</span><strong>{damageBps ? damageBps + ' BPS damage charge if MATERIAL_DAMAGE' : 'Enter a frozen BPS policy'}</strong></div><Status tone={damageBps ? 'green' : 'amber'} label={damageBps ? 'Ready to freeze' : 'Incomplete'} /></div>
          <div className="form-actions"><button className="button subtle" onClick={() => setStep(2)}>Back</button><button className="button primary" disabled={submitting} onClick={() => void submit()}>{submitting ? 'Waiting for finality…' : 'Create bond draft'} <ArrowUpRight size={16} /></button></div>
        </div>}
      </div>
      <aside className="create-aside"><div className="aside-label"><FileCheck2 size={14} /> Protocol sequence</div><div className="aside-flow"><FlowRow icon={<FileCheck2 size={16} />} title="Create" detail="Freeze the exact policy and BEFORE evidence." /><FlowRow icon={<Wallet size={16} />} title="Fund" detail="Owner funds the exact frozen amount." /><FlowRow icon={<Camera size={16} />} title="Inspect" detail="Custodian submits the actual AFTER evidence." /><FlowRow icon={<Gavel size={16} />} title="Review & settle" detail="Owner triggers GenLayer; party settles the stored verdict." /></div><div className="aside-foot"><ShieldCheck size={15} /><span>No fixture values are substituted for submitted fields.</span></div></aside>
    </div>
  </>
}

function Step({ number, label, active, done }: { number: string; label: string; active: boolean; done: boolean }) {
  return <div className={'step ' + (active ? 'active ' : '') + (done ? 'done' : '')}><span>{done ? <Check size={14} /> : number}</span><strong>{label}</strong></div>
}

function FormIntro({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="form-intro"><span className="section-number">{number}</span><div><h2>{title}</h2><p>{detail}</p></div></div>
}

function Field({ label, hint, value, onChange, placeholder, type = 'text', multiline = false }: { label: string; hint: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; multiline?: boolean }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return <label className="field" htmlFor={id}><span>{label}</span>{multiline ? <textarea id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <input id={id} aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}<small>{hint}</small></label>
}

function FlowRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="flow-row"><span className="flow-icon">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div></div>
}

function LoadingState() { return <div className="empty-state"><Clock3 size={22} /><strong>Reading deployed state…</strong><span>Waiting for latest-nonfinal contract reads.</span></div> }

function MissingBond({ error }: { error: string }) {
  return <div className="empty-state"><X size={22} /><strong>Bond record unavailable.</strong><span>{error || 'The selected ID was not returned by get_bond_ids().'}</span></div>
}

function BondDetail({ bond, loading, error, account, navigate, copyValue, copied, onWrite }: { bond?: ChainBond; loading: boolean; error: string; account: string | null; navigate: (route: Route) => void; copyValue: (value: string) => void; copied: boolean; onWrite: (bondId: string | null, functionName: string, args: any[], value: bigint, success: string) => Promise<boolean> }) {
  const [afterUrl, setAfterUrl] = useState('')
  if (loading && !bond) return <LoadingState />
  if (!bond) return <MissingBond error={error} />
  const status = String(bond.status) as BondStatus
  const verdict = normalizeVerdict(bond.verdict)
  const beforeUrl = beforeUrlFor(bond)
  const storedAfterUrl = afterUrlFor(bond)
  const criteria = criteriaFor(bond)
  const reviewAllowed = canPerformBondAction('review', account, { status, owner: bond.owner, custodian: bond.custodian })
  const returnAllowed = canPerformBondAction('submit_return', account, { status, owner: bond.owner, custodian: bond.custodian })
  const fundAllowed = canPerformBondAction('fund', account, { status, owner: bond.owner, custodian: bond.custodian })
  const activateAllowed = canPerformBondAction('activate', account, { status, owner: bond.owner, custodian: bond.custodian })
  const submit = async () => {
    if (!isValidEvidenceUrl(afterUrl) || !comparableEvidence(beforeUrl, afterUrl)) return
    await onWrite(bond.bond_id, 'submit_return', [bond.bond_id, JSON.stringify([{ evidence_id: 'after-1', url: afterUrl.trim(), sha256: '' }])], 0n, 'Return evidence anchored')
    setAfterUrl('')
  }
  const roleMessage = (action: BondAction) => account ? 'Connected wallet is not authorized for this state.' : 'Connect the owner or custodian wallet.'
  return <>
    <div className="detail-topline"><button className="back-button" onClick={() => navigate({ kind: 'dashboard' })}>← Back to bonds</button><span className="detail-id"><span className="status-dot" /> {bond.bond_id} <button onClick={() => copyValue(bond.bond_id)} aria-label="Copy bond ID">{copied ? <Check size={13} /> : <Copy size={13} />}</button></span></div>
    <div className="detail-head"><div><div className="eyebrow">Production bond / {labelForStatus(status)}</div><h1>{itemDescription(bond)}</h1><div className="detail-meta"><span>Owner {short(bond.owner)}</span><span className="meta-divider" /><span>Custodian {short(bond.custodian)}</span><span className="meta-divider" /><span>{formatGen(toBigInt(bond.amount))} principal</span></div></div><div className="detail-actions">
      <button className="button subtle" disabled={!fundAllowed} title={!fundAllowed ? roleMessage('fund') : ''} onClick={() => void onWrite(bond.bond_id, 'fund_bond', [bond.bond_id], toBigInt(bond.amount), 'Bond funded')}><Wallet size={15} /> Fund</button>
      <button className="button subtle" disabled={!activateAllowed} title={!activateAllowed ? roleMessage('activate') : ''} onClick={() => void onWrite(bond.bond_id, 'activate_bond', [bond.bond_id], 0n, 'Bond activated')}><ShieldCheck size={15} /> Activate</button>
      <button className="button subtle" disabled={!reviewAllowed} title={!reviewAllowed ? roleMessage('review') : ''} onClick={() => navigate({ kind: 'review', bondId: bond.bond_id })}><Gavel size={15} /> Review</button>
      <button className="button primary" onClick={() => navigate({ kind: 'settlement', bondId: bond.bond_id })}><ArrowUpRight size={15} /> Settlement</button>
    </div></div>
    <div className="detail-grid">
      <div className="detail-content">
        <section className="evidence-section"><div className="section-heading compact"><div><span className="eyebrow">The evidence</span><h2>Before / after inspection</h2></div><span className="evidence-count"><Camera size={14} /> {beforeUrl ? 'BEFORE anchored' : 'BEFORE missing'} · {storedAfterUrl ? 'AFTER anchored' : 'AFTER pending'}</span></div><div className="evidence-compare"><EvidenceCard label="BEFORE · frozen on create" image={beforeUrl} note={bond.before_fingerprint ? 'Fingerprint ' + short(bond.before_fingerprint, 10, 6) : 'On-chain manifest'} /><div className="compare-line"><span>Compare</span><ArrowUpRight size={14} /></div>{storedAfterUrl ? <EvidenceCard label="AFTER · submitted by custodian" image={storedAfterUrl} note={bond.after_fingerprint ? 'Fingerprint ' + short(bond.after_fingerprint, 10, 6) : 'On-chain manifest'} after /> : <EvidencePlaceholder label="AFTER · not submitted" note="Custodian evidence is required before review." />}</div><div className="evidence-caption"><span><Fingerprint size={14} /> Manifest URLs and fingerprints come from get_bond().</span><span className="muted-small">No local fixture fallback</span></div></section>
        {returnAllowed && <section className="return-panel"><div className="section-heading compact"><div><span className="eyebrow">Custodian action</span><h2>Submit actual AFTER evidence</h2></div><Status tone="blue" label="Custodian only" /></div><div className="return-preview"><EvidenceCard label="BEFORE · frozen" image={beforeUrl} note="Read from chain" /><div className="compare-line"><ArrowUpRight size={14} /></div><EvidenceCard label="AFTER · preview" image={afterUrl} note={afterUrl ? 'Submitted URL preview' : 'Enter an HTTPS URL'} after /></div><label className="field evidence-url"><span>AFTER image URL</span><input aria-label="AFTER image URL" value={afterUrl} onChange={(event) => setAfterUrl(event.target.value)} placeholder="https://…" /><small>{afterUrl && !isValidEvidenceUrl(afterUrl) ? 'Use a valid HTTPS URL without credentials or fragments.' : 'The URL is sent exactly as entered after HTTPS validation.'}</small></label><div className="form-actions"><button className="button primary" disabled={!isValidEvidenceUrl(afterUrl) || !comparableEvidence(beforeUrl, afterUrl)} onClick={() => void submit()}><Camera size={15} /> Submit return evidence</button></div></section>}
        <section className="findings-section"><div className="section-heading compact"><div><span className="eyebrow">Condition verdict</span><h2>Frozen criteria and stored result</h2></div>{bond.verdict ? <Status tone={verdictTone(verdict)} label={labelForVerdict(verdict)} /> : <Status tone="amber" label="Pending review" />}</div><div className="findings-list">{criteria.map((criterion, index) => <div className="finding" key={String(criterion.criterion_id || index)}><span className="finding-number">{String(index + 1).padStart(2, '0')}</span><div className="finding-main"><strong>{String(criterion.criterion_id || 'criterion')}</strong><p>{String(criterion.requirement || '')}</p></div><Status tone={bond.verdict ? verdictTone(verdict) : 'neutral'} label={bond.verdict ? 'Included in verdict' : 'Frozen'} /><ChevronRight size={15} className="finding-chevron" /></div>)}</div></section>
        <section className={'verdict-panel ' + (verdict === 'UNDETERMINED' ? 'undetermined-panel' : '')}><div className="verdict-symbol">{verdict === 'UNDETERMINED' ? <Info size={20} /> : <Check size={20} />}</div><div><span className="eyebrow">GenLayer result stored on-chain</span><h3>{bond.verdict ? labelForVerdict(verdict) : 'No verdict stored yet'}</h3><p>{bond.reasoning || (bond.verdict ? 'The deployed contract stored the verdict without reasoning.' : 'The owner must trigger review after return evidence is submitted.')}</p></div>{bond.verdict && verdict !== 'UNDETERMINED' && <button className="button dark" onClick={() => navigate({ kind: 'settlement', bondId: bond.bond_id })}>View settlement <ChevronRight size={15} /></button>}</section>
      </div>
      <aside className="detail-aside"><div className="side-card lifecycle-card"><div className="side-card-head"><span className="eyebrow">Bond lifecycle</span><span className="tiny-live"><span className="pulse-dot" /> Chain state</span></div><div className="lifecycle"><LifeStep label="Bond created" date="revision 1" done /><LifeStep label="Funding / activation" date={['FUNDED', 'ACTIVE', 'RETURN_SUBMITTED', 'REVIEWED', 'SETTLED', 'UNDETERMINED'].includes(status) ? 'record advanced' : 'pending'} done={['FUNDED', 'ACTIVE', 'RETURN_SUBMITTED', 'REVIEWED', 'SETTLED', 'UNDETERMINED'].includes(status)} /><LifeStep label="Return submitted" date={storedAfterUrl ? 'AFTER anchored' : 'pending'} done={Boolean(storedAfterUrl)} /><LifeStep label="GenLayer review" date={bond.verdict ? labelForVerdict(verdict) : 'pending'} done={Boolean(bond.verdict)} current={!bond.verdict && status === 'RETURN_SUBMITTED'} /><LifeStep label="Settlement" date={status === 'UNDETERMINED' ? 'blocked' : status === 'SETTLED' ? 'complete' : 'pending'} done={status === 'SETTLED'} /></div></div><div className="side-card"><div className="side-card-head"><span className="eyebrow">Frozen policy</span><ShieldCheck size={15} /></div><div className="policy-lines"><div><span>Acceptable wear</span><strong>{policyDefinition(bond.acceptable_wear)}</strong></div><div><span>Material damage</span><strong>{policyDefinition(bond.material_damage)}</strong></div><div><span>Damage BPS</span><strong>{String(bond.damage_bps)}</strong></div><div><span>Deadline</span><strong>{String(bond.deadline_utc)}</strong></div></div><span className="muted-small">Policy fingerprint {short(bond.policy_fingerprint, 12, 8)}</span></div></aside>
    </div>
  </>
}

function EvidenceCard({ label, image, note, after }: { label: string; image: string; note: string; after?: boolean }) {
  return <div className="evidence-card"><div className="evidence-image">{image ? <img src={image} alt="Condition evidence" /> : <div className="evidence-empty"><Camera size={24} /><span>No evidence URL</span></div>}<span className={'evidence-badge ' + (after ? 'after' : '')}>{after ? 'RETURN' : 'INTAKE'}</span><button className="image-expand" aria-label="Open evidence" disabled={!image} onClick={() => image && window.open(image, '_blank', 'noopener,noreferrer')}><ExternalLink size={14} /></button></div><div className="evidence-card-foot"><span>{label}</span><span className="muted-small">{note}</span></div></div>
}

function EvidencePlaceholder({ label, note }: { label: string; note: string }) { return <EvidenceCard label={label} image="" note={note} after /> }

function LifeStep({ label, date, done, current }: { label: string; date: string; done?: boolean; current?: boolean }) {
  return <div className={'life-step ' + (done ? 'done ' : '') + (current ? 'current' : '')}><span className="life-dot">{done ? <Check size={11} /> : current ? <span /> : ''}</span><div><strong>{label}</strong><span>{date}</span></div></div>
}

function Review({ bond, loading, error, account, navigate, onReview }: { bond?: ChainBond; loading: boolean; error: string; account: string | null; navigate: (route: Route) => void; onReview: (id: string) => Promise<boolean> }) {
  if (loading && !bond) return <LoadingState />
  if (!bond) return <MissingBond error={error} />
  const status = String(bond.status) as BondStatus
  const verdict = normalizeVerdict(bond.verdict)
  const afterUrl = afterUrlFor(bond)
  const criteria = criteriaFor(bond)
  const allowed = canPerformBondAction('review', account, { status, owner: bond.owner, custodian: bond.custodian })
  const hasResult = Boolean(bond.verdict)
  return <><PageHeader eyebrow={bond.bond_id + ' / Return review'} title="Does the item match?" subtitle="GenLayer reads the frozen policy and both evidence manifests. There is no client-side verdict selector." action={<Status tone={hasResult ? verdictTone(verdict) : 'amber'} label={hasResult ? labelForVerdict(verdict) : 'Decision pending'} />} /><div className="review-layout"><div className="review-main"><div className="review-compare"><EvidenceCard label="BEFORE · frozen" image={beforeUrlFor(bond)} note="On-chain manifest" /><div className="review-arrow"><ArrowUpRight size={18} /></div>{afterUrl ? <EvidenceCard label="AFTER · submitted" image={afterUrl} note="On-chain manifest" after /> : <EvidencePlaceholder label="AFTER · missing" note="Review cannot run without return evidence." />}</div><div className="review-checklist"><div className="section-heading compact"><div><span className="eyebrow">Frozen checklist</span><h2>Criteria sent to GenLayer</h2></div><span className="muted-small">{criteria.length} criterion{criteria.length === 1 ? '' : 's'}</span></div>{criteria.map((criterion, index) => <div className="review-row" key={String(criterion.criterion_id || index)}><span className="review-check"><Check size={14} /></span><span className="review-row-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{String(criterion.criterion_id || 'criterion')}</strong><p>{String(criterion.requirement || '')}</p></div><span className="review-match">Frozen <ShieldCheck size={13} /></span></div>)}</div><div className="review-actions"><button className="button subtle" onClick={() => navigate({ kind: 'bond', bondId: bond.bond_id })}>Back to bond</button>{hasResult ? <button className="button primary" onClick={() => navigate({ kind: 'settlement', bondId: bond.bond_id })}>View stored result <ArrowUpRight size={16} /></button> : <button className="button primary" disabled={!allowed || !afterUrl} title={!allowed ? 'Only the owner may trigger review.' : !afterUrl ? 'Return evidence is required.' : ''} onClick={async () => { if (await onReview(bond.bond_id)) navigate({ kind: 'settlement', bondId: bond.bond_id }) }}><Gavel size={16} /> Run GenLayer review</button>}</div></div><aside className="review-aside"><div className="side-card"><div className="side-card-head"><span className="eyebrow">Decision guardrails</span><CircleHelp size={15} /></div><p className="aside-copy">The deployed owner-only review call stores the verdict or fails closed to UNDETERMINED. The UI cannot choose the outcome.</p><div className="guardrail"><ShieldCheck size={15} /><span>{account ? (allowed ? 'Connected wallet is the bond owner.' : 'Connected wallet is not the bond owner.') : 'Connect the bond owner wallet to review.'}</span></div></div><div className="side-card"><div className="side-card-head"><span className="eyebrow">Stored result</span></div><p className="aside-copy">{hasResult ? labelForVerdict(verdict) + ': ' + (bond.reasoning || 'No reasoning returned.') : 'No GenLayer result has been stored for this bond yet.'}</p></div></aside></div></>
}

function Settlement({ bond, loading, error, account, navigate, onSettle }: { bond?: ChainBond; loading: boolean; error: string; account: string | null; navigate: (route: Route) => void; onSettle: (id: string) => Promise<boolean> }) {
  if (loading && !bond) return <LoadingState />
  if (!bond) return <MissingBond error={error} />
  const status = String(bond.status) as BondStatus
  const verdict = normalizeVerdict(bond.verdict)
  const ownerReceipt = toBigInt(bond.owner_receipt)
  const custodianReceipt = toBigInt(bond.custodian_receipt)
  const undetermined = verdict === 'UNDETERMINED' || status === 'UNDETERMINED'
  const allowed = canPerformBondAction('settle', account, { status, owner: bond.owner, custodian: bond.custodian })
  return <><div className="settlement-page"><div className={'settlement-mark ' + (undetermined ? 'settlement-blocked' : '')}>{undetermined ? <Info size={31} /> : <Check size={31} />}</div><span className="eyebrow">{bond.bond_id} / {undetermined ? 'Fail-closed result' : 'Settlement state'}</span><h1>{undetermined ? 'Settlement blocked.' : status === 'SETTLED' ? 'Settlement finalized.' : 'Settlement is ready.'}</h1><p className="settlement-lede">{undetermined ? 'UNDETERMINED never settles. The stored receipts remain 0 / 0 and the bond principal remains retained.' : 'Every value below is read from the selected bond record after the GenLayer verdict.'}</p><div className="settlement-receipt"><div><span className="eyebrow">Owner receipt</span><strong>{formatGen(ownerReceipt)}</strong></div><div><span className="eyebrow">Custodian receipt</span><strong>{formatGen(custodianReceipt)}</strong></div><div><span className="eyebrow">Verdict</span><Status tone={verdictTone(verdict)} label={labelForVerdict(verdict)} /></div><div><span className="eyebrow">Bond amount</span><strong>{formatGen(toBigInt(bond.amount))}</strong></div><div><span className="eyebrow">Damage BPS</span><strong>{String(bond.damage_bps)}</strong></div><div><span className="eyebrow">Contract state</span><strong>{labelForStatus(status)}</strong></div></div>{undetermined && <div className="attention-banner"><div className="attention-icon"><ShieldCheck size={20} /></div><div><span className="eyebrow">Fail closed</span><h3>{formatGen(toBigInt(bond.amount))} retained by the contract</h3><p>Settlement calls are disabled for an UNDETERMINED verdict.</p></div></div>}<div className="settlement-steps"><LifeStep label="Evidence compared" date={bond.after_fingerprint ? 'AFTER fingerprint stored' : 'AFTER pending'} done={Boolean(bond.after_fingerprint)} /><LifeStep label="Policy evaluated" date={bond.verdict ? labelForVerdict(verdict) : 'pending'} done={Boolean(bond.verdict)} /><LifeStep label="Funds released" date={status === 'SETTLED' ? formatGen(ownerReceipt) + ' / ' + formatGen(custodianReceipt) : undetermined ? 'blocked' : 'awaiting settle_bond'} done={status === 'SETTLED'} /></div><div className="settlement-actions"><button className="button subtle" onClick={() => navigate({ kind: 'audit' })}>View audit trail</button><button className="button primary" disabled={!allowed} title={!allowed ? (undetermined ? 'UNDETERMINED bonds cannot settle.' : 'Only a bond party may settle a reviewed bond.') : ''} onClick={() => void onSettle(bond.bond_id)}>{status === 'SETTLED' ? 'Settlement finalized' : undetermined ? 'Settlement blocked' : 'Settle stored verdict'} <Check size={15} /></button><button className="button subtle" onClick={() => navigate({ kind: 'bond', bondId: bond.bond_id })}>Back to bond <ArrowUpRight size={15} /></button></div></div></>
}

function Audit({ ids, records, balance, loading, error, copyValue }: { ids: string[]; records: RecordMap; balance: bigint; loading: boolean; error: string; copyValue: (value: string) => void }) {
  const [query, setQuery] = useState('')
  const rows = ids.filter((id) => (id + ' ' + itemDescription(records[id]) + ' ' + records[id]?.status).toLowerCase().includes(query.toLowerCase()))
  const material = records['CB-LIVE-MATERIAL-01']
  const undetermined = records['CB-LIVE-UNDETERMINED-01']
  return <><PageHeader eyebrow="Protocol / Audit" title="Every decision, inspectable." subtitle="Live registry reads, frozen policy, evidence fingerprints and known historical hashes." action={<button className="button subtle" onClick={() => copyValue(CONTRACT_ADDRESS)}><ArrowDownLeft size={15} /> Copy contract</button>} /><div className="audit-summary"><div><span className="eyebrow">Production contract</span><strong>{short(CONTRACT_ADDRESS)}</strong><span>Studio Dev · chain {CHAIN_ID}</span><span className="muted-small">Source {SOURCE_SHA256}</span></div><div><span className="eyebrow">Contract balance</span><strong>{loading ? '…' : formatGen(balance)}</strong><span>Authoritative latest balance</span></div><div><span className="eyebrow">Registry</span><strong>{loading ? '…' : String(ids.length)}</strong><span>get_bond_ids() records</span></div></div>{error && <div className="attention-banner"><div className="attention-icon"><X size={20} /></div><div><span className="eyebrow">Read failed</span><h3>Audit data could not be refreshed</h3><p>{error}</p></div></div>}<section className="audit-panel"><div className="audit-toolbar"><div><span className="eyebrow">Chain records</span><h2>ConditionBond activity</h2></div><div className="search-field"><Search size={15} /><input aria-label="Search audit records" placeholder="Search records" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="audit-table"><div className="audit-row audit-head"><span>Bond</span><span>Asset</span><span>State</span><span>Verdict</span><span>Receipts</span></div>{rows.map((id) => { const bond = records[id]; const verdict = normalizeVerdict(bond.verdict); return <div className="audit-row" key={id}><span className="hash-link">{id}</span><strong>{itemDescription(bond)}</strong><Status tone={statusTone(String(bond.status))} label={labelForStatus(String(bond.status))} /><Status tone={verdictTone(verdict)} label={labelForVerdict(verdict)} /><span>{formatGen(toBigInt(bond.owner_receipt))} / {formatGen(toBigInt(bond.custodian_receipt))}</span></div> })}</div>{!loading && rows.length === 0 && <div className="empty-state"><Fingerprint size={22} /><strong>No matching live records.</strong><span>The audit page does not synthesize history when the chain returns no record.</span></div>}<div className="audit-foot"><Fingerprint size={15} /> Values above are read from the deployed contract <span className="muted-small">Balance {formatGen(balance)}</span></div></section><section className="audit-panel audit-hashes"><div className="section-heading compact"><div><span className="eyebrow">Known provenance</span><h2>Preserved transaction hashes</h2></div></div>{KNOWN_AUDIT_HASHES.map((event) => <div className="audit-hash-row" key={event.hash}><strong>{event.label}</strong><button className="hash-link" onClick={() => copyValue(event.hash)}>{short(event.hash, 14, 10)} <Copy size={12} /></button></div>)}<p className="muted-small">Material-bond lifecycle hashes and several older fail-closed lifecycle hashes were not preserved in the available runner output; they are intentionally not fabricated here. The live bond rows above are authoritative reads.</p>{material && <p className="muted-small">Material proof present on chain: {material.bond_id} · {labelForVerdict(normalizeVerdict(material.verdict))} · {formatGen(toBigInt(material.owner_receipt))} owner / {formatGen(toBigInt(material.custodian_receipt))} custodian.</p>}{undetermined && <p className="muted-small">Fail-closed proof present on chain: {undetermined.bond_id} · UNDETERMINED · {formatGen(toBigInt(undetermined.owner_receipt))} / {formatGen(toBigInt(undetermined.custodian_receipt))}; principal retained.</p>}</section></>
}

export function getRoute(): Route { return routeForPath(window.location.pathname) }
export { routeForPath }

export default App

if (typeof document !== 'undefined') {
  const root = document.getElementById('root')
  if (root && !root.hasChildNodes()) createRoot(root).render(<App />)
}
