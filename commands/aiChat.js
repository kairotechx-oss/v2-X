import axios from 'axios';

// ─── .deepseek / .claude ────────────────────────────────────────────────────
// Railway variables:
//   DEEPSEEK_API_KEY   key from platform.deepseek.com      (for .deepseek)
//   DEEPSEEK_MODEL     optional, default: deepseek-reasoner (shows the thinking)
//   ANTHROPIC_API_KEY  key from console.anthropic.com       (for .claude)
//   CLAUDE_MODEL       optional, default: claude-haiku-5-5
const lastUse = new Map();

function tooFast(sender, ms = 10000) {
    const now = Date.now();
    if (now - (lastUse.get(sender) || 0) < ms) return true;
    lastUse.set(sender, now);
    return false;
}

const cut = (s, n = 4000) => (s.length > n ? s.slice(0, n) + '\n\n... (cut)' : s);

async function react(client, message, emoji) {
    try { await client.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

export async function deepseek(message, client, text) {
    const from = message.key.remoteJid;
    const q = { quoted: message };
    const sender = message.key.participant || from;

    if (!text) {
        return client.sendMessage(from, {
            text: '🧠 *DeepSeek*\n\nAI that thinks before it answers.\n\n*Usage:* .deepseek <question>\n*Example:* .deepseek Explain black holes'
        }, q);
    }

    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
        return client.sendMessage(from, { text: '❌ DeepSeek is not set up. The owner must add *DEEPSEEK_API_KEY* in the Railway variables.' }, q);
    }
    if (tooFast(sender)) return client.sendMessage(from, { text: '⏳ Wait a few seconds before asking again.' }, q);

    await react(client, message, '🕕');
    try {
        const res = await axios.post('https://api.deepseek.com/chat/completions', {
            model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner',
            messages: [{ role: 'user', content: text }],
            stream: false
        }, {
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            timeout: 180000
        });

        const msg = res.data?.choices?.[0]?.message || {};
        const answer = (msg.content || '').trim();
        if (!answer) throw new Error('Empty response');

        let reply = '';
        if (msg.reasoning_content) {
            const preview = msg.reasoning_content.length > 800 ? msg.reasoning_content.slice(0, 800) + '...' : msg.reasoning_content;
            reply += `💭 *Thinking:*\n> ${preview.replace(/\n/g, '\n> ')}\n\n`;
        }
        reply += answer;

        await client.sendMessage(from, { text: cut(reply) }, q);
        await react(client, message, '✅');
    } catch (e) {
        const status = e.response?.status;
        const why = status === 401 ? 'Invalid DEEPSEEK_API_KEY.'
            : status === 402 ? 'DeepSeek balance is empty.'
            : status === 429 ? 'Too many requests, try again later.'
            : (e.response?.data?.error?.message || e.message);
        console.error('[deepseek]', why);
        await react(client, message, '❌');
        await client.sendMessage(from, { text: `❌ *DeepSeek failed*\n\n> ${why}` }, q);
    }
}

export async function claude(message, client, text) {
    const from = message.key.remoteJid;
    const q = { quoted: message };
    const sender = message.key.participant || from;

    if (!text) {
        return client.sendMessage(from, {
            text: '🤍 *Claude*\n\nFast and smart AI for everyday questions.\n\n*Usage:* .claude <question>\n*Example:* .claude Tips to stay productive'
        }, q);
    }

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
        return client.sendMessage(from, { text: '❌ Claude is not set up. The owner must add *ANTHROPIC_API_KEY* in the Railway variables.' }, q);
    }
    if (tooFast(sender)) return client.sendMessage(from, { text: '⏳ Wait a few seconds before asking again.' }, q);

    await react(client, message, '🕕');
    try {
        const res = await axios.post('https://api.anthropic.com/v1/messages', {
            model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
            max_tokens: 1024,
            messages: [{ role: 'user', content: text }]
        }, {
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
            timeout: 120000
        });

        const answer = (res.data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (!answer) throw new Error('Empty response');

        await client.sendMessage(from, { text: cut(answer) }, q);
        await react(client, message, '✅');
    } catch (e) {
        const status = e.response?.status;
        const why = status === 401 ? 'Invalid ANTHROPIC_API_KEY.'
            : status === 429 ? 'Too many requests, try again later.'
            : (e.response?.data?.error?.message || e.message);
        console.error('[claude]', why);
        await react(client, message, '❌');
        await client.sendMessage(from, { text: `❌ *Claude failed*\n\n> ${why}` }, q);
    }
}

export default { deepseek, claude };
