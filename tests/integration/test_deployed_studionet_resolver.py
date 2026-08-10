"""Verification against the recorded durable Studionet submission deployment."""

import json
from pathlib import Path

import pytest
from gltest.clients import get_gl_client


DEPLOYMENT = json.loads(
    Path("deployments/genlayer/studionet.json").read_text(encoding="utf-8")
)
TRUE_RESOLUTION_ID = "epl-2023-05-02-arsenal-chelsea-home-first"
FALSE_RESOLUTION_ID = "epl-2023-05-02-arsenal-chelsea-penalty-30-60"
CONTRACT_ADDRESS = DEPLOYMENT["submission_deployment"]["contract_address"]


@pytest.mark.integration
@pytest.mark.slow
def test_durable_submission_deployment_stores_true_and_false_proofs():
    client = get_gl_client()
    true_record = client.read_contract(
        address=CONTRACT_ADDRESS,
        function_name="get_resolution",
        args=[TRUE_RESOLUTION_ID],
    )
    assert true_record["status"] == "SETTLED"
    assert true_record["result"] == "TRUE"
    assert true_record["reason_code"] == "HOME_FIRST"
    assert true_record["match_status"] == "FINAL"
    assert true_record["event_minute"] == 18

    false_record = client.read_contract(
        address=CONTRACT_ADDRESS,
        function_name="get_resolution",
        args=[FALSE_RESOLUTION_ID],
    )
    assert false_record["status"] == "SETTLED"
    assert false_record["result"] == "FALSE"
    assert false_record["reason_code"] == "NO_PENALTY_IN_WINDOW"
    assert false_record["match_status"] == "FINAL"
    assert false_record["event_minute"] == -1
