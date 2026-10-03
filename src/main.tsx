import { useEffect, useMemo, useState } from 'react'
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
  FolderOpen,
  Gavel,
  Info,
  LayoutDashboard,
  Link2,
  Menu,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Wallet,
  X,
} from 'lucide-react'
import './styles.css'
import { CHAIN_ID, CONTRACT_ADDRESS, SOURCE_SHA256, connectWallet, errorMessage, short, watchWallet, writeAndFinalize } from './genlayer'
import { routeForPath, validateCreateBondInput, type Route } from './product'

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue'

type Bond = {
  id: string
  item: string
  category: string
  counterparty: string
  initials: string
  amount: string
  status: string
  statusTone: Tone
  due: string
  image: string
}

const imageBefore = 'https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/before-intact.svg'
const imageAfter = 'https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/after-material-damage.svg'

const initialBonds: Bond[] = [
  {
    id: 'CB-LIVE-MATERIAL-01',
    item: 'Red ceramic mug',
    category: 'Canonical proof',
    counterparty: 'Studio Dev custodian',
    initials: 'SD',
    amount: '1 GEN',
    status: 'Material damage settled',
    statusTone: 'red',
    due: 'Today, 16:00',
    image: imageAfter,
  },
  {
    id: 'CB-1039',
    item: 'Sony A7 IV camera body',
    category: 'Photography',
    counterparty: 'Jon Bell',
    initials: 'JB',
    amount: '2.40 GEN',
    status: 'Awaiting return',
    statusTone: 'blue',
    due: 'Oct 08, 2026',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'CB-1035',
    item: 'Herman Miller Aeron',
    category: 'Furniture',
    counterparty: 'Sam Okafor',
    initials: 'SO',
    amount: '0.92 GEN',
    status: 'Settled',
    statusTone: 'green',
    due: 'Sep 29, 2026',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'CB-1028',
    item: 'Brompton C Line bicycle',
    category: 'Mobility',
    counterparty: 'Ada Nwosu',
    initials: 'AN',
    amount: '1.10 GEN',
    status: 'In transit',
    statusTone: 'neutral',
    due: 'Oct 12, 2026',
    image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=85',
  },
]

const criteria = [
  { label: 'Asset identity', value: 'Matches', note: 'The same red ceramic mug is visible in both frames.', tone: 'green' as Tone },
  { label: 'Surface integrity', value: 'Material damage', note: 'A new structural crack crosses the mug body.', tone: 'red' as Tone },
  { label: 'Handle and rim', value: 'Visible', note: 'The handle and rim remain identifiable for comparison.', tone: 'green' as Tone },
  { label: 'Frozen policy', value: 'Triggered', note: 'A new crack meets the material-damage rule.', tone: 'red' as Tone },
]

function iconForTone(tone: Tone) {
  if (tone === 'green') return <CheckCircle2 size={15} />
  if (tone === 'amber') return <Clock3 size={15} />
  if (tone === 'red') return <X size={15} />
  return <Info size={15} />
}

