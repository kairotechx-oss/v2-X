// .snap / .snapchat / .sc <snapchat link> — download a public Snapchat video/photo.
// No third-party downloader: reads the public page's og:video / og:image tags.
import axios from 'axios';
import { OWNER_NAME } from '../config.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x2F;/g, '/').replace(/\\u002F/g, '/');
const meta = (html, prop) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
    return decode((html.match(re) || html.match(re2) || [])[1] || '');
};

async function resolveSnap(url) {
    const res = await axios.get(url, {
        timeout: 30000,
        maxRedirects: 5,
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const html = String(res.data || '');

    let video = meta(html, 'og:video:secure_url') || meta(html, 'og:video') || meta(html, 'twitter:player:stream');
    if (!video) {
        const m = html.match(/"contentUrl"\s*:\s*"([^"]+)"/) || html.match(/"mediaUrl"\s*:\s*"([^"]+)"/);
        if (m) video = decode(m[1]);
    }
    const image = meta(html, 'og:image');
    const title = meta(html, 'og:title') || 'Snapchat';

    if (video && /\.(mp4|mov)|video/i.test(video)) return { type: title, mediaType: 'video', url: video };
    if (image) return { type: title, mediaType: 'image', url: image };
    throw new Error('No downloadable media found (the snap may be private or expired)');
}

export async function snap(message, client) {
    const chatId = message.key.remoteJid;
    const q = { quoted: message };
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    let url = text.split(/\s+/).slice(1).join(' ').trim();

    if (!url) {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text ||
            quoted?.imageMessage?.caption || quoted?.videoMessage?.caption || '').trim();
        url = (quotedText.match(/https?:\/\/[^\s]+/) || [])[0] || '';
    }

    if (!url) return client.sendMessage(chatId, { text: '❌ Provide a Snapchat link.\nExample: .snap https://www.snapchat.com/spotlight/xxxx' }, q);
    if (!/snapchat\.com|snap\.com/i.test(url)) return client.sendMessage(chatId, { text: '❌ That is not a valid Snapchat link.' }, q);

    try { await client.sendMessage(chatId, { react: { text: '⏳', key: message.key } }); } catch {}

    try {
        const data = await resolveSnap(url);
        const caption = `*${data.type}*\n\n📥 Downloaded by ${OWNER_NAME}`;

        const media = await axios.get(data.url, {
            responseType: 'arraybuffer', timeout: 90000,
            headers: { 'User-Agent': UA, Referer: 'https://www.snapchat.com/' },
            maxContentLength: 100 * 1024 * 1024,
        });
        const buffer = Buffer.from(media.data);
        if (!buffer.length) throw new Error('Downloaded file is empty');

        if (data.mediaType === 'video') {
            await client.sendMessage(chatId, { video: buffer, mimetype: 'video/mp4', caption }, q);
        } else {
            await client.sendMessage(chatId, { image: buffer, caption }, q);
        }
        try { await client.sendMessage(chatId, { react: { text: '✅', key: message.key } }); } catch {}
    } catch (error) {
        console.error('[SNAP]', error?.message || error);
        await client.sendMessage(chatId, { text: `❌ Failed to download the snap.\n\n_${error.message}_` }, q);
    }
}

export default { snap };
