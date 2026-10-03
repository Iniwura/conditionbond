# ConditionBond reviewer walkthrough

ConditionBond is a physical-condition escrow product on GenLayer Studio Dev. The deployed contract is the source of truth for the registry, evidence manifests, frozen policy, overall GenLayer verdict, receipts, and settlement state.

Live product: https://conditionbond.vercel.app

## Under two minutes

1. Open the live product at `/`, then choose **Launch app** to reach `/app`, the authoritative bond registry.
2. Open `/app/bonds/CB-LIVE-MATERIAL-01`. Inspect the side-by-side BEFORE / AFTER evidence comparison, the frozen criteria and policy, the stored overall `MATERIAL_DAMAGE` verdict, and the evidence provenance read from `get_bond()`.
3. Open `/app/bonds/CB-LIVE-MATERIAL-01/settlement`. Confirm the chain-derived `0.25 GEN` owner receipt and `0.75 GEN` custodian receipt from the `1 GEN` controlled Studio Dev material-damage proof.
4. Open `/app/bonds/CB-LIVE-UNDETERMINED-01`. Confirm the fail-closed overall `UNDETERMINED` state and open `/app/bonds/CB-LIVE-UNDETERMINED-01/settlement` to see settlement blocked, owner receipt `0`, custodian receipt `0`, and `1 GEN` retained in the contract.
5. Open `/app/audit`. Verify the production contract address, source SHA, known transaction hashes, controlled Studio Dev proof records, and explicit notes for historical hashes that were not preserved.

The model returns the condition verdict; it does not choose payout amounts. The contract applies the frozen deterministic settlement policy. Criteria are shown as frozen policy context; the deployed contract stores the criteria plus an overall verdict and reasoning, not per-criterion PASS/FAIL results.

No fixture record is inserted into the registry. If a canonical ID is absent from `get_bond_ids()`, the app shows that it is unavailable rather than synthesizing it.

## Links

- GitHub: https://github.com/Iniwura/conditionbond
- Production app: https://conditionbond.vercel.app
- Production contract: `0x866e35788c8773e04A4A29B1fE490b81ca6B254c`
- Final live audit: `docs/LIVE_AUDIT_FINAL.md`
- Submission details: `SUBMISSION.md`
