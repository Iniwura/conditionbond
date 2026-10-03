# ConditionBond state machine

```text
DRAFT --fund_bond(exact amount)--> FUNDED --activate_bond(custodian)--> ACTIVE
ACTIVE --submit_return(custodian)--> RETURN_SUBMITTED --review_bond(owner)--> REVIEWING
REVIEWING --consensus verdict--> REVIEWED (UNCHANGED | ACCEPTABLE_WEAR | MATERIAL_DAMAGE)
REVIEWING --fail closed--> UNDETERMINED
REVIEWED --settle_bond(owner or custodian)--> SETTLED
FUNDED | ACTIVE | RETURN_SUBMITTED --expire_bond(owner)--> EXPIRED --refund_expired(owner)--> REFUNDED
```

`UNDETERMINED` has no settlement edge. It intentionally retains the bond until an explicit product-level recovery process is added. A settled, refunded, or expired bond has no replay path.
