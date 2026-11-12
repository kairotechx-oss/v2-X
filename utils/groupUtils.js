// Small helpers shared by the group commands (admin checks that also work with LID ids).
const norm = (id) => String(id || '').replace(/:\d+(?=@)/, '');

export async function getGroupContext(client, message) {
    const chatId = message.key.remoteJid;
    const meta = await client.groupMetadata(chatId);

    const senderIds = [message.key.participant, message.key.participantAlt, message.participant]
        .filter(Boolean).map(norm);
    const botIds = [client.user?.id, client.user?.lid].filter(Boolean).map(norm);

    const admins = meta.participants.filter(p => p.admin);
    const idsOf = (p) => [p.id, p.phoneNumber, p.lid, p.jid].filter(Boolean).map(norm);
    const matches = (p, ids) => idsOf(p).some(x => ids.includes(x));

    return {
        meta,
        isAdmin: message.key.fromMe || admins.some(p => matches(p, senderIds)),
        isBotAdmin: admins.some(p => matches(p, botIds)),
    };
}

export function phoneOf(participant) {
    const candidates = [participant.phoneNumber, participant.jid, participant.id];
    for (const c of candidates) {
        if (c && /@s\.whatsapp\.net$/.test(c)) return c.split('@')[0].split(':')[0];
    }
    return null;
}