export function App() {
  const [route, setRoute] = useState<Route>(getRoute())
  const [bonds, setBonds] = useState(initialBonds)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const [liveBondId, setLiveBondId] = useState('CB-LIVE-MATERIAL-01')
  const [liveAmountWei, setLiveAmountWei] = useState(1000000000000000000n)


  const navigate = (next: Route) => {
    setRoute(next)
    setMobileNav(false)
    window.history.pushState({}, '', next === 'dashboard' ? '/' : `/${next}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  useEffect(() => watchWallet((address) => setAccount(address), () => showToast('Wallet network changed')), [])

  const createBond = async (item: string, amount: string, counterparty: string, beforeUrl: string) => {
    const validation = validateCreateBondInput({ item, amount, counterparty, beforeUrl })
    if (validation) { showToast(validation); return }
    if (!account) { showToast('Connect Rabby on Studio Dev before creating a bond.'); return }
    const amountWei = BigInt(Math.round(Number(amount) * 1e18))
    const bondId = `CB-${Date.now().toString().slice(-6)}`
    const before = beforeUrl || 'https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/before-intact.svg'
    const criteriaJson = JSON.stringify([{ criterion_id: 'identity', requirement: 'The same physical item is visible.' }, { criterion_id: 'surface', requirement: 'No new material damage beyond the frozen policy.' }])
    const manifestJson = JSON.stringify([{ evidence_id: 'item-before', url: before, sha256: '' }])
    try {
      const result = await writeAndFinalize(account, 'create_bond', [bondId, counterparty, amountWei, manifestJson, criteriaJson, JSON.stringify({ rule: 'Minor scuffs that do not affect use.' }), JSON.stringify({ rule: 'New crack, break, missing piece, or unusable function.' }), 2500n, '2099-01-01T00:00:00Z'])
      const next: Bond = { id: bondId, item: item || 'Condition-bound item', category: 'New bond', counterparty: short(counterparty), initials: short(counterparty, 2, 0).toUpperCase(), amount: `${amount || '0.75'} GEN`, status: 'Created · fund next', statusTone: 'blue', due: 'Awaiting funding', image: before }
      setBonds([next, ...bonds]); setLiveBondId(bondId); setLiveAmountWei(amountWei); showToast(`Bond created · ${short(result.hash)}`); navigate('bond')
    } catch (error) { showToast(errorMessage(error)) }
  }

  const runWrite = async (functionName: string, args: any[], value = 0n, success = 'Transaction finalized') => {
    if (!account) { showToast('Connect Rabby on Studio Dev first.'); return }
    try { const result = await writeAndFinalize(account, functionName, args, value); showToast(`${success} · ${short(result.hash)}`) } catch (error) { showToast(errorMessage(error)) }
  }
  const fundBond = () => runWrite('fund_bond', [liveBondId], liveAmountWei, 'Bond funded')
  const activateBond = () => runWrite('activate_bond', [liveBondId], 0n, 'Bond activated')
  const submitReturn = () => runWrite('submit_return', [liveBondId, JSON.stringify([{ evidence_id: 'item-after', url: 'https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/after-material-damage.svg', sha256: '' }])], 0n, 'Return evidence anchored')
  const reviewBond = () => runWrite('review_bond', [liveBondId], 0n, 'GenLayer review finalized')
  const settleBond = () => runWrite('settle_bond', [liveBondId], 0n, 'Settlement finalized')

  const copyId = () => {
    navigator.clipboard?.writeText('0x8b12…a9c4')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('dashboard')} aria-label="ConditionBond home">
          <span className="brand-mark"><span /></span>
          <span>ConditionBond</span>
        </button>
        <nav className={`main-nav ${mobileNav ? 'is-open' : ''}`}>
          <NavLink active={route === 'dashboard'} onClick={() => navigate('dashboard')} icon={<LayoutDashboard size={15} />} label="Overview" />
          <NavLink active={route === 'create'} onClick={() => navigate('create')} icon={<Plus size={15} />} label="Create bond" />
          <NavLink active={route === 'audit'} onClick={() => navigate('audit')} icon={<Fingerprint size={15} />} label="Audit" />
        </nav>
        <div className="topbar-actions">
          <button className="network-pill"><span className="pulse-dot" /> Studio Dev <ChevronDown size={13} /></button>
          <button className="icon-button notification" aria-label="Notifications"><Bell size={17} /><span /></button>
          <button className="wallet-button" onClick={async () => { try { const connected = await connectWallet(); setAccount(connected.address); showToast('Studio Dev wallet connected') } catch (error) { showToast(errorMessage(error)) } }}><Wallet size={15} /> {account ? short(account) : 'Connect wallet'}</button>
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open menu"><Menu size={19} /></button>
        </div>
      </header>

      <main className="page-wrap">
        {route === 'dashboard' && <Dashboard bonds={bonds} navigate={navigate} />}
        {route === 'create' && <CreateBond onCancel={() => navigate('dashboard')} onCreate={createBond} />}
        {route === 'bond' && <BondDetail navigate={navigate} showToast={showToast} copyId={copyId} copied={copied} onFund={fundBond} onActivate={activateBond} onSubmitReturn={submitReturn} onReview={reviewBond} settled={liveBondId === 'CB-LIVE-MATERIAL-01'} />}
        {route === 'review' && <Review navigate={navigate} showToast={showToast} onReview={reviewBond} />}
        {route === 'settlement' && <Settlement navigate={navigate} onSettle={settleBond} />}
        {route === 'audit' && <Audit showToast={showToast} />}
      </main>

      <footer className="footer">
        <span>ConditionBond © 2026</span>
        <span className="footer-links"><span>Protocol</span><span>Documentation</span><span>Support</span></span>
        <span className="footer-status"><span className="pulse-dot" /> All systems operational</span>
      </footer>
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </div>
  )
}

function NavLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button className={`nav-link ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="header-action">{action}</div>}</div>
}

function Dashboard({ bonds, navigate }: { bonds: Bond[]; navigate: (route: Route) => void }) {
  return <>
    <PageHeader eyebrow="Workspace / Overview" title="Trust, with a paper trail." subtitle="Physical-condition escrow for items that matter." action={<button className="button primary" onClick={() => navigate('create')}><Plus size={16} /> Create bond</button>} />
    <section className="metric-grid">
      <Metric label="Active bonds" value="06" detail="+2 this month" tone="green" />
      <Metric label="Value secured" value="8.42 GEN" detail="Across 4 items" />
      <Metric label="Awaiting action" value="02" detail="One due today" tone="amber" />
      <Metric label="Settled lifetime" value="31" detail="100% resolved" tone="blue" />
    </section>

    <section className="attention-banner">
      <div className="attention-icon"><ShieldCheck size={20} /></div>
      <div><span className="eyebrow">Action required</span><h3>Inspection window closes today</h3><p>Compare the return evidence for <strong>Red ceramic mug</strong> before the frozen policy settles.</p></div>
      <button className="button light" onClick={() => navigate('bond')}>Review evidence <ArrowUpRight size={15} /></button>
    </section>

    <div className="section-heading"><div><span className="eyebrow">Your workspace</span><h2>Recent bonds</h2></div><button className="text-button" onClick={() => navigate('audit')}>View audit log <ChevronRight size={14} /></button></div>
    <section className="bond-table-wrap">
      <div className="table-toolbar"><div className="search-field"><Search size={15} /><input placeholder="Search bonds" /></div><button className="filter-button"><SlidersHorizontal size={15} /> Filter <ChevronDown size={13} /></button></div>
      <div className="bond-table">
        <div className="table-row table-head"><span>Item</span><span>Counterparty</span><span>Bond value</span><span>State</span><span>Due</span><span /></div>
        {bonds.map((bond) => <div className="table-row" key={bond.id} onClick={() => navigate('bond')}>
          <div className="item-cell"><img src={bond.image} alt="" /><div><strong>{bond.item}</strong><span>{bond.id} · {bond.category}</span></div></div>
          <div className="person-cell"><span className="avatar">{bond.initials}</span><span>{bond.counterparty}</span></div>
          <strong className="amount-cell">{bond.amount}</strong>
          <Status tone={bond.statusTone} label={bond.status} />
          <span className="due-cell">{bond.due}</span>
          <button className="row-menu" aria-label={`Open ${bond.item}`}><MoreHorizontal size={16} /></button>
        </div>)}
      </div>
      <div className="table-footer"><span>Showing <strong>{bonds.length}</strong> of 6 bonds</span><div><button className="pagination-button" disabled>←</button><button className="pagination-button">→</button></div></div>
    </section>
  </>
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: Tone }) {
  return <div className="metric"><div className="metric-top"><span className="eyebrow">{label}</span>{tone && <span className={`metric-dot ${tone}`} />}</div><strong>{value}</strong><span>{detail}</span></div>
}

