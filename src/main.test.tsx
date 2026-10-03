import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './main'
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  SOURCE_SHA256,
  connectWallet,
  readBond,
  readBondIds,
  readContractBalance,
  writeAndFinalize,
  short,
} from './genlayer'
import {
  canPerformBondAction,
  comparableEvidence,
  normalizeVerdict,
  routeForPath,
  settlementFor,
  validateCreateBondInput,
  utcDeadline,
  formatDeadline,
  type ChainBond,
} from './product'

vi.mock('./genlayer', async () => {
  const actual = await vi.importActual<typeof import('./genlayer')>('./genlayer')
  return {
    ...actual,
    connectWallet: vi.fn(),
    readBond: vi.fn(),
    readBondIds: vi.fn(),
    readContractBalance: vi.fn(),
    watchWallet: vi.fn(() => () => undefined),
    writeAndFinalize: vi.fn(),
  }
})

const OWNER = '0x1111111111111111111111111111111111111111'
const CUSTODIAN = '0x2222222222222222222222222222222222222222'
const BEFORE = 'https://example.com/before.png'
const AFTER = 'https://example.com/after.png'
const WEI = 1_000_000_000_000_000_000n

function makeBond(overrides: Partial<ChainBond> = {}): ChainBond {
  return {
    schema_version: 'conditionbond.v1',
    bond_id: 'CB-TEST',
    owner: OWNER,
    custodian: CUSTODIAN,
    amount: WEI.toString(),
    damage_bps: '2500',
    deadline_utc: '2026-12-31T23:59:00Z',
    before_manifest: JSON.stringify([{ evidence_id: 'before-1', url: BEFORE, sha256: '' }]),
    criteria: JSON.stringify([{ criterion_id: 'surface', requirement: 'No new structural crack.' }]),
    acceptable_wear: JSON.stringify({ asset_description: 'Test asset', definition: 'Light scuffs are acceptable.' }),
    material_damage: JSON.stringify({ asset_description: 'Test asset', definition: 'A structural crack is material damage.' }),
    policy_fingerprint: 'policy-fingerprint',
    before_fingerprint: 'before-fingerprint',
    after_manifest: JSON.stringify([{ evidence_id: 'after-1', url: AFTER, sha256: '' }]),
    after_fingerprint: 'after-fingerprint',
    verdict: 'MATERIAL_DAMAGE',
    reasoning: 'Stored GenLayer result.',
    damage_charge: '250000000000000000',
    owner_receipt: '250000000000000000',
    custodian_receipt: '750000000000000000',
    settlement_fingerprint: 'settlement-fingerprint',
    status: 'SETTLED',
    revision: '5',
    ...overrides,
  }
}

const materialBond = makeBond({ bond_id: 'CB-LIVE-MATERIAL-01', deadline_utc: '2099-01-01T00:00:00Z', acceptable_wear: JSON.stringify({ asset_description: 'Red ceramic mug', definition: 'Minor scuffs.' }), material_damage: JSON.stringify({ asset_description: 'Red ceramic mug', definition: 'New structural crack.' }) })
const undeterminedBond = makeBond({
  bond_id: 'CB-LIVE-UNDETERMINED-01',
  deadline_utc: '2099-01-01T00:00:00Z',
  verdict: 'UNDETERMINED',
  reasoning: 'Evidence was ambiguous.',
  damage_charge: '0',
  owner_receipt: '0',
  custodian_receipt: '0',
  settlement_fingerprint: '',
  status: 'UNDETERMINED',
})
const activeBond = makeBond({ bond_id: 'CB-ACTIVE', status: 'ACTIVE', verdict: '', reasoning: '', after_manifest: '[]', after_fingerprint: '', damage_charge: '0', owner_receipt: '0', custodian_receipt: '0', settlement_fingerprint: '', revision: '2' })

