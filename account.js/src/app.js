/*
 * DreamLand account broker (Phase 5.1).
 *
 * The one server-side component of the passwordless account flow. It holds the
 * per-surface `web` token (which the browser must never see) and speaks to the MUD
 * account servlets on its behalf. The flow:
 *
 *   1. Visitor proves they own an email  -> /account-api/emailcode + emailverify
 *   2. On success the broker sets a signed session cookie ("identity proven, no
 *      character chosen"). This state lives HERE, never in the engine.
 *   3. The browser asks for the roster    -> /account-api/session
 *   4. The visitor clicks a character     -> /account-api/enter, which mints a
 *      one-use entry token (~90s) the browser sends over its own WebSocket as
 *      `account_enter <token>`. The engine cold-loads the character, no password.
 *
 * Only the entry token ever reaches the browser, and only for the moment it takes
 * to hand it to the game -- exactly like the resume token. The web token and the
 * cookie secret stay in the process environment.
 *
 * Ships dark: with no account_web.token on the MUD host (or the seam un-rebooted)
 * every MUD call 403s, so the broker is inert until go-public.
 */

const express = require('express');
const crypto = require('crypto');

// ---- config ----------------------------------------------------------------

const PORT = parseInt(process.env.ACCOUNT_PORT || '8002', 10);
// The engine's servlet port on the same host. Servlet paths are registered BARE
// (/account/emailcode, /eval, ...); the public https://dreamland.rocks/api/* works
// only because nginx strips the /api prefix. The broker talks to the engine
// directly (no nginx in between), so its base must NOT carry /api.
const MUD_API = (process.env.MUD_API || 'http://localhost:1235').replace(/\/+$/, '');
const WEB_TOKEN = process.env.ACCOUNT_WEB_TOKEN || '';
const COOKIE_SECRET = process.env.ACCOUNT_COOKIE_SECRET || '';

// A broker without its secrets is either useless or dangerous (a weak default
// cookie secret is forgeable). Refuse to start rather than run insecurely.
if (!WEB_TOKEN || !COOKIE_SECRET) {
    console.error(
        'account-broker: ACCOUNT_WEB_TOKEN and ACCOUNT_COOKIE_SECRET are required. ' +
        'Refusing to start.'
    );
    process.exit(1);
}

// Telegram Login Widget verification key. Optional: without it /telegramverify is
// inert (501) and email login is unaffected, so the broker still deploys before the
// bot token and BotFather domain are wired. secret_key = SHA256(bot_token), per
// https://core.telegram.org/widgets/login#checking-authorization.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_SECRET = TELEGRAM_BOT_TOKEN
    ? crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest()
    : null;
const TG_AUTH_MAX_AGE_S = 24 * 60 * 60;   // reject a widget payload older than a day (replay)

const COOKIE_NAME = 'dl_acct';
// "Identity proven, no character chosen." Kept long so a returning player lands on
// their roster instead of re-proving every visit -- the cookie is httpOnly + Secure +
// SameSite=Lax + HMAC-signed, only ever opens characters the account already owns, and
// the engine re-checks ownership on /enter, so a stale one is low-value. The visible
// Log out button clears it for shared machines.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days

// Discord OAuth2 (authorization-code flow). Optional, same as Telegram: without a
// client id + secret both /discord routes bounce back to /newui with an error flag,
// so the broker deploys before Kit's OAuth app exists. The redirect_uri must match
// the one registered in the Discord Developer Portal exactly.
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI
    || 'https://dreamland.rocks/account-api/discord/callback';
const DISCORD_CONFIGURED = !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);

// Where the OAuth round-trip lands the browser back. The SPA reads the session
// cookie via /account-api/session on load, so a bare /newui/ is enough on success.
const NEWUI = '/play/';

// Ko-fi webhook verification token (Ko-fi dashboard -> API -> Webhooks). Optional:
// without it /kofi answers 501 and everything else works.
const KOFI_TOKEN = process.env.KOFI_VERIFICATION_TOKEN || '';

const OAUTH_STATE_NAME = 'dl_oauth';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;   // the round-trip to Discord and back

// ---- signed session cookie -------------------------------------------------
//
// Value = base64url(payload).base64url(HMAC-SHA256(payload, secret)). The payload
// is the proven identity plus an expiry. httpOnly so page JS cannot read it, Secure
// so it only travels over TLS, SameSite=Lax so a cross-site POST cannot ride it.

