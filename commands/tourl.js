import fs from 'fs';
import path from 'path';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { OWNER_NAME } from '../config.js';

// Finds media in the message itself, otherwise in the quoted (replied-to) message.
function findMedia(msg) {
    const m = msg || {};
    if (m.imageMessage)    return { kind: 'image',    node: m.imageMessage,    ext: '.jpg' };
    if (m.videoMessage)    return { kind: 'video',    node: m.videoMessage,    ext: '.mp4' };
    if (m.audioMessage)    return { kind: 'audio',    node: m.audioMessage,    ext: '.mp3' };
    if (m.stickerMessage)  return { kind: 'sticker',  node: m.stickerMessage,  ext: '.webp' };
    if (m.documentMessage) {
        const ext = path.extname(m.documentMessage.fileName || '') || '.bin';
        return { kind: 'document', node: m.documentMessage, ext };
    }
    return null;
}

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };

async function toBlobForm(buffer, mimeType, fileName, field, extra = {}) {
    const form = new FormData();
    for (const [k, v] of Object.entries(extra)) form.append(k, v);
    form.append(field, new Blob([buffer], { type: mimeType }), fileName);
    return form;
}

async function uploadCatbox(buffer, mimeType, fileName) {
    const form = await toBlobForm(buffer, mimeType, fileName, 'fileToUpload', { reqtype: 'fileupload' });
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, headers: UA });
    const url = (await res.text()).trim();
    if (!res.ok || !url.startsWith('http')) throw new Error(`Catbox: ${url.slice(0, 80) || res.status}`);
    return url;
}

async function uploadUguu(buffer, mimeType, fileName) {
    const form = await toBlobForm(buffer, mimeType, fileName, 'files[]');
    const res = await fetch('https://uguu.se/upload.php', { method: 'POST', body: form, headers: UA });
    const data = await res.json().catch(() => null);
    const url = data?.files?.[0]?.url;
    if (!res.ok || !url) throw new Error(`Uguu: HTTP ${res.status}`);
    return url;
}

async function uploadTmpfiles(buffer, mimeType, fileName) {
    const form = await toBlobForm(buffer, mimeType, fileName, 'file');
    const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: form, headers: UA });
    const data = await res.json().catch(() => null);
    const url = data?.data?.url;
    if (!res.ok || !url) throw new Error(`Tmpfiles: HTTP ${res.status}`);
    return url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

export async function tourl(message, client) {
    const remoteJid = message.key.remoteJid;
    const q = { quoted: message };

    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let media = findMedia(message.message);
        let source = message;
        if (!media) {
            media = findMedia(quoted);
            source = { key: message.key, message: quoted };
        }

        if (!media) {
            return client.sendMessage(remoteJid, {
                text: '❌ Send or reply to a media (image, video, audio, sticker, document) to get a URL.'
            }, q);
        }

        const buffer = await downloadMediaMessage(
            source, 'buffer', {}, { reuploadRequest: client.reuploadRequest }
        );

        const mimeType = media.node.mimetype || 'application/octet-stream';
        const fileName = `upload-${Date.now()}${media.ext}`;

        // Upload with fallbacks: Catbox → Uguu → Tmpfiles
        let url = '';
        const errors = [];
        for (const uploader of [uploadCatbox, uploadUguu, uploadTmpfiles]) {
            try { url = await uploader(buffer, mimeType, fileName); if (url) break; }
            catch (e) { errors.push(e.message); console.log('[TOURL]', e.message); }
        }

        if (!url) throw new Error(errors.join(' | ') || 'all uploads failed');

        await client.sendMessage(remoteJid, { text: `✅ URL:\n${url}\n\n> Powered by ${OWNER_NAME}` }, q);
    } catch (err) {
        console.error('[TOURL] error:', err?.message || err);
        await client.sendMessage(remoteJid, { text: `❌ Failed to convert media to URL.\n_${err.message}_` }, q);
    }
}

export default tourl;
