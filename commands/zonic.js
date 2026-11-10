// ─── .zonic — runs the ZONIC game from the pairing website (/zonic) ─────────
const baseUrl = () => (process.env.PUBLIC_URL || 'https://zynex-pair-code.up.railway.app').replace(/\/+$/, '');

export async function zonic(message, client) {
    const from = message.key.remoteJid;
    await client.sendMessage(from, {
        text:
`🔵 *ZONIC SPEED ADVENTURE*

Run, jump over spikes and pits, collect rings, and tap *GAS* to go super fast!

🕹️ Controls: *Space / Jump button* = jump · *GAS* = boost · *P* = pause

🔗 ${baseUrl()}/zonic

_Open the link in your phone browser to play._`
    }, { quoted: message });
    try { await client.sendMessage(from, { react: { text: '🎮', key: message.key } }); } catch {}
}

export default { zonic };
