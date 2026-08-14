"""Direct-mode coverage for tiered pools, jackpot accounting, and refunds."""

import pytest


CONTRACT = "contracts/moment_grid_game.py"
ROUND_ID = "round-1"
MATCH_ID = "match-1"
RESOLUTION_ID = "resolution-1"
GEN = 10**18
MINIMUM_STAKE = GEN
DEFAULT_STAKE = 10 * GEN


def pack(moment_ids):
    value = 0
    for cell, moment_id in enumerate(moment_ids):
        value |= moment_id << (cell * 8)
    return value


def bitmap(*moment_ids):
    value = 0
    for moment_id in moment_ids:
        value |= 1 << moment_id
    return value


def address(raw):
    from genlayer import Address

    return Address(raw)


GRID_A = pack([1, 4, 7, 10, 13, 16, 19, 22, 25])
GRID_B = pack([2, 5, 8, 11, 14, 17, 20, 23, 26])
GRID_C = pack([3, 6, 9, 12, 15, 18, 21, 24, 27])
GRID_A_DIVERSE = pack([1, 4, 7, 11, 13, 16, 19, 22, 25])


def create_round(
    contract,
    resolver,
    round_id=ROUND_ID,
    lock_at="2026-08-11T13:00:00Z",
    kickoff_at="2026-08-11T13:30:00Z",
    resolve_not_before="2026-08-11T16:00:00Z",
    refund_at="2026-08-12T13:00:00Z",
    minimum_stake=MINIMUM_STAKE,
    minimum_participants=2,
    minimum_total_stake=None,
):
    if minimum_total_stake is None:
        minimum_total_stake = minimum_stake * minimum_participants
    contract.create_round(
        round_id,
        MATCH_ID,
        address(resolver),
        RESOLUTION_ID,
        lock_at,
        kickoff_at,
        resolve_not_before,
        refund_at,
        minimum_stake,
        minimum_participants,
        minimum_total_stake,
        2,
    )


def enter(direct_vm, contract, player, grid=GRID_A, stake=DEFAULT_STAKE, round_id=ROUND_ID):
    direct_vm.sender = player
    direct_vm.value = stake
    contract.join_round(round_id, grid)


def settle(
    direct_vm,
    contract,
    resolver,
    window_0,
    window_1,
    window_2,
    round_id=ROUND_ID,
    batch=100,
):
    direct_vm.value = 0
    direct_vm.warp("2026-08-11T16:00:01Z")
    direct_vm.sender = resolver
    contract.accept_resolution(
        round_id,
        RESOLUTION_ID,
        MATCH_ID,
        window_0,
        window_1,
        window_2,
        bitmap(1, 2, 3, 10, 11, 12, 19, 20, 21),
        bitmap(4, 5, 6, 13, 14, 15, 22, 23, 24),
        bitmap(7, 8, 9, 16, 17, 18, 25, 26, 27),
    )
    if contract.get_round(round_id)["status"] == "SCORING":
        contract.process_settlement(round_id, batch)


def all_grid_a_true():
    return (
        sum(1 << moment_id for moment_id in [1, 10, 19]),
        sum(1 << moment_id for moment_id in [4, 13, 22]),
        sum(1 << moment_id for moment_id in [7, 16, 25]),
    )


def test_ten_gen_quote_splits_by_tier_and_fee():
    # Pure numbers document the exact 10 GEN product economics.
    assert DEFAULT_STAKE * 5 // 100 == GEN // 2
    assert DEFAULT_STAKE * 10 // 100 == GEN
    assert DEFAULT_STAKE * 15 // 100 == GEN + GEN // 2


def test_one_gen_quote_preserves_the_nine_pool_weights(direct_deploy):
    contract = direct_deploy(CONTRACT)
    assert contract.get_stake_quote(GEN) == {
        "stake_amount": GEN,
        "common_per_cell": GEN * 5 // 100,
        "medium_per_cell": GEN * 10 // 100,
        "rare_per_cell": GEN * 15 // 100,
        "pool_total": GEN * 90 // 100,
        "jackpot": GEN * 5 // 100,
        "revenue": GEN * 5 // 100,
    }