function Status({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`status ${tone}`}>{iconForTone(tone)}{label}</span>
}

function CreateBond({ onCancel, onCreate }: { onCancel: () => void; onCreate: (item: string, amount: string, counterparty: string, beforeUrl: string) => void }) {
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [beforeUrl, setBeforeUrl] = useState('')
  const [step, setStep] = useState(1)
  return <>
    <PageHeader eyebrow="Workspace / Create bond" title="Make the condition explicit." subtitle="Set the terms once. Let the evidence carry the rest." action={<span className="draft-state"><span className="status-dot" /> Saved locally</span>} />
    <div className="create-layout">
      <div className="stepper"><Step number="01" label="Item & people" active={step === 1} done={step > 1} /><Step number="02" label="Condition policy" active={step === 2} done={step > 2} /><Step number="03" label="Fund & invite" active={step === 3} done={false} /></div>
      <div className="create-main">
        {step === 1 && <div className="form-section"><FormIntro number="01" title="Item & people" detail="Start with what is moving and who is responsible for it." />
          <div className="form-grid"><Field label="What are you bonding?" hint="A clear name helps both parties inspect the same item." value={item} onChange={setItem} placeholder="e.g. Red ceramic mug" /><Field label="Counterparty wallet" hint="The custodian must activate the funded bond." value={counterparty} onChange={setCounterparty} placeholder="0x…" /><Field label="Before evidence URL" hint="HTTPS image URL; it becomes immutable on-chain." value={beforeUrl} onChange={setBeforeUrl} placeholder="https://…" /><Field label="Category" hint="Used to organize your audit trail." placeholder="Select a category" select /><Field label="Reference or serial number" hint="Optional. Never store sensitive personal data." placeholder="e.g. C02ZK1H0MD6M" /></div>
          <div className="form-actions"><button className="button subtle" onClick={onCancel}>Cancel</button><button className="button primary" onClick={() => setStep(2)}>Continue <ChevronRight size={16} /></button></div>
        </div>}
        {step === 2 && <div className="form-section"><FormIntro number="02" title="Condition policy" detail="Give the inspection a shared, objective frame." />
          <div className="policy-editor"><div className="policy-editor-head"><div><strong>Inspection criteria</strong><p>Both parties will see this list before accepting.</p></div><button className="text-button"><Plus size={14} /> Add criterion</button></div>{['Screen & glass', 'Chassis & edges', 'Power & ports', 'Accessories'].map((label, index) => <div className="criterion-input" key={label}><span className="criterion-index">0{index + 1}</span><input defaultValue={label} /><button aria-label="Remove criterion"><X size={15} /></button></div>)}<div className="policy-note"><Info size={15} /><span>ConditionBond freezes these criteria on-chain when both parties accept. Neither party can edit them afterwards.</span></div></div>
          <div className="form-actions"><button className="button subtle" onClick={() => setStep(1)}>Back</button><button className="button primary" onClick={() => setStep(3)}>Continue <ChevronRight size={16} /></button></div>
        </div>}
        {step === 3 && <div className="form-section"><FormIntro number="03" title="Fund & invite" detail="Secure the return before you share the inspection link." />
          <div className="fund-card"><div><span className="eyebrow">Bond amount</span><h3>How much should be held?</h3><p>Released automatically when the return matches the frozen policy.</p></div><div className="amount-input"><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" /><span>GEN</span></div></div><div className="settlement-preview"><div><span className="eyebrow">Settlement policy</span><strong>Auto-release on match</strong></div><Status tone="green" label="Frozen after acceptance" /></div>
          <div className="form-actions"><button className="button subtle" onClick={() => setStep(2)}>Back</button><button className="button primary" onClick={() => onCreate(item, amount, counterparty, beforeUrl)}>Create bond <ArrowUpRight size={16} /></button></div>
        </div>}
      </div>
      <aside className="create-aside"><div className="aside-label"><Sparkles size={14} /> How it works</div><div className="aside-flow"><FlowRow icon={<FileCheck2 size={16} />} title="Agree" detail="Both parties accept the same criteria." /><FlowRow icon={<Camera size={16} />} title="Inspect" detail="Evidence is captured at return." /><FlowRow icon={<Gavel size={16} />} title="Settle" detail="GenLayer validators compare the record." /></div><div className="aside-foot"><ShieldCheck size={15} /><span>Non-custodial. The policy is visible before funds move.</span></div></aside>
    </div>
  </>
}

