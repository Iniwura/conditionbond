from __future__ import annotations
import json
import sys
import pytest

CONTRACT = "contracts/condition_bond.py"
AMOUNT = 1000
DAMAGE_BPS = 2500
DEADLINE = "2099-01-01T00:00:00Z"
BEFORE_URL = "https://fixtures.example/before.png"
AFTER_URL = "https://fixtures.example/after.png"
BEFORE = [{"evidence_id": "item-before", "url": BEFORE_URL, "sha256": ""}]
AFTER = [{"evidence_id": "item-after", "url": AFTER_URL, "sha256": ""}]
CRITERIA = [{"criterion_id": "identity", "requirement": "The same red ceramic mug is visible."}, {"criterion_id": "surface", "requirement": "No new crack or break is present."}]
ACCEPTABLE = {"label": "ACCEPTABLE_WEAR", "rule": "Minor scuffs that do not affect use."}
DAMAGE = {"label": "MATERIAL_DAMAGE", "rule": "A new crack, break, missing piece, or unusable handle."}

def deploy(direct_deploy):
    return direct_deploy(CONTRACT)

def setup(contract, direct_vm, alice, bob, bond_id="bond-1"):
    direct_vm.sender = alice; direct_vm.value = 0
    contract.create_bond(bond_id, "0x" + bob.hex(), AMOUNT, json.dumps(BEFORE), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)
    direct_vm.value = AMOUNT
    contract.fund_bond(bond_id)
    direct_vm.value = 0; direct_vm.sender = bob
    contract.activate_bond(bond_id)

def mock_review(direct_vm, response):
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"fixtures[.]example", {"method": "GET", "status": 200, "body": b"image-bytes"})
    direct_vm.mock_llm(r"ConditionBond physical inspection adjudicator", json.dumps(response) if isinstance(response, dict) else response)

def submit_and_review(contract, direct_vm, alice, bob, response, bond_id="bond-1"):
    setup(contract, direct_vm, alice, bob, bond_id)
    direct_vm.sender = bob; direct_vm.value = 0
    contract.submit_return(bond_id, json.dumps(AFTER))
    mock_review(direct_vm, response)
    direct_vm.sender = alice
    return contract.review_bond(bond_id)

def install_spy(contract, monkeypatch):
    module = sys.modules[type(contract).__module__]
    class SpyRecipient:
        calls = []
        def __init__(self, address): self.address = address.as_hex.lower()
        def emit_transfer(self, value): self.calls.append((self.address, int(value)))
    monkeypatch.setattr(module, "_Recipient", SpyRecipient)
    return SpyRecipient

