# ConditionBond

ConditionBond is a GenLayer Studio Dev physical-condition escrow product. It freezes BEFORE evidence, return criteria, acceptable-wear policy, material-damage policy, and a funded GEN bond. The custodian submits AFTER evidence; GenLayer returns a bounded overall verdict. Settlement is deterministic; `UNDETERMINED` never settles.

## Production

- Live product: https://conditionbond.vercel.app
- Production commit: `9ec3b4dc9cb5512616d963819a170edaa0e5568d`
- Network: GenLayer Studio Dev, chain ID `61997`
- Contract: `0x866e35788c8773e04A4A29B1fE490b81ca6B254c`
- Production source SHA-256: `7d28c3e453cc7fa56a48987dfc92b56fe77ac68409a9e5b52f47d52b565406ad`

The public landing page introduces the protocol and links into the live app. The app reads the deployed registry and bond records from chain; it does not synthesize production records or aggregate metrics.

## Product routes

- `/` — public landing page with the BEFORE / AFTER evidence comparison, protocol sequence, deterministic outcomes, and controlled Studio Dev proof links.
- `/app` — authoritative bond registry read from `get_bond_ids()` and `get_bond()`.
- `/app/create` — create a bond with user-supplied parties, BEFORE evidence, frozen criteria and policy, amount, and deadline.
- `/app/audit` — production contract identity, controlled proof records, known transaction hashes, and explicit unavailable-history notes.
- `/app/bonds/CB-LIVE-MATERIAL-01` — canonical controlled Studio Dev material-damage bond detail and evidence inspection.
- `/app/bonds/CB-LIVE-MATERIAL-01/settlement` — chain-derived material-damage receipts and settlement state.
- `/app/bonds/CB-LIVE-UNDETERMINED-01` — canonical controlled Studio Dev fail-closed bond detail.
- `/app/bonds/CB-LIVE-UNDETERMINED-01/settlement` — blocked settlement, zero receipts, and retained principal.

The legacy paths `/create`, `/audit`, and `/bonds/:bondId` remain compatible, but the `/app` paths above are the final production routes.

## Run

```bash
npm install
npm run dev
npm test
npm run build
```

The frontend uses `genlayer-js` against Studio Dev and the deployed contract in `src/genlayer.ts`. Wallet actions require an injected EIP-1193 wallet on Studio Dev.

## Contract verification

```bash
/home/ini/consentgate/.venv/bin/pytest -q tests/direct/test_condition_bond.py
/home/ini/consentgate/.venv/bin/genvm-lint lint contracts/condition_bond.py
```

See `docs/LIVE_AUDIT_FINAL.md` for the production contract, deployment transaction, source hash, multimodal probe, and live material-damage / fail-closed evidence. See `docs/THREAT_MODEL.md`, `docs/STATE_MACHINE.md`, `docs/INVARIANTS.md`, `docs/SCHEMA.md`, and `docs/ARCHITECTURE_REVIEW.md` for the protocol review.
