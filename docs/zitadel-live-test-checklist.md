# ZITADEL Live Test Checklist

Updated: 2026-08-18

This checklist is for the first live end-to-end test of the non-production ZITADEL integration from a local developer machine.

## 1. Fill in local env files

Update these files with the real non-production values:

- `backend/.env.local`
- `frontend/.env.local`

Replace these placeholders with real values:

- `ZITADEL_ISSUER`
- `ZITADEL_AUDIENCE`
- `VITE_ZITADEL_ISSUER`
- `VITE_ZITADEL_CLIENT_ID`
- `VITE_ZITADEL_AUDIENCE`

If discovery is hosted at the default well-known path, leave:

- `ZITADEL_DISCOVERY_URL=`
- `VITE_ZITADEL_DISCOVERY_URL=`

If the real role claim is not `role`, update:

- `ZITADEL_ROLES_CLAIM`
- `VITE_ZITADEL_ROLES_CLAIM`

## 2. Confirm ZITADEL app registration

Verify the non-production ZITADEL frontend application allows:

- redirect URI: `http://localhost:5173/auth/callback`
- post-logout redirect URI: `http://localhost:5173/login`

Verify the backend API audience/resource matches:

- `decision-arena-api` or the final audience value you place in both local env files

Verify the test account:

- exists in non-production ZITADEL
- is active
- is assigned the intended application role
- can complete the required MFA flow

## 3. Start local backend

From `backend/`:

```bash
source .venv/bin/activate
set -a
source .env.local
set +a
uvicorn main:app --reload --port 8000
```

Expected result:

- backend starts successfully
- no startup config validation error appears

## 4. Start local frontend

From `frontend/`:

```bash
npm run dev
```

Expected result:

- frontend starts on `http://localhost:5173`
- Vite reads `frontend/.env.local`

## 5. Test login redirect

Open:

- `http://localhost:5173/login`

Click:

- `Continue to Sign In`

Expected result:

- browser redirects to the non-production ZITADEL login page
- the redirect URI in the browser request is `http://localhost:5173/auth/callback`

## 6. Test callback completion

Finish login in ZITADEL.

Expected result:

- browser returns to `http://localhost:5173/auth/callback`
- frontend exchanges the code for tokens
- browser lands on `/dashboard`
- no local password form is shown anywhere

## 7. Test backend authorization

While signed in, verify these flows:

- dashboard loads
- `GET /users/me/onboarding-status` succeeds
- `GET /rooms` succeeds
- protected API calls include a bearer token

Expected result:

- backend accepts the ZITADEL token
- local app user record is linked or provisioned
- no `401` loop occurs

## 8. Verify role mapping

Log in with a test account that should be a professor.

Expected result:

- frontend shows professor-specific UI
- backend professor-only routes are allowed

If this fails, inspect the real token claims and update:

- `ZITADEL_ROLES_CLAIM`
- `VITE_ZITADEL_ROLES_CLAIM`

## 9. Test logout

From the account settings page, sign out.

Expected result:

- frontend clears session state
- browser is redirected through ZITADEL logout if available
- browser lands on `/login`

## 10. Record the first live-test outcome

After the first real test, record:

- the actual non-production issuer used
- the actual audience used
- the actual client ID used
- the real role-claim key observed in the token
- whether professor role mapping worked without code changes
- any callback, CORS, or discovery issues found

If the real role-claim shape differs from the current `role` assumption, the next code task is to update the claim mapping and re-test.