function Step({ number, label, active, done }: { number: string; label: string; active: boolean; done: boolean }) { return <div className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`}><span>{done ? <Check size={14} /> : number}</span><strong>{label}</strong></div> }
function FormIntro({ number, title, detail }: { number: string; title: string; detail: string }) { return <div className="form-intro"><span className="section-number">{number}</span><div><h2>{title}</h2><p>{detail}</p></div></div> }
function Field({ label, hint, value, onChange, placeholder, select }: { label: string; hint: string; value?: string; onChange?: (value: string) => void; placeholder: string; select?: boolean }) { return <label className="field"><span>{label}</span>{select ? <select defaultValue=""><option value="" disabled>{placeholder}</option><option>Electronics</option><option>Furniture</option><option>Photography</option><option>Mobility</option></select> : <input value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} />}<small>{hint}</small></label> }
function FlowRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="flow-row"><span className="flow-icon">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div></div> }

function BondDetail({ navigate, showToast, copyId, copied, onFund, onActivate, onSubmitReturn, onReview, settled }: { navigate: (route: Route) => void; showToast: (message: string) => void; copyId: () => void; copied: boolean; onFund: () => void; onActivate: () => void; onSubmitReturn: () => void; onReview: () => void; settled: boolean }) {
  return <>
    <div className="detail-topline"><button className="back-button" onClick={() => navigate('dashboard')}>← Back to bonds</button><span className="detail-id"><span className="status-dot" /> CB-LIVE-MATERIAL-01 <button onClick={copyId}>{copied ? <Check size={13} /> : <Copy size={13} />}</button></span></div>
    <div className="detail-head"><div><div className="eyebrow">Active bond / Settled / material damage</div><h1>Red ceramic mug</h1><div className="detail-meta"><span>Owned by you</span><span className="meta-divider" /><span>Counterparty: Studio Dev custodian</span><span className="meta-divider" /><span>1 GEN secured</span></div></div><div className="detail-actions"><button className="button subtle" disabled={settled} onClick={onFund}><Wallet size={15} /> Fund bond</button><button className="button subtle" disabled={settled} onClick={onActivate}><ShieldCheck size={15} /> Activate</button><button className="button subtle" disabled={settled} onClick={onSubmitReturn}><Camera size={15} /> Submit return</button><button className="button primary" disabled={settled} onClick={() => { onReview(); navigate('review') }}>Review return <ArrowUpRight size={15} /></button></div></div>
    <div className="detail-grid">
      <div className="detail-content">
        <section className="evidence-section"><div className="section-heading compact"><div><span className="eyebrow">The evidence</span><h2>Before / after inspection</h2></div><span className="evidence-count"><Camera size={14} /> 8 files · hash verified</span></div><div className="evidence-compare"><EvidenceCard label="Before · Oct 02, 09:41" image={imageBefore} note="Intake evidence" /><div className="compare-line"><span>Compare</span><ArrowUpRight size={14} /></div><EvidenceCard label="After · Oct 06, 14:18" image={imageAfter} note="Return evidence" after /></div><div className="evidence-caption"><span><Fingerprint size={14} /> Evidence hashes are anchored to the bond contract.</span><button className="text-button">View provenance <ExternalLink size={13} /></button></div></section>
        <section className="findings-section"><div className="section-heading compact"><div><span className="eyebrow">Condition verdict</span><h2>Criterion-by-criterion</h2></div><Status tone="red" label="Material damage" /></div><div className="findings-list">{criteria.map((criterion, index) => <div className="finding" key={criterion.label}><span className="finding-number">0{index + 1}</span><div className="finding-main"><strong>{criterion.label}</strong><p>{criterion.note}</p></div><Status tone={criterion.tone} label={criterion.value} /><ChevronRight size={15} className="finding-chevron" /></div>)}</div></section>
        <section className="verdict-panel"><div className="verdict-symbol"><Check size={20} /></div><div><span className="eyebrow">Validator consensus</span><h3>Material damage confirmed against the frozen policy</h3><p>3 of 3 independent validators agreed on MATERIAL_DAMAGE. The deterministic split is recorded.</p></div><button className="button dark" onClick={() => navigate('settlement')}>View settlement <ChevronRight size={15} /></button></section>
      </div>
      <aside className="detail-aside"><div className="side-card lifecycle-card"><div className="side-card-head"><span className="eyebrow">Bond lifecycle</span><span className="tiny-live"><span className="pulse-dot" /> Live</span></div><div className="lifecycle"><LifeStep label="Bond created" date="Oct 02 · 09:36" done /><LifeStep label="Policy accepted" date="Oct 02 · 09:42" done /><LifeStep label="Return submitted" date="Oct 06 · 14:18" done /><LifeStep label="Inspection review" date="Now" current /><LifeStep label="Settlement" date="Next" /></div></div><div className="side-card"><div className="side-card-head"><span className="eyebrow">Frozen policy</span><ShieldCheck size={15} /></div><div className="policy-lines"><div><span>Release condition</span><strong>Match on return</strong></div><div><span>Review window</span><strong>24 hours</strong></div><div><span>Dispute path</span><strong>Evidence review</strong></div></div><button className="side-link" onClick={() => navigate('audit')}>Open policy record <ChevronRight size={14} /></button></div><div className="side-card transaction-card"><div className="side-card-head"><span className="eyebrow">Latest transaction</span><CheckCircle2 size={15} className="green-icon" /></div><strong>Policy evaluation accepted</strong><button className="hash-link" onClick={copyId}>0x8b12…a9c4 <ExternalLink size={12} /></button><span className="muted-small">Finalized on Studio Dev · 2 min ago</span></div></aside>
    </div>
  </>
}

function EvidenceCard({ label, image, note, after }: { label: string; image: string; note: string; after?: boolean }) { return <div className="evidence-card"><div className="evidence-image"><img src={image} alt="Condition evidence" /><span className={`evidence-badge ${after ? 'after' : ''}`}>{after ? 'RETURN' : 'INTAKE'}</span><button className="image-expand" aria-label="Open evidence"><ExternalLink size={14} /></button></div><div className="evidence-card-foot"><span>{label}</span><span className="muted-small">{note}</span></div></div> }
function LifeStep({ label, date, done, current }: { label: string; date: string; done?: boolean; current?: boolean }) { return <div className={`life-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}><span className="life-dot">{done ? <Check size={11} /> : current ? <span /> : ''}</span><div><strong>{label}</strong><span>{date}</span></div></div> }

