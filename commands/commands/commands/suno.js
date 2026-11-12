// .suno — AI music generation via aisong.io (free Suno frontend)
// temp-mail OTP login → generate → poll → send MP3 as WhatsApp audio
import { BOT_NAME } from '../config.js';

const TEMP_MAIL_BASE = 'https://api.internal.temp-mail.io/api/v3';
const AISONG_BASE = 'https://aisong.io';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138 Safari/537.36';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function makeCookieJar() {
    const jar = new Map();
    return {
        header: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
        store(setCookieHeaders = []) {
            for (const line of setCookieHeaders) {
                const part = line.split(';')[0].trim();
                const eq = part.indexOf('=');
                if (eq < 1) continue;
                jar.set(part.slice(0, eq), part.slice(eq + 1));
            }
        },
        has: (k) => jar.has(k),
    };
}

function makeGot(jar) {
    return async function got(method, url, { body, form, headers: extra = {}, noRedirect = false } = {}) {
        const opts = {
            method,
            redirect: noRedirect ? 'manual' : 'follow',
            headers: {
                'User-Agent': UA,
                Referer: AISONG_BASE + '/',
                Cookie: jar.header(),
                ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...extra,
            },
            ...(form ? { body: new URLSearchParams(form).toString() } : {}),
            ...(body ? { body: JSON.stringify(body) } : {}),
        };
        const res = await fetch(url, opts);
        const raw = res.headers.getSetCookie?.() ?? [];
        jar.store(raw.length ? raw : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []));
        return res;
    };
}

async function createTempEmail() {
    const res = await fetch(`${TEMP_MAIL_BASE}/email/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_name_length: 10, max_name_length: 10 }),
    });
    if (!res.ok) throw new Error(`temp-mail create failed: ${res.status}`);
    return (await res.json()).email;
}

async function pollForOtp(email, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await sleep(3000);
        try {
            const res = await fetch(`${TEMP_MAIL_BASE}/email/${email}/messages`);
            const msgs = await res.json();
            for (const m of (Array.isArray(msgs) ? msgs : [])) {
                const hit = `${m.subject ?? ''} ${m.body_text ?? ''}`.match(/\b(\d{6})\b/);
                if (hit) return hit[1];
            }
        } catch { /* retry */ }
    }
    return null;
}

async function login(got, jar, attemptLimit = 3) {
    for (let attempt = 1; attempt <= attemptLimit; attempt++) {
        const email = await createTempEmail();

        const csrfData = await (await got('GET', `${AISONG_BASE}/api/auth/csrf`)).json();
        if (!csrfData.csrfToken) throw new Error('No csrfToken');
        const csrf = csrfData.csrfToken;

        try {
            const r = await got('POST', `${AISONG_BASE}/api/auth/send-verification-code`, { body: { email } });
            if (!r.ok) continue;
        } catch { continue; }

        const otp = await pollForOtp(email, 60_000);
        if (!otp) continue;

        const verifyRes = await got('POST', `${AISONG_BASE}/api/auth/callback/verification-code`, {
            form: { csrfToken: csrf, email, code: otp, redirect: 'false', callbackUrl: AISONG_BASE, json: 'true' },
            noRedirect: true,
        });

        const location = verifyRes.headers.get('location') ?? '';
        if (verifyRes.status === 302 && !location.includes('/api/auth/signin') && !location.includes('error')) {
            await got('GET', location.startsWith('http') ? location : `${AISONG_BASE}${location}`);
        } else if (!jar.has('__Secure-next-auth.session-token') && !jar.has('next-auth.session-token')) {
            continue;
        }

        const sessionData = await (await got('GET', `${AISONG_BASE}/api/auth/session`)).json();
        if (sessionData?.user) return;
    }
    throw new Error('Login to aisong.io failed after all attempts');
}

async function generate(got, prompt, title) {
    const res = await got('POST', `${AISONG_BASE}/api/v2/generate`, {
        body: {
            inputType: '10', prompt, title,
            tags: 'Pop, Upbeat, Energetic',
            makeInstrumental: false,
            mvVersion: 'chirp-v5.0',
        },
    });
    const data = await res.json();
    const taskBatchId = data?.data?.taskBatchId;
    if (!taskBatchId) throw new Error(`No taskBatchId — response: ${JSON.stringify(data).slice(0, 200)}`);
    return taskBatchId;
}

async function pollTaskState(got, taskBatchId, timeoutMs = 5 * 60_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await sleep(5000);
        const data = await (await got('GET', `${AISONG_BASE}/api/v2/task-state?taskBatchId=${taskBatchId}`)).json();
        const { taskStatus, items = [] } = data?.data ?? {};

        if (taskStatus === 'failed') throw new Error('aisong.io: generation failed on server');
        if (taskStatus === 'finished') {
            const cdnReady = items.filter(i => i.audioUrl && !i.audioUrl.includes('audiopipe'));
            if (cdnReady.length) return cdnReady;
            const anyAudio = items.filter(i => i.audioUrl);
            if (anyAudio.length) return anyAudio;
        }
    }
    throw new Error('Timed out — no songs returned after 5 minutes');
}

async function fetchBuffer(url, extraHeaders = {}) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: `${AISONG_BASE}/`, ...extraHeaders } });
    if (!res.ok) throw new Error(`Download failed ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

export async function suno(message, client, query, prefix = '.') {
    const chatId = message.key.remoteJid;
    const q = { quoted: message };
    const react = async (emoji) => { try { await client.sendMessage(chatId, { react: { text: emoji, key: message.key } }); } catch {} };

    if (!query) {
        return client.sendMessage(chatId, {
            text: `🎵 *AI Music Generator*\n\nUsage: ${prefix}suno <describe your song>\n\nExample:\n${prefix}suno an upbeat afrobeat song about making money and living life`
        }, q);
    }

    await react('🎼');
    await client.sendMessage(chatId, {
        text: `🎼 *AI Music Studio*\n━━━━━━━━━━━━━━━━\n\n🎤 *Prompt:* ${query}\n\n⚡ *Status:* Signing in to music engine...\n⏱️ *ETA:* 2–4 minutes (AI music takes time!)\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${BOT_NAME}`
    }, q);

    const jar = makeCookieJar();
    const got = makeGot(jar);

    try {
        await login(got, jar);

        await client.sendMessage(chatId, {
            text: `🎹 *Status:* Composing your track...\n⏱️ _This takes 1–2 minutes, hang tight_`
        }, q);

        const taskBatchId = await generate(got, query, query.slice(0, 50));
        const songs = await pollTaskState(got, taskBatchId);
        if (!songs.length) throw new Error('No songs returned');

        const song = songs[0];
        const audioHeaders = song.audioUrl.includes('audiopipe') ? { Cookie: jar.header() } : {};
        const audioBuffer = await fetchBuffer(song.audioUrl, audioHeaders);
        const trackTitle = song.title || query.slice(0, 40);

        await client.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${trackTitle}.mp3`,
            ptt: false,
        }, q);
        await client.sendMessage(chatId, {
            text: `🎵 *${trackTitle}*\n_Prompt: ${query}_\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${BOT_NAME}`,
        }, q);
        await react('✅');
    } catch (err) {
        console.error('[suno] Error:', err.message);
        await react('❌');
        await client.sendMessage(chatId, { text: `❌ *Suno failed*\n\n${err.message}\n\nPlease try again in a moment.` }, q);
    }
}

export default { suno };
