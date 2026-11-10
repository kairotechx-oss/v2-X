import configManager from '../utils/manageConfigs.js';
import fs from 'fs';
import path from 'path';

// Mathematical bold letters/digits (𝐀𝐁𝐂 𝟎𝟏𝟐) used by the menu style
const bold = (s) => [...String(s)].map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D400 + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D41A + c - 97);
    if (c >= 48 && c <= 57) return String.fromCodePoint(0x1D7CE + c - 48);
    return ch;
}).join('');

// Every command listed here has a handler in events/messageHandler.js.
// The command total in the header is computed from this list.
const CATEGORIES = [
    ['🧸', 'MENU', ['menu', 'alive', 'runtime']],
    ['🛠️', 'TOOLS', ['ping', 'getid', 'idch', 'pair', 'sudo', 'tourl', 'owner', 'fancy', 'update', 'device', 'delsudo', 'getsudo']],
    ['⚙️', 'CONFIG', ['online', 'welcome', 'goodbye', 'autotype', 'autoreact', 'setprefix', 'getconfig', 'statuslike', 'autorecord', 'chreact', 'autoview', 'likeemoji', 'private', 'public']],
    ['👥', 'GROUP', ['delete', 'bye', 'kick', 'add', 'purge', 'mute', 'unmute', 'promote', 'demote', 'gclink', 'antilink', 'antimedia', 'antibot', 'kickall', 'promoteall', 'demoteall', 'groupstatus', 'creategc']],
    ['🎥', 'MEDIA', ['vv', 'take', 'save', 'photo', 'setpp', 'grtpp', 'toaudio', 'sticker', 'logo', 'aiimage', 'telegram', 'toimage']],
    ['🔍', 'SEARCH', ['ask', 'wiki-en', 'wiki-fr']],
    ['📥', 'DOWNLOAD', ['play', 'tiktok', 'ig', 'apk', 'song', 'video', 'video1', 'fb']],
    ['🎌', 'ANIME', ['waifu']],
    ['🤖', 'AI', ['deepseek', 'claude']],
    ['🎮', 'GAME', ['zonic']],
    ['🆕', 'NEW', ['jid', 'groupinfo', 'admins', 'members', 'botinfo', 'calc', 'quote', 'help']],
    ['🏷️', 'TAGS', ['tag', 'tagadmin', 'tagall', 'settag', 'response']],
];

const COMMAND_COUNT = CATEGORIES.reduce((n, [, , list]) => n + list.length, 0);
const VERSION = '1.1.0';

export async function info(message, client) {
    const remoteJid = message.key.remoteJid;
    const number = client.user.id.split(':')[0];
    const prefix = configManager.config.users?.[number]?.prefix || '.';

    const up = Math.floor(process.uptime());
    const runtime = `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m ${up % 60}s`;

    const mode = String(configManager.config.botMode || 'public').toUpperCase();

    const sections = CATEGORIES.map(([icon, title, list]) =>
`『 ${icon} 』${bold(title)}
╭─────────────────╾━━━⟡
${list.map((c) => `┊ ◈ ${prefix}${c}`).join('\n')}
╰─────────────────━━━𖤓`).join('\n\n');

    const caption =
`╭━━━〔 ${bold('KAIRO ZYNEX')} 〕╾━━━⟡
┃✧ ${bold('OWNER')} : ${bold('KAIRO DEV')}
┃✧ ${bold('COMMANDS')} : ${bold(COMMAND_COUNT)}
┃✧ ${bold('RUNTIME')} : ${bold(runtime)}
┃✧ ${bold('PREFIX')} : ${prefix}
┃✧ ${bold('MODE')} : ${bold(mode)}
┃✧ ${bold('VERSION')} : ${bold(VERSION)}
╰━━━━━━━━━━━━━━━━━━━𖤓

${sections}

╭━━━〔 ${bold('EXTRA')} 〕━━━⊷
┊ ✧ ${bold('STATUS SAVER')}
┊ Reply: ${bold('send')} / ${bold('sendme')} / ${bold('save')}
┊ ${bold('OWNER ONLY')}
┊
┊ ✧ ${bold('PAIRING WEBSITE')}
┊ https://zynex-pair-code.up.railway.app
╰━━━━━━━━━━━━━━━━━━━━𖤓

⟪ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴋᴀɪʀᴏ 〆 ᴅᴇᴠ ⟫`;

    // Banner image on top with the menu as its caption (quoted goes in the options argument)
    const options = { quoted: message };
    const imagePath = path.join(process.cwd(), 'menu.jpg');

    if (fs.existsSync(imagePath)) {
        await client.sendMessage(remoteJid, { image: fs.readFileSync(imagePath), caption }, options);
    } else {
        await client.sendMessage(remoteJid, { text: caption }, options);
    }

    const audioPath = path.join(process.cwd(), 'menu.mp3');
    if (fs.existsSync(audioPath)) {
        try {
            await client.sendMessage(remoteJid, { audio: fs.readFileSync(audioPath), mimetype: 'audio/mpeg', ptt: false }, options);
        } catch (e) {
            console.log('[menu] audio failed:', e?.message || e);
        }
    }
}

export default info;
