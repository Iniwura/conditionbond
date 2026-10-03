import fs from 'node:fs'
import process from 'node:process'
import { Keystore } from 'ox'
import { createClient, isSuccessful } from 'genlayer-js'
import { studioDevnet } from 'genlayer-js/chains'
import { privateKeyToAccount } from 'viem/accounts'

const CONTRACT = '0x866e35788c8773e04A4A29B1fE490b81ca6B254c'
const OWNER_KEY = process.env.CONDITIONBOND_OWNER_KEY || '/tmp/conditionbond-owner.json'
const CUSTODIAN_KEY = process.env.CONDITIONBOND_CUSTODIAN_KEY || '/tmp/conditionbond-custodian.json'
const PASSWORD = process.env.CONDITIONBOND_KEYSTORE_PASSWORD
if (!PASSWORD) throw new Error('CONDITIONBOND_KEYSTORE_PASSWORD is required via an interactive environment prompt.')
const AMOUNT = 1000000000000000000n
const BEFORE = 'https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/before-intact.svg'
const DAMAGE_AFTER = 'https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/after-material-damage.svg'
const UNDETERMINED_AFTER = 'https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/after-undetermined.svg'
const CRITERIA = JSON.stringify([{ criterion_id: 'identity', requirement: 'The same red ceramic mug is visible.' }, { criterion_id: 'surface', requirement: 'No new crack or break is present.' }])
const ACCEPTABLE = JSON.stringify({ label: 'ACCEPTABLE_WEAR', rule: 'Minor scuffs that do not affect use.' })
const DAMAGE = JSON.stringify({ label: 'MATERIAL_DAMAGE', rule: 'A new crack, break, missing piece, or unusable handle.' })
const manifest = (url, id) => JSON.stringify([{ evidence_id: id, url, sha256: '' }])
function accountFrom(path) { const keystore = JSON.parse(fs.readFileSync(path, 'utf8')); if (!keystore.crypto && keystore.Crypto) keystore.crypto = keystore.Crypto; return privateKeyToAccount(Keystore.decrypt(keystore, Keystore.scrypt({ password: PASSWORD, salt: `0x${keystore.crypto.kdfparams.salt}`, iv: `0x${keystore.crypto.cipherparams.iv}`, n: keystore.crypto.kdfparams.n, r: keystore.crypto.kdfparams.r, p: keystore.crypto.kdfparams.p })[0])) }
const owner = accountFrom(OWNER_KEY)
const custodian = accountFrom(CUSTODIAN_KEY)
const clientFor = (account) => createClient({ chain: studioDevnet, account })
const readClient = createClient({ chain: studioDevnet })
async function balance(address) { return BigInt(await readClient.getBalance({ address, blockTag: 'latest' })) }
async function write(account, functionName, args, value = 0n) {
  const client = clientFor(account)
  const estimate = await client.estimateTransactionFeesForWrite({ address: CONTRACT, functionName, args, value })
  if (!estimate?.distribution || BigInt(estimate.feeValue) <= 0n) throw new Error(`No usable fee estimate for ${functionName}`)
  const hash = await client.writeContract({ address: CONTRACT, functionName, args, value, fees: { distribution: estimate.distribution, messageAllocations: estimate.messageAllocations, feeValue: estimate.feeValue } })
  const decided = await client.waitForTransactionReceipt({ hash, waitUntil: 'decided', interval: 2000, retries: 180 })
  const finalized = await client.waitForTransactionReceipt({ hash, waitUntil: 'finalized', interval: 2000, retries: 300 })
  if (!isSuccessful(finalized)) throw new Error(`${functionName} failed: ${finalized?.txExecutionResultName || finalized?.execution_result || 'unknown'}`)
  return { hash, feeValue: String(estimate.feeValue), consensusStatus: finalized.consensusStatus || finalized.statusName || 'finalized', decided, finalized }
}
async function readBond(id) { return await readClient.readContract({ address: CONTRACT, functionName: 'get_bond', args: [id], transactionHashVariant: 'latest-nonfinal', jsonSafeReturn: true }) }
async function audit(kind) {
  const id = kind === 'material' ? 'CB-LIVE-MATERIAL-01' : 'CB-LIVE-UNDETERMINED-01'
  const after = kind === 'material' ? DAMAGE_AFTER : UNDETERMINED_AFTER
  const transactions = {}
  const beforeBalance = await balance(CONTRACT)
  transactions.create = await write(owner, 'create_bond', [id, custodian.address, AMOUNT, manifest(BEFORE, 'item-before'), CRITERIA, ACCEPTABLE, DAMAGE, 2500n, '2099-01-01T00:00:00Z'])
  transactions.fund = await write(owner, 'fund_bond', [id], AMOUNT)
  transactions.activate = await write(custodian, 'activate_bond', [id])
  transactions.submitReturn = await write(custodian, 'submit_return', [id, manifest(after, 'item-after')])
  transactions.review = await write(owner, 'review_bond', [id])
  const reviewed = await readBond(id)
  const report = { kind, id, owner: owner.address, custodian: custodian.address, contract: CONTRACT, beforeBalance: String(beforeBalance), transactions, reviewed }
  if (kind === 'material') {
    const preSettleBalance = await balance(CONTRACT)
    transactions.settle = await write(owner, 'settle_bond', [id])
    const settled = await readBond(id)
    const afterBalance = await balance(CONTRACT)
    let duplicateError = ''
    try { await write(owner, 'settle_bond', [id]) } catch (error) { duplicateError = String(error?.shortMessage || error?.message || error) }
    report.preSettleBalance = String(preSettleBalance); report.afterBalance = String(afterBalance); report.settled = settled; report.duplicateSettlementRejected = duplicateError.length > 0; report.duplicateSettlementError = duplicateError.slice(0, 300)
  } else {
    let settlementError = ''
    try { await write(owner, 'settle_bond', [id]) } catch (error) { settlementError = String(error?.shortMessage || error?.message || error) }
    report.afterUndeterminedBalance = String(await balance(CONTRACT)); report.settlementRejected = settlementError.length > 0; report.settlementError = settlementError.slice(0, 300); report.final = await readBond(id)
  }
  console.log(JSON.stringify(report, (_, value) => typeof value === 'bigint' ? value.toString() : value))
}
await audit(process.argv[2] || 'material')
