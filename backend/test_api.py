"""
End-to-end API test: full game loop.
Run with: py test_api.py (while server is running on port 8000)
"""
import json
import requests

BASE = "http://localhost:8000"

def p(label, data):
    if isinstance(data, dict) or isinstance(data, list):
        print(f"\n{'='*60}\n{label}\n{'='*60}")
        print(json.dumps(data, indent=2)[:1500])
    else:
        print(f"\n{label}: {data}")


# --- 1. Register users ---
print("\n" + "="*60 + "\n STEP 1: Register Users\n" + "="*60)

prof = requests.post(f"{BASE}/auth/register", json={
    "email": "prof2@test.com", "password": "test123",
    "display_name": "Professor Oak", "role": "professor"
}).json()
p("Professor", prof)
prof_token = prof["access_token"]

student1 = requests.post(f"{BASE}/auth/register", json={
    "email": "student1@test.com", "password": "test123",
    "display_name": "Ash Ketchum", "role": "student"
}).json()
p("Student 1", student1)
s1_token = student1["access_token"]

student2 = requests.post(f"{BASE}/auth/register", json={
    "email": "student2@test.com", "password": "test123",
    "display_name": "Misty Waterflower", "role": "student"
}).json()
p("Student 2", student2)
s2_token = student2["access_token"]

student3 = requests.post(f"{BASE}/auth/register", json={
    "email": "student3@test.com", "password": "test123",
    "display_name": "Brock Harrison", "role": "student"
}).json()
p("Student 3", student3)
s3_token = student3["access_token"]

# --- 2. Professor creates a room ---
print("\n" + "="*60 + "\n STEP 2: Create Room\n" + "="*60)

room = requests.post(f"{BASE}/rooms", json={"name": "MBA 601 - Operations"},
    headers={"Authorization": f"Bearer {prof_token}"}).json()
p("Room", room)
invite_code = room["invite_code"]

# --- 3. Students join ---
print("\n" + "="*60 + "\n STEP 3: Students Join Room\n" + "="*60)

j1 = requests.post(f"{BASE}/rooms/{room['id']}/join",
    json={"invite_code": invite_code},
    headers={"Authorization": f"Bearer {s1_token}"}).json()
p("Student 1 joined", j1)

j2 = requests.post(f"{BASE}/rooms/{room['id']}/join",
    json={"invite_code": invite_code},
    headers={"Authorization": f"Bearer {s2_token}"}).json()
p("Student 2 joined", j2)

j3 = requests.post(f"{BASE}/rooms/join",
    json={"invite_code": invite_code},
    headers={"Authorization": f"Bearer {s3_token}"}).json()
assert j3.get("room_id") == room["id"], f"invite-only join failed: {j3}"
p("Student 3 joined (invite code only)", j3)

# --- 4. Professor creates a fiscal year (1 month) ---
print("\n" + "="*60 + "\n STEP 4: Create Fiscal Year\n" + "="*60)

COSTS = {
    "holding_per_unit": 1.0, "stockout_penalty": 10.0,
    "ordering_fixed": 20.0, "per_unit_cost": 5.0,
    "selling_price": 15.0,
    "dual_source_enabled": True,
    "dual_source_premium_per_unit": 2.0,
    "dual_source_rescue_pct": 1.0,
}

fy = requests.post(f"{BASE}/seasons", json={
    "room_id": room["id"],
    "name": "API fiscal year loop",
    "total_rounds": 1,
    "contract_updates_allowed": 0,
    "round_duration_days": 30,
    "historical_leadin_days": 60,
    "scenario_preset": "steady",
    "scenario_config": {},
    "season_mode": "single",
    "mix_config": {},
    "costs": COSTS,
    "starting_inventory": 100,
    "season_scope": "room",
}, headers={"Authorization": f"Bearer {prof_token}"}).json()
p("Fiscal year created", fy)
assert fy.get("id"), fy
assert fy.get("is_practice_run") is False
season_loop_id = fy["id"]
rnd = fy["rounds"][0]

requests.post(
    f"{BASE}/seasons/{season_loop_id}/activate",
    headers={"Authorization": f"Bearer {prof_token}"},
).raise_for_status()

# --- 5. Student sees round (actuals hidden) ---
print("\n" + "="*60 + "\n STEP 5: Student Views Round (actuals hidden?)\n" + "="*60)

student_view = requests.get(f"{BASE}/rounds/{rnd['id']}",
    headers={"Authorization": f"Bearer {s1_token}"}).json()
p(f"Actual data visible? {student_view['actual_data'] is not None}", student_view.get("actual_data"))

# --- 6. Students submit policies ---
print("\n" + "="*60 + "\n STEP 6: Submit Policies\n" + "="*60)

