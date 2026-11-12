import { getGroupContext, phoneOf } from '../utils/groupUtils.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';

const say = (client, message, text) =>
    client.sendMessage(message.key.remoteJid, { text }, { quoted: message });

// .resetlink — revoke the invite link and send the new one (group admins only)
export async function resetlink(message, client) {
    const chatId = message.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return say(client, message, '❌ Groups only.');
    try {
        const { isAdmin, isBotAdmin } = await getGroupContext(client, message);
        if (!isAdmin) return say(client, message, '❌ Only admins can use this command!');
        if (!isBotAdmin) return say(client, message, '❌ Bot must be admin to reset group link!');

        const newCode = await client.groupRevokeInvite(chatId);
        await say(client, message, `✅ Group link has been successfully reset\n\n📌 New link:\nhttps://chat.whatsapp.com/${newCode}`);
    } catch (error) {
        console.error('[resetlink]', error?.message || error);
        await say(client, message, '❌ Failed to reset group link!');
    }
}

// .saveppgc — send the group profile picture
export async function saveppgc(message, client) {
    const chatId = message.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return say(client, message, '❌ Groups only.');

    let groupName = chatId.split('@')[0];
    try { const m = await client.groupMetadata(chatId); groupName = m.subject || groupName; } catch {}

    try {
        const picUrl = await client.profilePictureUrl(chatId, 'image');
        await client.sendMessage(chatId, { image: { url: picUrl }, caption: `*Group Picture of* ${groupName}` }, { quoted: message });
    } catch {
        await say(client, message, '❌ Group has no picture.');
    }
}

// .vcf — export the group contacts as a .vcf file (group admins only)
export async function vcf(message, client) {
    const chatId = message.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return say(client, message, '❌ Groups only!');

    try {
        const { meta, isAdmin } = await getGroupContext(client, message);
        if (!isAdmin) return say(client, message, '❌ Admins only!');

        try { await client.sendMessage(chatId, { react: { text: '⏳', key: message.key } }); } catch {}

        let vcard = '';
        let counter = 1;
        for (const member of meta.participants) {
            const num = phoneOf(member);
            if (!num || !/^\d+$/.test(num)) continue;
            vcard += `BEGIN:VCARD\nVERSION:3.0\nFN:${OWNER_NAME} ${counter++}\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD\n`;
        }

        if (!vcard.trim()) {
            await say(client, message, '❌ Could not extract any phone numbers (the group hides them).');
            try { await client.sendMessage(chatId, { react: { text: '❌', key: message.key } }); } catch {}
            return;
        }

        const fileName = `Contacts_${meta.subject.replace(/[^\w-]+/g, '_')}.vcf`;
        await client.sendMessage(chatId, {
            document: Buffer.from(vcard.trim(), 'utf8'),
            mimetype: 'text/vcard',
            fileName,
            caption: `Contacts for *${meta.subject}*\n\n©${BOT_NAME}`
        }, { quoted: message });
        try { await client.sendMessage(chatId, { react: { text: '✅', key: message.key } }); } catch {}
    } catch (error) {
        console.error('[vcf]', error?.message || error);
        await say(client, message, '❌ Failed to export contacts.');
    }
}

export default { resetlink, saveppgc, vcf };
