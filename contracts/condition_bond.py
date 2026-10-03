# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""ConditionBond: physical-condition escrow with multimodal GenLayer review."""
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit
import genlayer as gl
from genlayer.types import Address, u256

SCHEMA_VERSION = "conditionbond.v1"
DRAFT="DRAFT"; FUNDED="FUNDED"; ACTIVE="ACTIVE"; RETURN_SUBMITTED="RETURN_SUBMITTED"; REVIEWING="REVIEWING"; REVIEWED="REVIEWED"; SETTLED="SETTLED"; UNDETERMINED="UNDETERMINED"; EXPIRED="EXPIRED"; REFUNDED="REFUNDED"
UNCHANGED="UNCHANGED"; ACCEPTABLE_WEAR="ACCEPTABLE_WEAR"; MATERIAL_DAMAGE="MATERIAL_DAMAGE"
VERDICTS={UNCHANGED, ACCEPTABLE_WEAR, MATERIAL_DAMAGE, UNDETERMINED}
MAX_BOND_ID=64; MAX_URL=2048; MAX_POLICY=6000; MAX_CRITERIA=8; MAX_CRITERION=700; MAX_EVIDENCE=4; MAX_REASONING=1200; MAX_DEADLINE=32; MAX_BONDS=128

@gl.evm.contract_interface
class _Recipient:
    class View: pass
    class Write: pass

@gl.storage.allow
@dataclass
class BondRecord:
    bond_id: str; owner: Address; custodian: Address; amount: u256; damage_bps: u256; deadline_utc: str
    before_manifest_json: str; criteria_json: str; acceptable_wear_json: str; material_damage_json: str
    policy_fingerprint: str; before_fingerprint: str; after_manifest_json: str; after_fingerprint: str
    verdict: str; reasoning: str; damage_charge: u256; owner_receipt: u256; custodian_receipt: u256
    settlement_fingerprint: str; status: str; revision: u256

def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def _digest(label: str, value: Any) -> str:
    return hashlib.sha256(_canonical([label, value]).encode("utf-8")).hexdigest()

def _error(message: str) -> None:
    raise gl.vm.UserError(message)

def _text(value: Any, field: str, maximum: int) -> str:
    if type(value) is not str or not value.strip(): _error(field + " must not be empty.")
    value=value.strip()
    if len(value)>maximum: _error(field + " is too long.")
    if any(ord(char)<32 and char not in "\n\t" for char in value): _error(field + " contains a control character.")
    return value

def _bond_id(value: Any) -> str:
    value=_text(value,"bond_id",MAX_BOND_ID)
    if any(not (char.isalnum() or char in "._-") for char in value): _error("bond_id contains an invalid character.")
    return value

def _address(value: Any) -> Address:
    try: return value if isinstance(value,Address) else Address(value)
    except Exception: _error("invalid address."); return Address(b"\x00"*Address.SIZE)

def _address_key(value: Any) -> str: return _address(value).as_hex.lower()

def _url(value: Any) -> str:
    value=_text(value,"url",MAX_URL)
    try: parsed=urlsplit(value)
    except ValueError: _error("url is invalid.")
    if parsed.scheme.lower()!="https" or not parsed.netloc or parsed.fragment: _error("evidence URL must be HTTPS without a fragment.")
    if parsed.username is not None or parsed.password is not None: _error("evidence URL must not contain credentials.")
    return value

def _sha256(value: Any) -> str:
    if value is None or value=="": return ""
    value=_text(value,"sha256",64).lower()
    if len(value)!=64 or any(char not in "0123456789abcdef" for char in value): _error("sha256 must be a 64-character hexadecimal digest.")
    return value

def _stored_json(value: str, field: str) -> Any:
    try: return json.loads(value)
    except Exception: _error("stored "+field+" is invalid."); return None

def _json_object(value: Any, field: str, maximum: int) -> dict[str,Any]:
    parsed=_stored_json(_text(value,field,maximum),field)
    if type(parsed) is not dict: _error(field+" must be a JSON object.")
    return parsed

def _manifest(value: Any, field: str) -> list[dict[str,str]]:
    if type(value) is not list or not 1<=len(value)<=MAX_EVIDENCE: _error(field+" must contain 1 to 4 evidence items.")
    result=[]; seen=[]
    for item in value:
        if type(item) is not dict or set(item.keys())!={"evidence_id","url","sha256"}: _error(field+" has an invalid evidence schema.")
        evidence_id=_text(item["evidence_id"],"evidence_id",64)
        if evidence_id in seen: _error(field+" contains duplicate evidence IDs.")
        seen.append(evidence_id); result.append({"evidence_id":evidence_id,"url":_url(item["url"]),"sha256":_sha256(item["sha256"])})
    return result

