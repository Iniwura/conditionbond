# ConditionBond final live audit

This document records only the evidence available from the preserved Studio Dev audit runs. Missing historical transaction hashes are marked explicitly; none are reconstructed or guessed.

## Production deployment

- Network: Studio Dev, chain ID `61997`
- Contract: `0x866e35788c8773e04A4A29B1fE490b81ca6B254c`
- Deployment transaction: `0x7ed51eee49ea1dbaebc49c5a7f0428b57f963105cdd25182b5d362e641e5e1db`
- Deployed source SHA-256: `7d28c3e453cc7fa56a48987dfc92b56fe77ac68409a9e5b52f47d52b565406ad`

## A — canonical MATERIAL_DAMAGE bond

Bond: `CB-LIVE-MATERIAL-01`

The preserved live runner completed create → fund → activate → submit return → GenLayer review → settlement. The final production record was read directly from the contract and contained:

- verdict/status: `MATERIAL_DAMAGE` / `SETTLED`
- amount: `1 GEN`
- frozen damage policy: `2500 bps`
- deterministic damage charge: `0.25 GEN`
- owner receipt: `0.25 GEN`
- custodian receipt: `0.75 GEN`
- before/after evidence: the immutable intact and material-damage fixture URLs from commit `edd41a3`
- settlement fingerprint: `3d7b19a5b44a69e530d8a6ce61eabeea53508552d45ae55ba2b7568559e4e47b`
- final contract balance: `0 GEN`

Authoritative balance snapshots available from the run establish the escrow movement:

```text
funded escrow:       1.00 GEN
owner receipt:       0.25 GEN
custodian receipt:   0.75 GEN
final contract:      0.00 GEN
```

The preserved runner also attempted a second `settle_bond` after settlement. Studio Dev rejected the replay during fee/transaction estimation with `execution failed`; no second payout was recorded. The replay attempt’s transaction hash was not preserved by the runner.

The individual material create, funding, activation, AFTER submission, review, settlement, and replay-attempt hashes were not preserved in the original runner output. They are intentionally not invented here. The final on-chain record, exact receipts, settlement fingerprint, and zero contract balance remain independently readable from the production contract.

## B — fail-closed UNDETERMINED bond

Bond: `CB-LIVE-UNDETERMINED-01`

The preserved run used the intact BEFORE fixture and ambiguous AFTER fixture. The following create transaction hash is available:

- create: `0xc86c67e9ec5ceee5b04c65b12866cd6386e19c770cf815fe18d332a992aaa098`

The final production record, read directly from the contract, contained:

- verdict/status: `UNDETERMINED` / `UNDETERMINED`
- amount: `1 GEN`
- damage charge: `0`
- owner receipt: `0`
- custodian receipt: `0`
- settlement fingerprint: empty
- final contract balance: `1 GEN`
- settlement attempt: rejected with `execution failed`

The funding, activation, AFTER submission, review, and settlement-attempt hashes were not preserved in the original runner output. No payout or release occurred.

```text
UNDETERMINED → owner 0 + custodian 0
locked escrow  → 1.00 GEN retained in contract
```

## Multimodal probe provenance

Disposable probe contract: `0x3574235B94ad584b255f7fc146A1377aEa469671`

- deployment: `0xefdb25088fd60a5d28214cc1b54c6d340c95304c94823fd58e62b7c047deb1c7`
- material-damage comparison: `0x70dea717e252b84c6879cb5c7135cdaf24b949851553bf4e683e1255900ee730` → accepted `MATERIAL_DAMAGE`
- ambiguous comparison: `0xc0464794e0589b10689831d9b126cb7f1bdbe4779be7f09964cec345be28d85e` → accepted `UNDETERMINED`

Both cases used screenshot rendering for BEFORE and AFTER and passed both image objects into the GenLayer multimodal prompt.

## Read-only final checks

- Production schema retrieved successfully from `0x866e…6B254c`.
- Production code endpoint returned the deployed source.
- No production contract code, state, or deployment was changed during hardening.
