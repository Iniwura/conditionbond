# ConditionBond submission

## Production identity

- Repository: https://github.com/Iniwura/conditionbond
- Network: GenLayer Studio Dev, chain ID `61997`
- Contract: `0x866e35788c8773e04A4A29B1fE490b81ca6B254c`
- Deployment transaction: `0x7ed51eee49ea1dbaebc49c5a7f0428b57f963105cdd25182b5d362e641e5e1db`
- Production source SHA-256: `7d28c3e453cc7fa56a48987dfc92b56fe77ac68409a9e5b52f47d52b565406ad`

## What to verify

ConditionBond freezes BEFORE evidence, criteria, acceptable wear, material damage policy, and bond amount. GenLayer compares the actual BEFORE and AFTER screenshots. It returns one bounded verdict; malformed, unavailable, ambiguous, or disagreeing reviews fail closed to `UNDETERMINED`. Settlement never delegates payout choice to the model: the contract computes integer receipts from the frozen policy.

Canonical production material proof:

```text
CB-LIVE-MATERIAL-01
MATERIAL_DAMAGE
1.00 GEN → 0.25 GEN owner + 0.75 GEN custodian
contract balance after settlement: 0 GEN
```

Canonical production fail-closed proof:

```text
CB-LIVE-UNDETERMINED-01
UNDETERMINED
owner 0 + custodian 0
1.00 GEN retained in the contract
```

## Final polish verification

- Evidence inspection uses full-frame contain rendering with no grayscale, contrast, or hover scaling.
- Criterion rows remain neutral because the deployed contract stores only frozen criteria plus an overall verdict/reasoning result.
- /audit exposes chain-derived controlled proof summaries and verified Studio Explorer transaction/address links; unavailable historical hashes remain explicitly unavailable.
- The production source SHA remains unchanged after this frontend-only pass.

## Verification performed

- Direct Mode: 18 substantive tests passed.
- Frontend regression suite: 15 tests passed, including final-polish regressions for address truncation, UTC conversion, evidence semantics, verdict panels, controlled audit proof, criteria bounds, and settlement fingerprints.
- AST contract lint: passed.
- Deployed schema: retrieved successfully.
- TypeScript and production build: passed.
- Required deep links: root, create, audit, /bonds/:bondId, /bonds/:bondId/review, and /bonds/:bondId/settlement returned HTTP 200 in the local smoke test.

The bundled GenVM semantic/typecheck command remains limited by the missing cached SDK artifact `runners/py-genlayer/5j/ycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng.tar`; the contract was accepted at deployment and its deployed schema/code were verified afterward.

The individual material and most fail-closed lifecycle transaction hashes were not preserved by the original audit runner. They are documented as unavailable in `docs/LIVE_AUDIT_FINAL.md` rather than inferred.
