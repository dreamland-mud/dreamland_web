# account.js — DreamLand account broker (Phase 5.1)

The server-side half of the passwordless account flow. It holds the per-surface
`web` token so the browser never does, proves a visitor's email/OAuth identity
against the MUD account servlets, keeps the "identity proven, no character chosen"
state in a signed cookie, and mints one-use entry tokens the client sends over its
own WebSocket as `account_enter <token>`.

It never serves HTML. The UI lives in mudjs `/newui`; this is the token-holder.

## Endpoints (browser-facing, behind nginx `location /account-api`)

| method | path | body | returns |
|---|---|---|---|
| POST | `/account-api/emailcode` | `{email}` | `{sent}` — mails a 6-digit code |
| POST | `/account-api/emailverify` | `{email, code}` | sets session cookie if the address owns an account; `{account, title, chars}` or `{account:null}` |
| GET | `/account-api/session` | — | `{account, title, chars}` or `{account:null}` |
| POST | `/account-api/enter` | `{char}` | `{char, token}` — a one-use entry token for the client's WS |
| POST | `/account-api/logout` | — | `{ok:true}` |

Every MUD call goes out as `{token: <web token>, bottype: "web", args}`. The engine
seam `servlet_auth_account()` checks the web token, which reaches account endpoints
only — never `/api/exec` (that gates on the god token directly and rejects
`bottype: web`).

## Environment

Required (the process refuses to start without them):

- `ACCOUNT_WEB_TOKEN` — must equal the MUD host's `runtime/var/misc/account_web.token`.
- `ACCOUNT_COOKIE_SECRET` — random ≥32 bytes, HMAC key for the session cookie.

Optional:

- `ACCOUNT_PORT` — default `8002` (binds `127.0.0.1` only).
- `MUD_API` — default `http://localhost:1235` (the engine's servlet port on the same
  host). No `/api`: servlet paths are registered bare, and only nginx adds `/api` on
  the public `dreamland.rocks/api/*` route. The broker bypasses nginx.

## Go-live checklist (Kit-gated, needs root once)

The whole layer ships dark. To turn the broker on:

1. **Mint the web token on the MUD host** (out of band, like `dreamland_bot.token`):
   ```
   head -c 24 /dev/urandom | base64 | tr -d '/+=' > runtime/var/misc/account_web.token
   chmod 600 runtime/var/misc/account_web.token
   ```
2. **Reboot the MUD** so the `servlet_auth_account()` seam that accepts `bottype: web`
   is live (C++ change, ships on a rebuild).
3. **Secrets file** `/etc/dreamland/account.env` (0600 root), like the bot units:
   ```
   ACCOUNT_WEB_TOKEN=<same value as the file in step 1>
   ACCOUNT_COOKIE_SECRET=<head -c 32 /dev/urandom | base64>
   ```
4. **systemd unit** `/etc/systemd/system/dreamland-account.service`:
   ```
   [Unit]
   Description=DreamLand account broker
   After=network.target

   [Service]
   Type=simple
   User=dreamland
   WorkingDirectory=/home/dreamland/dreamland_web/account.js
   EnvironmentFile=/etc/dreamland/account.env
   ExecStart=/home/dreamland/.nodejs/current/bin/node src/app.js
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```
   then `systemctl daemon-reload && systemctl enable --now dreamland-account`.
5. **nginx** — add beside the existing `/searcher-api` proxy:
   ```
   location /account-api { proxy_pass http://127.0.0.1:8002; }
   ```
   `nginx -t && systemctl reload nginx`.

Redeploy after code changes = `systemctl restart dreamland-account` (no drone; this
service is not in the mudjs/dreamland_web CI pipelines).
