# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Consensus resolver for reusable Moment Grid football events.

Validators independently fetch the registered sources and extract a small set
of match facts.  Deterministic code then applies the registered finality policy.
Only TRUE/FALSE outcomes settle; INVALID attempts remain retryable.
"""

import json
from dataclasses import dataclass

from genlayer import *


PENDING = "PENDING"
SETTLED = "SETTLED"
UNRESOLVED = "UNRESOLVED"
TRUE = "TRUE"
FALSE = "FALSE"
INVALID = "INVALID"

HOME_TEAM_SCORES_FIRST = "HOME_TEAM_SCORES_FIRST"
BOTH_TEAMS_SCORE_FULL_TIME = "BOTH_TEAMS_SCORE_FULL_TIME"
PENALTY_AWARDED = "PENALTY_AWARDED"

FINAL = "FINAL"
LIVE = "LIVE"
SCHEDULED = "SCHEDULED"
UNKNOWN = "UNKNOWN"

SOURCE_ORIGINS = [
    "https://www.bbc.co.uk/",
    "https://www.espn.co.uk/",
    "https://www.espn.com/",
    "https://www.thesportsdb.com/",
]
MIN_SOURCES = 2
MAX_SOURCES = 3


@allow_storage
@dataclass
class MomentResolution:
    resolution_id: str
    match_id: str
    home_team: str
    away_team: str
    competition: str
    match_date: str
    moment_type: str
    moment_statement: str
    criteria_json: str
    source_urls_json: str
    status: str
    result: str
    reason_code: str
    match_status: str
    event_minute: i64
    evidence_summary: str
    source_references_json: str
    resolved_at: str
    attempt_count: u256


def _invalid_decision(
    reason_code: str,
    summary: str,
    available_urls: list,
    match_status: str = UNKNOWN,
) -> dict:
    return {
        "result": INVALID,
        "reason_code": reason_code,
        "match_status": match_status,
        "event_minute": -1,
        "evidence_summary": summary[:360],
        "source_references_json": json.dumps(available_urls),
    }


def _decision(
    result: str,
    reason_code: str,
    facts: dict,
    event_minute: int,
    available_urls: list,
) -> dict:
    return {
        "result": result,
        "reason_code": reason_code,
        "match_status": facts["match_status"],
        "event_minute": event_minute,
        "evidence_summary": facts["evidence_summary"],
        "source_references_json": json.dumps(available_urls),
    }


def _integer_or_minus_one(value) -> int:
    if not isinstance(value, int) or value < -1 or value > 130:
        raise gl.vm.UserError("Malformed evidence extraction")
    return value


def _normalize_facts(raw: dict) -> dict:
    match_status = str(raw.get("match_status", "")).upper()
    first_goal_team = str(raw.get("first_goal_team", "")).upper()
    summary = str(raw.get("evidence_summary", "")).strip()
    penalty_minutes = raw.get("penalty_minutes", [])

    if match_status not in [FINAL, LIVE, SCHEDULED, UNKNOWN]:
        raise gl.vm.UserError("Malformed evidence extraction")
    if first_goal_team not in ["HOME", "AWAY", "NONE", "UNKNOWN"]:
        raise gl.vm.UserError("Malformed evidence extraction")
    if not isinstance(raw.get("identity_confirmed"), bool):
        raise gl.vm.UserError("Malformed evidence extraction")
    if not isinstance(raw.get("source_conflict"), bool):
        raise gl.vm.UserError("Malformed evidence extraction")
    if not isinstance(raw.get("home_scored"), bool):
        raise gl.vm.UserError("Malformed evidence extraction")
    if not isinstance(raw.get("away_scored"), bool):
        raise gl.vm.UserError("Malformed evidence extraction")
    if not isinstance(penalty_minutes, list):
        raise gl.vm.UserError("Malformed evidence extraction")
    if any(not isinstance(minute, int) for minute in penalty_minutes):
        raise gl.vm.UserError("Malformed evidence extraction")
    if len(summary) == 0:
        raise gl.vm.UserError("Malformed evidence extraction")

    return {
        "identity_confirmed": raw["identity_confirmed"],
        "source_conflict": raw["source_conflict"],
        "match_status": match_status,
        "current_minute": _integer_or_minus_one(raw.get("current_minute")),
        "first_goal_team": first_goal_team,
        "first_goal_minute": _integer_or_minus_one(raw.get("first_goal_minute")),
        "home_scored": raw["home_scored"],
        "away_scored": raw["away_scored"],
        "both_teams_score_minute": _integer_or_minus_one(
            raw.get("both_teams_score_minute")
        ),
        "penalty_minutes": penalty_minutes,
        "evidence_summary": summary[:360],
    }


def _bounded_excerpt(body: str) -> str:
    if len(body) <= 80000:
        return body
    chunk_size = 6000
    last_start = len(body) - chunk_size
    starts = [
        0,
        len(body) // 12,
        len(body) // 6,
        len(body) // 3,
        len(body) // 2,
        (len(body) * 2) // 3,
        (len(body) * 5) // 6,
        last_start,
    ]
    return "\n[...SOURCE SEGMENT...]\n".join(
        body[start : start + chunk_size] for start in starts
    )


def _derive_decision(moment: dict, facts: dict, available_urls: list) -> dict:
    if not facts["identity_confirmed"]:
        return _invalid_decision(
            "MATCH_NOT_FOUND",
            facts["evidence_summary"],
            available_urls,
            facts["match_status"],
        )
    if facts["source_conflict"]:
        return _invalid_decision(
            "CONFLICTING_SOURCES",
            facts["evidence_summary"],
            available_urls,
            facts["match_status"],
        )

    if moment["moment_type"] == HOME_TEAM_SCORES_FIRST:
        if facts["first_goal_team"] == "HOME":
            return _decision(
                TRUE, "HOME_FIRST", facts, facts["first_goal_minute"], available_urls
            )
        if facts["first_goal_team"] == "AWAY":
            return _decision(
                FALSE, "AWAY_FIRST", facts, facts["first_goal_minute"], available_urls
            )
        if facts["match_status"] == FINAL and facts["first_goal_team"] == "NONE":
            return _decision(FALSE, "NO_GOALS", facts, -1, available_urls)
        return _invalid_decision(
            "MATCH_NOT_FINAL",
            facts["evidence_summary"],
            available_urls,
            facts["match_status"],
        )

    if moment["moment_type"] == BOTH_TEAMS_SCORE_FULL_TIME:
        if facts["home_scored"] and facts["away_scored"]:
            return _decision(
                TRUE,
                "BOTH_TEAMS_SCORED",
                facts,
                facts["both_teams_score_minute"],
                available_urls,
            )
        if facts["match_status"] == FINAL:
            return _decision(
                FALSE, "ONE_OR_NO_TEAMS_SCORED", facts, -1, available_urls
            )
        return _invalid_decision(
            "MATCH_NOT_FINAL",
            facts["evidence_summary"],
            available_urls,
            facts["match_status"],
        )

    criteria = json.loads(moment["criteria_json"])
    from_minute = int(criteria["from_minute"])
    to_minute = int(criteria["to_minute"])
    matching_penalties = [
        minute
        for minute in facts["penalty_minutes"]
        if minute >= from_minute and minute < to_minute
    ]
    if len(matching_penalties) > 0:
        return _decision(
            TRUE,
            "PENALTY_IN_WINDOW",
            facts,
            min(matching_penalties),
            available_urls,
        )
    if facts["match_status"] == FINAL:
        return _decision(FALSE, "NO_PENALTY_IN_WINDOW", facts, -1, available_urls)
    if facts["current_minute"] >= to_minute:
        return _decision(FALSE, "WINDOW_CLOSED", facts, -1, available_urls)
    return _invalid_decision(
        "WINDOW_NOT_CLOSED",
        facts["evidence_summary"],
        available_urls,
        facts["match_status"],
    )


def _adjudicate(moment: dict) -> dict:
    source_urls = json.loads(moment["source_urls_json"])
    source_sections = []
    available_urls = []

    for index, source_url in enumerate(source_urls):
        try:
            response = gl.nondet.web.get(source_url)
        except Exception:
            continue
        if response.status >= 400 or response.body is None:
            continue
        body = response.body.decode("utf-8")
        source_sections.append(
            f"SOURCE {index + 1}\nURL: {source_url}\nCONTENT:\n"
            + _bounded_excerpt(body)
        )
        available_urls.append(source_url)

    if len(source_sections) < MIN_SOURCES:
        return _invalid_decision(
            "SOURCE_UNAVAILABLE",
            "Fewer than two configured authoritative sources were available.",
            available_urls,
        )

    evidence = "\n\n".join(source_sections)
    prompt = f"""
