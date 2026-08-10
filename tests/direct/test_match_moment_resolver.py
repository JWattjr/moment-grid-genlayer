"""Direct-mode coverage for the reusable MatchMomentResolver."""

import json


CONTRACT = "contracts/match_moment_resolver.py"
RESOLUTION_ID = "epl-2023-05-02-arsenal-chelsea-home-first"
BBC_URL = "https://www.bbc.co.uk/sport/football/65382202"
ESPN_URL = "https://www.espn.co.uk/football/match/_/gameId/638156/chelsea-arsenal"


def home_first_criteria():
    return {
        "kind": "FIRST_VALID_GOAL_TEAM",
        "finality": "FIRST_VALID_GOAL_RECORDED",
    }


def both_score_criteria():
    return {
        "kind": "BOTH_TEAMS_SCORED",
        "finality": "TRUE_OR_MATCH_FINISHED",
    }


def penalty_criteria():
    return {
        "kind": "EVENT_IN_MINUTE_RANGE",
        "event": "PENALTY_AWARDED",
        "from_minute": 30,
        "to_minute": 60,
        "finality": "EVENT_OR_WINDOW_CLOSED",
    }


def register_moment(
    contract,
    resolution_id=RESOLUTION_ID,
    moment_type="HOME_TEAM_SCORES_FIRST",
    statement="Home team scores first",
    criteria=None,
    source_urls=None,
):
    contract.register_moment(
        resolution_id,
        "epl-arsenal-chelsea-2023-05-02",
        "Arsenal",
        "Chelsea",
        "Premier League",
        "2023-05-02",
        moment_type,
        statement,
        json.dumps(criteria or home_first_criteria(), separators=(",", ":")),
        json.dumps(source_urls or [BBC_URL, ESPN_URL], separators=(",", ":")),
    )


def mock_sources(vm, bbc_body="BBC match report", espn_body="ESPN match report"):
    vm.mock_web(
        r".*bbc\.co\.uk/sport/football/65382202.*",
        {"status": 200, "body": bbc_body},
    )
    vm.mock_web(
        r".*espn\.co\.uk/football/match.*",
        {"status": 200, "body": espn_body},
    )


def facts(**overrides):
    value = {
        "identity_confirmed": True,
        "source_conflict": False,
        "match_status": "FINAL",
        "current_minute": 90,
        "first_goal_team": "HOME",
        "first_goal_minute": 18,
        "home_scored": True,
        "away_scored": True,
        "both_teams_score_minute": 65,
        "penalty_minutes": [],
        "evidence_summary": "Both reports identify Arsenal as the opening scorer.",
    }
    value.update(overrides)
    return value


def mock_facts(vm, **overrides):
    vm.mock_llm(
        r".*Extract objective football facts.*",
        json.dumps(facts(**overrides)),
    )


def test_home_first_true_settles_with_audit_fields(direct_vm, direct_deploy):
    direct_vm.warp("2026-08-09T12:34:56Z")
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm)

    contract.resolve_moment(RESOLUTION_ID)

    resolution = contract.get_resolution(RESOLUTION_ID)
    assert resolution["status"] == "SETTLED"
    assert resolution["result"] == "TRUE"
    assert resolution["reason_code"] == "HOME_FIRST"
    assert resolution["match_status"] == "FINAL"
    assert resolution["event_minute"] == 18
    assert resolution["attempt_count"] == 1
    assert resolution["resolved_at"] == "2026-08-09T12:34:56Z"
    assert json.loads(resolution["source_references_json"]) == [BBC_URL, ESPN_URL]