def test_create_fund_activate_and_frozen_policy(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = deploy(direct_deploy); setup(contract, direct_vm, direct_alice, direct_bob)
    record = contract.get_bond("bond-1")
    assert record["status"] == "ACTIVE"
    assert record["amount"] == AMOUNT
    assert record["damage_bps"] == DAMAGE_BPS
    assert record["criteria"] == CRITERIA
    assert record["policy_fingerprint"]
    assert record["before_fingerprint"]
    assert record["after_manifest"] == []

def test_exact_funding_roles_and_invalid_transition_rejected(direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice; direct_vm.value = 0
    contract.create_bond("bad", "0x" + direct_bob.hex(), AMOUNT, json.dumps(BEFORE), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)
    direct_vm.value = AMOUNT - 1
    with direct_vm.expect_revert(): contract.fund_bond("bad")
    direct_vm.value = AMOUNT; direct_vm.sender = direct_charlie
    with direct_vm.expect_revert(): contract.fund_bond("bad")
    direct_vm.sender = direct_alice; contract.fund_bond("bad")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert(): contract.activate_bond("bad")

def test_material_damage_multimodal_verdict_and_deterministic_payout(direct_deploy, direct_vm, direct_alice, direct_bob, monkeypatch):
    contract = deploy(direct_deploy)
    verdict = submit_and_review(contract, direct_vm, direct_alice, direct_bob, {"verdict": "MATERIAL_DAMAGE", "reasoning": "A new crack crosses the mug body."})
    assert verdict == "MATERIAL_DAMAGE"
    record = contract.get_bond("bond-1")
    assert record["status"] == "REVIEWED"
    assert record["damage_charge"] == 0
    spy = install_spy(contract, monkeypatch)
    direct_vm.sender = direct_alice
    fingerprint = contract.settle_bond("bond-1")
    assert fingerprint
    settled = contract.get_bond("bond-1")
    assert settled["status"] == "SETTLED"
    assert settled["damage_charge"] == 250
    assert settled["owner_receipt"] == 250
    assert settled["custodian_receipt"] == 750
    assert sorted(spy.calls) == sorted([("0x" + direct_alice.hex(), 250), ("0x" + direct_bob.hex(), 750)])
    with direct_vm.expect_revert(): contract.settle_bond("bond-1")

def test_unchanged_and_acceptable_wear_release_without_damage(direct_deploy, direct_vm, direct_alice, direct_bob, monkeypatch):
    for index, verdict in enumerate(("UNCHANGED", "ACCEPTABLE_WEAR"), start=1):
        contract = deploy(direct_deploy); bond_id = f"bond-{index}"
        assert submit_and_review(contract, direct_vm, direct_alice, direct_bob, {"verdict": verdict, "reasoning": "The frozen criteria pass."}, bond_id) == verdict
        spy = install_spy(contract, monkeypatch); direct_vm.sender = direct_bob
        contract.settle_bond(bond_id)
        record = contract.get_bond(bond_id)
        assert record["status"] == "SETTLED" and record["damage_charge"] == 0
        assert spy.calls[-1] == ("0x" + direct_bob.hex(), AMOUNT)

def test_undetermined_fails_closed_and_never_pays(direct_deploy, direct_vm, direct_alice, direct_bob, monkeypatch):
    contract = deploy(direct_deploy)
    assert submit_and_review(contract, direct_vm, direct_alice, direct_bob, {"verdict": "not-a-verdict", "reasoning": "malformed"}) == "UNDETERMINED"
    assert contract.get_bond("bond-1")["status"] == "UNDETERMINED"
    spy = install_spy(contract, monkeypatch); direct_vm.sender = direct_alice
    with direct_vm.expect_revert(): contract.settle_bond("bond-1")
    assert spy.calls == []

def test_unavailable_images_fail_closed(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = deploy(direct_deploy); setup(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob; contract.submit_return("bond-1", json.dumps(AFTER)); direct_vm.clear_mocks(); direct_vm.sender = direct_alice
    assert contract.review_bond("bond-1") == "UNDETERMINED"

def test_evidence_and_policy_inputs_are_bounded_and_duplicate_ids_rejected(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = deploy(direct_deploy); direct_vm.sender = direct_alice; direct_vm.value = 0
    duplicate = json.dumps([BEFORE[0], BEFORE[0]])
    with direct_vm.expect_revert(): contract.create_bond("dup", "0x" + direct_bob.hex(), AMOUNT, duplicate, json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)
    with direct_vm.expect_revert(): contract.create_bond("url", "0x" + direct_bob.hex(), AMOUNT, json.dumps([{**BEFORE[0], "url": "http://bad.example/x"}]), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)

def test_expiry_refund_and_refund_replay_rejected(direct_deploy, direct_vm, direct_alice, direct_bob, monkeypatch):
    contract = deploy(direct_deploy); setup(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice; spy = install_spy(contract, monkeypatch)
    contract.expire_bond("bond-1"); assert contract.get_bond("bond-1")["status"] == "EXPIRED"
    assert contract.refund_expired("bond-1") == AMOUNT
    assert contract.get_bond("bond-1")["status"] == "REFUNDED"
    assert spy.calls[-1] == ("0x" + direct_alice.hex(), AMOUNT)
    with direct_vm.expect_revert(): contract.refund_expired("bond-1")

def test_duplicate_bond_id_and_same_party_are_rejected(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice; direct_vm.value = 0
    args = ("same", "0x" + direct_bob.hex(), AMOUNT, json.dumps(BEFORE), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)
    contract.create_bond(*args)
    with direct_vm.expect_revert(): contract.create_bond(*args)
    with direct_vm.expect_revert(): contract.create_bond("same", "0x" + direct_alice.hex(), AMOUNT, json.dumps(BEFORE), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)


def test_malformed_oversized_and_invalid_policy_inputs_are_rejected(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = deploy(direct_deploy); direct_vm.sender = direct_alice; direct_vm.value = 0
    base = ("valid", "0x" + direct_bob.hex(), AMOUNT, json.dumps(BEFORE), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)
    with direct_vm.expect_revert(): contract.create_bond("x" * 65, *base[1:])
    with direct_vm.expect_revert(): contract.create_bond("bad-url", base[1], base[2], json.dumps([{**BEFORE[0], "url": BEFORE_URL + "#fragment"}]), *base[4:])
    with direct_vm.expect_revert(): contract.create_bond("bad-sha", base[1], base[2], json.dumps([{**BEFORE[0], "sha256": "abc"}]), *base[4:])
    with direct_vm.expect_revert(): contract.create_bond("too-many-criteria", base[1], base[2], base[3], json.dumps(CRITERIA * 5), *base[5:])
    with direct_vm.expect_revert(): contract.create_bond("zero-amount", base[1], 0, base[3], *base[4:])
    with direct_vm.expect_revert(): contract.create_bond("bad-bps", base[1], base[2], base[3], base[4], base[5], base[6], 10001, base[8])
    with direct_vm.expect_revert(): contract.create_bond("bad-deadline", base[1], base[2], base[3], base[4], base[5], base[6], base[7], "2099-01-01")


def test_before_criteria_and_policy_are_immutable_after_return(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = deploy(direct_deploy); setup(contract, direct_vm, direct_alice, direct_bob)
    before = contract.get_bond("bond-1")
    direct_vm.sender = direct_bob; direct_vm.value = 0
    contract.submit_return("bond-1", json.dumps(AFTER))
    after = contract.get_bond("bond-1")
    assert after["before_manifest"] == before["before_manifest"]
    assert after["before_fingerprint"] == before["before_fingerprint"]
    assert after["criteria"] == before["criteria"]
    assert after["acceptable_wear"] == before["acceptable_wear"]
    assert after["material_damage"] == before["material_damage"]
    assert after["policy_fingerprint"] == before["policy_fingerprint"]
    assert after["after_manifest"] == AFTER


def test_under_and_over_funding_and_activation_lifecycle(direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie):
    contract = deploy(direct_deploy); direct_vm.sender = direct_alice; direct_vm.value = 0
    contract.create_bond("lifecycle", "0x" + direct_bob.hex(), AMOUNT, json.dumps(BEFORE), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)
    with direct_vm.expect_revert(): contract.activate_bond("lifecycle")
    direct_vm.value = AMOUNT - 1
    with direct_vm.expect_revert(): contract.fund_bond("lifecycle")
    direct_vm.value = AMOUNT + 1
    with direct_vm.expect_revert(): contract.fund_bond("lifecycle")
    direct_vm.value = AMOUNT; direct_vm.sender = direct_charlie
    with direct_vm.expect_revert(): contract.fund_bond("lifecycle")
    direct_vm.sender = direct_alice; contract.fund_bond("lifecycle")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert(): contract.activate_bond("lifecycle")
    direct_vm.sender = direct_bob; contract.activate_bond("lifecycle")
    with direct_vm.expect_revert(): contract.activate_bond("lifecycle")


def test_return_submission_requires_custodian_and_active_state(direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie):
    contract = deploy(direct_deploy); direct_vm.sender = direct_alice; direct_vm.value = 0
    contract.create_bond("return", "0x" + direct_bob.hex(), AMOUNT, json.dumps(BEFORE), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)
    with direct_vm.expect_revert(): contract.submit_return("return", json.dumps(AFTER))
    direct_vm.value = AMOUNT; contract.fund_bond("return")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert(): contract.submit_return("return", json.dumps(AFTER))
    contract.activate_bond("return")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert(): contract.submit_return("return", json.dumps(AFTER))
    direct_vm.sender = direct_bob; contract.submit_return("return", json.dumps(AFTER))
    with direct_vm.expect_revert(): contract.submit_return("return", json.dumps(AFTER))


def test_wrong_asset_and_ambiguous_evidence_fail_closed(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = deploy(direct_deploy); setup(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob; contract.submit_return("bond-1", json.dumps(AFTER))
    mock_review(direct_vm, {"verdict": "UNDETERMINED", "reasoning": "The returned object is not the frozen asset."})
    direct_vm.sender = direct_alice
    assert contract.review_bond("bond-1") == "UNDETERMINED"
    record = contract.get_bond("bond-1")
    assert record["status"] == "UNDETERMINED" and record["damage_charge"] == 0


def test_malformed_model_shapes_fail_closed(direct_deploy, direct_vm, direct_alice, direct_bob):
    for index, response in enumerate(("not-json", {"verdict": "MATERIAL_DAMAGE", "reasoning": 42}, {"reasoning": "missing verdict"})):
        bond_id = f"malformed-{index}"
        contract = deploy(direct_deploy); setup(contract, direct_vm, direct_alice, direct_bob, bond_id)
        direct_vm.sender = direct_bob; contract.submit_return(bond_id, json.dumps(AFTER))
        mock_review(direct_vm, response); direct_vm.sender = direct_alice
        assert contract.review_bond(bond_id) == "UNDETERMINED"


def test_settlement_caller_rules_and_replay_protection(direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie, monkeypatch):
    contract = deploy(direct_deploy)
    assert submit_and_review(contract, direct_vm, direct_alice, direct_bob, {"verdict": "UNCHANGED", "reasoning": "No change."}, "caller-rules") == "UNCHANGED"
    install_spy(contract, monkeypatch); direct_vm.sender = direct_charlie
    with direct_vm.expect_revert(): contract.settle_bond("caller-rules")
    direct_vm.sender = direct_bob; contract.settle_bond("caller-rules")
    with direct_vm.expect_revert(): contract.settle_bond("caller-rules")
    with direct_vm.expect_revert(): contract.review_bond("caller-rules")


def test_transfer_failure_reverts_money_path(direct_deploy, direct_vm, direct_alice, direct_bob, monkeypatch):
    contract = deploy(direct_deploy)
    assert submit_and_review(contract, direct_vm, direct_alice, direct_bob, {"verdict": "MATERIAL_DAMAGE", "reasoning": "Break."}, "transfer-failure") == "MATERIAL_DAMAGE"
    module = sys.modules[type(contract).__module__]
    class FailingRecipient:
        def __init__(self, address): self.address = address
        def emit_transfer(self, value): raise RuntimeError("simulated transfer failure")
    monkeypatch.setattr(module, "_Recipient", FailingRecipient)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert(): contract.settle_bond("transfer-failure")
    failed = contract.get_bond("transfer-failure")
    assert failed["status"] == "SETTLED"
    assert failed["owner_receipt"] == 250 and failed["custodian_receipt"] == 750


def test_expire_only_supported_funded_paths_and_unfunded_cannot_refund(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = deploy(direct_deploy); direct_vm.sender = direct_alice; direct_vm.value = 0
    contract.create_bond("unfunded", "0x" + direct_bob.hex(), AMOUNT, json.dumps(BEFORE), json.dumps(CRITERIA), json.dumps(ACCEPTABLE), json.dumps(DAMAGE), DAMAGE_BPS, DEADLINE)
    with direct_vm.expect_revert(): contract.expire_bond("unfunded")
    with direct_vm.expect_revert(): contract.refund_expired("unfunded")
