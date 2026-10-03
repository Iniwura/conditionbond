# ConditionBond

ConditionBond is a GenLayer Studio Dev physical-condition escrow product. It freezes BEFORE evidence, return criteria, acceptable-wear policy, material-damage policy, and a funded GEN bond. The custodian submits AFTER evidence; GenLayer validators compare both images and agree on a bounded verdict. Settlement is deterministic; `UNDETERMINED` never settles.

## Product routes

- `/` dashboard and lifecycle overview
- `/create` create and freeze a bond
- `/bonds/:bondId` side-by-side BEFORE / AFTER evidence and controls
- `/bonds/:bondId/review` review criteria and verdict
- `/bonds/:bondId/settlement` deterministic receipt confirmation
- `/audit` evidence provenance and transaction history

## Run

```bash
npm install
npm run dev
npm run build
```

The frontend uses `genlayer-js` against Studio Dev chain `61997` and the deployed contract in `src/genlayer.ts`. Wallet actions require an injected EIP-1193 wallet on Studio Dev.

## Contract verification

```bash
/home/ini/consentgate/.venv/bin/pytest -q tests/direct/test_condition_bond.py
/home/ini/consentgate/.venv/bin/genvm-lint lint contracts/condition_bond.py
```

See `docs/LIVE_AUDIT_FINAL.md` for the production contract, deployment transaction, source hash, multimodal probe, and live material-damage / fail-closed evidence. See `docs/THREAT_MODEL.md`, `docs/STATE_MACHINE.md`, `docs/INVARIANTS.md`, `docs/SCHEMA.md`, and `docs/ARCHITECTURE_REVIEW.md` for the protocol review.