function setReadState(records: ChainBond[], balance = WEI) {
  vi.mocked(readBondIds).mockResolvedValue(records.map((record) => record.bond_id))
  vi.mocked(readBond).mockImplementation(async (id) => records.find((record) => record.bond_id === id) || records[0])
  vi.mocked(readContractBalance).mockResolvedValue(balance)
}

function renderRoute(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

beforeEach(() => {
  vi.mocked(connectWallet).mockResolvedValue({ address: OWNER, provider: {} as any, chainId: '0xf22d' })
  vi.mocked(writeAndFinalize).mockResolvedValue({ hash: '0xwrite', estimate: {} as any, decided: {}, finalized: {} })
  setReadState([materialBond, undeterminedBond])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.history.pushState({}, '', '/')
})

describe('ConditionBond authoritative frontend', () => {
  it('renders the dashboard from get_bond_ids/get_bond and removes invented production records', async () => {
    const view = renderRoute('/')
    await waitFor(() => expect(screen.getByText('CB-LIVE-MATERIAL-01')).toBeInTheDocument())
    expect(screen.getByText('CB-LIVE-UNDETERMINED-01')).toBeInTheDocument()
    expect(screen.getAllByText('Jan 1, 2099 · controlled proof fixture')).toHaveLength(2)
    expect(screen.queryByText('2099-01-01T00:00:00Z')).not.toBeInTheDocument()
    expect(screen.queryByText(/Sony A7 IV|Aeron|Brompton|100% resolved|validator agreement/i)).not.toBeInTheDocument()
    expect(screen.getByText('No fixture records are rendered.')).toBeInTheDocument()
    expect(readBondIds).toHaveBeenCalled()
    expect(readBond).toHaveBeenCalledWith('CB-LIVE-MATERIAL-01')
    expect(readContractBalance).toHaveBeenCalled()
    view.unmount()
  })

  it('supports dynamic bond, review, settlement, and audit routes', async () => {
    for (const [path, heading] of [
      ['/', 'Trust, with a paper trail.'],
      ['/create', 'Make the condition explicit.'],
      ['/bonds/CB-LIVE-MATERIAL-01', 'Red ceramic mug'],
      ['/bonds/CB-LIVE-MATERIAL-01/review', 'Does the item match?'],
      ['/bonds/CB-LIVE-MATERIAL-01/settlement', 'Settlement finalized.'],
      ['/audit', 'Every decision, inspectable.'],
    ] as const) {
      const view = renderRoute(path)
      await waitFor(() => expect(screen.getByText(heading)).toBeInTheDocument())
      view.unmount()
    }
    expect(routeForPath('/bonds/CB-LIVE-MATERIAL-01')).toEqual({ kind: 'bond', bondId: 'CB-LIVE-MATERIAL-01' })
    expect(routeForPath('/bonds/CB-LIVE-MATERIAL-01/review')).toEqual({ kind: 'review', bondId: 'CB-LIVE-MATERIAL-01' })
    expect(routeForPath('/bonds/CB-LIVE-MATERIAL-01/settlement')).toEqual({ kind: 'settlement', bondId: 'CB-LIVE-MATERIAL-01' })
  })

  it('validates the complete create payload and preserves custom policy fields', () => {
    const base = { item: 'Test asset', amount: '1', counterparty: CUSTODIAN, beforeUrl: BEFORE, criteria: ['Screen is intact'], acceptableWear: 'Minor scuffs', materialDamage: 'Any structural crack', damageBps: '2500', deadline: '2026-12-31T23:59:00Z' }
    expect(validateCreateBondInput({ ...base, item: '' })).toContain('item')
    expect(validateCreateBondInput({ ...base, beforeUrl: 'http://bad.example/image' })).toContain('HTTPS')
    expect(validateCreateBondInput({ ...base, criteria: [''] })).toContain('criterion')
    expect(validateCreateBondInput({ ...base, damageBps: '0' })).toContain('1 to 10000')
    expect(validateCreateBondInput(base)).toBeNull()
    expect(comparableEvidence(BEFORE, AFTER)).toBe(true)
    expect(comparableEvidence(BEFORE, BEFORE)).toBe(false)
  })

  it('sends user-entered item, criteria, policies, BPS, BEFORE URL, amount and deadline to create_bond', async () => {
    const view = renderRoute('/create')
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    await waitFor(() => expect(screen.getByText(/0x1111/i)).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Item / asset description'), { target: { value: 'Custom field recorder' } })
    fireEvent.change(screen.getByLabelText('Custodian wallet'), { target: { value: CUSTODIAN } })
    fireEvent.change(screen.getByLabelText('BEFORE image URL'), { target: { value: 'https://cdn.example/custom-before.png' } })
    fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '2026-12-31T23:59' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByLabelText('Criterion 1'), { target: { value: 'Serial plate remains present' } })
    fireEvent.change(screen.getByLabelText('Acceptable wear definition'), { target: { value: 'Small cosmetic marks only' } })
    fireEvent.change(screen.getByLabelText('Material damage definition'), { target: { value: 'Crack or missing component' } })
    fireEvent.change(screen.getByLabelText('Damage charge (BPS)'), { target: { value: '3750' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByLabelText('Bond amount in GEN'), { target: { value: '1.25' } })
    fireEvent.click(screen.getByRole('button', { name: /create bond draft/i }))
    await waitFor(() => expect(writeAndFinalize).toHaveBeenCalledWith(
      OWNER,
      'create_bond',
      expect.any(Array),
    ))
    const args = vi.mocked(writeAndFinalize).mock.calls[0][2] as any[]
    expect(args[1]).toBe(CUSTODIAN)
    expect(args[2]).toBe(1_250_000_000_000_000_000n)
    expect(args[3]).toContain('custom-before.png')
    expect(args[4]).toContain('Serial plate remains present')
    expect(args[5]).toContain('Small cosmetic marks only')
    expect(args[5]).toContain('Custom field recorder')
    expect(args[6]).toContain('Crack or missing component')
    expect(args[7]).toBe(3750n)
    expect(args[8]).toBe(utcDeadline('2026-12-31T23:59'))
    view.unmount()
  })

  it('submits the entered AFTER URL and never substitutes a fixture', async () => {
    vi.mocked(connectWallet).mockResolvedValue({ address: CUSTODIAN, provider: {} as any, chainId: '0xf22d' })
    setReadState([activeBond])
    const view = renderRoute('/bonds/CB-ACTIVE')
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    await waitFor(() => expect(screen.getByText('Submit actual AFTER evidence')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('AFTER image URL'), { target: { value: 'https://cdn.example/custom-after.png' } })
    fireEvent.click(screen.getByRole('button', { name: /submit return evidence/i }))
    await waitFor(() => expect(writeAndFinalize).toHaveBeenCalledWith(CUSTODIAN, 'submit_return', expect.any(Array), 0n))
    const args = vi.mocked(writeAndFinalize).mock.calls[0][2] as any[]
    expect(args[1]).toContain('custom-after.png')
    expect(args[1]).not.toContain('after-material-damage.svg')
    expect(vi.mocked(readBond).mock.calls.length).toBeGreaterThan(1)
    view.unmount()
  })

  it('does not render a verdict selector and review is an owner-only write', async () => {
    const pending = makeBond({ bond_id: 'CB-PENDING', status: 'RETURN_SUBMITTED', verdict: '', reasoning: '', owner_receipt: '0', custodian_receipt: '0', damage_charge: '0', settlement_fingerprint: '' })
    setReadState([pending])
    const view = renderRoute('/bonds/CB-PENDING/review')
    await waitFor(() => expect(screen.getByText('Run GenLayer review')).toBeInTheDocument())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/UNCHANGED|ACCEPTABLE|MATERIAL|UNDETERMINED/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    await waitFor(() => expect(screen.getByText(/0x1111/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /run genlayer review/i }))
    await waitFor(() => expect(writeAndFinalize).toHaveBeenCalledWith(OWNER, 'review_bond', ['CB-PENDING'], 0n))
    view.unmount()
  })

  it('rereads authoritative state after a successful write', async () => {
    const funded = makeBond({ bond_id: 'CB-FUNDED', status: 'FUNDED', verdict: '', after_manifest: '[]', after_fingerprint: '', owner_receipt: '0', custodian_receipt: '0', damage_charge: '0' })
    setReadState([funded])
    const view = renderRoute('/bonds/CB-FUNDED')
    await waitFor(() => expect(screen.getByText('Activate')).toBeInTheDocument())
    vi.mocked(connectWallet).mockResolvedValue({ address: CUSTODIAN, provider: {} as any, chainId: '0xf22d' })
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    await waitFor(() => expect(screen.getByText(/0x2222/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /activate/i }))
    await waitFor(() => expect(writeAndFinalize).toHaveBeenCalled())
    expect(vi.mocked(readBond).mock.calls.length).toBeGreaterThan(1)
    view.unmount()
  })

  it('derives canonical settlement receipts from chain data and blocks UNDETERMINED', async () => {
    const materialView = renderRoute('/bonds/CB-LIVE-MATERIAL-01/settlement')
    await waitFor(() => expect(screen.getByText('Settlement finalized.')).toBeInTheDocument())
    expect(screen.getByText('0.25 GEN')).toBeInTheDocument()
    expect(screen.getByText('0.75 GEN')).toBeInTheDocument()
    materialView.unmount()

    const undeterminedView = renderRoute('/bonds/CB-LIVE-UNDETERMINED-01/settlement')
    await waitFor(() => expect(screen.getByText('Settlement blocked.')).toBeInTheDocument())
    expect(screen.getByText('UNDETERMINED never settles. The stored receipts remain 0 / 0 and the bond principal remains retained.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settlement blocked/i })).toBeDisabled()
    expect(screen.getAllByText('0 GEN').length).toBeGreaterThanOrEqual(2)
    undeterminedView.unmount()
  })

  it('gates roles and terminal states without inventing a write path', () => {
    expect(canPerformBondAction('fund', OWNER, { status: 'DRAFT', owner: OWNER, custodian: CUSTODIAN })).toBe(true)
    expect(canPerformBondAction('fund', CUSTODIAN, { status: 'DRAFT', owner: OWNER, custodian: CUSTODIAN })).toBe(false)
    expect(canPerformBondAction('activate', CUSTODIAN, { status: 'FUNDED', owner: OWNER, custodian: CUSTODIAN })).toBe(true)
    expect(canPerformBondAction('activate', OWNER, { status: 'FUNDED', owner: OWNER, custodian: CUSTODIAN })).toBe(false)
    expect(canPerformBondAction('submit_return', CUSTODIAN, { status: 'ACTIVE', owner: OWNER, custodian: CUSTODIAN })).toBe(true)
    expect(canPerformBondAction('review', OWNER, { status: 'RETURN_SUBMITTED', owner: OWNER, custodian: CUSTODIAN })).toBe(true)
    expect(canPerformBondAction('settle', OWNER, { status: 'SETTLED', owner: OWNER, custodian: CUSTODIAN })).toBe(false)
    expect(settlementFor('UNDETERMINED', WEI, 2500n)).toBeNull()
  })

  it('handles short addresses, formats controlled and UTC deadlines, and fails safely', () => {
    expect(short(CUSTODIAN, 2, 0)).toBe('0x…')
    expect(short(CUSTODIAN, 2, 4)).toBe('0x…2222')
    expect(utcDeadline('2026-12-31T23:59')).toBe(new Date('2026-12-31T23:59:00').toISOString().replace(/\.\d{3}Z$/, 'Z'))
    expect(utcDeadline('2026-12-31T23:59:00Z')).toBe('2026-12-31T23:59:00Z')
    expect(formatDeadline('2099-01-01T00:00:00Z', 'CB-LIVE-MATERIAL-01')).toBe('Jan 1, 2099 · controlled proof fixture')
    expect(formatDeadline('2026-12-31T23:59:00Z', 'CB-TEST')).toBe('Dec 31, 2026 · 11:59 PM UTC')
    expect(formatDeadline('', 'CB-TEST')).toBe('—')
    expect(formatDeadline('not-a-date', 'CB-TEST')).toBe('—')
  })

  it('renders chain-derived controlled proof cards and verified explorer links on audit', async () => {
    const view = renderRoute('/audit')
    await waitFor(() => expect(screen.getByText('CONTROLLED STUDIO DEV PROOF · MATERIAL')).toBeInTheDocument())
    expect(screen.getByText(/0\.25 GEN owner/)).toBeInTheDocument()
    expect(screen.getByText(/0\.75 GEN custodian/)).toBeInTheDocument()
    expect(screen.getByText('CONTROLLED STUDIO DEV PROOF · FAIL-CLOSED')).toBeInTheDocument()
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === 'https://explorer-studio.genlayer.com/tx/0x7ed51eee49ea1dbaebc49c5a7f0428b57f963105cdd25182b5d362e641e5e1db')).toBe(true)
    view.unmount()
  })

  it('keeps criteria neutral and separates the stored overall verdict', async () => {
    const view = renderRoute('/bonds/CB-LIVE-MATERIAL-01')
    await waitFor(() => expect(screen.getByText('Evaluated by GenLayer')).toBeInTheDocument())
    expect(screen.queryByText('Included in verdict')).not.toBeInTheDocument()
    expect(view.container.querySelector('.verdict-material_damage')).toBeTruthy()
    expect(screen.getByText('Stored on-chain')).toBeInTheDocument()
    view.unmount()
  })

  it('caps create criteria at eight and previews the deterministic contract rule', async () => {
    const view = renderRoute('/create')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByLabelText('Criterion 1'), { target: { value: 'Criterion one' } })
    const add = screen.getByRole('button', { name: /add criterion/i })
    for (let index = 0; index < 7; index += 1) fireEvent.click(add)
    expect(screen.getByLabelText('Criterion 8')).toBeInTheDocument()
    expect(add).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Damage charge (BPS)'), { target: { value: '2500' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByLabelText('Bond amount in GEN'), { target: { value: '1' } })
    expect(screen.getByText('0.25 GEN owner / 0.75 GEN custodian')).toBeInTheDocument()
    expect(screen.getByText('No settlement · principal retained')).toBeInTheDocument()
    view.unmount()
  })

  it('shows the authoritative settlement fingerprint without inventing a transaction hash', async () => {
    const view = renderRoute('/bonds/CB-LIVE-MATERIAL-01/settlement')
    await waitFor(() => expect(screen.getByText('Settlement fingerprint')).toBeInTheDocument())
    expect(screen.getByText('settlement-fingerprint')).toBeInTheDocument()
    expect(screen.getByText(/no settlement transaction hash is inferred/i)).toBeInTheDocument()
    view.unmount()
  })

  it('shows production contract constants and only known audit hashes', async () => {
    const view = renderRoute('/audit')
    await waitFor(() => expect(screen.getByText('ConditionBond activity')).toBeInTheDocument())
    expect(screen.getByText(CONTRACT_ADDRESS.slice(0, 8) + '…' + CONTRACT_ADDRESS.slice(-6))).toBeInTheDocument()
    expect(screen.getByText('Studio Dev · chain ' + CHAIN_ID)).toBeInTheDocument()
    expect(screen.getByText('Source ' + SOURCE_SHA256)).toBeInTheDocument()
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === 'https://explorer-studio.genlayer.com/address/' + CONTRACT_ADDRESS)).toBe(true)
    expect(screen.getByText('Production deployment')).toBeInTheDocument()
    expect(screen.getByText(/Only the deployment and UNDETERMINED creation hashes were preserved/i)).toBeInTheDocument()
    view.unmount()
  })
})
