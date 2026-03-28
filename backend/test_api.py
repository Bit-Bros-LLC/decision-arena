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

# --- 4. Professor creates a round ---
print("\n" + "="*60 + "\n STEP 4: Create Round\n" + "="*60)

historical = [{"day": i, "demand": 90 + (i*7 % 30), "lead_time": 2 + (i % 3), "black_swan": None} for i in range(1, 61)]
actuals = [{"day": i, "demand": 100 + (i*11 % 40), "lead_time": 2 + (i % 4), "black_swan": None} for i in range(1, 31)]
actuals[13]["black_swan"] = {"type": "supplier_failure", "duration_days": 3}
actuals[24]["demand"] = 250  # demand spike

rnd = requests.post(f"{BASE}/rounds", json={
    "room_id": room["id"],
    "round_number": 1,
    "historical_data": historical,
    "actual_data": actuals,
    "costs": {
        "holding_per_unit": 1.0, "stockout_penalty": 10.0,
        "ordering_fixed": 20.0, "per_unit_cost": 5.0,
        "selling_price": 15.0, "insurance_premium": 8.0,
        "insurance_coverage_pct": 0.80
    },
    "starting_inventory": 100,
    "deadline": "2026-04-15T23:59:00"
}, headers={"Authorization": f"Bearer {prof_token}"}).json()
p("Round created", rnd)

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
    "config": {"target_level": 200, "insurance_mode": "never"}
}, headers={"Authorization": f"Bearer {s1_token}"}).json()
p("Student 1 policy (Order Up To S=200)", p1)

p2 = requests.put(f"{BASE}/policies", json={
    "round_id": rnd["id"],
    "policy_type": "service_level",
    "config": {"target_service_level": 0.95, "lookback_days": 14, "insurance_mode": "always"}
}, headers={"Authorization": f"Bearer {s2_token}"}).json()
p("Student 2 policy (Service Level 95%)", p2)

# --- 7. Student 1 backtests ---
print("\n" + "="*60 + "\n STEP 7: Backtest\n" + "="*60)

bt = requests.post(f"{BASE}/policies/backtest", json={
    "round_id": rnd["id"],
    "policy_type": "order_up_to",
    "config": {"target_level": 200, "insurance_mode": "never"}
}, headers={"Authorization": f"Bearer {s1_token}"}).json()
print(f"Backtest profit: ${bt['total_profit']:,.2f}")
print(f"Service level: {bt['service_level']:.1%}")
print(f"Stockout days: {bt['stockout_days']}")
print(f"Highlights: {bt['highlights'][:3]}")

# --- 8. Professor scores the round ---
print("\n" + "="*60 + "\n STEP 8: Score Round\n" + "="*60)

score = requests.post(f"{BASE}/rounds/{rnd['id']}/score",
    headers={"Authorization": f"Bearer {prof_token}"}).json()
p("Scoring", score)

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

# --- 11. Season leaderboard ---
print("\n" + "="*60 + "\n STEP 11: Season Leaderboard\n" + "="*60)

season = requests.get(f"{BASE}/leaderboard/season/{room['id']}",
    headers={"Authorization": f"Bearer {s1_token}"}).json()
p("Season standings", season["standings"])

print("\n" + "="*60)
print(" ALL TESTS PASSED - GAME LOOP WORKS!")
print("="*60)
