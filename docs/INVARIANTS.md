# ConditionBond invariants

1. A bond ID is unique and immutable.
2. Owner, custodian, amount, deadline, criteria, acceptable wear, material damage, and damage basis points are frozen at creation.
3. `fund_bond` accepts exactly the frozen amount and only from the owner.
4. Only the custodian activates a funded bond and submits AFTER evidence.
5. Only the owner requests review; review always uses the stored BEFORE and AFTER manifests.
6. Only the four declared verdicts can be stored; failures normalize to `UNDETERMINED`.
7. `UNDETERMINED` never settles and produces zero receipts.
8. For `MATERIAL_DAMAGE`, owner receipt is `amount * damage_bps // 10000`; custodian receives the remainder. For other settled verdicts, owner receipt is zero.
9. The settlement fingerprint commits to both evidence fingerprints, the frozen policy, verdict, and exact receipts.
10. State and receipts are stored before native transfers, so replay attempts cannot pay twice.