function b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function signSession(payload) {
    const body = b64url(JSON.stringify(payload));
    const sig = b64url(crypto.createHmac('sha256', COOKIE_SECRET).update(body).digest());
    return body + '.' + sig;
}

function verifySession(value) {
    if (!value || typeof value !== 'string')
        return null;
    const dot = value.indexOf('.');
    if (dot < 0)
        return null;
    const body = value.slice(0, dot);
    const sig = value.slice(dot + 1);

    const expected = b64url(crypto.createHmac('sha256', COOKIE_SECRET).update(body).digest());
    // Constant-time compare; unequal lengths would throw, so guard first.
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
        return null;

    let payload;
    try {
        payload = JSON.parse(b64urlDecode(body).toString('utf8'));
    } catch (e) {
        return null;
    }
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now())
        return null;
    return payload;
}

// Cookie string builders (so a single response can set more than one cookie -- the
// OAuth callback clears the state cookie AND sets the session cookie together).
function sessionCookieString(payload) {
    const value = signSession(payload);
    const maxAge = Math.floor(SESSION_TTL_MS / 1000);
    return `${COOKIE_NAME}=${value}; Path=/account-api; Max-Age=${maxAge}; `
        + `HttpOnly; Secure; SameSite=Lax`;
}
function sessionClearString() {
    return `${COOKIE_NAME}=; Path=/account-api; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function setSessionCookie(res, payload) {
    res.setHeader('Set-Cookie', sessionCookieString(payload));
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', sessionClearString());
}

function readCookie(req, name) {
    const raw = req.headers.cookie;
    if (!raw)
        return null;
    for (const part of raw.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0)
            continue;
        if (part.slice(0, eq).trim() === name)
            return part.slice(eq + 1).trim();
    }
    return null;
}

function readSession(req) {
    const c = readCookie(req, COOKIE_NAME);
    return c ? verifySession(c) : null;
}

// ---- OAuth state cookie (CSRF) ---------------------------------------------
//
// A one-use signed nonce cookie set on /discord/start and matched on the callback,
// so a forged callback (attacker's own code) cannot ride a victim's session. Signed
// with the same HMAC as the session cookie; verifySession enforces the 10-min exp.
function stateCookieString(nonce, popup) {
    // `p` remembers that the flow began in a popup, so the callback answers with a
    // postMessage page that closes itself instead of navigating the whole window.
    const value = signSession({ s: nonce, p: popup ? 1 : 0, exp: Date.now() + OAUTH_STATE_TTL_MS });
    return `${OAUTH_STATE_NAME}=${value}; Path=/account-api; Max-Age=`
        + `${Math.floor(OAUTH_STATE_TTL_MS / 1000)}; HttpOnly; Secure; SameSite=Lax`;
}
function stateClearString() {
    return `${OAUTH_STATE_NAME}=; Path=/account-api; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
function readStateNonce(req) {
    const c = readCookie(req, OAUTH_STATE_NAME);
    if (!c)
        return null;
    const p = verifySession(c);
    return p && typeof p.s === 'string' ? p.s : null;
}
function readStatePopup(req) {
    const c = readCookie(req, OAUTH_STATE_NAME);
    if (!c)
        return false;
    const p = verifySession(c);
    return !!(p && p.p === 1);
}

// End of the Discord flow. A popup gets a tiny page that posts the result to its
// opener (the login panel re-reads /session on success) and closes; a full-page
// flow keeps the original redirect back to /newui. Cookies (state clear, session
// set) are the caller's to set before calling -- this only writes the body/redirect.
function popupResultHtml(payload) {
    // `<` escaped so a reason string can never break out of the inline <script>.
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    return '<!doctype html><html><head><meta charset="utf-8"><title>Dreamland</title></head>'
        + '<body style="margin:0;height:100vh;display:flex;align-items:center;'
        + 'justify-content:center;background:#0b0a0f;color:#c6a24e;'
        + 'font:14px/1.4 system-ui,sans-serif">'
        + '<span>Done. You can close this window.</span>'
        + '<script>(function(){'
        + 'try{if(window.opener&&!window.opener.closed)'
        + 'window.opener.postMessage(' + json + ',window.location.origin);}catch(e){}'
        + 'try{window.close();}catch(e){}'
        + '})();</script></body></html>';
}
function sendDiscordResult(res, popup, ok, reason) {
    if (popup) {
        const payload = ok
            ? { dl: 'discord', ok: true }
            : { dl: 'discord', ok: false, error: reason };
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(popupResultHtml(payload));
    }
    return res.redirect(ok ? NEWUI : (NEWUI + '?acct_error=' + reason));
}

// ---- Telegram Login Widget verification ------------------------------------
//
// The widget hands the browser {id, first_name, ...auth_date, hash}, signed with
// HMAC-SHA256 keyed by SHA256(bot_token). Recompute over the sorted "key=value"
// lines (hash excluded), constant-time compare, then bound auth_date so a captured
// payload cannot be replayed. Returns the verified numeric id (as a string) or null.

function verifyTelegramAuth(data) {
    if (!TG_SECRET || !data || typeof data !== 'object')
        return null;
    const hash = data.hash;
    if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash))
        return null;

    const pairs = [];
    for (const k of Object.keys(data)) {
        if (k === 'hash')
            continue;
        const val = data[k];
        // Telegram signs scalar fields only; an object/array value is tampering.
        if (val === null || typeof val === 'object')
            return null;
        const sval = String(val);
        // A newline in a key or value could re-partition the sorted "key=value" join
        // into different pairs that HMAC to the same digest -- a canonicalization
        // collision. Telegram never signs one, but that guarantee lives on their
        // servers, not in the spec; reject it here so it does not have to.
        if (k.indexOf('\n') >= 0 || sval.indexOf('\n') >= 0)
            return null;
        pairs.push(k + '=' + sval);
    }
    pairs.sort();

    const computed = crypto.createHmac('sha256', TG_SECRET)
        .update(pairs.join('\n')).digest('hex');
    const a = Buffer.from(computed);
    const b = Buffer.from(hash);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
        return null;

    const now = Date.now() / 1000;
    const authDate = parseInt(data.auth_date, 10);
    if (!Number.isFinite(authDate) || now - authDate > TG_AUTH_MAX_AGE_S || authDate - now > 300)
        return null;   // stale (replay) or implausibly future (clock-skew guard)

    const id = String(data.id);
    if (!/^[0-9]{1,20}$/.test(id))
        return null;
    return id;
}

