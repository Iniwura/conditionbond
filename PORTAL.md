# ConditionBond reviewer walkthrough

ConditionBond is a physical-condition escrow product on GenLayer Studio Dev. The deployed contract is the source of truth for the registry, evidence manifests, frozen policy, GenLayer verdict, receipts, and settlement state.

## Under two minutes

1. Open the dashboard / and select the canonical CB-LIVE-MATERIAL-01 controlled Studio Dev proof from the authoritative registry.
2. Inspect /bonds/CB-LIVE-MATERIAL-01: the side-by-side BEFORE / AFTER evidence comparison is read from get_bond(), alongside the frozen policy and stored GenLayer verdict.
3. Open /bonds/CB-LIVE-MATERIAL-01/settlement. Confirm the chain-derived 0.25 GEN owner receipt and 0.75 GEN custodian receipt from the 1 GEN material-damage record.
4. Open the fail-closed production record at /bonds/CB-LIVE-UNDETERMINED-01/settlement: UNDETERMINED, zero receipts, and 1 GEN retained.
5. Open /audit to verify the two chain-derived controlled proof cards, production contract address page, source SHA, known transaction hashes, and explicit unavailable-hash notes.

No fixture record is inserted into the dashboard. If a canonical ID is absent from get_bond_ids(), the app shows that it is unavailable rather than synthesizing it.

## Links

- GitHub: https://github.com/Iniwura/conditionbond
- Production contract: 0x866e35788c8773e04A4A29B1fE490b81ca6B254c
- Final live audit: docs/LIVE_AUDIT_FINAL.md
- Submission details: SUBMISSION.md
