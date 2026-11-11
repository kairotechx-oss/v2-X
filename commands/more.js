// Extra commands for KAIRO ZYNEX:
// fullpp, pinterest, idch, fancy/styleteks, videotranscribe, spotify, capcut, mediafire,
// movie, blur, groupjid, anticall, antidelete, antigrouptag, autojoingc.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import Jimp from 'jimp';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

// ───────────────────────── helpers ─────────────────────────
const SETTINGS_PATH = path.resolve('data', 'more-settings.json');
function readSettings() {
    try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch { return {}; }
}
function writeSettings(data) {
    try {
        fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.warn('[more] save failed:', e?.message || e); }
}
const getSetting = (key, def) => { const s = readSettings(); return s[key] === undefined ? def : s[key]; };
const setSetting = (key, value) => { const s = readSettings(); s[key] = value; writeSettings(s); };

const chatOf = (m) => m.key.remoteJid;
const senderOf = (m) => m.key.participant || m.key.remoteJid;
const say = (client, m, text, extra = {}) => client.sendMessage(chatOf(m), { text, ...extra }, { quoted: m });
const react = (client, m, emoji) => client.sendMessage(chatOf(m), { react: { text: emoji, key: m.key } }).catch(() => {});
const ownerJid = (client) => (client.user?.id || '').split(':')[0].split('@')[0] + '@s.whatsapp.net';
const quotedOf = (m) => m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

async function getImageBuffer(m, client) {
    const quoted = quotedOf(m);
    const source = quoted?.imageMessage || m.message?.imageMessage || m.message?.imageMessage;
    if (!source) return null;
    const wrapped = quoted?.imageMessage ? { message: quoted } : { message: m.message };
    return await downloadMediaMessage(wrapped, 'buffer', {}, { reuploadRequest: client.reuploadRequest });
}

// ───────────────────────── .fullpp ─────────────────────────
// Reply to a photo: the bot profile picture changes at once, with the WHOLE photo (no crop).
export async function fullpp(message, client, isOwner) {
    if (!isOwner) return say(client, message, '*Owner only.*');
    const buf = await getImageBuffer(message, client);
    if (!buf) return say(client, message, '*Reply to a photo with .fullpp*');
    await react(client, message, '🕕');
    try {
        const img = await Jimp.read(buf);
        const size = Math.max(img.bitmap.width, img.bitmap.height);
        const canvas = new Jimp(size, size, 0x000000ff);
        canvas.composite(img, Math.floor((size - img.bitmap.width) / 2), Math.floor((size - img.bitmap.height) / 2));
        canvas.resize(640, 640);
        const out = await canvas.getBufferAsync(Jimp.MIME_JPEG);
        await client.updateProfilePicture(ownerJid(client), out);
        await react(client, message, '✅');
        await say(client, message, '*✅ Profile picture updated (full photo).*');
    } catch (e) {
        await react(client, message, '❌');
        await say(client, message, `*❌ Failed:* ${e.message}`);
    }
}