// ---- MUD servlet client ----------------------------------------------------
//
// Every account servlet takes {token, bottype, args}. We send bottype "web" so the
// engine's servlet_auth_account_web() seam checks the scoped web token, never the
// god bot token. A network failure becomes a 502 with no token in the message.

async function mudCall(path, args) {
    // Reading the body must stay inside the try: if the engine closes the socket
    // after headers but before the body (a reboot window -- exactly when this sees
    // traffic), resp.text() rejects, and an unhandled rejection in an async Express
    // route kills the process.
    try {
        const resp = await fetch(MUD_API + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: WEB_TOKEN, bottype: 'web', args: args || {} }),
        });
        const text = await resp.text();
        let json = null;
        if (text) {
            try { json = JSON.parse(text); } catch (e) { json = null; }
        }
        return { status: resp.status, json };
    } catch (e) {
        console.error('account-broker: MUD call failed for', path, e.message);
        return { status: 502, json: null };
    }
}

// Exchange a Discord OAuth code for the user's numeric id. Server-side only: the
// access token never reaches the browser, and we ask for the `identify` scope alone
// (id + username, no email). Returns the id string, or null on any failure.
async function discordExchange(code) {
    try {
        const form = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: DISCORD_REDIRECT_URI,
        });
        const tokResp = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
        });
        if (!tokResp.ok)
            return null;
        const tok = await tokResp.json();
        if (!tok || !tok.access_token)
            return null;
        const meResp = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: 'Bearer ' + tok.access_token },
        });
        if (!meResp.ok)
            return null;
        const me = await meResp.json();
        const id = me && me.id != null ? String(me.id) : '';
        return /^[0-9]{1,20}$/.test(id) ? id : null;
    } catch (e) {
        console.error('account-broker: discord exchange failed', e.message);
        return null;
    }
}

// ---- app -------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '8kb' }));

// Light input guards. The engine is the real validator (ascii email, latin name);
// these just keep obvious junk off the wire.
const looksEmail = s => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const looksCode = s => typeof s === 'string' && /^[0-9]{4,8}$/.test(s);
const looksName = s => typeof s === 'string' && /^[A-Za-z]{1,20}$/.test(s);

// Mail a login code to an address. No session is created here.
app.post('/account-api/emailcode', async (req, res) => {
    const email = (req.body && req.body.email || '').trim().toLowerCase();
    if (!looksEmail(email))
        return res.status(400).json({ error: 'invalid_email' });

    const r = await mudCall('/account/emailcode', { email });
    if (r.status === 200 && r.json)
        return res.json({ sent: !!r.json.sent });
    if (r.status === 400)
        return res.status(429).json({ error: 'rate_limited' });
    return res.status(502).json({ error: 'upstream' });
});

