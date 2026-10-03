import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './main'
import { CHAIN_ID, CONTRACT_ADDRESS, SOURCE_SHA256 } from './genlayer'
import {
  canPerformBondAction,
  comparableEvidence,
  normalizeVerdict,
  routeForPath,
  settlementFor,
  validateCreateBondInput,
} from './product'

afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
})

function renderRoute(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('ConditionBond frontend regression coverage', () => {
  it('renders every supported deep-link route', () => {
    for (const [path, heading] of [
      ['/', 'Trust, with a paper trail.'],
      ['/create', 'Make the condition explicit.'],
      ['/bond', 'Red ceramic mug'],
      ['/review', 'Does the item match?'],
      ['/settlement', 'Material damage settled.'],
      ['/audit', 'Every decision, inspectable.'],
    ] as const) {
      const view = renderRoute(path)
      expect(screen.getByText(heading)).toBeInTheDocument()
      view.unmount()
    }
  })

  it('validates create-bond fields before a wallet write', () => {
    expect(validateCreateBondInput({ item: '', amount: '1', counterparty: '0x123' })).toContain('item')
    expect(validateCreateBondInput({ item: 'Mug', amount: '0', counterparty: '0x123' })).toContain('custodian')
    expect(validateCreateBondInput({ item: 'Mug', amount: '1', counterparty: '0x' + '1'.repeat(40), beforeUrl: 'http://bad.example/image' })).toContain('HTTPS')
    expect(validateCreateBondInput({ item: 'Mug', amount: '1', counterparty: '0x' + '1'.repeat(40), beforeUrl: 'https://example.com/before.png' })).toBeNull()
  })

  it('keeps BEFORE and AFTER evidence comparable only for distinct HTTPS URLs', () => {
    expect(comparableEvidence('https://example.com/before.png', 'https://example.com/after.png')).toBe(true)
    expect(comparableEvidence('https://example.com/before.png', 'https://example.com/before.png')).toBe(false)
    expect(comparableEvidence('http://example.com/before.png', 'https://example.com/after.png')).toBe(false)
    const view = renderRoute('/bond')
    expect(screen.getAllByAltText('Condition evidence')).toHaveLength(2)
    expect(screen.getByText('Before / after inspection')).toBeInTheDocument()
    expect(screen.getByText('INTAKE')).toBeInTheDocument()
    expect(screen.getByText('RETURN')).toBeInTheDocument()
    view.unmount()
  })

  it('normalizes every verdict and fails closed on malformed output', () => {
    expect(normalizeVerdict('UNCHANGED')).toBe('UNCHANGED')
    expect(normalizeVerdict('ACCEPTABLE_WEAR')).toBe('ACCEPTABLE_WEAR')
    expect(normalizeVerdict('MATERIAL_DAMAGE')).toBe('MATERIAL_DAMAGE')
    expect(normalizeVerdict('not-json')).toBe('UNDETERMINED')
    const view = renderRoute('/review')
    expect(screen.getByText('Decision pending')).toBeInTheDocument()
    expect(screen.getByText('Confirm each criterion')).toBeInTheDocument()
    view.unmount()
  })

  it('renders deterministic settlement state and receipts', () => {
    const payout = settlementFor('MATERIAL_DAMAGE', 1_000_000_000_000_000_000n, 2500n)
    expect(payout).toEqual({ damageCharge: 250_000_000_000_000_000n, ownerReceipt: 250_000_000_000_000_000n, custodianReceipt: 750_000_000_000_000_000n })
    expect(settlementFor('UNCHANGED', 1_000n, 2500n)).toEqual({ damageCharge: 0n, ownerReceipt: 0n, custodianReceipt: 1_000n })
    const view = renderRoute('/settlement')
    expect(screen.getByText('Material damage settled.')).toBeInTheDocument()
    expect(screen.getByText('0.25 GEN')).toBeInTheDocument()
    expect(screen.getByText('0.75 GEN')).toBeInTheDocument()
    expect(screen.getAllByText('MATERIAL_DAMAGE').length).toBeGreaterThanOrEqual(1)
    view.unmount()
  })

  it('keeps UNDETERMINED fail-closed with no payout', () => {
    expect(settlementFor('UNDETERMINED', 1_000n, 2500n)).toBeNull()
  })

  it('gates owner/custodian actions and terminal states', () => {
    const owner = '0x' + '1'.repeat(40)
    const custodian = '0x' + '2'.repeat(40)
    expect(canPerformBondAction('fund', owner, { status: 'DRAFT', owner, custodian })).toBe(true)
    expect(canPerformBondAction('fund', custodian, { status: 'DRAFT', owner, custodian })).toBe(false)
    expect(canPerformBondAction('activate', custodian, { status: 'FUNDED', owner, custodian })).toBe(true)
    expect(canPerformBondAction('activate', owner, { status: 'FUNDED', owner, custodian })).toBe(false)
    expect(canPerformBondAction('settle', owner, { status: 'SETTLED', owner, custodian })).toBe(false)
    expect(canPerformBondAction('settle', null, { status: 'REVIEWED', owner, custodian })).toBe(false)
  })

  it('shows production constants on the audit page', () => {
    expect(routeForPath('/audit')).toBe('audit')
    const view = renderRoute('/audit')
    expect(screen.getByText(CONTRACT_ADDRESS.slice(0, 8) + '…' + CONTRACT_ADDRESS.slice(-6))).toBeInTheDocument()
    expect(screen.getByText(`Studio Dev · chain ${CHAIN_ID}`)).toBeInTheDocument()
    expect(screen.getByText(`Source ${SOURCE_SHA256.slice(0, 12)}…`)).toBeInTheDocument()
    expect(screen.getByText('ConditionBond activity')).toBeInTheDocument()
    view.unmount()
  })

  it('settled-state gating disables lifecycle writes in the canonical bond view', () => {
    const view = renderRoute('/bond')
    expect(screen.getByRole('button', { name: /fund bond/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /activate/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /submit return/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /review return/i })).toBeDisabled()
    view.unmount()
  })
})
