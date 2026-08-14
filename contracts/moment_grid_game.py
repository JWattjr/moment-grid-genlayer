# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Tier-weighted native-GEN pools and progressive jackpot for Moment Grid."""

from dataclasses import dataclass

from genlayer import *


OPEN = "OPEN"
SCORING = "SCORING"
SETTLED = "SETTLED"
REFUNDING = "REFUNDING"
CELLS = 9
OPTIONS_PER_CELL = 3
MINIMUM_ALLOWED_STAKE = 1_000_000_000_000_000_000
MAXIMUM_STAKE = 100_000_000_000_000_000_000
MAX_SETTLEMENT_BATCH = 100
HORIZONTAL_MASKS = [0x007, 0x038, 0x1C0]
DIAGONAL_MASKS = [0x111, 0x054]
LINE_MASKS = [0x007, 0x038, 0x1C0, 0x049, 0x092, 0x124, 0x111, 0x054]


@gl.evm.contract_interface
class NativeRecipient:
    class View:
        pass

    class Write:
        pass


@allow_storage
@dataclass
class GameRound:
    round_id: str
    match_id: str
    resolver_address: Address
    resolver_resolution_id: str
    status: str
    lock_at: str
    kickoff_at: str
    resolve_not_before: str
    refund_at: str
    minimum_participants: u256
    minimum_total_stake: u256
    minimum_unique_grids: u256
    unique_grid_count: u256
    participant_count: u256
    total_escrow: u256
    total_pool_stake: u256
    total_claimed: u256
    jackpot_seed: u256
    jackpot_pool: u256
    jackpot_winning_stake: u256
    jackpot_claimed_stake: u256
    jackpot_paid: u256
    jackpot_rolled_over: bool
    jackpot_rollover_destination: str
    revenue_pool: u256
    revenue_released: bool
    settlement_cursor: u256
    window_0_bitmap: u256
    window_1_bitmap: u256
    window_2_bitmap: u256
    window_0_valid_bitmap: u256
    window_1_valid_bitmap: u256
    window_2_valid_bitmap: u256
    resolution_accepted_at: str
    settled_at: str
    minimum_stake: u256


@allow_storage
@dataclass
class GridEntry:
    player: Address
    packed_grid: u256
    stake_amount: u256
    claimed: bool
    joined_at: str


def _now_seconds() -> str:
    value = str(gl.message_raw["datetime"])
    if len(value) < 19:
        raise gl.vm.UserError("Invalid network timestamp")
    return value[:19] + "Z"


def _valid_timestamp(value: str) -> bool:
    return (
        len(value) == 20
        and value[4] == "-"
        and value[7] == "-"
        and value[10] == "T"
        and value[13] == ":"
        and value[16] == ":"
        and value[19] == "Z"
    )


def _moment_at(packed_grid: u256, cell: int) -> int:
    return (int(packed_grid) >> (cell * 8)) & 0xFF


def _validate_grid(packed_grid: u256) -> None:
    if int(packed_grid) >> 72 != 0:
        raise gl.vm.UserError("Packed grid contains extra data")
    for cell in range(CELLS):
        moment_id = _moment_at(packed_grid, cell)
        first = cell * OPTIONS_PER_CELL + 1
        if moment_id < first or moment_id >= first + OPTIONS_PER_CELL:
            raise gl.vm.UserError("Moment is not valid for its grid cell")


def _cell_stake(stake_amount: u256, cell: int) -> u256:
    if cell < 3:
        return stake_amount * 5 // 100
    if cell < 6:
        return stake_amount * 10 // 100
    return stake_amount * 15 // 100


def _jackpot_contribution(stake_amount: u256) -> u256:
    return stake_amount * 5 // 100


def _pool_total(stake_amount: u256) -> u256:
    total = u256(0)
    for cell in range(CELLS):
        total += _cell_stake(stake_amount, cell)
    return total


def _score_grid(packed_grid: u256, windows: tuple) -> tuple:
    marked_mask = 0
    for cell in range(CELLS):
        moment_id = _moment_at(packed_grid, cell)
        if (int(windows[cell % 3]) & (1 << moment_id)) != 0:
            marked_mask |= 1 << cell
    completed_lines = 0
    for line_mask in LINE_MASKS:
        if (marked_mask & line_mask) == line_mask:
            completed_lines += 1
    return marked_mask, completed_lines


