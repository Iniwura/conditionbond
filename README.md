# ConditionBond

ConditionBond is a polished GenLayer proof-of-concept for physical-condition escrow. It turns the return inspection into a shared, inspectable record: intake evidence, return evidence, frozen criteria, validator verdict and settlement.

## Run the interface

```bash
npm install
npm run dev
```

The app is a Vite + React single-page prototype with these flows:

- `/` overview and recent bonds
- `/create` create bond wizard
- `/bond` before/after evidence and bond detail
- `/review` return review flow
- `/settlement` settlement confirmation
- `/audit` evidence and transaction audit stream

The interface uses local demo data for the visual proof-of-concept. `contracts/condition_bond.py` contains the corresponding GenLayer contract boundary: funds are received through a payable write, policy/evidence references are frozen as data, and only a strict-equality validator verdict can release the secured GEN.

## Contract notes

The contract intentionally follows the current GenLayer transfer pattern (`@gl.evm.contract_interface` + `emit_transfer`), uses `gl.eq_principle.strict_eq` for the money-moving verdict, uses `gl.vm.UserError` for user-facing failures, and normalizes addresses before party checks.

Before a testnet deployment, wire the app’s write/read adapter to `genlayer-js`, set the deployed contract address in an environment file, and pass `transactionHashVariant: 'latest-nonfinal'` for post-write reads so the UI does not appear stale while the transaction finalizes.