p1 = requests.put(f"{BASE}/policies", json={
    "round_id": rnd["id"],
    "policy_type": "order_up_to",
    "config": {"target_level": 200, "dual_source": False}
}, headers={"Authorization": f"Bearer {s1_token}"}).json()
p("Student 1 policy (Order Up To S=200)", p1)

p2 = requests.put(f"{BASE}/policies", json={
    "round_id": rnd["id"],
    "policy_type": "service_level",
    "config": {"target_service_level": 0.95, "lookback_days": 14, "dual_source": True}
}, headers={"Authorization": f"Bearer {s2_token}"}).json()
p("Student 2 policy (Service Level 95%)", p2)

# --- 7. Student 1 backtests ---
print("\n" + "="*60 + "\n STEP 7: Backtest\n" + "="*60)

bt = requests.post(f"{BASE}/policies/backtest", json={
    "round_id": rnd["id"],
    "policy_type": "order_up_to",
    "config": {"target_level": 200, "dual_source": False}
}, headers={"Authorization": f"Bearer {s1_token}"}).json()
print(f"Backtest profit: ${bt['total_profit']:,.2f}")
print(f"Service level: {bt['service_level']:.1%}")
print(f"Stockout days: {bt['stockout_days']}")
print(f"Highlights: {bt['highlights'][:3]}")

# --- 8. Professor advances (scores) the fiscal year month ---
print("\n" + "="*60 + "\n STEP 8: Advance Fiscal Year\n" + "="*60)

score = requests.post(f"{BASE}/seasons/{season_loop_id}/advance",
    headers={"Authorization": f"Bearer {prof_token}"}).json()
p("Advance", score)

# --- 9. Check leaderboard ---
print("\n" + "="*60 + "\n STEP 9: Leaderboard\n" + "="*60)

lb = requests.get(f"{BASE}/leaderboard/{rnd['id']}",
    headers={"Authorization": f"Bearer {s1_token}"}).json()
print(f"\n{'Rank':<6}{'Student':<25}{'Profit':>12}{'Svc Lvl':>10}{'Stockouts':>10}")
print("-" * 63)
for entry in lb:
    me = " <-- YOU" if entry["is_me"] else ""
    print(f"{entry['rank']:<6}{entry['display_name']:<25}${entry['total_profit']:>10,.0f}"
          f"{entry['service_level']:>9.1%}{entry['stockout_days']:>10}{me}")

# --- 10. Student views own results ---
print("\n" + "="*60 + "\n STEP 10: My Results\n" + "="*60)

my_res = requests.get(f"{BASE}/results/{rnd['id']}",
    headers={"Authorization": f"Bearer {s1_token}"}).json()
print(f"Profit: ${my_res['total_profit']:,.2f}")
print(f"Service Level: {my_res['service_level']:.1%}")
print(f"Highlights:")
for h in my_res["highlights"]:
    print(f"  - {h}")

# --- 11. Season leaderboard (cumulative for one season, not whole room) ---
print("\n" + "="*60 + "\n STEP 11: Season Leaderboard\n" + "="*60)

sea = requests.post(
    f"{BASE}/seasons",
    json={
        "room_id": room["id"],
        "name": "API season standings test",
        "total_rounds": 1,
        "contract_updates_allowed": 0,
        "round_duration_days": 30,
        "historical_leadin_days": 60,
        "scenario_preset": "steady",
        "scenario_config": {},
        "season_mode": "single",
        "mix_config": {},
        "costs": COSTS,
        "starting_inventory": 100,
        "season_scope": "room",
    },
    headers={"Authorization": f"Bearer {prof_token}"},
).json()
p("Season for cumulative LB", sea)
season_id = sea["id"]
sr = sea["rounds"][0]["id"]

requests.post(
    f"{BASE}/seasons/{season_id}/activate",
    headers={"Authorization": f"Bearer {prof_token}"},
).raise_for_status()

requests.put(
    f"{BASE}/policies",
    json={
        "round_id": sr,
        "policy_type": "order_up_to",
        "config": {"target_level": 200, "dual_source": False},
    },
    headers={"Authorization": f"Bearer {s1_token}"},
).raise_for_status()
requests.put(
    f"{BASE}/policies",
    json={
        "round_id": sr,
        "policy_type": "service_level",
        "config": {
            "target_service_level": 0.95,
            "lookback_days": 14,
            "dual_source": True,
        },
    },
    headers={"Authorization": f"Bearer {s2_token}"},
).raise_for_status()

requests.post(
    f"{BASE}/seasons/{season_id}/advance",
    headers={"Authorization": f"Bearer {prof_token}"},
).raise_for_status()

