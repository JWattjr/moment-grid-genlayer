"""Direct-mode coverage for the full-grid MatchRoundResolver."""

import json


CONTRACT = "contracts/match_round_resolver.py"
RESOLUTION_ID = "epl-2024-demo-round"
BBC_URL = "https://www.bbc.co.uk/sport/football/demo"
ESPN_URL = "https://www.espn.co.uk/football/match/_/gameId/demo"


def register(contract):
    from genlayer import Address

    contract.register_round(
        RESOLUTION_ID,
        "epl-demo-match",
        "Home",
        "Away",
        "Premier League",
        "2024-05-04",
        json.dumps([BBC_URL, ESPN_URL], separators=(",", ":")),
        Address("0x0000000000000000000000000000000000000000"),
        "game-round-1",
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


def test_resolves_all_twenty_seven_moments_into_three_stable_bitmaps(direct_vm, direct_deploy):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    register(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm)

    contract.resolve_round(RESOLUTION_ID)

    result = contract.get_round_resolution(RESOLUTION_ID)
    assert result["status"] == "SETTLED"
    assert result["reason_code"] == "FINAL_FACTS_AGREED"
    assert result["window_0_bitmap"] == bitmap(1, 2, 3, 11, 12, 19, 20, 21)
    assert result["window_1_bitmap"] == bitmap(4, 5, 6, 13, 14, 15, 23, 24)
    assert result["window_2_bitmap"] == bitmap(7, 8, 9, 16, 17, 18, 25, 27)
    assert result["attempt_count"] == 1
    assert result["resolved_at"] == "2026-08-11T12:00:00Z"


def test_live_match_remains_retryable(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm, match_status="LIVE", evidence_summary="The match is still live.")

    contract.resolve_round(RESOLUTION_ID)

    result = contract.get_round_resolution(RESOLUTION_ID)
    assert result["status"] == "PENDING"
    assert result["reason_code"] == "MATCH_NOT_FINAL"
    assert result["attempt_count"] == 1


def test_conflicting_sources_never_settle_money_result(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm, source_conflict=True, evidence_summary="The reports conflict.")

    contract.resolve_round(RESOLUTION_ID)

    result = contract.get_round_resolution(RESOLUTION_ID)
    assert result["status"] == "PENDING"
    assert result["reason_code"] == "CONFLICTING_SOURCES"
    assert result["window_0_bitmap"] == 0
