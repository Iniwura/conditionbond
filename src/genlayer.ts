import { createClient, isSuccessful } from 'genlayer-js'
import { studioDevnet } from 'genlayer-js/chains'
import { TransactionHashVariant, type CalldataEncodable } from 'genlayer-js/types'

export const CONTRACT_ADDRESS = '0x866e35788c8773e04A4A29B1fE490b81ca6B254c' as `0x${string}`
export const CHAIN_ID = 61997
export const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`
export const RPC_URL = 'https://studio-dev.genlayer.com/api'
export const SOURCE_SHA256 = '7d28c3e453cc7fa56a48987dfc92b56fe77ac68409a9e5b52f47d52b565406ad'
export const readClient = createClient({ chain: studioDevnet })
const readOptions = { transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL, jsonSafeReturn: true }
export type Provider = { request(args: { method: string; params?: unknown[] | object }): Promise<unknown>; on?(event: string, listener: (...args: unknown[]) => void): void; removeListener?(event: string, listener: (...args: unknown[]) => void): void; isRabby?: boolean; _isRabby?: boolean; isMetaMask?: boolean }
export type RecordValue = Record<string, any>
export type FeeEstimate = { distribution: Record<string, any>; messageAllocations?: any[]; feeValue: bigint }
export type FinalizedWrite = { hash: string; estimate: FeeEstimate; decided: any; finalized: any }
declare global { interface Window { ethereum?: Provider & { providers?: Provider[] } } }

function selectedProvider(): Provider | null {
  const injected = window.ethereum
  if (!injected) return null
  const providers = Array.isArray(injected.providers) ? injected.providers.filter(Boolean) : [injected]
  return providers.find((item) => item.isRabby || item._isRabby) || providers.find((item) => item.isMetaMask) || providers[0] || null
}
export function getProvider() { return selectedProvider() }
export function sameAddress(a: unknown, b: unknown) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
export function serializeError(value: unknown, seen = new WeakSet<object>(), depth = 0): any {
  if (value === null || value === undefined || typeof value !== 'object') return value
  if (depth > 7 || seen.has(value)) return depth > 7 ? '[MaxDepth]' : '[Circular]'
  seen.add(value); const output: Record<string, any> = {}; const keys = new Set(['name','message','code','shortMessage','details','stack','data','cause',...Object.keys(value),...Object.getOwnPropertyNames(value)])
  for (const key of keys) { try { if (key in value) output[key] = serializeError((value as any)[key], seen, depth + 1) } catch { output[key] = '[Unserializable]' } }
  return output
}
export function errorMessage(value: unknown) { const item = serializeError(value); return typeof item === 'string' ? item : String(item?.shortMessage || item?.message || item?.details || 'Unknown GenLayer error') }
async function walletAccounts(provider: Provider) { const value = await provider.request({ method: 'eth_accounts' }); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }
async function walletChain(provider: Provider) { return String(await provider.request({ method: 'eth_chainId' })).toLowerCase() }
export async function connectWallet(): Promise<{ provider: Provider; address: string; chainId: string }> {
  const provider = getProvider(); if (!provider) throw new Error('No injected EIP-1193 wallet provider was found.')
  await provider.request({ method: 'eth_requestAccounts' })
  if (await walletChain(provider) !== CHAIN_HEX) {
    try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] }) }
    catch (error) {
      const item = serializeError(error); const code = item?.code || item?.data?.originalError?.code
      if (code !== 4902 && code !== '4902') throw error
      await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'GenLayer Studio Devnet', nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 }, rpcUrls: [RPC_URL] }] })
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] })
    }
  }
  const chainId = await walletChain(provider); if (chainId !== CHAIN_HEX) throw new Error(`Studio Dev chain ${CHAIN_ID} is required.`)
  const address = (await walletAccounts(provider))[0]; if (!address) throw new Error('Wallet did not return an account.')
  return { provider, address, chainId }
}
export function watchWallet(onAccounts: (address: string | null) => void, onChain: (chain: string) => void) {
  const provider = getProvider(); if (!provider?.on) return () => undefined
  const accounts = (...args: unknown[]) => onAccounts(Array.isArray(args[0]) && typeof args[0][0] === 'string' ? args[0][0] : null)
  const chain = (...args: unknown[]) => onChain(String(args[0] || '').toLowerCase())
  provider.on('accountsChanged', accounts); provider.on('chainChanged', chain)
  return () => { provider.removeListener?.('accountsChanged', accounts); provider.removeListener?.('chainChanged', chain) }
}
export async function readBond(bondId: string): Promise<RecordValue> { return await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: 'get_bond', args: [bondId], ...readOptions }) as RecordValue }
export async function readBondIds(): Promise<string[]> { const value = await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: 'get_bond_ids', args: [], ...readOptions }); return Array.isArray(value) ? value.map(String) : [] }
export async function readContractBalance() { return BigInt(await readClient.getBalance({ address: CONTRACT_ADDRESS, blockTag: 'latest' })) }
export async function writeAndFinalize(account: string, functionName: string, args: CalldataEncodable[], value = 0n, onSubmitted?: (hash: string) => void): Promise<FinalizedWrite> {
  const provider = getProvider(); if (!provider) throw new Error('No injected EIP-1193 wallet provider was found.')
  if (await walletChain(provider) !== CHAIN_HEX) throw new Error(`Studio Dev chain ${CHAIN_ID} is required before writing.`)
  const client = createClient({ chain: studioDevnet, account: account as `0x${string}`, provider: provider as any }) as any
  const estimate = await client.estimateTransactionFeesForWrite({ address: CONTRACT_ADDRESS, functionName, args, value }) as FeeEstimate
  if (!estimate?.distribution || BigInt(estimate.feeValue) <= 0n) throw new Error('Studio Dev returned an unusable fee estimate; refusing to submit.')
  const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName, args, value, fees: { distribution: estimate.distribution, messageAllocations: estimate.messageAllocations, feeValue: estimate.feeValue } }) as string
  onSubmitted?.(hash)
  const decided = await client.waitForTransactionReceipt({ hash, waitUntil: 'decided', interval: 2000, retries: 180 })
  const finalized = await client.waitForTransactionReceipt({ hash, waitUntil: 'finalized', interval: 2000, retries: 300 })
  if (!isSuccessful(finalized)) throw new Error(`GenLayer execution failed: ${finalized?.txExecutionResultName || finalized?.execution_result || 'unknown'}`)
  return { hash, estimate, decided, finalized }
}
export function formatGen(wei: bigint, decimals = 6) { const negative = wei < 0n; const value = negative ? -wei : wei; const base = 1000000000000000000n; const whole = value / base; const fraction = value % base; const fractionText = fraction.toString().padStart(18, '0').slice(0, decimals).replace(/0+$/, ''); return `${negative ? '-' : ''}${whole.toString()}${fractionText ? `.${fractionText}` : ''} GEN` }
export function short(value: unknown, left = 8, right = 6) { const text = String(value || ''); return text.length > left + right + 1 ? `${text.slice(0,left)}…${text.slice(-right)}` : text || '—' }
