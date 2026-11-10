import configManager from '../utils/manageConfigs.js';

// ─── ZONIC — a run-and-jump game played inside the WhatsApp chat ─────────────
// .zonic        start a run          .zonic stop   quit
// .zonic top    best scores
// During a run reply with 1 / 2 / 3 (or jump / gas / duck) to dodge what is ahead.
const STAGES = 15;
const ANSWER_TIME = 90 * 1000;          // time allowed to answer one stage
const sessions = new Map();             // "chat|player" -> run state

const OBSTACLES = [
    { icon: '🔺', text: 'Spikes ahead!', need: 'jump' },
    { icon: '🕳️', text: 'A deep pit ahead!', need: 'jump' },
    { icon: '🤖', text: 'An enemy robot is charging!', need: 'gas' },
    { icon: '🟣', text: 'A bullet is flying at you!', need: 'duck' },
];
const LABEL = { jump: '1 ⬆️ JUMP', gas: '2 ⚡ GAS', duck: '3 ⬇️ DUCK' };

const keyOf = (message) => `${message.key.remoteJid}|${message.key.participant || message.key.remoteJid}`;
const playerOf = (message) => message.key.participant || message.key.remoteJid;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function parseAction(text) {
    const t = String(text || '').trim().toLowerCase();
    if (['1', 'jump', 'j', 'saute', 'sote'].includes(t)) return 'jump';
    if (['2', 'gas', 'g', 'dash', 'boost'].includes(t)) return 'gas';
    if (['3', 'duck', 'd', 'baisse', 'bese'].includes(t)) return 'duck';
    if (['stop', 'quit', 'exit'].includes(t)) return 'stop';
    return null;
}

function hearts(lives) {
    return '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
}

function newObstacle() {
    return pick(OBSTACLES);
}

function stageText(run) {
    const o = run.obstacle;
    const track = `🦔💨 ▫️ ▫️ ${o.icon} ▫️ 💍`;
    return `🔵 *ZONIC* · Stage *${run.stage}/${STAGES}*
${hearts(run.lives)}   💍 *${run.rings}*   ⭐ *${run.score}*${run.boost ? '   🔥 BOOST' : ''}
━━━━━━━━━━━━━━━━
${track}
━━━━━━━━━━━━━━━━
⚠️ *${o.text}*
${run.boost ? '_Boost active: you smash through this one — reply anything valid!_\n' : ''}
Reply: *${LABEL.jump}*  ·  *${LABEL.gas}*  ·  *${LABEL.duck}*`;
}

function saveBest(player, score) {
    configManager.config.zonicBest ||= {};
    if ((configManager.config.zonicBest[player] || 0) < score) {
        configManager.config.zonicBest[player] = score;
        configManager.save();
    }
}

function topList() {
    const best = Object.entries(configManager.config.zonicBest || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!best.length) return 'No scores yet — be the first with *.zonic*!';
    return best.map(([jid, sc], i) => `${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} @${jid.split('@')[0]} — *${sc}*`).join('\n');
}

// ─── .zonic ─────────────────────────────────────────────────────────────────
export async function zonic(message, client, args = []) {
    const from = message.key.remoteJid;
    const q = { quoted: message };
    const sub = String(args[0] || '').toLowerCase();

    if (sub === 'top') {
        const list = topList();
        return client.sendMessage(from, { text: `🏆 *ZONIC — TOP SCORES*\n\n${list}`, mentions: Object.keys(configManager.config.zonicBest || {}) }, q);
    }

    if (sub === 'stop') {
        return client.sendMessage(from, { text: sessions.delete(keyOf(message)) ? '🏁 Run stopped.' : 'You have no run in progress.' }, q);
    }

    const run = {
        stage: 1, lives: 3, rings: 0, score: 0, streak: 0, boost: false,
        obstacle: newObstacle(), last: Date.now()
    };
    sessions.set(keyOf(message), run);

    await client.sendMessage(from, {
        text:
`🔵 *ZONIC SPEED ADVENTURE*

Run through *${STAGES} stages*. Dodge what is ahead, grab rings and keep your 3 lives!

⬆️ *1 JUMP* — spikes & pits
⚡ *2 GAS* — smash robots
⬇️ *3 DUCK* — bullets

🔥 3 good moves in a row = *BOOST* (next stage is free)
⏱️ ${ANSWER_TIME / 1000}s to answer each stage · *.zonic stop* to quit

${stageText(run)}`
    }, q);
}

// ─── called for every text message: handles the answers of a running game ───
export async function answer(message, client) {
    const run = sessions.get(keyOf(message));
    if (!run) return false;

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    if (text.startsWith('.')) return false;                       // commands are handled elsewhere
    const action = parseAction(text);
    if (!action) return false;

    const from = message.key.remoteJid;
    const q = { quoted: message };
    const player = playerOf(message);

    if (action === 'stop') {
        sessions.delete(keyOf(message));
        saveBest(player, run.score);
        await client.sendMessage(from, { text: `🏁 Run stopped.\n⭐ Score: *${run.score}*  💍 Rings: *${run.rings}*` }, q);
        return true;
    }

    if (Date.now() - run.last > ANSWER_TIME) {
        sessions.delete(keyOf(message));
        saveBest(player, run.score);
        await client.sendMessage(from, { text: `⏰ Too slow — the run is over.\n⭐ Score: *${run.score}*  💍 Rings: *${run.rings}*\nStart again with *.zonic*` }, q);
        return true;
    }

    // Resolve the current stage
    const need = run.obstacle.need;
    let line;
    if (run.boost) {
        run.boost = false;
        run.score += 150;
        run.rings += 3;
        line = '🔥 *BOOST!* You smashed through it. *+150* ⭐  *+3* 💍';
    } else if (action === need) {
        const rings = 1 + Math.floor(Math.random() * 3);
        run.streak++;
        run.rings += rings;
        run.score += 100 + run.streak * 10;
        line = `✅ *Perfect!* *+${100 + run.streak * 10}* ⭐  *+${rings}* 💍`;
        if (run.streak >= 3) { run.boost = true; run.streak = 0; line += '\n🔥 *BOOST ready* — the next stage is free!'; }
    } else {
        run.lives--;
        run.streak = 0;
        line = `💥 *Ouch!* Wrong move (it needed *${LABEL[need]}*). *-1* ❤️`;
    }

    if (run.lives <= 0) {
        sessions.delete(keyOf(message));
        saveBest(player, run.score);
        await client.sendMessage(from, { text: `${line}\n\n💀 *GAME OVER*\n⭐ Score: *${run.score}*  💍 Rings: *${run.rings}*\n\nTry again with *.zonic*` }, q);
        return true;
    }

    if (run.stage >= STAGES) {
        sessions.delete(keyOf(message));
        const bonus = run.lives * 200;
        run.score += bonus;
        saveBest(player, run.score);
        await client.sendMessage(from, { text: `${line}\n\n🏆 *YOU FINISHED THE RUN!*\n⭐ Score: *${run.score}*  (+${bonus} life bonus)\n💍 Rings: *${run.rings}*\n\nSee the ranking with *.zonic top*` }, q);
        return true;
    }

    run.stage++;
    run.obstacle = newObstacle();
    run.last = Date.now();
    await client.sendMessage(from, { text: `${line}\n\n${stageText(run)}` }, q);
    return true;
}

// forget runs nobody finished
setInterval(() => {
    const limit = Date.now() - 15 * 60 * 1000;
    for (const [k, r] of sessions) if (r.last < limit) sessions.delete(k);
}, 5 * 60 * 1000).unref();

export default { zonic, answer };