season = requests.get(
    f"{BASE}/leaderboard/season/{season_id}",
    headers={"Authorization": f"Bearer {s1_token}"},
).json()
p("Season standings (student view: peers anonymized)", season["standings"])

for st in season["standings"]:
    if st.get("is_me"):
        assert st.get("user_id"), "Student should see own user_id on season standings"
    else:
        assert st.get("display_name") == "Other player"
        assert "user_id" not in st

season_prof = requests.get(
    f"{BASE}/leaderboard/season/{season_id}",
    headers={"Authorization": f"Bearer {prof_token}"},
).json()
for st in season_prof["standings"]:
    assert st.get("user_id"), "Professor should see all user_ids on season standings"
    assert st.get("display_name") != "Other player"

# --- 12. Classroom practice runs (visibility) ---
print("\n" + "="*60 + "\n STEP 12: Classroom practice runs\n" + "="*60)

gone = requests.post(
    f"{BASE}/seasons/room/{room['id']}/solo-templates",
    json={"name": "should fail", "costs": COSTS},
    headers={"Authorization": f"Bearer {prof_token}"},
)
assert gone.status_code == 410, gone.text

adhoc_gone = requests.post(
    f"{BASE}/rounds",
    json={
        "room_id": room["id"],
        "historical_data": [{"day": 1, "demand": 10, "lead_time": 2, "black_swan": None}],
        "actual_data": [{"day": 1, "demand": 10, "lead_time": 2, "black_swan": None}],
        "costs": COSTS,
        "starting_inventory": 100,
        "deadline": "2026-04-15T23:59:00",
    },
    headers={"Authorization": f"Bearer {prof_token}"},
)
assert adhoc_gone.status_code == 410, adhoc_gone.text

pr1 = requests.post(
    f"{BASE}/seasons",
    json={
        "room_id": room["id"],
        "name": "Student 1 practice",
        "total_rounds": 1,
        "contract_updates_allowed": 0,
        "round_duration_days": 30,
        "historical_leadin_days": 60,
        "scenario_preset": "steady",
        "scenario_config": {},
        "season_mode": "single",
        "mix_config": {},
        "costs": COSTS,
        "starting_inventory": 100,
        "season_scope": "room",
        "is_practice_run": True,
    },
    headers={"Authorization": f"Bearer {s1_token}"},
).json()
p("Student 1 practice run", pr1)
assert pr1.get("is_practice_run") is True
assert pr1["rounds"][0]["status"] == "active"

pr2 = requests.post(
    f"{BASE}/seasons",
    json={
        "room_id": room["id"],
        "name": "Student 2 practice",
        "total_rounds": 1,
        "contract_updates_allowed": 0,
        "round_duration_days": 30,
        "historical_leadin_days": 60,
        "scenario_preset": "steady",
        "scenario_config": {},
        "season_mode": "single",
        "mix_config": {},
        "costs": COSTS,
        "starting_inventory": 100,
        "season_scope": "room",
        "is_practice_run": True,
    },
    headers={"Authorization": f"Bearer {s2_token}"},
).json()
assert pr2.get("is_practice_run") is True

list_s1 = requests.get(
    f"{BASE}/seasons/room/{room['id']}",
    headers={"Authorization": f"Bearer {s1_token}"},
).json()
ids_s1 = {x["id"] for x in list_s1}
assert pr1["id"] in ids_s1
assert pr2["id"] not in ids_s1
assert season_loop_id in ids_s1  # shared fiscal year visible

list_prof = requests.get(
    f"{BASE}/seasons/room/{room['id']}",
    headers={"Authorization": f"Bearer {prof_token}"},
).json()
ids_prof = {x["id"] for x in list_prof}
assert pr1["id"] in ids_prof and pr2["id"] in ids_prof

my_solo = requests.get(
    f"{BASE}/seasons/my-solo",
    headers={"Authorization": f"Bearer {s1_token}"},
).json()
assert any(x["id"] == pr1["id"] for x in my_solo)

# --- Onboarding status ---
print("\n" + "="*60 + "\n Onboarding status\n" + "="*60)

onboarding_s1 = requests.get(
    f"{BASE}/users/me/onboarding-status",
    headers={"Authorization": f"Bearer {s1_token}"},
).json()
p("Student onboarding status", onboarding_s1)
assert onboarding_s1["has_policy_submission"] is True
assert onboarding_s1["has_class_room"] is True
assert onboarding_s1["has_solo_season"] is True

onboarding_prof = requests.get(
    f"{BASE}/users/me/onboarding-status",
    headers={"Authorization": f"Bearer {prof_token}"},
).json()
p("Professor onboarding status", onboarding_prof)
assert onboarding_prof["has_teaching_room"] is True

print("\n" + "="*60)
print(" ALL TESTS PASSED - GAME LOOP WORKS!")
print("="*60)
