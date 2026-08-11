# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Resolve every Moment Grid cell from one validator-consensus match record."""

import json
from dataclasses import dataclass

from genlayer import *


PENDING = "PENDING"
SETTLED = "SETTLED"
INVALID = "INVALID"
FINAL = "FINAL"
UNKNOWN = "UNKNOWN"

SOURCE_ORIGINS = [
    "https://www.bbc.co.uk/",
    "https://www.espn.co.uk/",
    "https://www.espn.com/",
    "https://www.thesportsdb.com/",
]
MIN_SOURCES = 2
MAX_SOURCES = 3
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


@gl.contract_interface
class MomentGridSettlementInterface:
    class View:
        pass

    class Write:
        def accept_resolution(
            self,
            round_id: str,
            resolution_id: str,
            match_id: str,
            window_0_bitmap: u256,
            window_1_bitmap: u256,
            window_2_bitmap: u256,
        ) -> None: ...


@allow_storage
@dataclass
class RoundResolution:
    resolution_id: str
    match_id: str
    home_team: str
    away_team: str
    competition: str
    match_date: str
    source_urls_json: str
    settlement_target: Address
    settlement_round_id: str
    status: str
    reason_code: str
    match_status: str
    window_0_bitmap: u256
    window_1_bitmap: u256
    window_2_bitmap: u256
    evidence_summary: str
    source_references_json: str
    resolved_at: str
    attempt_count: u256


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


def _minute(value) -> int:
    if not isinstance(value, int) or value < 0 or value > 130:
        raise gl.vm.UserError("Malformed evidence extraction")
    return value


def _count(value, maximum: int = 200) -> int:
    if not isinstance(value, int) or value < 0 or value > maximum:
        raise gl.vm.UserError("Malformed evidence extraction")
    return value


def _minutes(raw: dict, field: str) -> list:
    values = raw.get(field)
    if not isinstance(values, list):
        raise gl.vm.UserError("Malformed evidence extraction")
    normalized = [_minute(value) for value in values]
    return sorted(set(normalized))


def _goals(raw: dict) -> list:
    values = raw.get("goals")
    if not isinstance(values, list):
        raise gl.vm.UserError("Malformed evidence extraction")
    normalized = []
    seen = set()
    for value in values:
        if not isinstance(value, dict):
            raise gl.vm.UserError("Malformed evidence extraction")
        team = str(value.get("team", "")).upper()
        substitute = value.get("substitute")
        if team not in ["HOME", "AWAY"] or not isinstance(substitute, bool):
            raise gl.vm.UserError("Malformed evidence extraction")
        goal = (_minute(value.get("minute")), team, substitute)
        if goal not in seen:
            normalized.append(goal)
            seen.add(goal)
    return sorted(normalized, key=lambda goal: (goal[0], goal[1]))


