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
    ['🛠️', 'TOOLS', ['ping', 'getid', 'idch', 'pair', 'sudo', 'tourl', 'owner', 'fancy', 'update', 'device', 'delsudo', 'getsudo', 'react', 'saveppgc']],
    ['⚙️', 'CONFIG', ['online', 'welcome', 'goodbye', 'autotype', 'autoreact', 'setprefix', 'getconfig', 'autoreactstatus', 'autorecord', 'chreact', 'autoview', 'likeemoji', 'private', 'public', 'autostatusreply']],
    ['👥', 'GROUP', ['delete', 'bye', 'kick', 'add', 'purge', 'mute', 'unmute', 'promote', 'demote', 'gclink', 'antilink', 'antimedia', 'antibot', 'kickall', 'promoteall', 'demoteall', 'groupstatus', 'creategc', 'groupjid', 'resetlink', 'vcf']],
    ['🎥', 'MEDIA', ['vv', 'take', 'save', 'photo', 'setpp', 'grtpp', 'toaudio', 'sticker', 'logo', 'aiimage', 'telegram', 'toimage', 'fullpp', 'blur', 'videotranscribe']],
    ['🔍', 'SEARCH', ['ask', 'wiki-en', 'wiki-fr', 'pinterest', 'movie']],
    ['📥', 'DOWNLOAD', ['play', 'tiktok', 'ig', 'apk', 'song', 'video', 'video1', 'fb', 'spotify', 'capcut', 'mediafire', 'snap']],
    ['🎌', 'ANIME', ['waifu']],
    ['🤖', 'AI', ['deepseek', 'claude', 'gpt', 'sora', 'veo3', 'suno', 'chatbot']],
    ['🎮', 'GAME', ['zonic']],
    ['🆕', 'NEW', ['jid', 'groupinfo', 'admins', 'members', 'botinfo', 'calc', 'quote', 'help']],
    ['🛡️', 'SECURITY', ['anticall', 'antidelete', 'antigrouptag', 'autojoingc']],
    ['🏷️', 'TAGS', ['tag', 'tagadmin', 'tagall', 'settag', 'response']],
];

// Alternative names understood by events/messageHandler.js, shown next to the main command.
export const ALIASES = {
    jid: ['getjid'], deepseek: ['ds'], claude: ['claudehaiku', 'haiku'], waifu: ['mywaifu'],
    antimedia: ['am'], delete: ['del'], pinterest: ['pin'], videotranscribe: ['video-transcribe', 'transkripvideo'],
    spotify: ['spotifydl', 'spdl'], capcut: ['ccdl', 'cc'], mediafire: ['mf'], autojoingc: ['autojoin'],
    toaudio: ['tomp3'], telegram: ['tgsticker'], video: ['ytmp4'], fb: ['facebook'], creategc: ['creategroup'],
    groupstatus: ['gcstatus', 'togstatus'], response: ['respons'], fancy: ['styleteks', 'font'],
    song: ['mp3', 'ytmp3', 'music', 'audio'], video1: ['vid', 'ytv'], apk: ['app', 'playstore'],
    gpt: ['chatgpt'], suno: ['aisong'], snap: ['snapchat', 'sc'], resetlink: ['revoke'], tourl: ['url'],
    autoreactstatus: ['statuslike'], ig: ['instagram'], aiimage: ['aigen', 'imagine'], sticker: ['take'],
};

export const COMMAND_COUNT = CATEGORIES.reduce((n, [, , list]) => n + list.length, 0);