def test_nine_independent_pools_transfer_each_cells_losing_stakes_to_its_winner(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, GRID_A, stake=GEN)
    enter(direct_vm, contract, direct_bob, GRID_B, stake=GEN)
    enter(direct_vm, contract, direct_charlie, GRID_C, stake=GEN)

    settle(direct_vm, contract, direct_alice, *all_grid_a_true())

    expected_pool_totals = [GEN * 15 // 100] * 3 + [GEN * 30 // 100] * 3 + [GEN * 45 // 100] * 3
    expected_option_stakes = [GEN * 5 // 100] * 3 + [GEN * 10 // 100] * 3 + [GEN * 15 // 100] * 3
    for cell in range(9):
        pool = contract.get_cell_pool(ROUND_ID, cell)
        assert pool["total_pool"] == expected_pool_totals[cell]
        assert pool["option_0_stake"] == expected_option_stakes[cell]
        assert pool["option_1_stake"] == expected_option_stakes[cell]
        assert pool["option_2_stake"] == expected_option_stakes[cell]
        assert pool["winning_stake"] == expected_option_stakes[cell]

    # Alice wins all nine cell pools, including the money staked on the two
    # losing options in each individual cell, plus the three-player jackpot.
    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == GEN * 285 // 100
    assert contract.get_entry(ROUND_ID, address(direct_bob))["claimable"] == 0
    assert contract.get_entry(ROUND_ID, address(direct_charlie))["claimable"] == 0


def test_payable_entry_allocates_weighted_pools_jackpot_and_revenue(
    direct_vm, direct_deploy, direct_alice
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice)

    game_round = contract.get_round(ROUND_ID)
    assert game_round["participant_count"] == 1
    assert game_round["total_escrow"] == 10 * GEN
    assert game_round["total_pool_stake"] == 9 * GEN
    assert game_round["jackpot_pool"] == GEN // 2
    assert game_round["revenue_pool"] == GEN // 2

    expected = [GEN // 2] * 3 + [GEN] * 3 + [GEN + GEN // 2] * 3
    for cell, cell_stake in enumerate(expected):
        pool = contract.get_cell_pool(ROUND_ID, cell)
        assert pool["total_pool"] == cell_stake
        assert pool["option_0_stake"] == cell_stake
        assert pool["option_1_stake"] == 0
        assert pool["option_2_stake"] == 0

    quote = contract.get_stake_quote(10 * GEN)
    assert quote == {
        "stake_amount": 10 * GEN,
        "common_per_cell": GEN // 2,
        "medium_per_cell": GEN,
        "rare_per_cell": GEN + GEN // 2,
        "pool_total": 9 * GEN,
        "jackpot": GEN // 2,
        "revenue": GEN // 2,
    }


def test_stake_is_variable_above_the_round_minimum(direct_vm, direct_deploy, direct_alice):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, stake=20 * GEN)

    game_round = contract.get_round(ROUND_ID)
    assert game_round["total_pool_stake"] == 18 * GEN
    assert game_round["jackpot_pool"] == GEN
    assert game_round["revenue_pool"] == GEN
    assert contract.get_cell_pool(ROUND_ID, 0)["total_pool"] == GEN
    assert contract.get_cell_pool(ROUND_ID, 8)["total_pool"] == 3 * GEN


def test_entry_requires_minimum_value_and_valid_choice_per_cell(
    direct_vm, direct_deploy, direct_alice
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = MINIMUM_STAKE - 1

    with pytest.raises(Exception, match="below this round's minimum"):
        contract.join_round(ROUND_ID, GRID_A)

    direct_vm.value = 100 * GEN + 1
    with pytest.raises(Exception, match="Maximum testnet stake is 100 GEN"):
        contract.join_round(ROUND_ID, GRID_A)

    direct_vm.value = MINIMUM_STAKE
    invalid_grid = pack([4, 4, 7, 10, 13, 16, 19, 22, 25])
    with pytest.raises(Exception, match="Moment is not valid"):
        contract.join_round(ROUND_ID, invalid_grid)


def test_round_can_set_a_higher_immutable_minimum(direct_vm, direct_deploy, direct_alice):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice, minimum_stake=5 * GEN)
    assert contract.get_round(ROUND_ID)["minimum_stake"] == 5 * GEN

    direct_vm.sender = direct_alice
    direct_vm.value = 5 * GEN - 1
    with pytest.raises(Exception, match="below this round's minimum"):
        contract.join_round(ROUND_ID, GRID_A)

    direct_vm.value = 5 * GEN
    contract.join_round(ROUND_ID, GRID_A)
    assert contract.get_entry(ROUND_ID, address(direct_alice))["stake_amount"] == 5 * GEN


def test_one_wallet_can_enter_a_round_only_once(direct_vm, direct_deploy, direct_alice):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice)

    direct_vm.value = MINIMUM_STAKE
    with pytest.raises(Exception, match="already entered"):
        contract.join_round(ROUND_ID, GRID_B)


def test_timeout_refunds_return_the_full_stake_and_do_not_release_revenue(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    direct_vm.warp("2026-08-12T13:00:01Z")
    contract.activate_refunds(ROUND_ID)

    assert contract.get_round(ROUND_ID)["status"] == "REFUNDING"
    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == 10 * GEN
    assert contract.get_protocol_balances()["revenue_withdrawable"] == 0


def test_owner_cancel_only_opens_full_refunds(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_owner
    direct_vm.value = 0
    contract.cancel_round(ROUND_ID)

    assert contract.get_round(ROUND_ID)["status"] == "REFUNDING"
    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == 10 * GEN


def test_full_correct_grid_wins_all_regular_pools_and_the_jackpot(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, GRID_A)
    enter(direct_vm, contract, direct_bob, GRID_B)

    settle(direct_vm, contract, direct_alice, *all_grid_a_true())

    alice_entry = contract.get_entry(ROUND_ID, address(direct_alice))
    bob_entry = contract.get_entry(ROUND_ID, address(direct_bob))
    assert alice_entry["marked_mask"] == 0x1FF
    assert alice_entry["completed_lines"] == 8
    assert alice_entry["jackpot_qualified"] is True
    assert alice_entry["claimable"] == 19 * GEN
    assert bob_entry["marked_mask"] == 0
    assert bob_entry["jackpot_qualified"] is False
    assert bob_entry["claimable"] == 0
    assert contract.get_protocol_balances()["revenue_withdrawable"] == GEN


def test_jackpot_requires_at_least_one_horizontal_and_one_diagonal(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice)
    enter(direct_vm, contract, direct_bob, GRID_B)

    # Cells 0,1,2 complete the top horizontal and cells 0,4,8 complete a diagonal.
    settle(
        direct_vm,
        contract,
        direct_alice,
        1 << 1,
        (1 << 4) | (1 << 13),
        (1 << 7) | (1 << 25),
    )

    entry = contract.get_entry(ROUND_ID, address(direct_alice))
    assert entry["marked_mask"] == 0x117
    assert entry["jackpot_qualified"] is True
    assert contract.get_round(ROUND_ID)["jackpot_winning_stake"] == 10 * GEN


def test_jackpot_is_shared_pro_rata_by_qualifying_stake(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, stake=10 * GEN)
    enter(direct_vm, contract, direct_bob, GRID_A_DIVERSE, stake=20 * GEN)

    settle(direct_vm, contract, direct_alice, *all_grid_a_true())

    assert contract.get_round(ROUND_ID)["jackpot_pool"] == GEN + GEN // 2
    assert contract.get_round(ROUND_ID)["jackpot_winning_stake"] == 30 * GEN
    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == 11 * GEN + GEN // 2
    assert contract.get_entry(ROUND_ID, address(direct_bob))["claimable"] == 17 * GEN


def test_no_jackpot_winner_rolls_the_jackpot_forward(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice)
    enter(direct_vm, contract, direct_bob, GRID_B)

    # Only the first column is correct: a vertical line does not unlock the jackpot.
    settle(
        direct_vm,
        contract,
        direct_alice,
        (1 << 1) | (1 << 10) | (1 << 19),
        0,
        0,
    )

    game_round = contract.get_round(ROUND_ID)
    assert game_round["jackpot_winning_stake"] == 0
    assert game_round["jackpot_rolled_over"] is True
    assert contract.get_protocol_balances()["jackpot_rollover"] == GEN
    assert contract.get_protocol_balances()["revenue_withdrawable"] == GEN


def test_jackpot_scoring_is_permissionless_and_batched(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice)
    enter(direct_vm, contract, direct_bob, GRID_B)
    enter(direct_vm, contract, direct_charlie)

    direct_vm.value = 0
    direct_vm.warp("2026-08-11T16:00:01Z")
    direct_vm.sender = direct_alice
    contract.accept_resolution(
        ROUND_ID,
        RESOLUTION_ID,
        MATCH_ID,
        *all_grid_a_true(),
        bitmap(1, 2, 3, 10, 11, 12, 19, 20, 21),
        bitmap(4, 5, 6, 13, 14, 15, 22, 23, 24),
        bitmap(7, 8, 9, 16, 17, 18, 25, 26, 27),
    )

    direct_vm.sender = direct_bob
    contract.process_settlement(ROUND_ID, 2)
    assert contract.get_round(ROUND_ID)["status"] == "SCORING"
    assert contract.get_round(ROUND_ID)["settlement_cursor"] == 2

    direct_vm.sender = direct_charlie
    contract.process_settlement(ROUND_ID, 2)
    assert contract.get_round(ROUND_ID)["status"] == "SETTLED"
    assert contract.get_round(ROUND_ID)["settlement_cursor"] == 3
    assert contract.get_round(ROUND_ID)["jackpot_winning_stake"] == 20 * GEN


def test_only_configured_resolver_can_deliver_finalized_bitmaps(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    direct_vm.warp("2026-08-11T16:00:01Z")
    direct_vm.sender = direct_bob

    with pytest.raises(Exception, match="Only the configured resolver"):
        contract.accept_resolution(ROUND_ID, RESOLUTION_ID, MATCH_ID, 0, 0, 0, 0, 0, 0)


def test_unbacked_true_options_refund_regular_pool_stakes_but_not_fees(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice)
    enter(direct_vm, contract, direct_bob, GRID_B)

    settle(
        direct_vm,
        contract,
        direct_alice,
        sum(1 << moment_id for moment_id in [3, 12, 21]),
        sum(1 << moment_id for moment_id in [6, 15, 24]),
        sum(1 << moment_id for moment_id in [9, 18, 27]),
    )

    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == 9 * GEN
    assert contract.get_entry(ROUND_ID, address(direct_bob))["claimable"] == 9 * GEN


def test_resolution_cannot_start_before_post_match_evidence_window(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, GRID_A)
    enter(direct_vm, contract, direct_bob, GRID_B)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp("2026-08-11T13:59:59Z")

    with pytest.raises(Exception, match="evidence window has not opened"):
        contract.accept_resolution(ROUND_ID, RESOLUTION_ID, MATCH_ID, 0, 0, 0, 0, 0, 0)


def test_underfilled_round_can_be_refunded_immediately_after_lock(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, GRID_A)
    direct_vm.sender = direct_bob
    direct_vm.value = 0
    direct_vm.warp("2026-08-11T13:00:01Z")
    contract.activate_refunds(ROUND_ID)

    assert contract.get_round(ROUND_ID)["status"] == "REFUNDING"
    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == 10 * GEN


def test_unknown_evidence_refunds_only_the_affected_choice(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, GRID_A)
    enter(direct_vm, contract, direct_bob, GRID_B)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp("2026-08-11T16:00:01Z")
    all_valid_0 = bitmap(1, 2, 3, 10, 11, 12, 19, 20, 21) & ~(1 << 1)
    contract.accept_resolution(
        ROUND_ID,
        RESOLUTION_ID,
        MATCH_ID,
        *all_grid_a_true(),
        all_valid_0,
        bitmap(4, 5, 6, 13, 14, 15, 22, 23, 24),
        bitmap(7, 8, 9, 16, 17, 18, 25, 26, 27),
    )
    contract.process_settlement(ROUND_ID, 100)

    # Cell zero is unknown for Alice, so her 0.5 GEN cell stake is returned.
    assert contract.get_cell_pool(ROUND_ID, 0)["refundable_stake"] == GEN // 2
    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == 18 * GEN + GEN // 2


def test_indexed_entry_exposes_the_committing_wallet(
    direct_vm, direct_deploy, direct_alice
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, GRID_A)

    indexed = contract.get_entry_by_index(ROUND_ID, 0)
    assert indexed["player"].lower() == str(address(direct_alice)).lower()
    assert indexed["packed_grid"] == GRID_A


def test_scoring_timeout_can_open_full_refunds(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    enter(direct_vm, contract, direct_alice, GRID_A)
    enter(direct_vm, contract, direct_bob, GRID_B)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp("2026-08-11T16:00:01Z")
    contract.accept_resolution(
        ROUND_ID, RESOLUTION_ID, MATCH_ID, *all_grid_a_true(),
        bitmap(1, 2, 3, 10, 11, 12, 19, 20, 21),
        bitmap(4, 5, 6, 13, 14, 15, 22, 23, 24),
        bitmap(7, 8, 9, 16, 17, 18, 25, 26, 27),
    )
    assert contract.get_round(ROUND_ID)["status"] == "SCORING"
    direct_vm.sender = direct_bob
    direct_vm.warp("2026-08-12T13:00:01Z")
    contract.activate_refunds(ROUND_ID)
    assert contract.get_round(ROUND_ID)["status"] == "REFUNDING"


def test_jackpot_rolls_to_the_next_created_open_round(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    create_round(
        contract,
        direct_alice,
        round_id="round-2",
        lock_at="2026-08-13T13:00:00Z",
        kickoff_at="2026-08-13T13:30:00Z",
        resolve_not_before="2026-08-13T16:00:00Z",
        refund_at="2026-08-14T13:00:00Z",
    )
    enter(direct_vm, contract, direct_alice, GRID_A)
    enter(direct_vm, contract, direct_bob, GRID_B)
    settle(direct_vm, contract, direct_alice, bitmap(1), 0, 0)

    assert contract.get_round(ROUND_ID)["jackpot_rollover_destination"] == "round-2"
    assert contract.get_round("round-2")["jackpot_seed"] == GEN
    assert contract.get_protocol_balances()["jackpot_rollover"] == 0
