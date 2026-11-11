
// Single list of every command shown in the menu. The total is computed from it,
// so .menu, .alive and .botinfo always show the same, correct number.
// Mathematical bold letters/digits (𝐀𝐁𝐂 𝟎𝟏𝟐) used by the menu style
export const bold = (s) => [...String(s)].map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D400 + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D41A + c - 97);
    if (c >= 48 && c <= 57) return String.fromCodePoint(0x1D7CE + c - 48);
    return ch;
}).join('');

// Every command listed here has a handler in events/messageHandler.js.
// The command total in the header is computed from this list.
export const CATEGORIES = [
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

export const COMMAND_COUNT = CATEGORIES.reduce((n, [, , list]) => n + list.length, 0);
