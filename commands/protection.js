import configManager from '../utils/manageConfigs.js';
import group from './group.js';
import { OWNER_NUM } from '../config.js';

// ─── .antimedia on/off and .antibot on/off (group protection) ───────────────
const norm = (j) => String(j || '').replace(/:\d+(?=@)/, '');

function groupCfg(id) {
    configManager.config.groups ||= {};
    configManager.config.groups[id] ||= {};
    return configManager.config.groups[id];
}

function unwrap(m) {
    let cur = m;
    for (let i = 0; i < 4 && cur; i++) {
        const inner = cur.ephemeralMessage?.message || cur.viewOnceMessage?.message ||
            cur.viewOnceMessageV2?.message || cur.documentWithCaptionMessage?.message;
        if (!inner) break;
        cur = inner;
    }
    return cur || {};
}

async function canToggle(message, client, isOwner) {
    if (isOwner || message.key.fromMe) return true;
    const ids = [message.key.participant, message.key.participantAlt].filter(Boolean);
    return group.isAdmin(client, message.key.remoteJid, ...ids);
}

async function toggle(message, client, args, isOwner, key, title, extra) {
    const from = message.key.remoteJid;
    const q = { quoted: message };
    if (!from.endsWith('@g.us')) return client.sendMessage(from, { text: '👥 This command only works in groups.' }, q);
    if (!(await canToggle(message, client, isOwner))) {
        return client.sendMessage(from, { text: '❌ Only group admins (or the owner) can change this.' }, q);
    }

    const cfg = groupCfg(from);
    const action = (args[0] || '').toLowerCase();

    if (action === 'on' || action === 'off') {
        cfg[key] = action === 'on';
        configManager.save();
        return client.sendMessage(from, { text: `${cfg[key] ? '✅' : '❌'} *${title} ${cfg[key] ? 'enabled' : 'disabled'}*${cfg[key] ? `\n${extra}` : ''}` }, q);
    }
    return client.sendMessage(from, { text: `*${title}*\n\n> Status: *${cfg[key] ? 'ON' : 'OFF'}*\n> Use: .${key} on / off\n\n${extra}` }, q);
}

export const antimedia = (message, client, args, isOwner) =>
    toggle(message, client, args, isOwner, 'antimedia', 'AntiMedia', 'Images, videos, audio and documents from non-admins are deleted. The bot must be admin.');

export const antibot = (message, client, args, isOwner) =>
    toggle(message, client, args, isOwner, 'antibot', 'AntiBot', 'WhatsApp bots sending bot-only messages are deleted and removed. The bot must be admin.');

// Conservative bot detection: only strong signals, to avoid removing real people.
function looksLikeBot(message) {
    const id = String(message.key?.id || '');
    const msg = unwrap(message.message);
    let score = 0;

    if (/^BAE5[0-9A-F]{12}$/i.test(id)) score += 5;                       // classic Baileys message id
    for (const t of ['buttonsMessage', 'templateMessage', 'listMessage', 'interactiveMessage']) {
        if (msg[t]) { score += 5; break; }                                  // normal users cannot send these
    }
    const ctx = msg.extendedTextMessage?.contextInfo || msg.imageMessage?.contextInfo || msg.videoMessage?.contextInfo || {};
    if (ctx.externalAdReply) score += 4;                                    // fake ad preview cards

    return score >= 5;
}

// Called for every group message. Returns true when the message was removed.
export async function enforce(message, client) {
    const from = message.key?.remoteJid;
    if (!from?.endsWith('@g.us') || message.key.fromMe) return false;

    const cfg = configManager.config.groups?.[from];
    if (!cfg?.antimedia && !cfg?.antibot) return false;

    const msg = unwrap(message.message);
    const isMedia = !!(msg.imageMessage || msg.videoMessage || msg.audioMessage || msg.documentMessage);
    const mediaHit = cfg.antimedia && isMedia;
    const botHit = cfg.antibot && looksLikeBot(message);
    if (!mediaHit && !botHit) return false;

    const sender = message.key.participant || message.key.participantAlt;
    const senderIds = [message.key.participant, message.key.participantAlt].filter(Boolean);
    const ownerNumber = String(OWNER_NUM).replace(/\D/g, '');
    if (senderIds.some((j) => norm(j).split('@')[0] === ownerNumber)) return false;

    if (await group.isAdmin(client, from, ...senderIds)) return false;

    const botIds = [client.user?.id, client.user?.lid].filter(Boolean);
    if (!(await group.isAdmin(client, from, ...botIds))) return false;

    try { await client.sendMessage(from, { delete: message.key }); } catch {}

    const number = String(sender || '').split('@')[0].split(':')[0];
    if (botHit) {
        try { await client.groupParticipantsUpdate(from, [sender], 'remove'); } catch {}
        await client.sendMessage(from, { text: `🤖 *AntiBot* — @${number} looked like a bot and was removed.`, mentions: [sender] });
    } else {
        await client.sendMessage(from, { text: `⚠️ *AntiMedia* — media from @${number} was deleted.`, mentions: [sender] });
    }
    return true;
}

export default { antimedia, antibot, enforce };