def _criteria(value: Any) -> list[dict[str,str]]:
    if type(value) is not list or not 1<=len(value)<=MAX_CRITERIA: _error("criteria must contain 1 to 8 entries.")
    result=[]; seen=[]
    for item in value:
        if type(item) is not dict or set(item.keys())!={"criterion_id","requirement"}: _error("criteria has an invalid schema.")
        criterion_id=_text(item["criterion_id"],"criterion_id",64); requirement=_text(item["requirement"],"criterion requirement",MAX_CRITERION)
        if criterion_id in seen: _error("criteria IDs must be unique.")
        seen.append(criterion_id); result.append({"criterion_id":criterion_id,"requirement":requirement})
    return result

def _deadline(value: Any) -> str:
    value=_text(value,"deadline_utc",MAX_DEADLINE)
    try: datetime.strptime(value,"%Y-%m-%dT%H:%M:%SZ")
    except ValueError: _error("deadline_utc must use YYYY-MM-DDTHH:MM:SSZ.")
    return value

def _decision(value: Any) -> dict[str,str]:
    if type(value) is not dict: return {"verdict":UNDETERMINED,"reasoning":"Model output was not an object."}
    verdict=value.get("verdict"); reasoning=value.get("reasoning","")
    if type(verdict) is not str or verdict not in VERDICTS: return {"verdict":UNDETERMINED,"reasoning":"Model output had an invalid verdict."}
    if type(reasoning) is not str: return {"verdict":UNDETERMINED,"reasoning":"Model reasoning was invalid."}
    return {"verdict":verdict,"reasoning":reasoning[:MAX_REASONING]}

def _prompt(criteria: list[dict[str,str]], acceptable: Any, damage: Any) -> str:
    return ("You are the ConditionBond physical inspection adjudicator. Compare image 1 (BEFORE) with image 2 (AFTER) for the same item. Do not use filenames, alt text, URLs, or hidden metadata as evidence. Check every frozen criterion. Return JSON with exactly verdict and reasoning. verdict must be one of: UNCHANGED, ACCEPTABLE_WEAR, MATERIAL_DAMAGE, UNDETERMINED. Use UNDETERMINED if the images are missing, ambiguous, show different assets, or you cannot confidently compare them. Frozen criteria: "+_canonical(criteria)+". Frozen acceptable wear: "+_canonical(acceptable)+". Frozen material damage: "+_canonical(damage)+".")

