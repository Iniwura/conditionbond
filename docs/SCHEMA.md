# ConditionBond schema

Schema version: `conditionbond.v1`

## Evidence manifest

```json
[{"evidence_id":"item-before","url":"https://…","sha256":""}]
```

Each manifest has 1–4 unique IDs. URLs must be HTTPS, have a host, contain no fragment, and contain no credentials. A digest is optional but, when supplied, must be exactly 64 lowercase hexadecimal characters.

## Criteria and policies

Criteria contain 1–8 entries of `{criterion_id, requirement}` with unique IDs. `acceptable_wear` and `material_damage` are JSON objects. All text and serialized JSON are bounded on-chain.

## Read record

`get_bond` returns the schema version, parties, amount, damage basis points, deadline, both manifests, evidence and policy fingerprints, verdict, bounded reasoning, damage charge, owner/custodian receipts, settlement fingerprint, status, and revision.

## Public writes

`create_bond`, payable `fund_bond`, `activate_bond`, `submit_return`, `review_bond`, `settle_bond`, `expire_bond`, and `refund_expired` are exposed. `get_bond` and `get_bond_ids` are views.