Extract objective football facts from the authoritative source excerpts below.
Do not decide the prediction. Do not guess missing facts. Treat disallowed or
overturned goals as not scored. Set source_conflict true if the accessible
sources materially disagree. Match status FINAL includes completed full-time
and completed-after-extra-time results; it does not include a live match.

Match id: {moment["match_id"]}
Competition: {moment["competition"]}
Date: {moment["match_date"]}
Home team: {moment["home_team"]}
Away team: {moment["away_team"]}
Moment type: {moment["moment_type"]}
Statement: {moment["moment_statement"]}
Criteria: {moment["criteria_json"]}

Evidence:
{evidence}

Return only a JSON object with exactly these fields:
{{
  "identity_confirmed": true | false,
  "source_conflict": true | false,
  "match_status": "FINAL" | "LIVE" | "SCHEDULED" | "UNKNOWN",
  "current_minute": integer or -1,
  "first_goal_team": "HOME" | "AWAY" | "NONE" | "UNKNOWN",
  "first_goal_minute": integer or -1,
  "home_scored": true | false,
  "away_scored": true | false,
  "both_teams_score_minute": integer or -1,
  "penalty_minutes": [integers for penalties awarded in regulation time],
  "evidence_summary": "one concise source-grounded sentence"
}}
"""
    raw = gl.nondet.exec_prompt(prompt, response_format="json")
    return _derive_decision(moment, _normalize_facts(raw), available_urls)


class MatchMomentResolver(gl.Contract):
    """Resolve owner-registered match facts through validator consensus."""

    owner: Address
    resolutions: TreeMap[str, MomentResolution]
    resolution_ids: DynArray[str]

    def __init__(self):
        self.owner = gl.message.sender_address

    @gl.public.write
    def register_moment(
        self,
        resolution_id: str,
        match_id: str,
        home_team: str,
        away_team: str,
        competition: str,
        match_date: str,
        moment_type: str,
        moment_statement: str,
        criteria_json: str,
        source_urls_json: str,
    ) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may register moments")

        self._validate_registration(
            resolution_id,
            match_id,
            home_team,
            away_team,
            competition,
            match_date,
            moment_type,
            moment_statement,
            criteria_json,
            source_urls_json,
        )
        if resolution_id in self.resolutions:
            raise gl.vm.UserError("Resolution already registered")

        self.resolutions[resolution_id] = MomentResolution(
            resolution_id=resolution_id,
            match_id=match_id,
            home_team=home_team,
            away_team=away_team,
            competition=competition,
            match_date=match_date,
            moment_type=moment_type,
            moment_statement=moment_statement,
            criteria_json=criteria_json,
            source_urls_json=source_urls_json,
            status=PENDING,
            result=UNRESOLVED,
            reason_code="",
            match_status=UNKNOWN,
            event_minute=-1,
            evidence_summary="",
            source_references_json="[]",
            resolved_at="",
            attempt_count=0,
        )
        self.resolution_ids.append(resolution_id)

    @gl.public.write
    def resolve_moment(self, resolution_id: str) -> None:
        if resolution_id not in self.resolutions:
            raise gl.vm.UserError("Resolution not found")

        moment = self.resolutions[resolution_id]
        if moment.status == SETTLED:
            raise gl.vm.UserError("Resolution already settled")

        moment_input = {
            "match_id": moment.match_id,
            "home_team": moment.home_team,
            "away_team": moment.away_team,
            "competition": moment.competition,
            "match_date": moment.match_date,
            "moment_type": moment.moment_type,
            "moment_statement": moment.moment_statement,
            "criteria_json": moment.criteria_json,
            "source_urls_json": moment.source_urls_json,
        }

        def leader_fn() -> dict:
            return _adjudicate(moment_input)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                validator_result = leader_fn()
                leader_data = leader_result.calldata
                return (
                    leader_data["result"] == validator_result["result"]
                    and leader_data["reason_code"]
                    == validator_result["reason_code"]
                    and leader_data["match_status"]
                    == validator_result["match_status"]
                    and leader_data["event_minute"]
                    == validator_result["event_minute"]
                )
            except Exception:
                return False

        adjudication = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        moment.attempt_count += 1
        moment.result = adjudication["result"]
        moment.reason_code = adjudication["reason_code"]
        moment.match_status = adjudication["match_status"]
        moment.event_minute = adjudication["event_minute"]
        moment.evidence_summary = adjudication["evidence_summary"]
        moment.source_references_json = adjudication["source_references_json"]

        if adjudication["result"] in [TRUE, FALSE]:
            moment.status = SETTLED
            moment.resolved_at = str(gl.message_raw["datetime"])

    @gl.public.view
    def get_resolution(self, resolution_id: str) -> dict:
        if resolution_id not in self.resolutions:
            return {}
        moment = self.resolutions[resolution_id]
        return {
            "resolution_id": moment.resolution_id,
            "match_id": moment.match_id,
            "home_team": moment.home_team,
            "away_team": moment.away_team,
            "competition": moment.competition,
            "match_date": moment.match_date,
            "moment_type": moment.moment_type,
            "moment_statement": moment.moment_statement,
            "criteria_json": moment.criteria_json,
            "source_urls_json": moment.source_urls_json,
            "status": moment.status,
            "result": moment.result,
            "reason_code": moment.reason_code,
            "match_status": moment.match_status,
            "event_minute": moment.event_minute,
            "evidence_summary": moment.evidence_summary,
            "source_references_json": moment.source_references_json,
            "resolved_at": moment.resolved_at,
            "attempt_count": moment.attempt_count,
        }

    @gl.public.view
    def get_owner(self) -> str:
        return str(self.owner)

    @gl.public.view
    def get_resolution_count(self) -> u256:
        return len(self.resolution_ids)

    @gl.public.view
    def get_resolution_id(self, index: u256) -> str:
        if index >= len(self.resolution_ids):
            raise gl.vm.UserError("Resolution index out of bounds")
        return self.resolution_ids[index]

    def _validate_registration(
        self,
        resolution_id: str,
        match_id: str,
        home_team: str,
        away_team: str,
        competition: str,
        match_date: str,
        moment_type: str,
        moment_statement: str,
        criteria_json: str,
        source_urls_json: str,
    ) -> None:
        required = [
            resolution_id,
            match_id,
            home_team,
            away_team,
            competition,
            match_date,
            moment_statement,
        ]
        if any(len(value.strip()) == 0 for value in required):
            raise gl.vm.UserError("Malformed prediction")
        if len(match_date) != 10 or match_date[4] != "-" or match_date[7] != "-":
            raise gl.vm.UserError("Malformed prediction")
        date_parts = match_date.split("-")
        if any(not part.isdigit() for part in date_parts):
            raise gl.vm.UserError("Malformed prediction")
        year, month, day = [int(part) for part in date_parts]
        if year < 2000 or month < 1 or month > 12 or day < 1 or day > 31:
            raise gl.vm.UserError("Malformed prediction")
        if moment_type not in [
            HOME_TEAM_SCORES_FIRST,
            BOTH_TEAMS_SCORE_FULL_TIME,
            PENALTY_AWARDED,
        ]:
            raise gl.vm.UserError("Unsupported moment type")

        try:
            criteria = json.loads(criteria_json)
            source_urls = json.loads(source_urls_json)
        except Exception:
            raise gl.vm.UserError("Malformed prediction")

        if not isinstance(criteria, dict):
            raise gl.vm.UserError("Malformed prediction")
        self._validate_criteria(moment_type, criteria)
        if not isinstance(source_urls, list):
            raise gl.vm.UserError("Malformed prediction")
        if len(source_urls) < MIN_SOURCES or len(source_urls) > MAX_SOURCES:
            raise gl.vm.UserError("Malformed prediction")
        if len(set(source_urls)) != len(source_urls):
            raise gl.vm.UserError("Malformed prediction")
        for source_url in source_urls:
            if not isinstance(source_url, str):
                raise gl.vm.UserError("Malformed prediction")
            if not any(source_url.startswith(origin) for origin in SOURCE_ORIGINS):
                raise gl.vm.UserError("Source is not allowed")

    def _validate_criteria(self, moment_type: str, criteria: dict) -> None:
        if moment_type == HOME_TEAM_SCORES_FIRST:
            if criteria.get("kind") != "FIRST_VALID_GOAL_TEAM":
                raise gl.vm.UserError("Malformed prediction")
            if criteria.get("finality") != "FIRST_VALID_GOAL_RECORDED":
                raise gl.vm.UserError("Malformed prediction")
            return
        if moment_type == BOTH_TEAMS_SCORE_FULL_TIME:
            if criteria.get("kind") != "BOTH_TEAMS_SCORED":
                raise gl.vm.UserError("Malformed prediction")
            if criteria.get("finality") != "TRUE_OR_MATCH_FINISHED":
                raise gl.vm.UserError("Malformed prediction")
            return
        if criteria.get("kind") != "EVENT_IN_MINUTE_RANGE":
            raise gl.vm.UserError("Malformed prediction")
        if criteria.get("event") != PENALTY_AWARDED:
            raise gl.vm.UserError("Malformed prediction")
        if criteria.get("finality") != "EVENT_OR_WINDOW_CLOSED":
            raise gl.vm.UserError("Malformed prediction")
        from_minute = criteria.get("from_minute")
        to_minute = criteria.get("to_minute")
        if not isinstance(from_minute, int) or not isinstance(to_minute, int):
            raise gl.vm.UserError("Malformed prediction")
        if from_minute < 0 or to_minute > 120 or from_minute >= to_minute:
            raise gl.vm.UserError("Malformed prediction")
