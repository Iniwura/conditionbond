# ConditionBond threat model

## Assets

- The funded GEN bond and deterministic receipts.
- Frozen BEFORE evidence, criteria, acceptable-wear policy, material-damage policy, and their fingerprints.
- The identity of the owner and custodian.
- The audit trail linking evidence, GenLayer consensus, and settlement.

## Adversaries and controls

| Threat | Control |
| --- | --- |
| Owner changes the rules after funding | Policy fields and `policy_fingerprint` are written at creation and never have mutators. |
| Custodian swaps the asset or return evidence | Custodian can only submit AFTER evidence in `ACTIVE`; owner review is required. Both manifests are HTTPS-only, bounded, schema-checked, and fingerprinted. |
| Model hallucination or malformed output | The prompt requires a bounded enum; invalid output, render failure, disagreement, or unavailable evidence becomes `UNDETERMINED`. |
| A validator chooses a payout | Validators produce only a semantic verdict. Settlement computes the amount locally from frozen `amount` and `damage_bps`. |
| Unauthorized lifecycle transition | Every write checks the caller and exact state. |
| Double settlement or replay | State is set to `SETTLED` before transfers; a second settlement fails. |
| Unbounded input / denial of service | Bond IDs, URLs, manifests, criteria, policies, reasoning, and bond count are bounded. |
| Ambiguous or wrong item | The multimodal prompt explicitly requires `UNDETERMINED`; the live ambiguous fixture proved funds remain locked. |

Out of scope for this proof-of-concept: external pinning availability, wallet malware, compromised validator infrastructure, and legal enforceability of a physical inspection.