class ConditionBond(gl.contract.Contract):
    # class body marker
    bonds: gl.storage.TreeMap[str,BondRecord]
    bond_ids_json: str
    def __init__(self): self.bond_ids_json = "[]"
    def _bond(self,bond_id: str)->BondRecord:
        record=self.bonds.get(_bond_id(bond_id),None)
        if record is None: _error("bond does not exist.")
        return record
    def _only_party(self,bond: BondRecord)->None:
        if _address_key(gl.message.sender_address) not in {_address_key(bond.owner),_address_key(bond.custodian)}: _error("caller is not a bond party.")
    def _only_owner(self,bond: BondRecord)->None:
        if _address_key(gl.message.sender_address)!=_address_key(bond.owner): _error("only the owner may perform this action.")
    def _manifest_for(self,bond: BondRecord,before: bool)->list[dict[str,str]]:
        raw=bond.before_manifest_json if before else bond.after_manifest_json
        return _manifest(_stored_json(raw,"evidence manifest"),"evidence manifest")
    def _emit_native_transfer(self,recipient: Address,amount: int)->None:
        if amount>0: _Recipient(recipient).emit_transfer(value=amount)

    @gl.public.write
    def create_bond(self,bond_id: str,custodian: str,amount: u256,before_manifest_json: str,criteria_json: str,acceptable_wear_json: str,material_damage_json: str,damage_bps: u256,deadline_utc: str)->str:
        bond_id=_bond_id(bond_id)
        if self.bonds.get(bond_id,None) is not None: _error("bond ID already exists.")
        owner=_address(gl.message.sender_address); custodian_address=_address(custodian)
        if _address_key(owner)==_address_key(custodian_address): _error("owner and custodian must be different.")
        if not 1<=int(amount)<=10**24: _error("bond amount is out of bounds.")
        if not 1<=int(damage_bps)<=10000: _error("damage_bps must be between 1 and 10000.")
        before=_manifest(_stored_json(before_manifest_json,"before_manifest_json"),"before manifest")
        criteria=_criteria(_stored_json(criteria_json,"criteria_json")); acceptable=_json_object(acceptable_wear_json,"acceptable_wear_json",MAX_POLICY); damage=_json_object(material_damage_json,"material_damage_json",MAX_POLICY); deadline=_deadline(deadline_utc)
        bond_ids = _stored_json(self.bond_ids_json, "bond IDs")
        if type(bond_ids) is not list or len(bond_ids)>=MAX_BONDS: _error("bond limit reached.")
        before_json=_canonical(before); criteria_json=_canonical(criteria); acceptable_json=_canonical(acceptable); damage_json=_canonical(damage)
        policy_fingerprint=_digest("CONDITIONBOND-POLICY-V1",[SCHEMA_VERSION,bond_id,_address_key(owner),_address_key(custodian_address),int(amount),int(damage_bps),deadline,criteria,acceptable,damage])
        before_fingerprint=_digest("CONDITIONBOND-BEFORE-V1",before)
        self.bonds[bond_id]=BondRecord(bond_id,owner,custodian_address,amount,damage_bps,deadline,before_json,criteria_json,acceptable_json,damage_json,policy_fingerprint,before_fingerprint,"","","","",0,0,0,"",DRAFT,1)
        bond_ids.append(bond_id); self.bond_ids_json = _canonical(bond_ids); return policy_fingerprint

    @gl.public.write.payable
    def fund_bond(self,bond_id: str)->str:
        bond=self._bond(bond_id); self._only_owner(bond)
        if bond.status!=DRAFT: _error("bond is not awaiting funding.")
        if int(gl.message.value)!=int(bond.amount): _error("funding must equal the frozen bond amount.")
        bond.status=FUNDED; self.bonds[bond.bond_id]=bond
        return _digest("CONDITIONBOND-FUNDING-V1",[bond.bond_id,bond.policy_fingerprint,int(bond.amount)])

    @gl.public.write
    def activate_bond(self,bond_id: str)->str:
        bond=self._bond(bond_id)
        if bond.status!=FUNDED: _error("bond is not funded.")
        if _address_key(gl.message.sender_address)!=_address_key(bond.custodian): _error("only the custodian may activate the bond.")
        bond.status=ACTIVE; self.bonds[bond.bond_id]=bond
        return _digest("CONDITIONBOND-ACTIVATION-V1",[bond.bond_id,bond.policy_fingerprint])

    @gl.public.write
    def submit_return(self,bond_id: str,after_manifest_json: str)->str:
        bond=self._bond(bond_id)
        if bond.status!=ACTIVE: _error("bond is not active.")
        if _address_key(gl.message.sender_address)!=_address_key(bond.custodian): _error("only the custodian may submit return evidence.")
        after=_manifest(_stored_json(after_manifest_json,"after_manifest_json"),"after manifest")
        bond.after_manifest_json=_canonical(after); bond.after_fingerprint=_digest("CONDITIONBOND-AFTER-V1",after); bond.status=RETURN_SUBMITTED; bond.revision=int(bond.revision)+1; self.bonds[bond.bond_id]=bond; return bond.after_fingerprint

    def _review_images(self,bond: BondRecord)->dict[str,str]:
        before=self._manifest_for(bond,True); after=self._manifest_for(bond,False)
        if not before or not after: return {"verdict":UNDETERMINED,"reasoning":"Evidence manifest is incomplete."}
        before_url=before[0]["url"]; after_url=after[0]["url"]
        prompt=_prompt(_stored_json(bond.criteria_json,"criteria"),_stored_json(bond.acceptable_wear_json,"acceptable wear"),_stored_json(bond.material_damage_json,"material damage"))
        def leader()->dict[str,str]:
            try:
                before_image=gl.nondet.web.render(before_url,mode="screenshot"); after_image=gl.nondet.web.render(after_url,mode="screenshot")
                return _decision(gl.nondet.exec_prompt(prompt,response_format="json",images=[before_image,after_image]))
            except Exception: return {"verdict":UNDETERMINED,"reasoning":"Evidence could not be rendered or reviewed."}
        def validator(leader_result: gl.vm.Result)->bool:
            if not isinstance(leader_result,gl.vm.Return): return False
            candidate=_decision(leader_result.calldata)
            try:
                before_image=gl.nondet.web.render(before_url,mode="screenshot"); after_image=gl.nondet.web.render(after_url,mode="screenshot")
                observed=_decision(gl.nondet.exec_prompt(prompt,response_format="json",images=[before_image,after_image]))
            except Exception: observed={"verdict":UNDETERMINED,"reasoning":"Evidence could not be rendered or reviewed."}
            return observed["verdict"]==candidate["verdict"]
        try:
            return gl.vm.run_nondet(leader,validator)
        except Exception:
            return {"verdict":UNDETERMINED,"reasoning":"Validator consensus was unavailable."}

    @gl.public.write
    def review_bond(self,bond_id: str)->str:
        bond=self._bond(bond_id); self._only_owner(bond)
        if bond.status!=RETURN_SUBMITTED: _error("bond is not ready for review.")
        bond.status=REVIEWING; result=self._review_images(bond); bond.verdict=result["verdict"]; bond.reasoning=result["reasoning"][:MAX_REASONING]; bond.status=UNDETERMINED if bond.verdict==UNDETERMINED else REVIEWED; bond.revision=int(bond.revision)+1; self.bonds[bond.bond_id]=bond; return bond.verdict

    @gl.public.write
    def settle_bond(self,bond_id: str)->str:
        bond=self._bond(bond_id); self._only_party(bond)
        if bond.status!=REVIEWED: _error("only a reviewed bond can settle.")
        if bond.verdict==UNDETERMINED: _error("UNDETERMINED bonds never settle.")
        amount=int(bond.amount); damage_charge=amount*int(bond.damage_bps)//10000 if bond.verdict==MATERIAL_DAMAGE else 0; custodian_receipt=amount-damage_charge
        settlement_fingerprint=_digest("CONDITIONBOND-SETTLEMENT-V1",[bond.bond_id,bond.policy_fingerprint,bond.before_fingerprint,bond.after_fingerprint,bond.verdict,damage_charge,custodian_receipt])
        bond.damage_charge=damage_charge; bond.owner_receipt=damage_charge; bond.custodian_receipt=custodian_receipt; bond.settlement_fingerprint=settlement_fingerprint; bond.status=SETTLED; bond.revision=int(bond.revision)+1; self.bonds[bond.bond_id]=bond
        self._emit_native_transfer(bond.owner,damage_charge); self._emit_native_transfer(bond.custodian,custodian_receipt); return settlement_fingerprint

    @gl.public.write
    def expire_bond(self,bond_id: str)->str:
        bond=self._bond(bond_id); self._only_owner(bond)
        if bond.status not in {FUNDED,ACTIVE,RETURN_SUBMITTED}: _error("bond cannot expire in its current state.")
        bond.status=EXPIRED; self.bonds[bond.bond_id]=bond; return _digest("CONDITIONBOND-EXPIRY-V1",[bond.bond_id,bond.policy_fingerprint])

    @gl.public.write
    def refund_expired(self,bond_id: str)->int:
        bond=self._bond(bond_id); self._only_owner(bond)
        if bond.status!=EXPIRED: _error("only expired bonds can be refunded.")
        amount=int(bond.amount); bond.status=REFUNDED; bond.owner_receipt=amount; bond.settlement_fingerprint=_digest("CONDITIONBOND-REFUND-V1",[bond.bond_id,amount]); self.bonds[bond.bond_id]=bond; self._emit_native_transfer(bond.owner,amount); return amount

    @gl.public.view
    def get_bond(self,bond_id: str)->dict[str,Any]:
        bond=self._bond(bond_id)
        return {"schema_version":SCHEMA_VERSION,"bond_id":bond.bond_id,"owner":_address_key(bond.owner),"custodian":_address_key(bond.custodian),"amount":int(bond.amount),"damage_bps":int(bond.damage_bps),"deadline_utc":bond.deadline_utc,"before_manifest":_stored_json(bond.before_manifest_json,"before manifest"),"criteria":_stored_json(bond.criteria_json,"criteria"),"acceptable_wear":_stored_json(bond.acceptable_wear_json,"acceptable wear"),"material_damage":_stored_json(bond.material_damage_json,"material damage"),"policy_fingerprint":bond.policy_fingerprint,"before_fingerprint":bond.before_fingerprint,"after_manifest":_stored_json(bond.after_manifest_json,"after manifest") if bond.after_manifest_json else [],"after_fingerprint":bond.after_fingerprint,"verdict":bond.verdict,"reasoning":bond.reasoning,"damage_charge":int(bond.damage_charge),"owner_receipt":int(bond.owner_receipt),"custodian_receipt":int(bond.custodian_receipt),"settlement_fingerprint":bond.settlement_fingerprint,"status":bond.status,"revision":int(bond.revision)}

    @gl.public.view
    def get_bond_ids(self)->list[str]: return _stored_json(self.bond_ids_json, "bond IDs")
