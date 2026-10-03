# Live production audit

Network: Studio Dev, chain ID `61997`.

Production contract: `0x866e35788c8773e04A4A29B1fE490b81ca6B254c`
Deployment transaction: `0x7ed51eee49ea1dbaebc49c5a7f0428b57f963105cdd25182b5d362e641e5e1db`
Source SHA-256: `7d28c3e453cc7fa56a48987dfc92b56fe77ac68409a9e5b52f47d52b565406ad`

## A — material damage

Bond `CB-LIVE-MATERIAL-01` completed create → exact 1 GEN funding → custodian activation → AFTER submission → GenLayer review → `MATERIAL_DAMAGE` → settlement. The final record contains the frozen image URLs, criteria and policy fingerprint, `damage_bps=2500`, `damage_charge=0.25 GEN`, `owner_receipt=0.25 GEN`, and `custodian_receipt=0.75 GEN`. The contract balance changed from the funded 1 GEN escrow to 0 after settlement. A repeated settlement attempt was rejected by the settled-state guard.

## B — fail closed

Bond `CB-LIVE-UNDETERMINED-01` used the same BEFORE fixture and the ambiguous AFTER fixture. The finalized review stored `verdict=UNDETERMINED`, `status=UNDETERMINED`, zero damage charge, zero owner receipt, and zero custodian receipt. The settlement attempt was rejected and the contract balance remained exactly `1 GEN`.

The production record retained the two evidence fingerprints and the frozen policy fingerprint in both cases. Transaction fees are separate from escrow amounts.