// ───────────────────────── .pinterest ─────────────────────────
export async function pinterest(message, client, query) {
    const q = String(query || '').trim().slice(0, 100);
    if (!q) return say(client, message, '*📌 PINTEREST*\n\nUsage: *.pinterest <search>*\nExample: *.pinterest nature*');
    await react(client, message, '🔍');
    const token = process.env.PINTEREST_API_TOKEN || 'SYDHKj';
    let data;
    try {
        const r = await axios.get(`https://whiteshadow-x-api.onrender.com/api/search/pinterest?q=${encodeURIComponent(q)}&apitoken=${encodeURIComponent(token)}`, { timeout: 40000 });
        data = r.data;
    } catch { data = null; }
    const results = data?.results || data?.result || data?.data || data?.images;
    const items = Array.isArray(results) ? results : results ? [results] : [];
    const urls = items
        .map((it) => (typeof it === 'string' ? it : it?.image || it?.imageUrl || it?.url || it?.src || it?.thumbnail))
        .filter((u) => typeof u === 'string' && /^https:\/\//i.test(u))
        .slice(0, 5);
    if (!urls.length) { await react(client, message, '❌'); return say(client, message, '*❌ No image found.*'); }
    let sent = 0;
    for (const [i, u] of urls.entries()) {
        try {
            await client.sendMessage(chatOf(message), { image: { url: u }, caption: i === 0 ? `📌 *${q}*` : '' }, { quoted: message });
            sent++;
        } catch {}
    }
    await react(client, message, sent ? '✅' : '❌');
    if (!sent) await say(client, message, '*❌ Could not send the images.*');
}

// ───────────────────────── .idch ─────────────────────────
const inviteCode = (url) => (String(url || '').match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i) || [])[1] || null;
export async function idch(message, client, text, fallback) {
    const code = inviteCode(text);
    if (!code) {
        if (fallback) return fallback(message, client);
        return say(client, message, '*📡 CHANNEL ID*\n\nUsage: *.idch <channel link>*\nExample: https://whatsapp.com/channel/XXXX\n_Or reply to a forwarded channel message._');
    }
    let meta = null;
    try { meta = await client.newsletterMetadata('invite', code); } catch {}
    if (!meta?.id) return say(client, message, '*❌ Channel not found.*\nCheck the link and try again.');
    const followers = meta.subscribers ?? meta.thread_metadata?.subscribers_count;
    const name = String(meta.name || meta.thread_metadata?.name?.text || '—').slice(0, 60);
    await say(client, message, `*📡 CHANNEL ID*\n\n*Name:* ${name}\n*ID:* ${meta.id}${followers != null ? `\n*Followers:* ${Number(followers).toLocaleString('en-US')}` : ''}`);
}

