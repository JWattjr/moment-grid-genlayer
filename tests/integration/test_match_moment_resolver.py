"""Hosted-network coverage for deployment, immutable registration, and a live verdict."""

import json
from pathlib import Path

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus
from gltest.utils import extract_contract_address


FIXTURE = json.loads(
    Path("fixtures/genlayer/arsenal-chelsea-2023-05-02.json").read_text(encoding="utf-8")
)


def receipt_summary(receipt):
    leader = receipt.get("consensus_data", {}).get("leader_receipt", [{}])[0]
    return {
        "hash": receipt.get("hash") or receipt.get("tx_id"),
        "status": receipt.get("status_name"),
        "result": receipt.get("result_name"),
        "execution": leader.get("execution_result"),
    }


@pytest.mark.integration
@pytest.mark.slow
def test_real_studionet_home_first_resolution():
    factory = get_contract_factory("MatchMomentResolver")
    deployment = factory.deploy_contract_tx(
        args=[],
        wait_transaction_status=TransactionStatus.ACCEPTED,
        wait_interval=10_000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(deployment)
    address = extract_contract_address(deployment)
    contract = factory.build_contract(address)
    print("STUDIONET_DEPLOYMENT", json.dumps(receipt_summary(deployment), sort_keys=True))
    print("STUDIONET_CONTRACT", address)

    source_urls_json = json.dumps(FIXTURE["source_urls"], separators=(",", ":"))
    selected_moments = [FIXTURE["moments"][0], FIXTURE["moments"][2]]

    for moment in selected_moments:
        criteria_json = json.dumps(moment["criteria"], separators=(",", ":"))
        receipt = contract.register_moment(
            args=[
                moment["resolution_id"],
                FIXTURE["match_id"],
                FIXTURE["home_team"],
                FIXTURE["away_team"],
                FIXTURE["competition"],
                FIXTURE["match_date"],
                moment["moment_type"],
                moment["moment_statement"],
                criteria_json,
                source_urls_json,
            ]
        ).transact(
            wait_transaction_status=TransactionStatus.ACCEPTED,
            wait_interval=10_000,
            wait_retries=60,
        )
        assert tx_execution_succeeded(receipt)
        print(
            "STUDIONET_REGISTRATION",
            moment["resolution_id"],
            json.dumps(receipt_summary(receipt), sort_keys=True),
        )

        stored = contract.get_resolution(args=[moment["resolution_id"]]).call()
        assert stored["resolution_id"] == moment["resolution_id"]
        assert stored["match_id"] == FIXTURE["match_id"]
        assert stored["criteria_json"] == criteria_json
        assert stored["source_urls_json"] == source_urls_json
        assert stored["status"] == "PENDING"
        assert stored["result"] == "UNRESOLVED"

    expected = {selected_moments[0]["resolution_id"]: "TRUE"}
    for moment in selected_moments[:1]:
        receipt = contract.resolve_moment(args=[moment["resolution_id"]]).transact(
            wait_transaction_status=TransactionStatus.ACCEPTED,
            wait_interval=3_000,
            wait_retries=160,
        )
        assert tx_execution_succeeded(receipt)
        print(
            "STUDIONET_RESOLUTION",
            moment["resolution_id"],
            json.dumps(receipt_summary(receipt), sort_keys=True),
        )

        stored = contract.get_resolution(args=[moment["resolution_id"]]).call()
        print("STUDIONET_STATE", json.dumps(stored, default=str, sort_keys=True))
        assert stored["status"] == "SETTLED"
        assert stored["result"] == expected[moment["resolution_id"]]
        assert stored["match_status"] == "FINAL"
        assert stored["attempt_count"] == 1
        assert len(stored["evidence_summary"]) > 0
        assert len(json.loads(stored["source_references_json"])) >= 2