function Review({ navigate, showToast, onReview }: { navigate: (route: Route) => void; showToast: (message: string) => void; onReview: () => void }) {
  return <><PageHeader eyebrow="CB-LIVE-MATERIAL-01 / Return review" title="Does the item match?" subtitle="Review the return against the criteria you both froze at intake." action={<Status tone="amber" label="Decision pending" />} /><div className="review-layout"><div className="review-main"><div className="review-compare"><EvidenceCard label="Intake · Oct 02" image={imageBefore} note="8 files" /><div className="review-arrow"><ArrowUpRight size={18} /></div><EvidenceCard label="Return · Oct 06" image={imageAfter} note="5 files" after /></div><div className="review-checklist"><div className="section-heading compact"><div><span className="eyebrow">Review checklist</span><h2>Confirm each criterion</h2></div><span className="muted-small">4 of 4 checked</span></div>{criteria.map((criterion, index) => <div className="review-row" key={criterion.label}><span className="review-check"><Check size={14} /></span><span className="review-row-index">0{index + 1}</span><div><strong>{criterion.label}</strong><p>{criterion.note}</p></div><button className="review-match">Matches <Check size={13} /></button></div>)}</div><div className="review-actions"><button className="button subtle" onClick={() => showToast('Issue flow opened — no dispute submitted')}>Raise an issue</button><button className="button primary" onClick={() => { onReview(); navigate('settlement') }}>Confirm match <Check size={16} /></button></div></div><aside className="review-aside"><div className="side-card"><div className="side-card-head"><span className="eyebrow">Decision guardrails</span><CircleHelp size={15} /></div><p className="aside-copy">Confirming releases the secured amount to the owner. The decision and evidence hashes are permanently recorded.</p><div className="guardrail"><ShieldCheck size={15} /><span>Validators independently inspect the same evidence set.</span></div></div><div className="side-card"><div className="side-card-head"><span className="eyebrow">If something is wrong</span></div><p className="aside-copy">Raise an issue to pause settlement. You’ll be asked to highlight the specific criterion and add evidence.</p><button className="side-link" onClick={() => showToast('Issue flow opened — no dispute submitted')}>Start issue flow <ChevronRight size={14} /></button></div></aside></div></>
}

