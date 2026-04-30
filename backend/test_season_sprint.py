from simulation.season_scenarios import generate_mixed_season


def test_random_mix_generates_round_plan():
    plan = generate_mixed_season(
        season_mode="random_mix",
        total_rounds=5,
        round_duration_days=30,
        leadin_days=60,
        mix_config={"allowed_presets": ["steady", "seasonality"]},
        seed=7,
    )
    assert len(plan["leadin"]) == 60
    assert len(plan["timeline"]) == 150
    assert len(plan["round_plan"]) == 5
    assert {item["preset_id"] for item in plan["round_plan"]}.issubset({"steady", "seasonality"})


def test_custom_mix_requires_full_round_plan():
    try:
        generate_mixed_season(
            season_mode="custom_mix",
            total_rounds=5,
            round_duration_days=30,
            leadin_days=60,
            mix_config={"round_presets": ["steady", "steady"]},
        )
    except ValueError as exc:
        assert "round_presets length" in str(exc)
    else:
        raise AssertionError("Expected ValueError for invalid custom mix length")


if __name__ == "__main__":
    test_random_mix_generates_round_plan()
    test_custom_mix_requires_full_round_plan()
    print("Season Sprint tests passed")
