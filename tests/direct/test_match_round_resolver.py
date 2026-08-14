"""Direct-mode coverage for the full-grid MatchRoundResolver."""

import json
import pytest


CONTRACT = "contracts/match_round_resolver.py"
RESOLUTION_ID = "epl-2024-demo-round"
BBC_URL = "https://www.bbc.co.uk/sport/football/demo"
ESPN_URL = "https://www.espn.co.uk/football/match/_/gameId/demo"


def register(contract, settlement_target="0x0000000000000000000000000000000000000000"):
    from genlayer import Address

    contract.register_round(
        RESOLUTION_ID,
        "epl-demo-match",
        "Home",
        "Away",
        "Premier League",
        "2024-05-04",
        json.dumps([BBC_URL, ESPN_URL], separators=(",", ":")),
        Address(settlement_target),
        "game-round-1",
        "2026-08-11T13:00:00Z",
        "2026-08-12T13:00:00Z",
    )


def mock_sources(vm):
    vm.mock_web(r".*bbc\.co\.uk.*", {"status": 200, "body": "BBC final report"})
    vm.mock_web(r".*espn\.co\.uk.*", {"status": 200, "body": "ESPN final timeline"})


def final_facts(**overrides):
    value = {
        "identity_confirmed": True,
        "source_conflict": False,
        "match_status": "FINAL",
        "home_shots_by_30": 2,
        "goals": [
            {"minute": 3, "team": "AWAY", "substitute": False},
            {"minute": 44, "team": "HOME", "substitute": False},
            {"minute": 52, "team": "AWAY", "substitute": True},
            {"minute": 84, "team": "HOME", "substitute": False},
        ],
        "corner_minutes": [21, 26, 65, 88],
        "yellow_card_minutes": [12, 33, 55, 80, 85],
        "red_card_minutes": [77],
        "substitution_minutes": [40, 50, 70, 75],
        "var_review_minutes": [33],
        "overturned_goal_minutes": [14],
        "penalty_minutes": [11],
        "went_to_extra_time": True,
        "supported_moment_ids": list(range(1, 28)),
        "evidence_summary": "Both reports agree on the final timeline.",
    }
    value.update(overrides)
    return value


def mock_facts(vm, **overrides):
    vm.mock_llm(r".*Extract the final objective football events.*", json.dumps(final_facts(**overrides)))


def bitmap(*moment_ids):
    value = 0
    for moment_id in moment_ids:
        value |= 1 << moment_id
    return value


def test_resolves_all_twenty_seven_moments_into_three_stable_bitmaps(
    direct_vm, direct_deploy, direct_alice
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    register(contract, direct_alice)
    mock_sources(direct_vm)
    mock_facts(direct_vm)

    direct_vm.warp("2026-08-11T13:00:01Z")
    contract.resolve_round(RESOLUTION_ID)

    result = contract.get_round_resolution(RESOLUTION_ID)
    assert result["status"] == "SETTLED"
    assert result["reason_code"] == "FINAL_FACTS_AGREED"
    assert result["window_0_bitmap"] == bitmap(1, 2, 3, 11, 12, 19, 20, 21)
    assert result["window_1_bitmap"] == bitmap(4, 5, 6, 13, 14, 15, 23, 24)
    assert result["window_2_bitmap"] == bitmap(7, 8, 9, 16, 17, 18, 25, 27)
    assert result["attempt_count"] == 1
    assert result["resolved_at"] == "2026-08-11T13:00:01Z"
    assert result["window_0_valid_bitmap"] == bitmap(1, 2, 3, 10, 11, 12, 19, 20, 21)
    assert result["window_1_valid_bitmap"] == bitmap(4, 5, 6, 13, 14, 15, 22, 23, 24)
    assert result["window_2_valid_bitmap"] == bitmap(7, 8, 9, 16, 17, 18, 25, 26, 27)
    assert result["dispatch_count"] == 0

    # Persist consensus first. Dispatch is a separate permissionless
    # transaction so a callback can never outrun the resolver's durable state.
    contract.dispatch_resolution(RESOLUTION_ID)
    assert contract.get_round_resolution(RESOLUTION_ID)["dispatch_count"] == 1


def test_live_match_remains_retryable(direct_vm, direct_deploy):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    register(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm, match_status="LIVE", evidence_summary="The match is still live.")

    direct_vm.warp("2026-08-11T13:00:01Z")
    contract.resolve_round(RESOLUTION_ID)

    result = contract.get_round_resolution(RESOLUTION_ID)
    assert result["status"] == "PENDING"
    assert result["reason_code"] == "MATCH_NOT_FINAL"
    assert result["attempt_count"] == 1


def test_conflicting_sources_never_settle_money_result(direct_vm, direct_deploy):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    register(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm, source_conflict=True, evidence_summary="The reports conflict.")

    direct_vm.warp("2026-08-11T13:00:01Z")
    contract.resolve_round(RESOLUTION_ID)

    result = contract.get_round_resolution(RESOLUTION_ID)
    assert result["status"] == "PENDING"
    assert result["reason_code"] == "CONFLICTING_SOURCES"
    assert result["window_0_bitmap"] == 0


def test_incomplete_source_coverage_is_committed_as_validity_bitmaps(direct_vm, direct_deploy):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    register(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm, supported_moment_ids=[2, 4, 7])
    direct_vm.warp("2026-08-11T13:00:01Z")
    contract.resolve_round(RESOLUTION_ID)

    result = contract.get_round_resolution(RESOLUTION_ID)
    assert result["window_0_valid_bitmap"] == bitmap(2)
    assert result["window_1_valid_bitmap"] == bitmap(4)
    assert result["window_2_valid_bitmap"] == bitmap(7)


def test_resolution_is_rejected_before_registered_evidence_window(direct_vm, direct_deploy):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    register(contract)
    with pytest.raises(Exception, match="evidence window has not opened"):
        contract.resolve_round(RESOLUTION_ID)


def test_registration_requires_distinct_publishers(direct_vm, direct_deploy):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    from genlayer import Address
    with pytest.raises(Exception, match="distinct publishers"):
        contract.register_round(
            RESOLUTION_ID,
            "epl-demo-match",
            "Home",
            "Away",
            "Premier League",
            "2024-05-04",
            json.dumps([BBC_URL, "https://www.bbc.co.uk/sport/football/other"]),
            Address("0x0000000000000000000000000000000000000000"),
            "game-round-1",
            "2026-08-11T13:00:00Z",
            "2026-08-12T13:00:00Z",
        )
