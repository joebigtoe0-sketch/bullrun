# Railway setup (simple)

You have **3 services**. Each one only needs the variables listed below — nothing else.

---

## 1. Postgres service

**Do nothing.** Railway manages this automatically. Do not copy these vars anywhere else.

---

## 2. Server service

Delete everything except these 4 variables:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=any-long-random-string-here
CORS_ORIGIN=https://bullrunclient-production.up.railway.app
RACE_INTERVAL_SEC=120
```

### How to set DATABASE_URL (important)

Do **not** paste the postgres env block into the server. Do **not** use `${PGUSER}` style strings.

In Railway server service → Variables → **Add Reference** → pick your **Postgres** service → select **DATABASE_URL**.

That creates `DATABASE_URL=${{Postgres.DATABASE_URL}}` which Railway resolves to the real connection string.

### Test after deploy

Open: `https://bullrunserver-production.up.railway.app/health`

You should see:
```json
{"ok":true,"db":true}
```

If you see `"db":false`, the database link is still wrong.

---

## 3. Client service

Delete the `VITE_*` variables (optional but less confusing). Keep only:

```env
API_URL=https://bullrunserver-production.up.railway.app
WS_URL=https://bullrunserver-production.up.railway.app
```

No trailing slash. Must be your **server** URL, not the client URL.

### Test after deploy

Open: `https://bullrunclient-production.up.railway.app/config.json`

You should see:
```json
{"apiUrl":"https://bullrunserver-production.up.railway.app","wsUrl":"https://bullrunserver-production.up.railway.app"}
```

If it says `localhost`, redeploy the client after setting `API_URL`.

---

## What went wrong

| Mistake | Why it breaks |
|---------|----------------|
| Copied all Postgres vars into **server** | `DATABASE_URL` contains literal `${PGUSER}` text — Railway does not expand that |
| Client calls wrong URL | Register gets HTML (`index.html`) instead of JSON → "Unexpected token `<`" |
| `CORS_ORIGIN` trailing `/` | Browser sends origin without slash — CORS can block requests |

---

## Flow

```
Browser → client URL (static files + config.json)
Browser → server URL /auth/register (API + database)
Postgres ← server only (via DATABASE_URL reference)
```