// Verify a code. On success, if the address already owns an account, start a
// session and return the roster. An unlinked address returns account:null with no
// session -- accounts are created only in-game, where a character can own them.
app.post('/account-api/emailverify', async (req, res) => {
    const email = (req.body && req.body.email || '').trim().toLowerCase();
    const code = (req.body && req.body.code || '').trim();
    if (!looksEmail(email))
        return res.status(400).json({ error: 'invalid_email' });
    if (!looksCode(code))
        return res.status(400).json({ error: 'invalid_code' });

    const r = await mudCall('/account/emailverify', { email, code });
    if (r.status === 400)
        return res.status(400).json({ error: 'bad_code' });
    if (r.status !== 200 || !r.json || !r.json.verified)
        return res.status(502).json({ error: 'upstream' });

    const verified = r.json.email || email;
    if (!r.json.account) {
        // Proven, but no account yet. No cookie; the UI offers the in-game link.
        return res.json({ account: null, email: verified });
    }

    setSessionCookie(res, {
        t: 'email',
        v: verified,
        a: r.json.account,
        exp: Date.now() + SESSION_TTL_MS,
    });
    return res.json({
        account: r.json.account,
        title: r.json.title || '',
        chars: Array.isArray(r.json.chars) ? r.json.chars : [],
    });
});

// Log in with a Telegram Login Widget payload. The widget proves the numeric TG id,
// and the bot's /attach keys the account by that same id (String(ctx.from.id)), so a
// verified payload maps straight onto the account -- no code round-trip. A proven id
// with no linked account returns account:null (the UI points at the in-game link).
app.post('/account-api/telegramverify', async (req, res) => {
    if (!TG_SECRET)
        return res.status(501).json({ error: 'telegram_unconfigured' });

    const id = verifyTelegramAuth(req.body && req.body.tg);
    if (!id)
        return res.status(400).json({ error: 'bad_signature' });

    const r = await mudCall('/account/info', { identityType: 'telegram', value: id });
    if (r.status === 404)
        return res.json({ account: null });          // proven id, not linked to an account
    if (r.status !== 200 || !r.json || !r.json.account)
        return res.status(502).json({ error: 'upstream' });

    setSessionCookie(res, {
        t: 'telegram',
        v: id,
        a: r.json.account,
        exp: Date.now() + SESSION_TTL_MS,
    });
    return res.json({
        account: r.json.account,
        title: r.json.title || '',
        chars: Array.isArray(r.json.chars) ? r.json.chars : [],
    });
});

// Discord OAuth2, authorization-code flow. /start bounces the browser to Discord;
// the callback exchanges the code server-side, checks the anti-CSRF state, and on a
// linked id sets the session cookie and returns to /newui (the SPA reads it via
// /session). All failures land back on /newui with an ?acct_error flag -- never a
// raw error page, since the user is mid-navigation. Ships dark: unconfigured -> flag.
app.get('/account-api/discord/start', (req, res) => {
    const popup = req.query.popup === '1';
    if (!DISCORD_CONFIGURED)
        return sendDiscordResult(res, popup, false, 'discord_off');
    const nonce = crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', stateCookieString(nonce, popup));
    const url = 'https://discord.com/oauth2/authorize?' + new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify',
        state: nonce,
    }).toString();
    return res.redirect(url);
});

