import axios from 'axios';
import { BOT_NAME } from '../config.js';

const say = (client, message, text) =>
    client.sendMessage(message.key.remoteJid, { text }, { quoted: message });
const react = async (client, message, emoji) => {
    try { await client.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
};

// ─── .gpt <question> ────────────────────────────────────────────────────────
export async function gpt(message, client, query) {
    if (!query) return say(client, message, '❌ Usage: .gpt <question>');
    await react(client, message, '🤖');
    try {
        const apiUrl = `https://all-in-1-ais.officialhectormanuel.workers.dev/?query=${encodeURIComponent(query)}&model=gpt-4.5`;
        const { data } = await axios.get(apiUrl, { timeout: 60000 });
        const answer = data?.success && data?.message?.content;
        if (!answer) throw new Error('Invalid GPT response');
        await say(client, message, answer);
    } catch (error) {
        console.error('[GPT]', error?.message || error);
        await say(client, message, '❌ GPT failed to answer. Try again later.');
    }
}

// ─── .sora <prompt> (text → video) ──────────────────────────────────────────
export async function sora(message, client, query) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    const input = (query || quotedText || '').trim();

    if (!input) return say(client, message, 'Provide a prompt. Example: .sora anime girl with short blue hair');

    await react(client, message, '🎬');
    try {
        const apiUrl = `https://okatsu-rolezapiiz.vercel.app/ai/txt2video?text=${encodeURIComponent(input)}`;
        const { data } = await axios.get(apiUrl, { timeout: 60000, headers: { 'user-agent': 'Mozilla/5.0' } });
        const videoUrl = data?.videoUrl || data?.result || data?.data?.videoUrl;
        if (!videoUrl) throw new Error('No videoUrl in API response');

        await client.sendMessage(message.key.remoteJid, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: `Prompt: ${input}`
        }, { quoted: message });
        await react(client, message, '✅');
    } catch (error) {
        console.error('[SORA]', error?.message || error);
        await say(client, message, '❌ Failed to generate video. Try a different prompt later.');
    }
}

// ─── .veo3 <prompt> (text → video) ──────────────────────────────────────────
const VEO_API = 'https://text2video.officialhectormanuel.workers.dev';

async function generateVeoVideo(prompt) {
    const res = await axios.get(`${VEO_API}/generate`, { params: { prompt, aspect: '16:9' }, timeout: 60000 });
    if (!res.data?.status || !res.data?.download_url) throw new Error('API did not return a download URL');
    const videoRes = await axios.get(res.data.download_url, { responseType: 'arraybuffer', timeout: 120000 });
    return Buffer.from(videoRes.data);
}

export async function veo3(message, client, query) {
    const chatId = message.key.remoteJid;
    if (!query) return say(client, message, '🎬 Provide a prompt.\nExample: .veo3 a cat playing piano on the moon');

    await react(client, message, '🎬');
    await say(client, message, '⏳ Generating your AI video, this can take a minute...');
    try { await client.sendPresenceUpdate('recording', chatId); } catch {}

    try {
        const videoBuffer = await generateVeoVideo(query);
        await client.sendMessage(chatId, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            caption: `🎬 *AI Video Generated*\n\n📝 Prompt: _${query}_\n\n_Powered by ${BOT_NAME}_`
        }, { quoted: message });
        await react(client, message, '✅');
    } catch (err) {
        console.error('[VEO3]', err?.message || err);
        await say(client, message, '❌ Video generation failed. Try again later.');
        await react(client, message, '❌');
    } finally {
        try { await client.sendPresenceUpdate('paused', chatId); } catch {}
    }
}

export default { gpt, sora, veo3 };
