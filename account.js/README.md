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
| POST | `/account-api/telegramverify` | `{tg}` — a Telegram Login Widget payload | sets session cookie if the verified TG id owns an account; `{account, title, chars}` or `{account:null}`; `501` if unconfigured |
| GET | `/account-api/discord/start` | — | 302 to Discord's OAuth consent (sets a signed anti-CSRF state cookie); dark → 302 `/newui/?acct_error=discord_off` |
| GET | `/account-api/discord/callback` | `?code&state` | exchanges the code server-side, sets the session cookie if the Discord id owns an account, then 302 to `/newui/`; every failure 302s to `/newui/?acct_error=…` |
| GET | `/account-api/session` | — | `{account, title, chars}` or `{account:null}` |
| POST | `/account-api/enter` | `{char}` | `{char, token}` — a one-use entry token for the client's WS |
| POST | `/account-api/logout` | — | `{ok:true}` |
| POST | `/account-api/kofi` | Ko-fi webhook: form-urlencoded `data=<JSON>`, up to 128 KB | `200 {ok:true}` when the engine stored the payment or already had it; `403` bad verification token; `400` malformed; `503` engine unreachable (Ko-fi retries); `501` if unconfigured |

Every MUD call goes out as `{token: <web token>, bottype: "web", args}`. The engine
seam `servlet_auth_account()` checks the web token, which reaches account endpoints
only — never `/api/exec` (that gates on the separate ops token and rejects
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
- `TELEGRAM_BOT_TOKEN` — the `dreamland_mud_bot` token (same value the telegram bot
  unit holds). Enables `/telegramverify`; without it that endpoint returns `501` and
  everything else works. The broker only ever computes `SHA256(token)` from it to
  verify Login Widget signatures — it never talks to Telegram.
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — the Discord OAuth2 app's credentials.
  Enable the `/discord/*` routes; without them those routes bounce back to `/newui`
  with an error flag and everything else works. The client id is the Valkyrie bot's
  application id (`659914892941328423`); the secret is generated in the Developer
  Portal's OAuth2 tab.
- `DISCORD_REDIRECT_URI` — default `https://dreamland.rocks/account-api/discord/callback`.
  Must match the redirect registered in the Discord app EXACTLY (Discord rejects a
  mismatch), and is sent identically on both `/start` and the token exchange.

- `KOFI_VERIFICATION_TOKEN` — the verification token from Ko-fi (Settings -> API ->
  Webhooks). Enables `/kofi`; without it that endpoint returns `501` and everything
  else works. Compared constant-time against the token inside each webhook's `data`.

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
   WorkingDirectory=/var/www/dreamland_web/account.js
   EnvironmentFile=/etc/dreamland/account.env
   ExecStart=/home/dreamland/.nodejs/current/bin/node src/app.js
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```
   then `systemctl daemon-reload && systemctl enable --now dreamland-account`.
   The deploy tree is `/var/www/dreamland_web` (drone pulls the repo there), NOT
   `/home/dreamland/...`. The node path MUST be the glibc-217 v22 build: the broker
   uses global `fetch`, and the system `/usr/bin/node` is v16 (the searcher's node),
   which has no `fetch`. Run `npm install --omit=dev` in the account.js dir first
   (node_modules is gitignored, so it does not arrive with the drone pull).
5. **nginx** — add beside the existing `/searcher-api` proxy:
   ```
   location /account-api { proxy_pass http://127.0.0.1:8002; }
   ```
   `nginx -t && systemctl reload nginx`.

Redeploy after code changes = `systemctl restart dreamland-account` (no drone; this
service is not in the mudjs/dreamland_web CI pipelines). The drone `dreamland_web`
pipeline `git pull`s the repo into `/var/www/dreamland_web` but does not restart this
service, so a merge lands the new code on disk and it goes live only on that restart.

## Telegram login go-live (extra, on top of the checklist above)

`/telegramverify` and the `/newui` Telegram button ship dark until:

1. **BotFather `/setdomain`** — set `dreamland_mud_bot`'s domain to `dreamland.rocks`,
   or the Login Widget refuses to render on the site (this is Kit's, in Telegram).
2. **`TELEGRAM_BOT_TOKEN`** — add it to `/etc/dreamland/account.env`, then
   `systemctl restart dreamland-account`. Same token the telegram bot unit uses.

The account is keyed by the numeric Telegram id (the bot's `/attach` stores
`String(ctx.from.id)`), which is exactly what the widget signs — so a verified widget
login maps onto the same account with no code step. A TG id that owns no account
returns `account:null`; linking still happens in-game (`аккаунт связать` -> bot).

## Discord login go-live (extra, on top of the checklist above)

The `/discord/*` routes and the `/newui` Discord button ship dark until:

1. **Discord Developer Portal** — on the Valkyrie application (`659914892941328423`),
   OAuth2 tab: generate a **client secret**, and add the redirect
   `https://dreamland.rocks/account-api/discord/callback` under Redirects (exact match,
   Discord rejects a mismatch). Scope used is `identify` only (no email).
2. **Env** — add `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (and, if it ever differs,
   `DISCORD_REDIRECT_URI`) to `/etc/dreamland/account.env`, then
   `systemctl restart dreamland-account`.

Flow: `/discord/start` mints a signed one-use state cookie and bounces to Discord;
the callback verifies the state (CSRF), exchanges the code for an id server-side (the
token never reaches the browser), resolves the account by that numeric id — the same
id the bot's `/attach` keys by — and sets the session cookie. A Discord id that owns
no account bounces to `/newui/?acct_error=discord_nolink`; linking stays in-game.

## Ko-fi webhook go-live (extra, on top of the checklist above)

`/kofi` ships dark until:

1. **Engine** — the `/account/kofi` servlet is live (dreamland_code). Plan on a
   reboot: `loadsave` and `comm` both carry new C++, and the plugin-reload guard
   refuses two plugins with pending C++. The ledger lands in `runtime/var/db/kofi/`,
   one `<txn>.json` per transaction, created on first use.
2. **Env** — add `KOFI_VERIFICATION_TOKEN` to `/etc/dreamland/account.env`, then
   `systemctl restart dreamland-account`.
3. **Ko-fi** — Settings -> API -> Webhooks: URL
   `https://dreamland.rocks/account-api/kofi`, then "Send test" and look for the
   `account-broker: kofi:` line in `journalctl -u dreamland-account`.

The engine matches a payment to an account by the Discord the payer connected on
Ko-fi, then the payer's email as an account identity, then an email that already paid
for an account (Ko-fi renewals carry no message), then the account's Ko-fi code (its
id, shown in `account` status) anywhere in the Ko-fi message. Nothing else matches.
USD donations and subscriptions with a well-formed amount extend the account's
supporter date (a month per $5, a year per $50); shop orders, commissions, other
currencies and odd amounts are recorded as `manual`. Anything the engine cannot match
waits in the ledger: the payer claims it in-game with `account kofi <transaction id>`
from their receipt. Immortals at trust 109+ see open entries in `account kofi list`
and handle them with `account kofi credit <txn> <account id> [months]` or
`account kofi resolve <txn>`. The broker logs one line per payment (txn, type,
amount, result) and never the token or the email.