def _normalize_facts(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise gl.vm.UserError("Malformed evidence extraction")
    match_status = str(raw.get("match_status", "")).upper()
    summary = str(raw.get("evidence_summary", "")).strip()
    if match_status not in [FINAL, "LIVE", "SCHEDULED", UNKNOWN]:
        raise gl.vm.UserError("Malformed evidence extraction")
    if not isinstance(raw.get("identity_confirmed"), bool):
        raise gl.vm.UserError("Malformed evidence extraction")
    if not isinstance(raw.get("source_conflict"), bool):
        raise gl.vm.UserError("Malformed evidence extraction")
    if not isinstance(raw.get("went_to_extra_time"), bool) or len(summary) == 0:
        raise gl.vm.UserError("Malformed evidence extraction")

    return {
        "identity_confirmed": raw["identity_confirmed"],
        "source_conflict": raw["source_conflict"],
        "match_status": match_status,
        "home_shots_by_30": _count(raw.get("home_shots_by_30")),
        "goals": _goals(raw),
        "corner_minutes": _minutes(raw, "corner_minutes"),
        "yellow_card_minutes": _minutes(raw, "yellow_card_minutes"),
        "red_card_minutes": _minutes(raw, "red_card_minutes"),
        "substitution_minutes": _minutes(raw, "substitution_minutes"),
        "var_review_minutes": _minutes(raw, "var_review_minutes"),
        "overturned_goal_minutes": _minutes(raw, "overturned_goal_minutes"),
        "penalty_minutes": _minutes(raw, "penalty_minutes"),
        "went_to_extra_time": raw["went_to_extra_time"],
        "evidence_summary": summary[:480],
    }


def _bit(bitmap: int, moment_id: int, condition: bool) -> int:
    if condition:
        return bitmap | (1 << moment_id)
    return bitmap


def _derive_bitmaps(facts: dict) -> tuple:
    goals = facts["goals"]
    goal_minutes = [goal[0] for goal in goals]
    home_goal_minutes = [goal[0] for goal in goals if goal[1] == "HOME"]
    away_goal_minutes = [goal[0] for goal in goals if goal[1] == "AWAY"]
    substitute_goal_minutes = [goal[0] for goal in goals if goal[2]]
    cards = facts["yellow_card_minutes"] + facts["red_card_minutes"]
    corners = facts["corner_minutes"]
    substitutions = facts["substitution_minutes"]
    penalties = facts["penalty_minutes"]
    var_reviews = facts["var_review_minutes"]
    overturned = facts["overturned_goal_minutes"]

    window_0 = 0
    window_1 = 0
    window_2 = 0

    window_0 = _bit(window_0, 1, facts["home_shots_by_30"] >= 2)
    window_0 = _bit(window_0, 2, any(minute < 30 for minute in goal_minutes))
    window_0 = _bit(window_0, 3, len([m for m in corners if m < 30]) >= 2)
    window_1 = _bit(window_1, 4, any(30 <= m < 60 for m in cards))
    window_1 = _bit(window_1, 5, any(30 <= m < 60 for m in goal_minutes))
    window_1 = _bit(window_1, 6, len([m for m in substitutions if m < 60]) >= 2)
    window_2 = _bit(window_2, 7, len([m for m in substitutions if m >= 60]) >= 2)
    window_2 = _bit(window_2, 8, any(m >= 75 for m in cards))
    window_2 = _bit(window_2, 9, len([m for m in corners if m >= 60]) >= 2)

    window_0 = _bit(window_0, 10, len(goals) > 0 and goals[0][1] == "HOME")
    window_0 = _bit(window_0, 11, any(m < 20 for m in goal_minutes))
    window_0 = _bit(window_0, 12, any(m < 30 for m in facts["yellow_card_minutes"]))
    window_1 = _bit(window_1, 13, any(30 <= m < 60 for m in var_reviews))
    window_1 = _bit(
        window_1,
        14,
        any(m < 60 for m in home_goal_minutes)
        and any(m < 60 for m in away_goal_minutes),
    )
    window_1 = _bit(window_1, 15, len([m for m in goal_minutes if m < 60]) >= 2)
    window_2 = _bit(window_2, 16, len(home_goal_minutes) > 0 and len(away_goal_minutes) > 0)
    window_2 = _bit(window_2, 17, len(cards) > 4)
    window_2 = _bit(window_2, 18, any(m >= 75 for m in goal_minutes))

    window_0 = _bit(window_0, 19, any(m < 30 for m in penalties))
    window_0 = _bit(
        window_0,
        20,
        len([m for m in away_goal_minutes if m < 30])
        > len([m for m in home_goal_minutes if m < 30]),
    )
    window_0 = _bit(window_0, 21, any(m < 30 for m in overturned))
    window_1 = _bit(window_1, 22, any(30 <= m < 60 for m in penalties))
    window_1 = _bit(window_1, 23, any(m < 60 for m in substitute_goal_minutes))
    window_1 = _bit(window_1, 24, len([m for m in goal_minutes if m < 60]) >= 3)
    window_2 = _bit(window_2, 25, any(m >= 80 for m in goal_minutes))
    window_2 = _bit(window_2, 26, any(m >= 60 for m in substitute_goal_minutes))
    window_2 = _bit(window_2, 27, facts["went_to_extra_time"])

    return window_0, window_1, window_2


def _invalid(reason_code: str, summary: str, urls: list, match_status: str = UNKNOWN) -> dict:
    return {
        "status": INVALID,
        "reason_code": reason_code,
        "match_status": match_status,
        "window_0_bitmap": 0,
        "window_1_bitmap": 0,
        "window_2_bitmap": 0,
        "evidence_summary": summary[:480],
        "source_references_json": json.dumps(urls),
    }


def _adjudicate(round_input: dict) -> dict:
    source_urls = json.loads(round_input["source_urls_json"])
    source_sections = []
    available_urls = []
    for index, source_url in enumerate(source_urls):
        try:
            response = gl.nondet.web.get(source_url)
        except Exception:
            continue
        if response.status >= 400 or response.body is None:
            continue
        source_sections.append(
            f"SOURCE {index + 1}\nURL: {source_url}\nCONTENT:\n"
            + _bounded_excerpt(response.body.decode("utf-8"))
        )
        available_urls.append(source_url)

    if len(source_sections) < MIN_SOURCES:
        return _invalid(
            "SOURCE_UNAVAILABLE",
            "Fewer than two configured authoritative sources were available.",
            available_urls,
        )

    evidence = "\n\n".join(source_sections)
    prompt = f"""
Extract the final objective football events for this exact match from the
authoritative excerpts. Do not guess missing facts. Count only valid goals;
list disallowed goals separately. Convert stoppage times to sortable integers
(45+2 becomes 47; 90+3 becomes 93). A substitute goal is a valid goal scored by
a player who entered as a substitute. Set source_conflict true when sources
materially disagree on any fact needed below.

Match id: {round_input["match_id"]}
Competition: {round_input["competition"]}
Date: {round_input["match_date"]}
Home team: {round_input["home_team"]}
Away team: {round_input["away_team"]}

Evidence:
{evidence}

Return only JSON with exactly these fields:
{{
  "identity_confirmed": true | false,
  "source_conflict": true | false,
  "match_status": "FINAL" | "LIVE" | "SCHEDULED" | "UNKNOWN",
  "home_shots_by_30": integer,
  "goals": [{{"minute": integer, "team": "HOME" | "AWAY", "substitute": true | false}}],
  "corner_minutes": [integers],
  "yellow_card_minutes": [integers],
  "red_card_minutes": [integers],
  "substitution_minutes": [integers],
  "var_review_minutes": [integers],
  "overturned_goal_minutes": [integers],
  "penalty_minutes": [integers for penalties awarded],
  "went_to_extra_time": true | false,
  "evidence_summary": "one concise source-grounded summary"
}}
"""
    raw = gl.nondet.exec_prompt(prompt, response_format="json")
    facts = _normalize_facts(raw)
    if not facts["identity_confirmed"]:
        return _invalid("MATCH_NOT_FOUND", facts["evidence_summary"], available_urls, facts["match_status"])
    if facts["source_conflict"]:
        return _invalid("CONFLICTING_SOURCES", facts["evidence_summary"], available_urls, facts["match_status"])
    if facts["match_status"] != FINAL:
        return _invalid("MATCH_NOT_FINAL", facts["evidence_summary"], available_urls, facts["match_status"])

    bitmaps = _derive_bitmaps(facts)
    return {
        "status": SETTLED,
        "reason_code": "FINAL_FACTS_AGREED",
        "match_status": FINAL,
        "window_0_bitmap": bitmaps[0],
        "window_1_bitmap": bitmaps[1],
        "window_2_bitmap": bitmaps[2],
        "evidence_summary": facts["evidence_summary"],
        "source_references_json": json.dumps(available_urls),
    }


class MatchRoundResolver(gl.Contract):
    owner: Address
    resolutions: TreeMap[str, RoundResolution]
    resolution_ids: DynArray[str]

    def __init__(self):
        self.owner = gl.message.sender_address

    @gl.public.write
    def register_round(
        self,
        resolution_id: str,
        match_id: str,
        home_team: str,
        away_team: str,
        competition: str,
        match_date: str,
        source_urls_json: str,
        settlement_target: Address,
        settlement_round_id: str,
    ) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may register rounds")
        self._validate_registration(
            resolution_id,
            match_id,
            home_team,
            away_team,
            competition,
            match_date,
            source_urls_json,
            settlement_round_id,
        )
        if resolution_id in self.resolutions:
            raise gl.vm.UserError("Round resolution already registered")
        self.resolutions[resolution_id] = RoundResolution(
            resolution_id=resolution_id,
            match_id=match_id,
            home_team=home_team,
            away_team=away_team,
            competition=competition,
            match_date=match_date,
            source_urls_json=source_urls_json,
            settlement_target=settlement_target,
            settlement_round_id=settlement_round_id,
            status=PENDING,
            reason_code="",
            match_status=UNKNOWN,
            window_0_bitmap=0,
            window_1_bitmap=0,
            window_2_bitmap=0,
            evidence_summary="",
            source_references_json="[]",
            resolved_at="",
            attempt_count=0,
        )
        self.resolution_ids.append(resolution_id)

    @gl.public.write
    def resolve_round(self, resolution_id: str) -> None:
        if resolution_id not in self.resolutions:
            raise gl.vm.UserError("Round resolution not found")
        resolution = self.resolutions[resolution_id]
        if resolution.status == SETTLED:
            raise gl.vm.UserError("Round resolution already settled")

        round_input = {
            "match_id": resolution.match_id,
            "home_team": resolution.home_team,
            "away_team": resolution.away_team,
            "competition": resolution.competition,
            "match_date": resolution.match_date,
            "source_urls_json": resolution.source_urls_json,
        }

        def leader_fn() -> dict:
            return _adjudicate(round_input)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                validator = leader_fn()
                leader = leader_result.calldata
                return (
                    leader["status"] == validator["status"]
                    and leader["reason_code"] == validator["reason_code"]
                    and leader["match_status"] == validator["match_status"]
                    and leader["window_0_bitmap"] == validator["window_0_bitmap"]
                    and leader["window_1_bitmap"] == validator["window_1_bitmap"]
                    and leader["window_2_bitmap"] == validator["window_2_bitmap"]
                )
            except Exception:
                return False

        adjudication = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        resolution.attempt_count += 1
        resolution.reason_code = adjudication["reason_code"]
        resolution.match_status = adjudication["match_status"]
        resolution.evidence_summary = adjudication["evidence_summary"]
        resolution.source_references_json = adjudication["source_references_json"]
        if adjudication["status"] == SETTLED:
            resolution.status = SETTLED
            resolution.window_0_bitmap = u256(adjudication["window_0_bitmap"])
            resolution.window_1_bitmap = u256(adjudication["window_1_bitmap"])
            resolution.window_2_bitmap = u256(adjudication["window_2_bitmap"])
            resolution.resolved_at = str(gl.message_raw["datetime"])
            self._dispatch_resolution(resolution)

    @gl.public.write
    def dispatch_resolution(self, resolution_id: str) -> None:
        if resolution_id not in self.resolutions:
            raise gl.vm.UserError("Round resolution not found")
        resolution = self.resolutions[resolution_id]
        if resolution.status != SETTLED:
            raise gl.vm.UserError("Round resolution is not settled")
        self._dispatch_resolution(resolution)

    @gl.public.view
    def get_round_resolution(self, resolution_id: str) -> dict:
        if resolution_id not in self.resolutions:
            return {}
        resolution = self.resolutions[resolution_id]
        return {
            "resolution_id": resolution.resolution_id,
            "match_id": resolution.match_id,
            "settlement_target": str(resolution.settlement_target),
            "settlement_round_id": resolution.settlement_round_id,
            "status": resolution.status,
            "reason_code": resolution.reason_code,
            "match_status": resolution.match_status,
            "window_0_bitmap": resolution.window_0_bitmap,
            "window_1_bitmap": resolution.window_1_bitmap,
            "window_2_bitmap": resolution.window_2_bitmap,
            "evidence_summary": resolution.evidence_summary,
            "source_references_json": resolution.source_references_json,
            "resolved_at": resolution.resolved_at,
            "attempt_count": resolution.attempt_count,
        }

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
        source_urls_json: str,
        settlement_round_id: str,
    ) -> None:
        required = [resolution_id, match_id, home_team, away_team, competition, match_date, settlement_round_id]
        if any(len(value.strip()) == 0 for value in required):
            raise gl.vm.UserError("Malformed round")
        if len(match_date) != 10 or match_date[4] != "-" or match_date[7] != "-":
            raise gl.vm.UserError("Malformed round")
        try:
            source_urls = json.loads(source_urls_json)
        except Exception:
            raise gl.vm.UserError("Malformed round")
        if not isinstance(source_urls, list) or len(source_urls) < MIN_SOURCES or len(source_urls) > MAX_SOURCES:
            raise gl.vm.UserError("Malformed round")
        if len(set(source_urls)) != len(source_urls):
            raise gl.vm.UserError("Malformed round")
        for source_url in source_urls:
            if not isinstance(source_url, str):
                raise gl.vm.UserError("Malformed round")
            if not any(source_url.startswith(origin) for origin in SOURCE_ORIGINS):
                raise gl.vm.UserError("Source is not allowed")

    def _dispatch_resolution(self, resolution: RoundResolution) -> None:
        if str(resolution.settlement_target).lower() == ZERO_ADDRESS:
            return
        target = MomentGridSettlementInterface(resolution.settlement_target)
        target.emit(on="finalized").accept_resolution(
            resolution.settlement_round_id,
            resolution.resolution_id,
            resolution.match_id,
            resolution.window_0_bitmap,
            resolution.window_1_bitmap,
            resolution.window_2_bitmap,
        )
