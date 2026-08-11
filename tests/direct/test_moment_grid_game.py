"""Direct-mode coverage for nine-pool escrow accounting and scoring."""

import pytest


CONTRACT = "contracts/moment_grid_game.py"
ROUND_ID = "round-1"
MATCH_ID = "match-1"
RESOLUTION_ID = "resolution-1"
ENTRY_FEE = 9_000


def pack(moment_ids):
    value = 0
    for cell, moment_id in enumerate(moment_ids):
        value |= moment_id << (cell * 8)
    return value


def address(raw):
    from genlayer import Address

    return Address(raw)


GRID_A = pack([1, 4, 7, 10, 13, 16, 19, 22, 25])
GRID_B = pack([2, 5, 8, 11, 14, 17, 20, 23, 26])


def create_round(contract, resolver, lock_at="2026-08-11T13:00:00Z", refund_at="2026-08-12T13:00:00Z"):
    contract.create_round(
        ROUND_ID,
        MATCH_ID,
        address(resolver),
        RESOLUTION_ID,
        ENTRY_FEE,
        lock_at,
        refund_at,
    )


def test_payable_entry_splits_exact_value_across_nine_pools(direct_vm, direct_deploy, direct_alice):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = ENTRY_FEE

    contract.join_round(ROUND_ID, GRID_A)

    game_round = contract.get_round(ROUND_ID)
    assert game_round["participant_count"] == 1
    assert game_round["total_escrow"] == ENTRY_FEE
    for cell in range(9):
        pool = contract.get_cell_pool(ROUND_ID, cell)
        assert pool["total_pool"] == 1_000
        assert pool["option_0_stake"] == 1_000
        assert pool["option_1_stake"] == 0
        assert pool["option_2_stake"] == 0


def test_entry_requires_exact_value_and_valid_choice_per_cell(direct_vm, direct_deploy, direct_alice):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = ENTRY_FEE - 1

    with pytest.raises(Exception, match="Exact entry fee required"):
        contract.join_round(ROUND_ID, GRID_A)

    direct_vm.value = ENTRY_FEE
    invalid_grid = pack([4, 4, 7, 10, 13, 16, 19, 22, 25])
    with pytest.raises(Exception, match="Moment is not valid"):
        contract.join_round(ROUND_ID, invalid_grid)


def test_one_wallet_can_enter_a_round_only_once(direct_vm, direct_deploy, direct_alice):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = ENTRY_FEE
    contract.join_round(ROUND_ID, GRID_A)

    with pytest.raises(Exception, match="already entered"):
        contract.join_round(ROUND_ID, GRID_B)


def test_anyone_can_activate_full_refunds_after_timeout(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = ENTRY_FEE
    contract.join_round(ROUND_ID, GRID_A)

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    direct_vm.warp("2026-08-12T13:00:01Z")
    contract.activate_refunds(ROUND_ID)

    assert contract.get_round(ROUND_ID)["status"] == "REFUNDING"
    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == ENTRY_FEE


def test_owner_cancel_only_opens_refunds_and_cannot_take_escrow(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = ENTRY_FEE
    contract.join_round(ROUND_ID, GRID_A)

    direct_vm.sender = direct_owner
    direct_vm.value = 0
    contract.cancel_round(ROUND_ID)

    game_round = contract.get_round(ROUND_ID)
    assert game_round["status"] == "REFUNDING"
    assert game_round["total_claimed"] == 0
    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == ENTRY_FEE


def test_settled_cell_pools_pay_the_backed_true_grid_and_score_its_lines(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)

    direct_vm.sender = direct_alice
    direct_vm.value = ENTRY_FEE
    contract.join_round(ROUND_ID, GRID_A)
    direct_vm.sender = direct_bob
    contract.join_round(ROUND_ID, GRID_B)

    direct_vm.value = 0
    direct_vm.warp("2026-08-11T13:00:01Z")
    window_0 = sum(1 << moment_id for moment_id in [1, 10, 19])
    window_1 = sum(1 << moment_id for moment_id in [4, 13, 22])
    window_2 = sum(1 << moment_id for moment_id in [7, 16, 25])
    direct_vm.sender = direct_alice
    contract.accept_resolution(ROUND_ID, RESOLUTION_ID, MATCH_ID, window_0, window_1, window_2)

    alice_entry = contract.get_entry(ROUND_ID, address(direct_alice))
    bob_entry = contract.get_entry(ROUND_ID, address(direct_bob))
    assert alice_entry["marked_mask"] == 0x1FF
    assert alice_entry["completed_lines"] == 8
    assert alice_entry["claimable"] == ENTRY_FEE * 2
    assert bob_entry["marked_mask"] == 0
    assert bob_entry["completed_lines"] == 0
    assert bob_entry["claimable"] == 0


def test_only_configured_resolver_can_deliver_finalized_bitmaps(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)
    direct_vm.warp("2026-08-11T13:00:01Z")
    direct_vm.sender = direct_bob

    with pytest.raises(Exception, match="Only the configured resolver"):
        contract.accept_resolution(ROUND_ID, RESOLUTION_ID, MATCH_ID, 0, 0, 0)


def test_unbacked_true_options_refund_each_cell_stake(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.warp("2026-08-11T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    create_round(contract, direct_alice)

    direct_vm.sender = direct_alice
    direct_vm.value = ENTRY_FEE
    contract.join_round(ROUND_ID, GRID_A)
    direct_vm.sender = direct_bob
    contract.join_round(ROUND_ID, GRID_B)

    direct_vm.value = 0
    direct_vm.warp("2026-08-11T13:00:01Z")
    direct_vm.sender = direct_alice
    contract.accept_resolution(
        ROUND_ID,
        RESOLUTION_ID,
        MATCH_ID,
        sum(1 << moment_id for moment_id in [3, 12, 21]),
        sum(1 << moment_id for moment_id in [6, 15, 24]),
        sum(1 << moment_id for moment_id in [9, 18, 27]),
    )

    assert contract.get_entry(ROUND_ID, address(direct_alice))["claimable"] == ENTRY_FEE
    assert contract.get_entry(ROUND_ID, address(direct_bob))["claimable"] == ENTRY_FEE
