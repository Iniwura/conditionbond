# Architecture review

The deployed design separates semantic inspection from money movement. `review_bond` invokes GenLayer multimodal nondeterminism twice: a leader renders both image URLs as screenshots and calls `gl.nondet.exec_prompt(..., images=[before, after], response_format="json")`; each validator repeats the same image fetch and accepts only an equal verdict. The contract never accepts a model-provided payout.

The money path is deterministic: `settle_bond` calculates the charge from stored integer values, writes `SETTLED` and the receipts, then emits native transfers. A validator disagreement, malformed response, render error, wrong asset, or unavailable image reaches `UNDETERMINED` and cannot settle.

The frontend uses the official `genlayer-js` client, Studio Dev chain 61997, wallet chain switching, fee estimation, and decided/finalized waits. It reads `latest-nonfinal` records after writes so the UI can show current lifecycle state while finality completes.
