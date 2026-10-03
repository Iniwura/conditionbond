# ConditionBond reviewer walkthrough

ConditionBond is a physical-condition escrow product on GenLayer Studio Dev. The policy, evidence references, validator verdict, and deterministic settlement are inspectable in one flow.

## Under two minutes

1. Open the app at `/bond`. Inspect the side-by-side BEFORE / AFTER evidence comparison and the frozen policy panel.
2. Open `/review`. The verdict surface shows criterion-by-criterion review and validator consensus.
3. Open `/settlement`. Confirm the deterministic material-damage split: `0.25 GEN` to the owner and `0.75 GEN` to the custodian from a `1 GEN` bond.
4. Open `/audit`. Verify the production Studio Dev contract, chain `61997`, source prefix, evidence events, and audit trail.
5. The fail-closed production case is `CB-LIVE-UNDETERMINED-01`: `UNDETERMINED`, zero receipts, and `1 GEN` retained.

## Links

- GitHub: https://github.com/Iniwura/conditionbond
- Production contract: `0x866e35788c8773e04A4A29B1fE490b81ca6B254c`
- Final live audit: [`docs/LIVE_AUDIT_FINAL.md`](docs/LIVE_AUDIT_FINAL.md)
- Submission details: [`SUBMISSION.md`](SUBMISSION.md)