app.get('/account-api/discord/callback', async (req, res) => {
    const popup = readStatePopup(req);
    const fail = reason => {
        res.setHeader('Set-Cookie', stateClearString());
        return sendDiscordResult(res, popup, false, reason);
    };

    if (!DISCORD_CONFIGURED)
        return fail('discord_off');

    // CSRF: the returned state must match the one-use signed nonce we set on /start.
    // The nonce is 32 hex chars, so shape-check `state` to that BEFORE the compare:
    // timingSafeEqual throws on unequal-length Buffers, and a string-length guard
    // misses multi-byte input (e.g. 32x "%C3%A9" is 32 chars but 64 bytes) -- which
    // on this async Express-4 / Node-22 stack would crash the process. Compare on
    // byte-length Buffers, the way verifySession does above.
    const expected = readStateNonce(req);
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!expected || !/^[0-9a-f]{32}$/.test(state))
        return fail('discord');
    const sb = Buffer.from(state), eb = Buffer.from(expected);
    if (sb.length !== eb.length || !crypto.timingSafeEqual(sb, eb))
        return fail('discord');

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code)
        return fail('discord');   // user denied consent, or a malformed callback

    const id = await discordExchange(code);
    if (!id)
        return fail('discord');

    const r = await mudCall('/account/info', { identityType: 'discord', value: id });
    if (r.status === 404)
        return fail('discord_nolink');          // proven id, not linked to an account
    if (r.status !== 200 || !r.json || !r.json.account)
        return fail('discord');

    // Success: clear the state cookie and set the session cookie in one response.
    // The popup path returns HTML but still carries these cookies, so the opener's
    // /session (same-origin cookie jar) sees the new session the moment it re-reads.
    res.setHeader('Set-Cookie', [
        stateClearString(),
        sessionCookieString({
            t: 'discord', v: id, a: r.json.account, exp: Date.now() + SESSION_TTL_MS,
        }),
    ]);
    return sendDiscordResult(res, popup, true);
});

// Return the current session's roster, re-fetched fresh so a rename/attach since
// login shows through. No valid cookie -> account:null (logged out).
app.get('/account-api/session', async (req, res) => {
    const sess = readSession(req);
    if (!sess)
        return res.json({ account: null });

    const r = await mudCall('/account/info', { identityType: sess.t, value: sess.v });
    if (r.status !== 200 || !r.json)
        return res.json({ account: sess.a, title: '', chars: [] });
    return res.json({
        account: sess.a,
        title: r.json.title || '',
        chars: Array.isArray(r.json.chars) ? r.json.chars : [],
    });
});

// Mint a one-use entry token for a chosen character. Requires a session; the engine
// re-checks that the identity actually owns the character, so a tampered name is
// refused server-side.
app.post('/account-api/enter', async (req, res) => {
    const sess = readSession(req);
    if (!sess)
        return res.status(401).json({ error: 'no_session' });

    const char = (req.body && req.body.char || '').trim();
    if (!looksName(char))
        return res.status(400).json({ error: 'invalid_char' });

    const r = await mudCall('/account/enter', {
        identityType: sess.t,
        value: sess.v,
        char,
    });
    if (r.status === 200 && r.json && r.json.token)
        return res.json({ char: r.json.char || char, token: r.json.token });
    if (r.status === 400 || r.status === 404)
        return res.status(400).json({ error: 'not_owned' });
    return res.status(502).json({ error: 'upstream' });
});

// ---- Ko-fi webhook ---------------------------------------------------------
//
// Ko-fi POSTs form-urlencoded `data=<JSON string>`. We check its verification
// token, keep a whitelist of fields and hand the payment to the engine, which
// keeps an idempotent ledger (one file per transaction) and extends the account's
// supporter date. 200 = stored or a duplicate; a 5xx when the engine is down, so
// Ko-fi retries.

// The JSON sits URL-encoded inside `data` (Cyrillic costs 6-10 bytes a letter on
// the wire), so leave room for a long message or a big shop order.
const kofiForm = express.urlencoded({ limit: '128kb', extended: false });

// Free text the engine can hold. The engine converts to KOI8-U, which has no
// emoji, and its converter stops at the first unmappable character -- so keep
// printable ASCII, the RU/UA letters KOI8-U has and the UA apostrophe, and fold
// line breaks into spaces.
function kofiText(v, max) {
    if (typeof v !== 'string')
        return undefined;
    const s = v.replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\x20-\x7EА-яЁёЄєІіЇїҐґʼ]/g, '')
        .replace(/ {2,}/g, ' ')
        .trim().slice(0, max);
    return s || undefined;
}

function kofiAscii(v, max) {
    if (typeof v !== 'string' && typeof v !== 'number')
        return undefined;
    const s = String(v).replace(/[^\x20-\x7E]/g, '').trim().slice(0, max);
    return s || undefined;
}

// Same rule as KofiLedger::monthsFor in the engine: no leading zeros, no comma,
// at most 7 integer digits and 2 decimals.
const KOFI_AMOUNT = /^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/;

function kofiBool(v) {
    return typeof v === 'boolean' ? v : undefined;
}