def test_home_first_false_when_away_scored_first(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    mock_sources(direct_vm)
    mock_facts(
        direct_vm,
        first_goal_team="AWAY",
        first_goal_minute=44,
        evidence_summary="Both reports identify Chelsea as the opening scorer.",
    )

    contract.resolve_moment(RESOLUTION_ID)

    resolution = contract.get_resolution(RESOLUTION_ID)
    assert resolution["result"] == "FALSE"
    assert resolution["reason_code"] == "AWAY_FIRST"
    assert resolution["event_minute"] == 44


def test_irreversible_home_first_can_settle_before_full_time(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    mock_sources(direct_vm)
    mock_facts(
        direct_vm,
        match_status="LIVE",
        current_minute=19,
        away_scored=False,
        both_teams_score_minute=-1,
        evidence_summary="Arsenal scored the first valid goal while the match remains live.",
    )

    contract.resolve_moment(RESOLUTION_ID)

    resolution = contract.get_resolution(RESOLUTION_ID)
    assert resolution["status"] == "SETTLED"
    assert resolution["result"] == "TRUE"
    assert resolution["match_status"] == "LIVE"


def test_both_teams_score_true_is_supported(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    resolution_id = "epl-2023-05-02-arsenal-chelsea-btts"
    register_moment(
        contract,
        resolution_id,
        "BOTH_TEAMS_SCORE_FULL_TIME",
        "Both teams score",
        both_score_criteria(),
    )
    mock_sources(direct_vm)
    mock_facts(direct_vm, both_teams_score_minute=65)

    contract.resolve_moment(resolution_id)

    resolution = contract.get_resolution(resolution_id)
    assert resolution["result"] == "TRUE"
    assert resolution["reason_code"] == "BOTH_TEAMS_SCORED"
    assert resolution["event_minute"] == 65


def test_both_teams_score_false_requires_full_time(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    resolution_id = "epl-2023-05-02-arsenal-chelsea-btts"
    register_moment(
        contract,
        resolution_id,
        "BOTH_TEAMS_SCORE_FULL_TIME",
        "Both teams score",
        both_score_criteria(),
    )
    mock_sources(direct_vm)
    mock_facts(
        direct_vm,
        away_scored=False,
        both_teams_score_minute=-1,
        evidence_summary="The completed match ended with only Arsenal scoring.",
    )

    contract.resolve_moment(resolution_id)

    resolution = contract.get_resolution(resolution_id)
    assert resolution["result"] == "FALSE"
    assert resolution["reason_code"] == "ONE_OR_NO_TEAMS_SCORED"


def test_penalty_window_true_is_supported(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    resolution_id = "epl-2023-05-02-arsenal-chelsea-penalty-30-60"
    register_moment(
        contract,
        resolution_id,
        "PENALTY_AWARDED",
        "Penalty awarded from minute 30 through 59",
        penalty_criteria(),
    )
    mock_sources(direct_vm)
    mock_facts(direct_vm, penalty_minutes=[52])

    contract.resolve_moment(resolution_id)

    resolution = contract.get_resolution(resolution_id)
    assert resolution["result"] == "TRUE"
    assert resolution["reason_code"] == "PENALTY_IN_WINDOW"
    assert resolution["event_minute"] == 52


def test_penalty_window_can_settle_false_after_window_closes(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    resolution_id = "epl-2023-05-02-arsenal-chelsea-penalty-30-60"
    register_moment(
        contract,
        resolution_id,
        "PENALTY_AWARDED",
        "Penalty awarded from minute 30 through 59",
        penalty_criteria(),
    )
    mock_sources(direct_vm)
    mock_facts(
        direct_vm,
        match_status="LIVE",
        current_minute=61,
        penalty_minutes=[],
        evidence_summary="The match passed minute 60 without a penalty award.",
    )

    contract.resolve_moment(resolution_id)

    resolution = contract.get_resolution(resolution_id)
    assert resolution["result"] == "FALSE"
    assert resolution["reason_code"] == "WINDOW_CLOSED"


def test_non_final_evidence_is_retryable(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    mock_sources(direct_vm)
    mock_facts(
        direct_vm,
        match_status="LIVE",
        current_minute=8,
        first_goal_team="UNKNOWN",
        first_goal_minute=-1,
        home_scored=False,
        away_scored=False,
        both_teams_score_minute=-1,
        evidence_summary="The match is live and goalless.",
    )

    contract.resolve_moment(RESOLUTION_ID)

    pending = contract.get_resolution(RESOLUTION_ID)
    assert pending["status"] == "PENDING"
    assert pending["result"] == "INVALID"
    assert pending["reason_code"] == "MATCH_NOT_FINAL"
    assert pending["attempt_count"] == 1
    assert pending["resolved_at"] == ""

    direct_vm.clear_mocks()
    mock_sources(direct_vm)
    mock_facts(direct_vm)
    contract.resolve_moment(RESOLUTION_ID)

    settled = contract.get_resolution(RESOLUTION_ID)
    assert settled["status"] == "SETTLED"
    assert settled["result"] == "TRUE"
    assert settled["attempt_count"] == 2


def test_two_unavailable_sources_remain_retryable_without_llm(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    direct_vm.mock_web(r".*bbc\.co\.uk.*", {"status": 503, "body": "Unavailable"})
    direct_vm.mock_web(r".*espn\.co\.uk.*", {"status": 503, "body": "Unavailable"})

    contract.resolve_moment(RESOLUTION_ID)

    resolution = contract.get_resolution(RESOLUTION_ID)
    assert resolution["status"] == "PENDING"
    assert resolution["result"] == "INVALID"
    assert resolution["reason_code"] == "SOURCE_UNAVAILABLE"


def test_conflicting_sources_remain_retryable(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    mock_sources(direct_vm, "Arsenal scored first", "Chelsea scored first")
    mock_facts(
        direct_vm,
        source_conflict=True,
        first_goal_team="UNKNOWN",
        first_goal_minute=-1,
        evidence_summary="BBC and ESPN disagree on the opening scorer.",
    )

    contract.resolve_moment(RESOLUTION_ID)

    resolution = contract.get_resolution(RESOLUTION_ID)
    assert resolution["status"] == "PENDING"
    assert resolution["result"] == "INVALID"
    assert resolution["reason_code"] == "CONFLICTING_SOURCES"


def test_validator_independently_rejects_a_different_decision(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm)
    contract.resolve_moment(RESOLUTION_ID)

    direct_vm.clear_mocks()
    mock_sources(direct_vm)
    mock_facts(
        direct_vm,
        first_goal_team="AWAY",
        first_goal_minute=44,
        evidence_summary="The validator evidence says Chelsea scored first.",
    )

    assert direct_vm.run_validator() is False


def test_validator_accepts_equivalent_decisive_fields(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm)
    contract.resolve_moment(RESOLUTION_ID)

    direct_vm.clear_mocks()
    mock_sources(direct_vm)
    mock_facts(
        direct_vm,
        evidence_summary="Equivalent evidence wording with the same decisive facts.",
    )

    assert direct_vm.run_validator() is True


def test_only_owner_may_register(direct_vm, direct_deploy, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_bob

    with direct_vm.expect_revert("Only the owner may register moments"):
        register_moment(contract)


def test_any_caller_may_trigger_resolution(direct_vm, direct_deploy, direct_bob):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    direct_vm.sender = direct_bob
    mock_sources(direct_vm)
    mock_facts(direct_vm)

    contract.resolve_moment(RESOLUTION_ID)

    assert contract.get_resolution(RESOLUTION_ID)["result"] == "TRUE"


def test_malformed_prediction_is_rejected(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)

    with direct_vm.expect_revert("Malformed prediction"):
        contract.register_moment(
            "bad",
            "demo",
            "Arsenal",
            "Chelsea",
            "Premier League",
            "not-a-date",
            "HOME_TEAM_SCORES_FIRST",
            "Home team scores first",
            "{}",
            "[]",
        )


def test_unapproved_source_is_rejected(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)

    with direct_vm.expect_revert("Source is not allowed"):
        register_moment(
            contract,
            source_urls=[BBC_URL, "https://attacker.example/match"],
        )


def test_duplicate_registration_is_rejected(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)

    with direct_vm.expect_revert("Resolution already registered"):
        register_moment(contract)


def test_registered_ids_are_enumerable_for_history(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    second_id = "epl-2023-05-02-arsenal-chelsea-btts"
    register_moment(
        contract,
        second_id,
        "BOTH_TEAMS_SCORE_FULL_TIME",
        "Both teams score by full time",
        both_score_criteria(),
    )

    assert contract.get_resolution_count() == 2
    assert contract.get_resolution_id(0) == RESOLUTION_ID
    assert contract.get_resolution_id(1) == second_id
    with direct_vm.expect_revert("Resolution index out of bounds"):
        contract.get_resolution_id(2)


def test_settled_event_cannot_resolve_twice(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)
    mock_sources(direct_vm)
    mock_facts(direct_vm)
    contract.resolve_moment(RESOLUTION_ID)

    with direct_vm.expect_revert("Resolution already settled"):
        contract.resolve_moment(RESOLUTION_ID)

    assert contract.get_resolution(RESOLUTION_ID)["result"] == "TRUE"


def test_locked_definition_cannot_be_replaced(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    register_moment(contract)

    with direct_vm.expect_revert("Resolution already registered"):
        register_moment(
            contract,
            RESOLUTION_ID,
            "BOTH_TEAMS_SCORE_FULL_TIME",
            "Both teams score",
            both_score_criteria(),
        )

    stored = contract.get_resolution(RESOLUTION_ID)
    assert stored["moment_type"] == "HOME_TEAM_SCORES_FIRST"
    assert json.loads(stored["criteria_json"]) == home_first_criteria()
