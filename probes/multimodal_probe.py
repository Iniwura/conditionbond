# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import json
from typing import Any
import genlayer as gl

VERDICTS = {"UNCHANGED", "ACCEPTABLE_WEAR", "MATERIAL_DAMAGE", "UNDETERMINED"}

def _decision(value: Any) -> dict[str, str]:
    if type(value) is not dict or type(value.get("verdict")) is not str or value.get("verdict") not in VERDICTS:
        return {"verdict": "UNDETERMINED", "reasoning": "Invalid model output."}
    reasoning = value.get("reasoning", "")
    if type(reasoning) is not str: reasoning = "Invalid model reasoning."
    return {"verdict": value["verdict"], "reasoning": reasoning[:600]}

def _prompt() -> str:
    return ("Compare image 1 BEFORE with image 2 AFTER. Use only visible pixels. Verify that the same physical object is shown. "
            "Return JSON with exactly verdict and reasoning. verdict must be UNCHANGED, ACCEPTABLE_WEAR, MATERIAL_DAMAGE, or UNDETERMINED. "
            "Use MATERIAL_DAMAGE only for a clear new crack, break, missing piece, or structural defect. Use UNDETERMINED for a wrong asset, ambiguous fixture, or insufficient comparison.")

class MultimodalProbe(gl.contract.Contract):
    last_result_json: str
    def __init__(self): self.last_result_json = "{}"
    @gl.public.write
    def compare(self, before_url: str, after_url: str) -> dict[str, str]:
        def leader() -> dict[str, str]:
            try:
                before = gl.nondet.web.render(before_url, mode="screenshot")
                after = gl.nondet.web.render(after_url, mode="screenshot")
                return _decision(gl.nondet.exec_prompt(_prompt(), response_format="json", images=[before, after]))
            except Exception:
                return {"verdict": "UNDETERMINED", "reasoning": "Image render or model call failed."}
        def validator(result: gl.vm.Result) -> bool:
            if not isinstance(result, gl.vm.Return): return False
            candidate = _decision(result.calldata)
            try:
                before = gl.nondet.web.render(before_url, mode="screenshot")
                after = gl.nondet.web.render(after_url, mode="screenshot")
                observed = _decision(gl.nondet.exec_prompt(_prompt(), response_format="json", images=[before, after]))
            except Exception:
                observed = {"verdict": "UNDETERMINED", "reasoning": "Image render or model call failed."}
            return observed["verdict"] == candidate["verdict"]
        try:
            result = gl.vm.run_nondet(leader, validator)
        except Exception:
            result = {"verdict": "UNDETERMINED", "reasoning": "Validator consensus was unavailable."}
        result = _decision(result)
        self.last_result_json = json.dumps(result, sort_keys=True, separators=(",", ":"))
        return result
    @gl.public.view
    def get_last_result(self) -> dict[str, str]:
        return json.loads(self.last_result_json)
