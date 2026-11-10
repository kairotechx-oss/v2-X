import axios from 'axios';
import crypto from 'crypto';
import { generateWAMessageFromContent, generateWAMessage, jidNormalizedUser } from '@whiskeysockets/baileys';

// ─── .waifu — 10 random SFW anime images (Waifu.im), sent as an album ───────
export async function waifu(message, client, args = []) {
    const from = message.key.remoteJid;
    const q = { quoted: message };

    if ((args[0] || '').toLowerCase() === 'nsfw') {
        return client.sendMessage(from, { text: '🌸 Only safe-for-work images are available. Use *.waifu*' }, q);
    }

    try {
        await client.sendMessage(from, { react: { text: '🕕', key: message.key } });

        const res = await axios.get('https://api.waifu.im/images', {
            params: { isNsfw: 'false', orderBy: 'Random', page: 1, pageSize: 10 },
            timeout: 30000
        });

        const urls = (res.data?.items || []).map((i) => i.url).filter(Boolean);
        if (!urls.length) {
            return client.sendMessage(from, { text: '❌ No image found right now, try again.' }, q);
        }

        await client.sendMessage(from, { text: `🌸 *WAIFU COLLECTION*\n\n${urls.length} images for you ✨` }, q);

        // Preferred: one WhatsApp album. If the library can't build it, send them one by one.
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
                await client.sendMessage(from, { image: { url } });
            }
        }

        await client.sendMessage(from, { react: { text: '✅', key: message.key } });
    } catch (e) {
        console.error('[waifu]', e?.message || e);
        await client.sendMessage(from, { text: `❌ The image service is unavailable: ${e.message}` }, q);
    }
}

export default { waifu };