// ───────────────────────── .fancy / .styleteks ─────────────────────────
const build = (upper, lower, exc = {}, digits = null) => {
    const map = {};
    for (let i = 0; i < 26; i++) {
        const U = String.fromCharCode(65 + i), L = String.fromCharCode(97 + i);
        if (upper != null) map[U] = String.fromCodePoint(upper + i);
        if (lower != null) map[L] = String.fromCodePoint(lower + i);
    }
    if (digits != null) for (let d = 0; d < 10; d++) map[String(d)] = String.fromCodePoint(digits + d);
    return Object.assign(map, exc);
};
const fromList = (list) => { const m = {}; [...list].forEach((c, i) => { m[String.fromCharCode(97 + i)] = c; m[String.fromCharCode(65 + i)] = c; }); return m; };
const FONTS = {
    'Cursive': build(0x1D4D0, 0x1D4EA),
    'Double Struck': build(0x1D538, 0x1D552, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }, 0x1D7D8),
    'Old English': build(0x1D504, 0x1D51E, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }),
    'Monospace': build(0x1D670, 0x1D68A, {}, 0x1D7F6),
    'Bold': build(0x1D400, 0x1D41A, {}, 0x1D7CE),
    'Bold Sans': build(0x1D5D4, 0x1D5EE, {}, 0x1D7EC),
    'Italic': build(0x1D608, 0x1D622),
    'Wide': build(0xFF21, 0xFF41, {}, 0xFF10),
    'Squares': build(0x1F130, 0x1F130),
    'Bubbles': build(0x24B6, 0x24D0, { 0: '⓪', 1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤', 6: '⑥', 7: '⑦', 8: '⑧', 9: '⑨' }),
    'Tiny': fromList('ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ'),
    'Superscript': Object.assign(fromList('ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ')),
    'Subscript': Object.assign(fromList('ₐbcdₑfgₕᵢⱼₖₗₘₙₒₚqᵣₛₜᵤᵥwₓyz')),
};
const COMBINING = { 'Strike Through': '\u0336', 'Underline': '\u0332', 'Slash Through': '\u0337' };
const applyMap = (text, map) => [...text].map((c) => map[c] ?? c).join('');
const applyCombining = (text, mark) => [...text].join(mark) + mark;
const styleOf = (name, text) => FONTS[name] ? applyMap(text, FONTS[name]) : applyCombining(text, COMBINING[name]);
const STYLE_NAMES = [...Object.keys(FONTS), ...Object.keys(COMBINING)];

export async function fancy(message, client, text, prefix = '.') {
    const input = String(text || '').trim();
    if (!input) {
        let out = '*✨ FANCY TEXT*\n\n';
        for (const n of STYLE_NAMES) out += `🔹 *${n}* ➔ ${styleOf(n, 'Zann')}\n`;
        out += `\n*Usage:*\n${prefix}fancy <Font> | <text>\n${prefix}fancy <text>  _(all styles)_\n\nExample: ${prefix}fancy Cursive | Hello`;
        return say(client, message, out);
    }
    if (input.includes('|')) {
        const [fontRaw, ...rest] = input.split('|');
        const wanted = fontRaw.trim().toLowerCase();
        const body = rest.join('|').trim();
        const name = STYLE_NAMES.find((n) => n.toLowerCase() === wanted || n.toLowerCase().startsWith(wanted));
        if (!name) return say(client, message, `*❌ Font not found:* ${fontRaw.trim()}\nSend *${prefix}fancy* to see the list.`);
        if (!body) return say(client, message, '*❌ Add a text after the | sign.*');
        return say(client, message, styleOf(name, body));
    }
    let out = '';
    for (const n of STYLE_NAMES) out += `${styleOf(n, input)}\n`;
    return say(client, message, out.trim());
}

// ───────────────────────── .videotranscribe ─────────────────────────
const msToTime = (ms = 0) => {
    const total = Math.floor(Number(ms) / 1000);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
export async function videotranscribe(message, client, args, prefix = '.') {
    const url = args[0];
    const lang = args[1] || 'en';
    if (!url || !/^https?:\/\//i.test(url)) {
        return say(client, message, `*📝 VIDEO TRANSCRIBE*\n\n${prefix}videotranscribe <video url> [lang]\nExample: ${prefix}videotranscribe https://youtu.be/xxxx en`);
    }
    await react(client, message, '🕕');
    try {
        const response = await fetch('https://api.proactor.ai:7788/v1/tourists/files/transcription', {
            method: 'POST',
            headers: {
                accept: 'application/json, text/plain, */*',
                'content-type': 'application/json',
                origin: 'https://videotranscriber.ai',
                referer: 'https://videotranscriber.ai/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
            },
            body: JSON.stringify({ track_id: `${crypto.randomUUID()}_${Date.now()}`, fileUrl: url, language: lang }),
            signal: AbortSignal.timeout(120000),
        });
        const raw = await response.text();
        let json;
        try { json = JSON.parse(raw); } catch { throw new Error('Response is not JSON'); }
        const data = Array.isArray(json?.data) ? json.data : [];
        if (json?.code !== 200 || !data.length) throw new Error(json?.msg || json?.message || 'Transcript not found');
        const title = data.find((i) => i?.videoTitle)?.videoTitle || 'No title';
        const transcript = data.map((i) => i?.text || '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        let info = `*📝 VIDEO TRANSCRIBE*\n\n*🎬 Title:* ${title}\n*🗣️ Language:* ${lang.toUpperCase()}\n*🔢 Segments:* ${data.length}\n*⏱️ Start:* ${msToTime(data[0]?.duration)}\n\n*📜 Transcript:*\n${transcript.slice(0, 2500)}`;
        if (transcript.length > 2500) info += '... (text too long)';
        await react(client, message, '✅');
        await say(client, message, info);
    } catch (e) {
        await react(client, message, '❌');
        await say(client, message, `*❌ Failed:* ${e.message || 'Could not process the video'}`);
    }
}

// ───────────────────────── .spotify ─────────────────────────
const SP_BASE = 'https://spotisaver.net';
const SP_LANG = 'en';
const SP_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64json = (d) => Buffer.from(JSON.stringify(d)).toString('base64');

async function spotify(message, client, input, prefix = '.') {
    const text = String(input || '').trim();
    if (!/open\.spotify\.com\/track/i.test(text)) {
        return say(client, message, `*❌ Spotify track link needed.*\n\nExample: ${prefix}spotify https://open.spotify.com/track/3RY0NyQQXxuAiyk5eAS4fC`);
    }
    await react(client, message, '🕕');
    const jar = { '_s-uid': `v_${Math.random().toString(16).slice(2, 16)}.${Math.floor(Math.random() * 1e8)}`, lang: SP_LANG };
    const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    const save = (headers) => {
        const raw = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
        for (const item of raw) { const part = item.split(';')[0]; const i = part.indexOf('='); if (i > -1) jar[part.slice(0, i)] = part.slice(i + 1); }
    };
    const getJson = async (url, extra = {}, referer = `${SP_BASE}/en1`) => {
        const res = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'user-agent': SP_UA, accept: 'application/json', referer, cookie: cookie(), ...extra } });
        save(res.headers);
        const t = await res.text();
        let data = null; try { data = JSON.parse(t); } catch {}
        return { ok: res.ok, data };
    };
    try {
        const url = new URL(text.replace(/\s/g, ''));
        const parts = url.pathname.split('/').filter(Boolean);
        const type = parts[0] || 'track';
        const id = parts[1] || '';
        const pageReferer = `${SP_BASE}/en/${type}/${id}/`;

        for (const u of [`${SP_BASE}/en1`, pageReferer]) {
            const r = await fetch(u, { signal: AbortSignal.timeout(60000), headers: { 'user-agent': SP_UA, cookie: cookie() } }).catch(() => null);
            if (r) { save(r.headers); await r.arrayBuffer().catch(() => null); }
        }
        const sig = async (action, ctx, ref) => getJson(`${SP_BASE}/api/get_signature.php?action=${encodeURIComponent(action)}&ctx=${encodeURIComponent(b64json(ctx))}`, {}, ref);

        const s1 = await sig('get_playlist', { id, type, lang: SP_LANG }, pageReferer);
        if (!s1.ok || !s1.data?.success) throw new Error('Spotify session failed');
        const pl = await getJson(`${SP_BASE}/api/get_playlist.php?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&lang=${SP_LANG}`, { 'x-pe': String(s1.data.exp), 'x-pt': String(s1.data.token) }, pageReferer);
        const track = pl.data?.tracks?.[0];
        if (!track) throw new Error('Track not found');
        const realId = track.id || id;
        const ref2 = `${SP_BASE}/en/track/${realId}/`;
        const s2 = await sig('download_track', { lang: SP_LANG, id: String(realId), name: String(track.name || ''), duration_ms: String(track.duration_ms || '') }, ref2);
        if (!s2.ok || !s2.data?.success) throw new Error('Download key failed');
        const dlUrl = `${SP_BASE}/api/download_track.php?sig=${encodeURIComponent(b64json({ token: String(s2.data.token), exp: String(s2.data.exp) }))}`;
        const body = { track, download_dir: 'downloads', filename_tag: 'kairo', user_ip: [1 + Math.floor(Math.random() * 222), ...Array(3).fill(0).map(() => Math.floor(Math.random() * 256))].join('.'), is_premium: false, lang: SP_LANG };

        let audio = null;
        const delays = [5000, 8000, 12000, 18000, 25000];
        for (let a = 0; a < 5; a++) {
            const res = await fetch(dlUrl, {
                method: 'POST', signal: AbortSignal.timeout(120000),
                headers: { 'user-agent': SP_UA, 'content-type': 'application/json', accept: '*/*', origin: SP_BASE, referer: ref2, cookie: cookie() },
                body: JSON.stringify(body),
            });
            save(res.headers);
            const ct = res.headers.get('content-type') || '';
            const buf = Buffer.from(await res.arrayBuffer());
            if (res.ok && ct.includes('audio')) { audio = buf; break; }
            if (!buf.toString('utf8').includes('No available slots') || a === 4) break;
            await sleep(delays[a]);
        }
        if (!audio) throw new Error('Download failed (server busy)');
        const name = `${(track.artists || []).join(', ') || 'Spotify'} - ${track.name || realId}`.replace(/[\\/:*?"<>|]/g, '').slice(0, 150);
        await client.sendMessage(chatOf(message), { audio, mimetype: 'audio/mpeg', fileName: `${name}.mp3`, ptt: false }, { quoted: message });
        await react(client, message, '✅');
    } catch (e) {
        await react(client, message, '❌');
        await say(client, message, `*❌ Spotify failed:* ${e.message}`);
    }
}
export { spotify };

// ───────────────────────── .capcut ─────────────────────────
export async function capcut(message, client, input, prefix = '.') {
    const url = String(input || '').trim();
    if (!url) return say(client, message, `*⚠️ CAPCUT*\n\nUsage: ${prefix}capcut <url>\nExample: ${prefix}capcut https://www.capcut.com/t/xxx`);
    if (!/capcut\.com/i.test(url)) return say(client, message, '*❌ Invalid URL. Use a CapCut link.*');
    await react(client, message, '🕕');
    try {
        const { capcut: cc } = await import('btch-downloader');
        const data = await cc(url);
        if (!data?.status || !data?.originalVideoUrl) throw new Error('No video found, try another link');
        await client.sendMessage(chatOf(message), { video: { url: data.originalVideoUrl }, caption: data.title ? `*${data.title}*` : '' }, { quoted: message });
        await react(client, message, '✅');
    } catch (e) {
        await react(client, message, '❌');
        await say(client, message, `*❌ CapCut failed:* ${e.message}`);
    }
}

// ───────────────────────── .mediafire ─────────────────────────
export async function mediafire(message, client, input, prefix = '.') {
    const url = String(input || '').trim() || (quotedOf(message)?.conversation || '').trim();
    if (!/^https?:\/\/(www\.)?mediafire\.com\//i.test(url)) return say(client, message, `*Example:* ${prefix}mediafire https://www.mediafire.com/file/xxxx`);
    await react(client, message, '🕕');
    try {
        const { data: html } = await axios.get(url, { timeout: 30000, headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36' } });
        const link = (String(html).match(/href="(https?:\/\/download[^"]+)"/i) || String(html).match(/aria-label="Download file"[^>]*href="([^"]+)"/i) || [])[1];
        if (!link) throw new Error('Download link not found');
        const fileName = decodeURIComponent((link.split('/').pop() || 'mediafire-file').split('?')[0]);
        await client.sendMessage(chatOf(message), { document: { url: link }, fileName, mimetype: 'application/octet-stream', caption: `*📁 ${fileName}*` }, { quoted: message });
        await react(client, message, '✅');
    } catch (e) {
        await react(client, message, '❌');
        await say(client, message, `*❌ Mediafire failed:* ${e.message}`);
    }
}

// ───────────────────────── .movie ─────────────────────────
export async function movie(message, client, title, prefix = '.') {
    const t = String(title || '').trim();
    if (!t) return say(client, message, `*🎬 MOVIE*\n\nUsage: ${prefix}movie <title>\nExample: ${prefix}movie Inception`);
    try {
        const { data: m } = await axios.get(`http://www.omdbapi.com/?apikey=${process.env.OMDB_KEY || '742b2d09'}&t=${encodeURIComponent(t)}&plot=full`, { timeout: 20000 });
        if (m.Response !== 'True') return say(client, message, '*❌ Movie not found.*');
        const poster = m.Poster;
        let msg = '';
        for (const [k, v] of Object.entries(m)) {
            if (['Poster', 'Response', 'Ratings'].includes(k) || v === 'N/A') continue;
            msg += `*${k}:* ${v}\n`;
        }
        if (!poster || poster === 'N/A') return say(client, message, msg.trim());
        await client.sendMessage(chatOf(message), { image: { url: poster }, caption: msg.trim().slice(0, 1000) }, { quoted: message });
    } catch (e) {
        await say(client, message, `*❌ Movie search failed:* ${e.message}`);
    }
}

// ───────────────────────── .blur ─────────────────────────
export async function blur(message, client) {
    const buf = await getImageBuffer(message, client);
    if (!buf) return say(client, message, '*❌ Reply to an image (or send an image with the caption .blur)*');
    try {
        const img = await Jimp.read(buf);
        img.scaleToFit(800, 800).blur(10).quality(80);
        const out = await img.getBufferAsync(Jimp.MIME_JPEG);
        await client.sendMessage(chatOf(message), { image: out, caption: '*[ ✔ ] Image blurred successfully*' }, { quoted: message });
    } catch (e) {
        await say(client, message, `*❌ Failed to blur image:* ${e.message}`);
    }
}

// ───────────────────────── .groupjid ─────────────────────────
export async function groupjid(message, client) {
    const chat = chatOf(message);
    if (!chat.endsWith('@g.us')) return say(client, message, '*❌ This command can only be used in a group.*');
    return say(client, message, `*✅ Group JID:* ${chat}`);
}

// ───────────────────────── .anticall ─────────────────────────
// .anticall off | decline | block   (on = decline)
export async function anticall(message, client, args, isOwner) {
    if (!isOwner) return say(client, message, '*❌ Owner only.*');
    const mode = String(args[0] || '').toLowerCase();
    if (!['off', 'on', 'decline', 'block', 'status'].includes(mode)) {
        return say(client, message, `*📞 ANTICALL*\n\nCurrent: *${String(getSetting('anticall', 'off')).toUpperCase()}*\n\n.anticall off\n.anticall decline\n.anticall block`);
    }
    if (mode === 'status') return say(client, message, `*Anticall is currently ${String(getSetting('anticall', 'off')).toUpperCase()}.*`);
    const value = mode === 'on' ? 'decline' : mode;
    setSetting('anticall', value);
    return say(client, message, `*✅ Anticall set to ${value.toUpperCase()}*`);
}

// ───────────────────────── .antidelete ─────────────────────────
export async function antidelete(message, client, args, isOwner) {
    if (!isOwner) return say(client, message, '*❌ Owner only.*');
    const a = String(args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(a)) {
        return say(client, message, `*ANTIDELETE*\n\nStatus: ${getSetting('antidelete', false) ? '✅ ON' : '❌ OFF'}\n\n.antidelete on\n.antidelete off`);
    }
    setSetting('antidelete', a === 'on');
    return say(client, message, `*Antidelete ${a === 'on' ? 'enabled' : 'disabled'}*`);
}

// ───────────────────────── .antigrouptag ─────────────────────────
export async function antigrouptag(message, client, args, isOwner) {
    const chat = chatOf(message);
    if (!chat.endsWith('@g.us')) return say(client, message, '*❌ Groups only.*');
    let allowed = isOwner;
    if (!allowed) {
        try {
            const meta = await client.groupMetadata(chat);
            const me = senderOf(message);
            allowed = meta.participants.some((p) => p.admin && (p.id === me || p.lid === me || p.phoneNumber === me));
        } catch {}
    }
    if (!allowed) return say(client, message, '*❌ Admins only.*');
    const all = getSetting('antigrouptag', {});
    const first = String(args[0] || '').toLowerCase();
    const second = String(args[1] || '').toLowerCase();
    const usage = '*ANTIGROUPTAG*\n\n.antigrouptag → status\n.antigrouptag on → enable (delete)\n.antigrouptag delete on\n.antigrouptag kick on\n.antigrouptag warn on\n.antigrouptag off → disable';
    if (!first) {
        const cur = all[chat];
        return say(client, message, `*Anti Group Tag:*\nStatus: *${cur?.enabled ? 'ON' : 'OFF'}*\nAction: *${cur?.action || 'delete'}*\n\n${usage}`);
    }
    if (first === 'off') { delete all[chat]; setSetting('antigrouptag', all); return say(client, message, '*✅ Anti Group Tag disabled.*'); }
    if (first === 'on') { all[chat] = { enabled: true, action: 'delete' }; setSetting('antigrouptag', all); return say(client, message, '*✅ Anti Group Tag enabled.* Action: *delete*'); }
    if (['delete', 'kick', 'warn'].includes(first) && second === 'on') {
        all[chat] = { enabled: true, action: first }; setSetting('antigrouptag', all);
        return say(client, message, `*✅ Anti Group Tag enabled.* Action: *${first}*`);
    }
    return say(client, message, usage);
}

// ───────────────────────── .autojoingc ─────────────────────────
export async function autojoingc(message, client, args, isOwner) {
    if (!isOwner) return say(client, message, '*❌ Owner only.*');
    const a = String(args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(a)) {
        return say(client, message, `*🔗 AUTO JOIN GROUP*\n\nStatus: *${getSetting('autojoingc', false) ? 'ON ✅' : 'OFF ❌'}*\n\n.autojoingc on\n.autojoingc off`);
    }
    setSetting('autojoingc', a === 'on');
    return say(client, message, `${a === 'on' ? '✅' : '❌'} Auto join group *${a === 'on' ? 'enabled' : 'disabled'}*`);
}

// ───────────────────────── passive hooks ─────────────────────────
const store = new Map();                 // antidelete: messageId -> { content, mediaType, buffer, sender, chat }
const STORE_MAX = 800;
const GROUP_LINK = /chat\.whatsapp\.com\/([A-Za-z0-9]{18,24})/gi;

function unwrap(msg) {
    return msg?.ephemeralMessage?.message || msg?.viewOnceMessageV2?.message || msg?.viewOnceMessage?.message || msg?.documentWithCaptionMessage?.message || msg;
}

export async function passive(message, client) {
    try {
        const raw = message.message;
        if (!raw || message.key?.fromMe) return;
        const msg = unwrap(raw);
        const chat = chatOf(message);

        // antidelete: a revoke arrives as a protocolMessage of type REVOKE (0)
        if (msg.protocolMessage && msg.protocolMessage.type === 0 && getSetting('antidelete', false)) {
            const id = msg.protocolMessage.key?.id;
            const original = id && store.get(id);
            if (original) {
                const owner = ownerJid(client);
                const who = senderOf(message);
                let head = `*🔰 ANTIDELETE*\n\n*🗑️ Deleted by:* @${who.split('@')[0]}\n*👤 Sender:* @${(original.sender || '').split('@')[0]}\n*🕒 Time:* ${new Date().toLocaleString()}`;
                if (original.content) head += `\n\n*💬 Message:*\n${original.content}`;
                const mentions = [who, original.sender].filter(Boolean);
                await client.sendMessage(owner, { text: head, mentions });
                if (original.buffer && original.mediaType) {
                    const cap = `*Deleted ${original.mediaType}*`;
                    const payload = original.mediaType === 'image' ? { image: original.buffer, caption: cap }
                        : original.mediaType === 'video' ? { video: original.buffer, caption: cap }
                        : original.mediaType === 'audio' ? { audio: original.buffer, mimetype: 'audio/mpeg' }
                        : original.mediaType === 'sticker' ? { sticker: original.buffer } : null;
                    if (payload) await client.sendMessage(owner, payload).catch(() => {});
                }
                store.delete(id);
            }
            return;
        }

        // antidelete: remember incoming messages
        if (getSetting('antidelete', false) && message.key?.id) {
            const entry = { sender: senderOf(message), chat, content: msg.conversation || msg.extendedTextMessage?.text || '', mediaType: '', buffer: null };
            const kind = msg.imageMessage ? 'image' : msg.videoMessage ? 'video' : msg.audioMessage ? 'audio' : msg.stickerMessage ? 'sticker' : '';
            if (kind) {
                const part = msg[`${kind}Message`];
                entry.content = part.caption || entry.content;
                const size = Number(part.fileLength || 0);
                if (size < 8 * 1024 * 1024) {
                    try {
                        entry.buffer = await downloadMediaMessage(message, 'buffer', {}, { reuploadRequest: client.reuploadRequest });
                        entry.mediaType = kind;
                    } catch {}
                }
            }
            store.set(message.key.id, entry);
            if (store.size > STORE_MAX) store.delete(store.keys().next().value);
        }

        // antigrouptag: a status shared to the group
        if (chat.endsWith('@g.us')) {
            const rules = getSetting('antigrouptag', {})[chat];
            if (rules?.enabled) {
                const ctx = (m) => m?.contextInfo;
                const isTag = !!(msg.groupStatusMentionMessage || msg.groupMentionedMessage || msg.statusMentionMessage ||
                    ctx(msg.imageMessage)?.remoteJid === 'status@broadcast' || ctx(msg.videoMessage)?.remoteJid === 'status@broadcast' ||
                    ctx(msg.extendedTextMessage)?.remoteJid === 'status@broadcast' ||
                    ctx(msg.imageMessage)?.groupMentions?.length || ctx(msg.videoMessage)?.groupMentions?.length || ctx(msg.extendedTextMessage)?.groupMentions?.length);
                if (isTag) {
                    const sender = senderOf(message);
                    const meta = await client.groupMetadata(chat);
                    const isAdm = meta.participants.some((p) => p.admin && (p.id === sender || p.lid === sender));
                    if (!isAdm) {
                        await client.sendMessage(chat, { delete: message.key }).catch(() => {});
                        const num = sender.split('@')[0];
                        if (rules.action === 'kick') {
                            await client.groupParticipantsUpdate(chat, [sender], 'remove').catch(() => {});
                            await client.sendMessage(chat, { text: `👢 @${num} was removed for tagging this group in a status.`, mentions: [sender] });
                        } else if (rules.action === 'warn') {
                            await client.sendMessage(chat, { text: `⚠️ @${num} Warning: do not tag this group in your status!`, mentions: [sender] });
                        } else {
                            await client.sendMessage(chat, { text: `🚫 @${num} Status tags are not allowed in this group.`, mentions: [sender] });
                        }
                    }
                }
            }
        }

        // autojoingc: group invite links seen in chat
        if (getSetting('autojoingc', false)) {
            const body = msg.conversation || msg.extendedTextMessage?.text || '';
            const matches = [...body.matchAll(GROUP_LINK)];
            for (const m of matches) {
                try { await client.groupAcceptInvite(m[1]); }
                catch (e) {
                    const t = String(e?.message || e);
                    if (/already|participant/i.test(t)) await say(client, message, '⚠️ Already in that group');
                    else if (/expired|revoked|gone/i.test(t)) await say(client, message, '❌ Group link expired/revoked');
                }
            }
        }
    } catch (e) {
        console.warn('[more:passive]', e?.message || e);
    }
}

// Call events (anticall). Call this once per socket.
export function attachExtraEvents(sock) {
    if (sock._moreEvents) return;
    sock._moreEvents = true;
    sock.ev.on('call', async (calls) => {
        const mode = getSetting('anticall', 'off');
        if (mode === 'off') return;
        for (const call of calls || []) {
            if (call.status !== 'offer') continue;
            try {
                await sock.rejectCall(call.id, call.from);
                if (mode === 'block') await sock.updateBlockStatus(call.from, 'block');
            } catch (e) { console.warn('[anticall]', e?.message || e); }
        }
    });
}

export default {
    fullpp, pinterest, idch, fancy, videotranscribe, spotify, capcut, mediafire, movie, blur,
    groupjid, anticall, antidelete, antigrouptag, autojoingc, passive, attachExtraEvents,
};
