# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Nine-pool, native-GEN escrow and payout contract for Moment Grid."""

from dataclasses import dataclass

from genlayer import *


OPEN = "OPEN"
SETTLED = "SETTLED"
REFUNDING = "REFUNDING"
CELLS = 9
OPTIONS_PER_CELL = 3
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
    entry_fee: u256
    stake_per_cell: u256
    lock_at: str
    refund_at: str
    participant_count: u256
    total_escrow: u256
    total_claimed: u256
    window_0_bitmap: u256
    window_1_bitmap: u256
    window_2_bitmap: u256
    settled_at: str


@allow_storage
@dataclass
class GridEntry:
    packed_grid: u256
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


class MomentGridGame(gl.Contract):
    owner: Address
    rounds: TreeMap[str, GameRound]
    round_ids: DynArray[str]
    entries: TreeMap[str, GridEntry]
    cell_pools: TreeMap[str, u256]
    option_stakes: TreeMap[str, u256]
    winning_stakes: TreeMap[str, u256]
    claimed_winning_stakes: TreeMap[str, u256]
    paid_cell_pools: TreeMap[str, u256]

    def __init__(self):
        self.owner = gl.message.sender_address

    @gl.public.write
    def create_round(
        self,
        round_id: str,
        match_id: str,
        resolver_address: Address,
        resolver_resolution_id: str,
        entry_fee: u256,
        lock_at: str,
        refund_at: str,
    ) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may create rounds")
        if round_id in self.rounds:
            raise gl.vm.UserError("Round already exists")
        if any(len(value.strip()) == 0 for value in [round_id, match_id, resolver_resolution_id]):
            raise gl.vm.UserError("Malformed round")
        if entry_fee == 0 or entry_fee % CELLS != 0:
            raise gl.vm.UserError("Entry fee must be positive and divisible by nine")
        if not _valid_timestamp(lock_at) or not _valid_timestamp(refund_at):
            raise gl.vm.UserError("Round timestamps must use YYYY-MM-DDTHH:MM:SSZ")
        if _now_seconds() >= lock_at or lock_at >= refund_at:
            raise gl.vm.UserError("Round timing is invalid")

        self.rounds[round_id] = GameRound(
            round_id=round_id,
            match_id=match_id,
            resolver_address=resolver_address,
            resolver_resolution_id=resolver_resolution_id,
            status=OPEN,
            entry_fee=entry_fee,
            stake_per_cell=entry_fee // CELLS,
            lock_at=lock_at,
            refund_at=refund_at,
            participant_count=0,
            total_escrow=0,
            total_claimed=0,
            window_0_bitmap=0,
            window_1_bitmap=0,
            window_2_bitmap=0,
            settled_at="",
        )
        self.round_ids.append(round_id)
        for cell in range(CELLS):
            cell_key = self._cell_key(round_id, cell)
            self.cell_pools[cell_key] = u256(0)
            self.winning_stakes[cell_key] = u256(0)
            self.claimed_winning_stakes[cell_key] = u256(0)
            self.paid_cell_pools[cell_key] = u256(0)
            first = cell * OPTIONS_PER_CELL + 1
            for moment_id in range(first, first + OPTIONS_PER_CELL):
                self.option_stakes[self._option_key(round_id, cell, moment_id)] = u256(0)

    @gl.public.write.payable
    def join_round(self, round_id: str, packed_grid: u256) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round not found")
        game_round = self.rounds[round_id]
        if game_round.status != OPEN or _now_seconds() >= game_round.lock_at:
            raise gl.vm.UserError("Round is locked")
        if gl.message.value != game_round.entry_fee:
            raise gl.vm.UserError("Exact entry fee required")
        _validate_grid(packed_grid)

        entry_key = self._entry_key(round_id, gl.message.sender_address)
        if entry_key in self.entries:
            raise gl.vm.UserError("Wallet already entered this round")
        self.entries[entry_key] = GridEntry(
            packed_grid=packed_grid,
            claimed=False,
            joined_at=_now_seconds(),
        )
        game_round.participant_count += 1
        game_round.total_escrow += game_round.entry_fee

        for cell in range(CELLS):
            moment_id = _moment_at(packed_grid, cell)
            cell_key = self._cell_key(round_id, cell)
            option_key = self._option_key(round_id, cell, moment_id)
            self.cell_pools[cell_key] += game_round.stake_per_cell
            self.option_stakes[option_key] += game_round.stake_per_cell

    @gl.public.write
    def accept_resolution(
        self,
        round_id: str,
        resolution_id: str,
        match_id: str,
        window_0_bitmap: u256,
        window_1_bitmap: u256,
        window_2_bitmap: u256,
    ) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round not found")
        game_round = self.rounds[round_id]
        if game_round.status != OPEN:
            raise gl.vm.UserError("Round cannot be settled")
        if _now_seconds() < game_round.lock_at:
            raise gl.vm.UserError("Round is not locked yet")
        if gl.message.sender_address != game_round.resolver_address:
            raise gl.vm.UserError("Only the configured resolver may settle")
        if resolution_id != game_round.resolver_resolution_id:
            raise gl.vm.UserError("Resolver resolution does not match round")
        if match_id != game_round.match_id:
            raise gl.vm.UserError("Resolver match does not match round")

        self._apply_resolution(
            round_id,
            window_0_bitmap,
            window_1_bitmap,
            window_2_bitmap,
        )

    def _apply_resolution(
        self,
        round_id: str,
        window_0_bitmap: u256,
        window_1_bitmap: u256,
        window_2_bitmap: u256,
    ) -> None:
        game_round = self.rounds[round_id]
        game_round.window_0_bitmap = window_0_bitmap
        game_round.window_1_bitmap = window_1_bitmap
        game_round.window_2_bitmap = window_2_bitmap
        windows = (
            game_round.window_0_bitmap,
            game_round.window_1_bitmap,
            game_round.window_2_bitmap,
        )
        for cell in range(CELLS):
            total_winning_stake = u256(0)
            first = cell * OPTIONS_PER_CELL + 1
            for moment_id in range(first, first + OPTIONS_PER_CELL):
                if (int(windows[cell % 3]) & (1 << moment_id)) != 0:
                    total_winning_stake += self.option_stakes[
                        self._option_key(round_id, cell, moment_id)
                    ]
            self.winning_stakes[self._cell_key(round_id, cell)] = total_winning_stake

        game_round.status = SETTLED
        game_round.settled_at = _now_seconds()

    @gl.public.write
    def activate_refunds(self, round_id: str) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError("Round not found")
        game_round = self.rounds[round_id]
        if game_round.status != OPEN:
            raise gl.vm.UserError("Refunds cannot be activated")
        if _now_seconds() < game_round.refund_at:
            raise gl.vm.UserError("Refund time has not arrived")
        game_round.status = REFUNDING

    @gl.public.write
    def cancel_round(self, round_id: str) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner may cancel a round")
        if round_id not in self.rounds or self.rounds[round_id].status != OPEN:
            raise gl.vm.UserError("Round cannot be cancelled")
        self.rounds[round_id].status = REFUNDING

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

        payout = game_round.entry_fee if game_round.status == REFUNDING else self._settled_claim(
            round_id, game_round, entry.packed_grid, True
        )
        entry.claimed = True
        game_round.total_claimed += payout
        if game_round.total_claimed > game_round.total_escrow:
            raise gl.vm.UserError("Payout exceeds escrow")
        if payout > 0:
            NativeRecipient(gl.message.sender_address).emit_transfer(value=payout)

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
            "entry_fee": game_round.entry_fee,
            "stake_per_cell": game_round.stake_per_cell,
            "lock_at": game_round.lock_at,
            "refund_at": game_round.refund_at,
            "participant_count": game_round.participant_count,
            "total_escrow": game_round.total_escrow,
            "total_claimed": game_round.total_claimed,
            "window_0_bitmap": game_round.window_0_bitmap,
            "window_1_bitmap": game_round.window_1_bitmap,
            "window_2_bitmap": game_round.window_2_bitmap,
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
            "total_pool": self.cell_pools[self._cell_key(round_id, cell_number)],
            "option_0_moment_id": u256(first),
            "option_0_stake": self.option_stakes[self._option_key(round_id, cell_number, first)],
            "option_1_moment_id": u256(first + 1),
            "option_1_stake": self.option_stakes[self._option_key(round_id, cell_number, first + 1)],
            "option_2_moment_id": u256(first + 2),
            "option_2_stake": self.option_stakes[self._option_key(round_id, cell_number, first + 2)],
            "winning_stake": self.winning_stakes[self._cell_key(round_id, cell_number)],
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
        claimable = u256(0)
        if round_id in self.rounds:
            game_round = self.rounds[round_id]
            if game_round.status == SETTLED:
                marked_mask, completed_lines = _score_grid(
                    entry.packed_grid,
                    (
                        game_round.window_0_bitmap,
                        game_round.window_1_bitmap,
                        game_round.window_2_bitmap,
                    ),
                )
                if not entry.claimed:
                    claimable = self._settled_claim(round_id, game_round, entry.packed_grid, False)
            elif game_round.status == REFUNDING and not entry.claimed:
                claimable = game_round.entry_fee
        return {
            "packed_grid": entry.packed_grid,
            "claimed": entry.claimed,
            "joined_at": entry.joined_at,
            "marked_mask": u256(marked_mask),
            "completed_lines": u256(completed_lines),
            "claimable": claimable,
        }

    @gl.public.view
    def get_round_count(self) -> u256:
        return len(self.round_ids)

    @gl.public.view
    def get_round_id(self, index: u256) -> str:
        if index >= len(self.round_ids):
            raise gl.vm.UserError("Round index out of bounds")
        return self.round_ids[index]

    def _settled_claim(
        self,
        round_id: str,
        game_round: GameRound,
        packed_grid: u256,
        apply: bool,
    ) -> u256:
        payout = u256(0)
        windows = (
            game_round.window_0_bitmap,
            game_round.window_1_bitmap,
            game_round.window_2_bitmap,
        )
        for cell in range(CELLS):
            cell_key = self._cell_key(round_id, cell)
            pool = self.cell_pools[cell_key]
            winners = self.winning_stakes[cell_key]
            if winners == 0:
                payout += game_round.stake_per_cell
                continue
            moment_id = _moment_at(packed_grid, cell)
            if (int(windows[cell % 3]) & (1 << moment_id)) == 0:
                continue
            claimed_stake = self.claimed_winning_stakes[cell_key]
            paid = self.paid_cell_pools[cell_key]
            next_claimed_stake = claimed_stake + game_round.stake_per_cell
            if next_claimed_stake > winners:
                raise gl.vm.UserError("Winning stake accounting exceeded")
            if next_claimed_stake == winners:
                cell_payout = pool - paid
            else:
                cell_payout = pool * game_round.stake_per_cell // winners
            payout += cell_payout
            if apply:
                self.claimed_winning_stakes[cell_key] = next_claimed_stake
                self.paid_cell_pools[cell_key] = paid + cell_payout
        return payout

    def _entry_key(self, round_id: str, player: Address) -> str:
        return round_id + "|" + str(player).lower()

    def _cell_key(self, round_id: str, cell: int) -> str:
        return round_id + "|c|" + str(cell)

    def _option_key(self, round_id: str, cell: int, moment_id: int) -> str:
        return round_id + "|c|" + str(cell) + "|m|" + str(moment_id)