// Whitelisted, coerced, capped payment for /account/kofi, or null when a required
// field is missing. Undefined fields drop out in JSON.stringify.
function kofiPayment(d) {
    const txn = typeof d.kofi_transaction_id === 'string' ? d.kofi_transaction_id.trim() : '';
    if (!/^[A-Za-z0-9-]{1,64}$/.test(txn))
        return null;
    // The amount is forwarded as Ko-fi sent it: the engine validates it (strict
    // D.CC, KOFI_AMOUNT above mirrors its rule for the log) and stores anything
    // malformed as `manual` for an immortal, rather than dropping the payment here.
    const type = kofiAscii(d.type, 40);
    const amount = kofiAscii(d.amount, 20);
    if (!type || !amount)
        return null;

    const email = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
    const discordId = typeof d.discord_userid === 'string' || typeof d.discord_userid === 'number'
        ? String(d.discord_userid) : '';
    const items = Array.isArray(d.shop_items) ? d.shop_items.slice(0, 20)
        .filter(i => i && typeof i === 'object')
        .map(i => ({
            direct_link_code: kofiAscii(i.direct_link_code, 100),
            variation_name: kofiAscii(i.variation_name, 100),
            quantity: Number.isInteger(i.quantity) ? i.quantity : undefined,
        })) : undefined;

    return {
        txn,
        type,
        amount,
        currency: kofiAscii(d.currency, 8),
        message_id: kofiAscii(d.message_id, 64),
        timestamp: kofiAscii(d.timestamp, 40),
        from_name: kofiText(d.from_name, 100),
        message: kofiText(d.message, 1000),
        email: looksEmail(email) ? email : undefined,
        tier_name: kofiText(d.tier_name, 100),
        discord_username: kofiText(d.discord_username, 100),
        discord_userid: /^[0-9]{1,20}$/.test(discordId) ? discordId : undefined,
        is_public: kofiBool(d.is_public),
        is_subscription_payment: kofiBool(d.is_subscription_payment),
        is_first_subscription_payment: kofiBool(d.is_first_subscription_payment),
        shop_items: items,
    };
}

app.post('/account-api/kofi', kofiForm, async (req, res) => {
    // Everything inside one try: an async throw in an Express-4 route is an
    // unhandled rejection, and that kills the process.
    try {
        if (!KOFI_TOKEN)
            return res.status(501).json({ error: 'kofi_off' });

        const raw = req.body && req.body.data;
        if (typeof raw !== 'string')
            return res.status(400).json({ error: 'no_data' });
        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            return res.status(400).json({ error: 'bad_json' });
        }
        if (!data || typeof data !== 'object' || Array.isArray(data))
            return res.status(400).json({ error: 'bad_json' });

        // Constant-time compare on byte-length Buffers, the way verifySession does:
        // timingSafeEqual throws on unequal lengths, and a string-length check
        // misses multi-byte input.
        const tok = data.verification_token;
        if (typeof tok !== 'string' || tok.length > 256)
            return res.status(403).json({ error: 'bad_token' });
        const tb = Buffer.from(tok), kb = Buffer.from(KOFI_TOKEN);
        if (tb.length !== kb.length || !crypto.timingSafeEqual(tb, kb))
            return res.status(403).json({ error: 'bad_token' });

        const payment = kofiPayment(data);
        if (!payment) {
            console.error('account-broker: kofi payment rejected, missing txn/type/amount');
            return res.status(400).json({ error: 'bad_payment' });
        }

        const r = await mudCall('/account/kofi', payment);
        const odd = KOFI_AMOUNT.test(payment.amount) ? '' : ' (malformed amount)';
        const line = `kofi: txn ${payment.txn} ${payment.type} ${payment.amount} ${payment.currency || ''}${odd}`;
        if (r.status === 200 && r.json) {
            const result = r.json.duplicate ? 'duplicate'
                : `${r.json.status} match=${r.json.match} months=${r.json.months}`;
            console.log(`account-broker: ${line} -> ${result}`);
            return res.status(200).json({ ok: true });
        }
        if (r.status === 400) {
            console.error(`account-broker: ${line} -> engine refused (400)`);
            return res.status(400).json({ error: 'bad_payment' });
        }
        // 403 (token mismatch), 500 (ledger write) or unreachable: let Ko-fi retry.
        console.error(`account-broker: ${line} -> engine ${r.status}, Ko-fi will retry`);
        return res.status(503).json({ error: 'upstream' });
    } catch (e) {
        console.error('account-broker: kofi handler failed', e.message);
        if (!res.headersSent)
            res.status(500).json({ error: 'internal' });
    }
});

app.post('/account-api/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`DreamLand account broker ready on 127.0.0.1:${PORT}, MUD ${MUD_API}`);
});