def _jackpot_qualifies(marked_mask: int) -> bool:
    horizontal = any((marked_mask & mask) == mask for mask in HORIZONTAL_MASKS)
    diagonal = any((marked_mask & mask) == mask for mask in DIAGONAL_MASKS)
    return horizontal and diagonal


class MomentGridGame(gl.Contract):
    owner: Address
    rounds: TreeMap[str, GameRound]
    round_ids: DynArray[str]
    round_indexes: TreeMap[str, u256]
    entries: TreeMap[str, GridEntry]
    indexed_entry_keys: TreeMap[str, str]
    cell_pools: TreeMap[str, u256]
    option_stakes: TreeMap[str, u256]
    winning_stakes: TreeMap[str, u256]
    claimed_winning_stakes: TreeMap[str, u256]
    paid_cell_pools: TreeMap[str, u256]
    refundable_stakes: TreeMap[str, u256]
    seen_grids: TreeMap[str, bool]
    jackpot_rollover: u256
    revenue_withdrawable: u256
    revenue_withdrawn: u256
    pending_owner: Address
    paused: bool

    def __init__(self):
        self.owner = gl.message.sender_address
        self.pending_owner = gl.message.sender_address
        self.paused = False
        self.jackpot_rollover = u256(0)
        self.revenue_withdrawable = u256(0)
        self.revenue_withdrawn = u256(0)

    @gl.public.write
    def create_round(
        self,
        round_id: str,
        match_id: str,
        resolver_address: Address,
        resolver_resolution_id: str,
        lock_at: str,
        kickoff_at: str,
        resolve_not_before: str,
        refund_at: str,
        minimum_stake: u256,
        minimum_participants: u256,
        minimum_total_stake: u256,
        minimum_unique_grids: u256,
    ) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may create rounds")
        if round_id in self.rounds:
            raise gl.vm.UserError("Round already exists")
        if any(len(value.strip()) == 0 for value in [round_id, match_id, resolver_resolution_id]):
            raise gl.vm.UserError("Malformed round")
        if self.paused:
            raise gl.vm.UserError("Contract is paused")
        if not all(
            _valid_timestamp(value)
            for value in [lock_at, kickoff_at, resolve_not_before, refund_at]
        ):
            raise gl.vm.UserError("Round timestamps must use YYYY-MM-DDTHH:MM:SSZ")
        if not (
            _now_seconds() < lock_at
            and lock_at < kickoff_at
            and kickoff_at <= resolve_not_before
            and resolve_not_before < refund_at
        ):
            raise gl.vm.UserError("Round timing is invalid")
        if minimum_stake < MINIMUM_ALLOWED_STAKE or minimum_stake > MAXIMUM_STAKE:
            raise gl.vm.UserError("Round stake floor is invalid")
        if minimum_participants < 2 or minimum_total_stake < minimum_stake * minimum_participants:
            raise gl.vm.UserError("Round liquidity floor is too low")
        if minimum_unique_grids < 2 or minimum_unique_grids > minimum_participants:
            raise gl.vm.UserError("Round grid diversity floor is invalid")

        jackpot_seed = self.jackpot_rollover
        self.jackpot_rollover = u256(0)
        self.rounds[round_id] = GameRound(
            round_id=round_id,
            match_id=match_id,
            resolver_address=resolver_address,
            resolver_resolution_id=resolver_resolution_id,
            status=OPEN,
            lock_at=lock_at,
            kickoff_at=kickoff_at,
            resolve_not_before=resolve_not_before,
            refund_at=refund_at,
            minimum_participants=minimum_participants,
            minimum_total_stake=minimum_total_stake,
            minimum_unique_grids=minimum_unique_grids,
            unique_grid_count=0,
            participant_count=0,
            total_escrow=0,
            total_pool_stake=0,
            total_claimed=0,
            jackpot_seed=jackpot_seed,
            jackpot_pool=jackpot_seed,
            jackpot_winning_stake=0,
            jackpot_claimed_stake=0,
            jackpot_paid=0,
            jackpot_rolled_over=False,
            jackpot_rollover_destination="",
            revenue_pool=0,
            revenue_released=False,
            settlement_cursor=0,
            window_0_bitmap=0,
            window_1_bitmap=0,
            window_2_bitmap=0,
            window_0_valid_bitmap=0,
            window_1_valid_bitmap=0,
            window_2_valid_bitmap=0,
            resolution_accepted_at="",
            settled_at="",
            minimum_stake=minimum_stake,
        )
        self.round_indexes[round_id] = u256(len(self.round_ids))
        self.round_ids.append(round_id)
        for cell in range(CELLS):
            cell_key = self._cell_key(round_id, cell)
            self.cell_pools[cell_key] = u256(0)
            self.winning_stakes[cell_key] = u256(0)
            self.claimed_winning_stakes[cell_key] = u256(0)
            self.paid_cell_pools[cell_key] = u256(0)
            self.refundable_stakes[cell_key] = u256(0)
            first = cell * OPTIONS_PER_CELL + 1
            for moment_id in range(first, first + OPTIONS_PER_CELL):
                self.option_stakes[self._option_key(round_id, cell, moment_id)] = u256(0)

    @gl.public.write.payable
    def join_round(self, round_id: str, packed_grid: u256) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round not found")
        if self.paused:
            raise gl.vm.UserError("Contract is paused")
        game_round = self.rounds[round_id]
        if game_round.status != OPEN or _now_seconds() >= game_round.lock_at:
            raise gl.vm.UserError("Round is locked")
        stake_amount = u256(gl.message.value)
        if stake_amount < game_round.minimum_stake:
            raise gl.vm.UserError("Stake is below this round's minimum")
        if stake_amount > MAXIMUM_STAKE:
            raise gl.vm.UserError("Maximum testnet stake is 100 GEN")
        _validate_grid(packed_grid)

        entry_key = self._entry_key(round_id, gl.message.sender_address)
        if entry_key in self.entries:
            raise gl.vm.UserError("Wallet already entered this round")
        self.entries[entry_key] = GridEntry(
            player=gl.message.sender_address,
            packed_grid=packed_grid,
            stake_amount=stake_amount,
            claimed=False,
            joined_at=_now_seconds(),
        )
        self.indexed_entry_keys[
            self._indexed_entry_key(round_id, int(game_round.participant_count))
        ] = entry_key
        game_round.participant_count += 1
        game_round.total_escrow += stake_amount
        grid_key = self._grid_key(round_id, packed_grid)
        if grid_key not in self.seen_grids:
            self.seen_grids[grid_key] = True
            game_round.unique_grid_count += 1

        pool_total = _pool_total(stake_amount)
        jackpot = _jackpot_contribution(stake_amount)
        revenue = stake_amount - pool_total - jackpot
        game_round.total_pool_stake += pool_total
        game_round.jackpot_pool += jackpot
        game_round.revenue_pool += revenue

        for cell in range(CELLS):
            cell_stake = _cell_stake(stake_amount, cell)
            moment_id = _moment_at(packed_grid, cell)
            cell_key = self._cell_key(round_id, cell)
            option_key = self._option_key(round_id, cell, moment_id)
            self.cell_pools[cell_key] += cell_stake
            self.option_stakes[option_key] += cell_stake

    @gl.public.write
    def accept_resolution(
        self,
        round_id: str,
        resolution_id: str,
        match_id: str,
        window_0_bitmap: u256,
        window_1_bitmap: u256,
        window_2_bitmap: u256,
        window_0_valid_bitmap: u256,
        window_1_valid_bitmap: u256,
        window_2_valid_bitmap: u256,
    ) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round not found")
        game_round = self.rounds[round_id]
        if game_round.status != OPEN:
            raise gl.vm.UserError("Round cannot be settled")
        if _now_seconds() < game_round.resolve_not_before:
            raise gl.vm.UserError("Resolution evidence window has not opened")
        if _now_seconds() >= game_round.refund_at:
            raise gl.vm.UserError("Resolution deadline has passed")
        if gl.message.sender_address != game_round.resolver_address:
            raise gl.vm.UserError("Only the configured resolver may settle")
        if resolution_id != game_round.resolver_resolution_id:
            raise gl.vm.UserError("Resolver resolution does not match round")
        if match_id != game_round.match_id:
            raise gl.vm.UserError("Resolver match does not match round")
        if not self._liquidity_ready(game_round):
            self._open_refunds(game_round)
            return

        game_round.window_0_bitmap = u256(int(window_0_bitmap) & int(window_0_valid_bitmap))
        game_round.window_1_bitmap = u256(int(window_1_bitmap) & int(window_1_valid_bitmap))
        game_round.window_2_bitmap = u256(int(window_2_bitmap) & int(window_2_valid_bitmap))
        game_round.window_0_valid_bitmap = window_0_valid_bitmap
        game_round.window_1_valid_bitmap = window_1_valid_bitmap
        game_round.window_2_valid_bitmap = window_2_valid_bitmap
        game_round.resolution_accepted_at = _now_seconds()
        windows = (
            game_round.window_0_bitmap,
            game_round.window_1_bitmap,
            game_round.window_2_bitmap,
        )
        valid_windows = (window_0_valid_bitmap, window_1_valid_bitmap, window_2_valid_bitmap)
        for cell in range(CELLS):
            total_winning_stake = u256(0)
            total_refundable_stake = u256(0)
            first = cell * OPTIONS_PER_CELL + 1
            for moment_id in range(first, first + OPTIONS_PER_CELL):
                option_stake = self.option_stakes[self._option_key(round_id, cell, moment_id)]
                if (int(valid_windows[cell % 3]) & (1 << moment_id)) == 0:
                    total_refundable_stake += option_stake
                if (int(windows[cell % 3]) & (1 << moment_id)) != 0:
                    total_winning_stake += option_stake
            self.winning_stakes[self._cell_key(round_id, cell)] = total_winning_stake
            self.refundable_stakes[self._cell_key(round_id, cell)] = total_refundable_stake

        game_round.status = SCORING
        if game_round.participant_count == 0:
            self._finish_settlement(game_round)

    @gl.public.write
    def process_settlement(self, round_id: str, max_entries: u256) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round not found")
        game_round = self.rounds[round_id]
        if game_round.status != SCORING:
            raise gl.vm.UserError("Round is not awaiting jackpot scoring")
        if max_entries == 0 or max_entries > MAX_SETTLEMENT_BATCH:
            raise gl.vm.UserError("Settlement batch must contain 1 to 100 entries")

        start = int(game_round.settlement_cursor)
        stop = min(start + int(max_entries), int(game_round.participant_count))
        windows = (
            game_round.window_0_bitmap,
            game_round.window_1_bitmap,
            game_round.window_2_bitmap,
        )
        for index in range(start, stop):
            entry_key = self.indexed_entry_keys[self._indexed_entry_key(round_id, index)]
            entry = self.entries[entry_key]
            marked_mask, _ = _score_grid(entry.packed_grid, windows)
            if _jackpot_qualifies(marked_mask):
                game_round.jackpot_winning_stake += entry.stake_amount

        game_round.settlement_cursor = u256(stop)
        if stop == int(game_round.participant_count):
            self._finish_settlement(game_round)

    @gl.public.write
    def activate_refunds(self, round_id: str) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round not found")
        game_round = self.rounds[round_id]
        if game_round.status not in [OPEN, SCORING]:
            raise gl.vm.UserError("Refunds cannot be activated")
        timed_out = _now_seconds() >= game_round.refund_at
        underfilled = _now_seconds() >= game_round.lock_at and not self._liquidity_ready(game_round)
        if not timed_out and not underfilled:
            raise gl.vm.UserError("Refund conditions have not been met")
        self._open_refunds(game_round)

    @gl.public.write
    def cancel_round(self, round_id: str) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may cancel a round")
        if round_id not in self.rounds or self.rounds[round_id].status != OPEN:
            raise gl.vm.UserError("Round cannot be cancelled")
        if _now_seconds() >= self.rounds[round_id].lock_at:
            raise gl.vm.UserError("Locked rounds cannot be owner-cancelled")
        self._open_refunds(self.rounds[round_id])

    @gl.public.write
    def set_paused(self, paused: bool) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may change pause state")
        self.paused = paused

    @gl.public.write
    def propose_owner(self, next_owner: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may propose ownership")
        self.pending_owner = next_owner

    @gl.public.write
    def accept_ownership(self) -> None:
        if gl.message.sender_address != self.pending_owner:
            raise gl.vm.UserError("Only the pending owner may accept ownership")
        self.owner = self.pending_owner

    @gl.public.write
    def claim(self, round_id: str) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round not found")
        game_round = self.rounds[round_id]
        if game_round.status not in [SETTLED, REFUNDING]:
            raise gl.vm.UserError("Claims are not open")
        entry_key = self._entry_key(round_id, gl.message.sender_address)
        if entry_key not in self.entries:
            raise gl.vm.UserError("Wallet did not enter this round")
        entry = self.entries[entry_key]
        if entry.claimed:
            raise gl.vm.UserError("Entry already claimed")

        payout = entry.stake_amount if game_round.status == REFUNDING else self._settled_claim(
            round_id, game_round, entry, True
        )
        entry.claimed = True
        game_round.total_claimed += payout
        liability = game_round.total_escrow if game_round.status == REFUNDING else (
            game_round.total_pool_stake
            + (game_round.jackpot_pool if game_round.jackpot_winning_stake > 0 else 0)
        )
        if game_round.total_claimed > liability:
            raise gl.vm.UserError("Payout exceeds player liability")
        if payout > 0:
            NativeRecipient(gl.message.sender_address).emit_transfer(value=payout)

    @gl.public.write
    def withdraw_revenue(self, amount: u256) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may withdraw revenue")
        if amount == 0 or amount > self.revenue_withdrawable:
            raise gl.vm.UserError("Revenue amount is not available")
        self.revenue_withdrawable -= amount
        self.revenue_withdrawn += amount
        NativeRecipient(self.owner).emit_transfer(value=amount)

    @gl.public.view
    def get_stake_quote(self, stake_amount: u256) -> dict:
        if stake_amount < MINIMUM_ALLOWED_STAKE:
            return {}
        common_per_cell = _cell_stake(stake_amount, 0)
        medium_per_cell = _cell_stake(stake_amount, 3)
        rare_per_cell = _cell_stake(stake_amount, 6)
        pool_total = _pool_total(stake_amount)
        jackpot = _jackpot_contribution(stake_amount)
        return {
            "stake_amount": stake_amount,
            "common_per_cell": common_per_cell,
            "medium_per_cell": medium_per_cell,
            "rare_per_cell": rare_per_cell,
            "pool_total": pool_total,
            "jackpot": jackpot,
            "revenue": stake_amount - pool_total - jackpot,
        }

    @gl.public.view
    def get_round(self, round_id: str) -> dict:
        if round_id not in self.rounds:
            return {}
        game_round = self.rounds[round_id]
        return {
            "round_id": game_round.round_id,
            "match_id": game_round.match_id,
            "resolver_address": str(game_round.resolver_address),
            "resolver_resolution_id": game_round.resolver_resolution_id,
            "status": game_round.status,
            "minimum_stake": game_round.minimum_stake,
            "maximum_stake": u256(MAXIMUM_STAKE),
            "lock_at": game_round.lock_at,
            "kickoff_at": game_round.kickoff_at,
            "resolve_not_before": game_round.resolve_not_before,
            "refund_at": game_round.refund_at,
            "minimum_participants": game_round.minimum_participants,
            "minimum_total_stake": game_round.minimum_total_stake,
            "minimum_unique_grids": game_round.minimum_unique_grids,
            "unique_grid_count": game_round.unique_grid_count,
            "liquidity_ready": self._liquidity_ready(game_round),
            "participant_count": game_round.participant_count,
            "total_escrow": game_round.total_escrow,
            "total_pool_stake": game_round.total_pool_stake,
            "total_claimed": game_round.total_claimed,
            "jackpot_seed": game_round.jackpot_seed,
            "jackpot_pool": game_round.jackpot_pool,
            "jackpot_winning_stake": game_round.jackpot_winning_stake,
            "jackpot_paid": game_round.jackpot_paid,
            "jackpot_rolled_over": game_round.jackpot_rolled_over,
            "jackpot_rollover_destination": game_round.jackpot_rollover_destination,
            "revenue_pool": game_round.revenue_pool,
            "settlement_cursor": game_round.settlement_cursor,
            "window_0_bitmap": game_round.window_0_bitmap,
            "window_1_bitmap": game_round.window_1_bitmap,
            "window_2_bitmap": game_round.window_2_bitmap,
            "window_0_valid_bitmap": game_round.window_0_valid_bitmap,
            "window_1_valid_bitmap": game_round.window_1_valid_bitmap,
            "window_2_valid_bitmap": game_round.window_2_valid_bitmap,
            "resolution_accepted_at": game_round.resolution_accepted_at,
            "settled_at": game_round.settled_at,
        }

    @gl.public.view
    def get_cell_pool(self, round_id: str, cell: u256) -> dict:
        if round_id not in self.rounds or cell >= CELLS:
            return {}
        cell_number = int(cell)
        first = cell_number * OPTIONS_PER_CELL + 1
        return {
            "cell": cell,
            "tier": "COMMON" if cell_number < 3 else ("MEDIUM" if cell_number < 6 else "RARE"),
            "total_pool": self.cell_pools[self._cell_key(round_id, cell_number)],
            "option_0_moment_id": u256(first),
            "option_0_stake": self.option_stakes[self._option_key(round_id, cell_number, first)],
            "option_1_moment_id": u256(first + 1),
            "option_1_stake": self.option_stakes[self._option_key(round_id, cell_number, first + 1)],
            "option_2_moment_id": u256(first + 2),
            "option_2_stake": self.option_stakes[self._option_key(round_id, cell_number, first + 2)],
            "winning_stake": self.winning_stakes[self._cell_key(round_id, cell_number)],
            "refundable_stake": self.refundable_stakes[self._cell_key(round_id, cell_number)],
            "paid": self.paid_cell_pools[self._cell_key(round_id, cell_number)],
        }

    @gl.public.view
    def get_entry(self, round_id: str, player: Address) -> dict:
        entry_key = self._entry_key(round_id, player)
        if entry_key not in self.entries:
            return {}
        entry = self.entries[entry_key]
        marked_mask = 0
        completed_lines = 0
        jackpot_qualified = False
        claimable = u256(0)
        if round_id in self.rounds:
            game_round = self.rounds[round_id]
            if game_round.status in [SCORING, SETTLED]:
                marked_mask, completed_lines = _score_grid(
                    entry.packed_grid,
                    (
                        game_round.window_0_bitmap,
                        game_round.window_1_bitmap,
                        game_round.window_2_bitmap,
                    ),
                )
                jackpot_qualified = _jackpot_qualifies(marked_mask)
                if game_round.status == SETTLED and not entry.claimed:
                    claimable = self._settled_claim(round_id, game_round, entry, False)
            elif game_round.status == REFUNDING and not entry.claimed:
                claimable = entry.stake_amount
        return {
            "player": str(entry.player),
            "packed_grid": entry.packed_grid,
            "stake_amount": entry.stake_amount,
            "claimed": entry.claimed,
            "joined_at": entry.joined_at,
            "marked_mask": u256(marked_mask),
            "completed_lines": u256(completed_lines),
            "jackpot_qualified": jackpot_qualified,
            "claimable": claimable,
        }

    @gl.public.view
    def get_entry_by_index(self, round_id: str, index: u256) -> dict:
        if round_id not in self.rounds or index >= self.rounds[round_id].participant_count:
            return {}
        entry_key = self.indexed_entry_keys[self._indexed_entry_key(round_id, int(index))]
        entry = self.entries[entry_key]
        return self.get_entry(round_id, entry.player)

    @gl.public.view
    def get_protocol_balances(self) -> dict:
        return {
            "jackpot_rollover": self.jackpot_rollover,
            "revenue_withdrawable": self.revenue_withdrawable,
            "revenue_withdrawn": self.revenue_withdrawn,
            "minimum_allowed_stake": u256(MINIMUM_ALLOWED_STAKE),
            "maximum_stake": u256(MAXIMUM_STAKE),
            "paused": self.paused,
            "owner": str(self.owner),
        }

    @gl.public.view
    def get_version(self) -> str:
        return "3.0.0"

    @gl.public.view
    def get_round_count(self) -> u256:
        return len(self.round_ids)

    @gl.public.view
    def get_round_id(self, index: u256) -> str:
        if index >= len(self.round_ids):
            raise gl.vm.UserError("Round index out of bounds")
        return self.round_ids[index]

    def _finish_settlement(self, game_round: GameRound) -> None:
        if game_round.jackpot_winning_stake == 0:
            round_index = int(self.round_indexes[game_round.round_id])
            if round_index + 1 < len(self.round_ids):
                next_round_id = self.round_ids[round_index + 1]
                next_round = self.rounds[next_round_id]
                if next_round.status == OPEN:
                    next_round.jackpot_seed += game_round.jackpot_pool
                    next_round.jackpot_pool += game_round.jackpot_pool
                    game_round.jackpot_rollover_destination = next_round_id
                else:
                    self.jackpot_rollover += game_round.jackpot_pool
                    game_round.jackpot_rollover_destination = "GLOBAL_NEXT_CREATED"
            else:
                self.jackpot_rollover += game_round.jackpot_pool
                game_round.jackpot_rollover_destination = "GLOBAL_NEXT_CREATED"
            game_round.jackpot_rolled_over = True
        self.revenue_withdrawable += game_round.revenue_pool
        game_round.revenue_released = True
        game_round.status = SETTLED
        game_round.settled_at = _now_seconds()

    def _open_refunds(self, game_round: GameRound) -> None:
        if game_round.jackpot_seed > 0:
            self.jackpot_rollover += game_round.jackpot_seed
            game_round.jackpot_pool -= game_round.jackpot_seed
            game_round.jackpot_seed = u256(0)
        game_round.status = REFUNDING

    def _settled_claim(
        self,
        round_id: str,
        game_round: GameRound,
        entry: GridEntry,
        apply: bool,
    ) -> u256:
        payout = u256(0)
        windows = (
            game_round.window_0_bitmap,
            game_round.window_1_bitmap,
            game_round.window_2_bitmap,
        )
        valid_windows = (
            game_round.window_0_valid_bitmap,
            game_round.window_1_valid_bitmap,
            game_round.window_2_valid_bitmap,
        )
        marked_mask, _ = _score_grid(entry.packed_grid, windows)
        for cell in range(CELLS):
            cell_key = self._cell_key(round_id, cell)
            pool = self.cell_pools[cell_key]
            distributable_pool = pool - self.refundable_stakes[cell_key]
            winners = self.winning_stakes[cell_key]
            entry_cell_stake = _cell_stake(entry.stake_amount, cell)
            moment_id = _moment_at(entry.packed_grid, cell)
            if (int(valid_windows[cell % 3]) & (1 << moment_id)) == 0:
                payout += entry_cell_stake
                continue
            if winners == 0:
                payout += entry_cell_stake
                continue
            if (int(windows[cell % 3]) & (1 << moment_id)) == 0:
                continue
            claimed_stake = self.claimed_winning_stakes[cell_key]
            paid = self.paid_cell_pools[cell_key]
            next_claimed_stake = claimed_stake + entry_cell_stake
            if next_claimed_stake > winners:
                raise gl.vm.UserError("Winning stake accounting exceeded")
            cell_payout = distributable_pool - paid if next_claimed_stake == winners else (
                distributable_pool * entry_cell_stake // winners
            )
            payout += cell_payout
            if apply:
                self.claimed_winning_stakes[cell_key] = next_claimed_stake
                self.paid_cell_pools[cell_key] = paid + cell_payout

        if _jackpot_qualifies(marked_mask) and game_round.jackpot_winning_stake > 0:
            next_jackpot_stake = game_round.jackpot_claimed_stake + entry.stake_amount
            if next_jackpot_stake > game_round.jackpot_winning_stake:
                raise gl.vm.UserError("Jackpot stake accounting exceeded")
            jackpot_payout = (
                game_round.jackpot_pool - game_round.jackpot_paid
                if next_jackpot_stake == game_round.jackpot_winning_stake
                else game_round.jackpot_pool * entry.stake_amount // game_round.jackpot_winning_stake
            )
            payout += jackpot_payout
            if apply:
                game_round.jackpot_claimed_stake = next_jackpot_stake
                game_round.jackpot_paid += jackpot_payout
        return payout

    def _entry_key(self, round_id: str, player: Address) -> str:
        return round_id + "|" + str(player).lower()

    def _indexed_entry_key(self, round_id: str, index: int) -> str:
        return round_id + "|i|" + str(index)

    def _cell_key(self, round_id: str, cell: int) -> str:
        return round_id + "|c|" + str(cell)

    def _option_key(self, round_id: str, cell: int, moment_id: int) -> str:
        return round_id + "|c|" + str(cell) + "|m|" + str(moment_id)

    def _grid_key(self, round_id: str, packed_grid: u256) -> str:
        return round_id + "|g|" + str(packed_grid)

    def _liquidity_ready(self, game_round: GameRound) -> bool:
        return (
            game_round.participant_count >= game_round.minimum_participants
            and game_round.total_escrow >= game_round.minimum_total_stake
            and game_round.unique_grid_count >= game_round.minimum_unique_grids
        )
