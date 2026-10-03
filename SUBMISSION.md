# ConditionBond submission

## Production identity

- Live product: https://conditionbond.vercel.app
- Production commit: `9ec3b4dc9cb5512616d963819a170edaa0e5568d`
- Repository: https://github.com/Iniwura/conditionbond
- Network: GenLayer Studio Dev, chain ID `61997`
- Contract: `0x866e35788c8773e04A4A29B1fE490b81ca6B254c`
- Deployment transaction: `0x7ed51eee49ea1dbaebc49c5a7f0428b57f963105cdd25182b5d362e641e5e1db`
- Production source SHA-256: `7d28c3e453cc7fa56a48987dfc92b56fe77ac68409a9e5b52f47d52b565406ad`

## Final production routes

- `/` — public landing page and controlled Studio Dev proof entry point.
- `/app` — authoritative bond registry.
- `/app/create` — bond creation flow.
- `/app/audit` — live audit and production identity.
- `/app/bonds/CB-LIVE-MATERIAL-01` — canonical controlled Studio Dev material-damage bond.
- `/app/bonds/CB-LIVE-MATERIAL-01/settlement` — material-damage settlement receipts.
- `/app/bonds/CB-LIVE-UNDETERMINED-01` — canonical controlled Studio Dev fail-closed bond.
- `/app/bonds/CB-LIVE-UNDETERMINED-01/settlement` — blocked settlement and retained principal.

The legacy `/create`, `/audit`, and `/bonds/:bondId` paths remain compatible for existing links.

## What to verify

ConditionBond freezes BEFORE evidence, criteria, acceptable wear, material damage policy, bond amount, and deadline. The custodian submits the actual AFTER evidence. GenLayer compares the evidence and returns one bounded overall verdict; malformed, unavailable, ambiguous, or disagreeing reviews fail closed to `UNDETERMINED`. Settlement never delegates payout choice to the model: the contract computes integer receipts from the frozen policy.

Canonical controlled Studio Dev material proof:

```text
CB-LIVE-MATERIAL-01
MATERIAL_DAMAGE
1.00 GEN → 0.25 GEN owner + 0.75 GEN custodian
contract balance after settlement: 0 GEN
```

Canonical controlled Studio Dev fail-closed proof:

```text
CB-LIVE-UNDETERMINED-01
UNDETERMINED
owner 0 + custodian 0
1.00 GEN retained in the contract
```

## Final polish verification

- Evidence inspection uses full-frame contain rendering with no grayscale, contrast, or hover scaling.
- Criteria remain neutral policy context. The deployed contract stores frozen criteria plus an overall verdict and reasoning; it does not store per-criterion PASS/FAIL results.
- `/app/audit` exposes chain-derived controlled proof summaries and verified Studio Explorer transaction/address links; unavailable historical hashes remain explicitly unavailable.
- The production source SHA remains unchanged after the frontend-only pass.

## Verification performed

- Direct Mode: 18 substantive tests passed.
- Frontend regression suite: 15 tests passed, including final-polish regressions for address truncation, UTC conversion, evidence semantics, verdict panels, controlled audit proof, criteria bounds, and settlement fingerprints.
- AST contract lint: passed.
- Deployed schema: retrieved successfully.
- TypeScript and production build: passed.
- Final frontend browser smoke checks covered `/`, `/app`, `/app/create`, `/app/audit`, `/app/bonds/CB-LIVE-MATERIAL-01`, and the controlled proof links; legacy paths remain covered by the regression suite.

The bundled GenVM semantic/typecheck command remains limited by the missing cached SDK artifact `runners/py-genlayer/5j/ycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng.tar`; the contract was accepted at deployment and its deployed schema/code were verified afterward.

The individual material and most fail-closed lifecycle transaction hashes were not preserved by the original audit runner. They are documented as unavailable in `docs/LIVE_AUDIT_FINAL.md` rather than inferred.