function Settlement({ navigate, onSettle }: { navigate: (route: Route) => void; onSettle: () => void }) {
  return <><div className="settlement-page"><div className="settlement-mark"><Check size={31} /></div><span className="eyebrow">CB-LIVE-MATERIAL-01 / Settlement complete</span><h1>Material damage settled.</h1><p className="settlement-lede">The return triggered the frozen material-damage rule. The 1 GEN bond was split deterministically.</p><div className="settlement-receipt"><div><span className="eyebrow">Owner receipt</span><strong>0.25 GEN</strong></div><div><span className="eyebrow">Custodian receipt</span><strong>0.75 GEN</strong></div><div><span className="eyebrow">Verdict</span><Status tone="red" label="MATERIAL_DAMAGE" /></div><div><span className="eyebrow">Contract balance</span><strong>0 GEN</strong></div></div><div className="settlement-steps"><LifeStep label="Evidence compared" date="3 validators agreed" done /><LifeStep label="Policy evaluated" date="MATERIAL_DAMAGE" done /><LifeStep label="Funds released" date="0.25 / 0.75 GEN" done /></div><div className="settlement-actions"><button className="button subtle" onClick={() => navigate('audit')}>View audit trail</button><button className="button primary" disabled onClick={onSettle}>Settlement finalized <Check size={15} /></button><button className="button subtle" onClick={() => navigate('dashboard')}>Back to overview <ArrowUpRight size={15} /></button></div></div></>
}

