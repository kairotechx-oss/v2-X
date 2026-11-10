import axios from 'axios';
import crypto from 'crypto';
import { generateWAMessageFromContent, generateWAMessage, jidNormalizedUser } from '@whiskeysockets/baileys';

// ─── .waifu — random SFW anime images, sent as an album ─────────────────────
// Several image services are tried in turn, because some hosts cannot be
// reached from every server (ENOTFOUND = that domain does not resolve here).
const SOURCES = [
    {
        name: 'waifu.pics',
        get: async () => {
            const r = await axios.post('https://api.waifu.pics/many/sfw/waifu', { exclude: [] }, { timeout: 20000 });
            return (r.data?.files || []).slice(0, 10);
        }
    },
    {
        name: 'nekos.best',
        get: async () => {
            const r = await axios.get('https://nekos.best/api/v2/waifu', { params: { amount: 10 }, timeout: 20000 });
            return (r.data?.results || []).map((x) => x.url);
        }
    },
    {
        name: 'waifu.im',
        get: async () => {
            const r = await axios.get('https://api.waifu.im/images', {
                params: { isNsfw: 'false', orderBy: 'Random', page: 1, pageSize: 10 }, timeout: 20000
            });
            return (r.data?.items || []).map((i) => i.url);
        }
    }
];

async function fetchImages() {
    for (const source of SOURCES) {
        try {
            const urls = (await source.get()).filter(Boolean);
            if (urls.length) return { urls, source: source.name };
        } catch (e) {
            console.log(`[waifu] ${source.name} failed:`, e.code || e.message);
        }
    }
    return { urls: [], source: null };
}

export async function waifu(message, client, args = []) {
    const from = message.key.remoteJid;
    const q = { quoted: message };

    if ((args[0] || '').toLowerCase() === 'nsfw') {
        return client.sendMessage(from, { text: '🌸 Only safe-for-work images are available. Use *.waifu*' }, q);
    }

    try {
        await client.sendMessage(from, { react: { text: '🕕', key: message.key } });

        const { urls, source } = await fetchImages();
        if (!urls.length) {
            await client.sendMessage(from, { react: { text: '❌', key: message.key } });
            return client.sendMessage(from, { text: '❌ The image services cannot be reached right now. Try again in a moment.' }, q);
        }

        await client.sendMessage(from, { text: `🌸 *WAIFU COLLECTION*\n\n${urls.length} images for you ✨` }, q);

        // Preferred: one WhatsApp album. If it can't be built, send them one by one.
        try {
            const opener = generateWAMessageFromContent(from, {
                messageContextInfo: { messageSecret: crypto.randomBytes(32) },
                albumMessage: { expectedImageCount: urls.length, expectedVideoCount: 0 }
            }, { userJid: jidNormalizedUser(client.user.id), quoted: message, upload: client.waUploadToServer });

            await client.relayMessage(opener.key.remoteJid, opener.message, { messageId: opener.key.id });

            for (const url of urls) {
                const msg = await generateWAMessage(opener.key.remoteJid, { image: { url } }, { upload: client.waUploadToServer });
                msg.message.messageContextInfo = {
                    messageSecret: crypto.randomBytes(32),
                    messageAssociation: { associationType: 1, parentMessageKey: opener.key }
                };
                await client.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
            }
        } catch (albumErr) {
            console.log('[waifu] album failed, sending one by one:', albumErr?.message || albumErr);
            for (const url of urls.slice(0, 5)) {
                try { await client.sendMessage(from, { image: { url } }); } catch {}
            }
        }

        await client.sendMessage(from, { react: { text: '✅', key: message.key } });
        console.log(`[waifu] sent ${urls.length} images from ${source}`);
    } catch (e) {
        console.error('[waifu]', e?.message || e);
        await client.sendMessage(from, { text: `❌ Something went wrong: ${e.message}` }, q);
    }
}

export default { waifu };