function Audit({ showToast }: { showToast: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const events = useMemo(() => [
    ['Live', 'Settlement finalized', 'CB-LIVE-MATERIAL-01', '0.25 / 0.75 GEN', 'MATERIAL_DAMAGE', 'red'],
    ['Live', 'Condition evaluated', 'CB-LIVE-MATERIAL-01', 'Return evidence', 'Consensus 3/3', 'green'],
    ['Live', 'Fail-closed case', 'CB-LIVE-UNDETERMINED-01', '1 GEN retained', 'UNDETERMINED', 'amber'],
    ['Live', 'Evidence anchored', 'CB-LIVE-MATERIAL-01', 'BEFORE / AFTER', 'Finalized', 'blue'],
    ['Live', 'Policy frozen', 'CB-LIVE-MATERIAL-01', '2500 bps', 'Finalized', 'blue'],
    ['Live', 'Bond funded', 'CB-LIVE-MATERIAL-01', '1 GEN', 'Finalized', 'green'],
  ].filter((event) => event.join(' ').toLowerCase().includes(query.toLowerCase())), [query])
  return <><PageHeader eyebrow="Protocol / Audit" title="Every decision, inspectable." subtitle="A chronological record of policy, evidence and settlement events." action={<button className="button subtle" onClick={() => showToast('Audit export prepared')}><ArrowDownLeft size={15} /> Export log</button>} /><div className="audit-summary"><div><span className="eyebrow">Audit coverage</span><strong>100%</strong><span>All active bonds have evidence anchors</span></div><div><span className="eyebrow">Validator agreement</span><strong>99.2%</strong><span>Across your last 31 settlements</span></div><div><span className="eyebrow">Production contract</span><strong>{short(CONTRACT_ADDRESS)}</strong><span className="hash-link">Studio Dev · chain {CHAIN_ID}</span><span className="muted-small" title={SOURCE_SHA256}>Source {SOURCE_SHA256.slice(0, 12)}…</span></div></div><section className="audit-panel"><div className="audit-toolbar"><div><span className="eyebrow">Event stream</span><h2>ConditionBond activity</h2></div><div className="search-field"><Search size={15} /><input placeholder="Search events" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="audit-table"><div className="audit-row audit-head"><span>Time</span><span>Event</span><span>Bond</span><span>Record</span><span>State</span></div>{events.map((event) => <div className="audit-row" key={`${event[0]}-${event[1]}`}><span className="muted-small">{event[0]}</span><strong>{event[1]}</strong><span className="hash-link">{event[2]}</span><span>{event[3]}</span><Status tone={event[5] as Tone} label={event[4]} /></div>)}</div><div className="audit-foot"><Fingerprint size={15} /> All records are anchored to the ConditionBond contract <button className="text-button">View on explorer <ExternalLink size={13} /></button></div></section></>
}

export function getRoute(): Route { return routeForPath(window.location.pathname) }

window.addEventListener('popstate', () => window.dispatchEvent(new Event('conditionbond-route')))

export default App

if (typeof document !== 'undefined') {
  const root = document.getElementById('root')
  if (root && !root.hasChildNodes()) createRoot(root).render(<App />)
}
