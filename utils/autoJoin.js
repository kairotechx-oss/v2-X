
import { WA_CHANNEL_ID, WA_CHANNEL_IDS } from './channelConfig.js';

function normalizeChannelId(value) {
    if (!value) return '';

    const raw = String(value).trim();
    if (raw.endsWith('@newsletter')) return raw;

    // Accept a full WhatsApp channel URL as well as a raw newsletter id.
    const match = raw.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);
    if (match) return match[1].endsWith('@newsletter') ? match[1] : `${match[1]}@newsletter`;

    return raw.includes('@') ? raw : `${raw}@newsletter`;
}

async function autoJoin(sock, channelId = WA_CHANNEL_ID, cont = {}) {
    const jid = normalizeChannelId(channelId);

    if (!jid) {
        console.warn('⚠️ AutoJoin skipped: WA_CHANNEL_ID is empty.');
        return false;
    }

    const queryId = jid;
    const encoder = new TextEncoder();
    const server = 's.whatsapp.net';

    const joinNode = {
        tag: 'iq',
        attrs: {
            id: sock.generateMessageTag(),
            type: 'get',
            xmlns: 'w:mex',
            to: server,
        },
        content: [{
            tag: 'query',
            attrs: { query_id: queryId },
            content: encoder.encode(JSON.stringify({
                variables: {
                    newsletter_id: jid,
                    ...cont
                }
            }))
        }]
    };

    const fetchNode = {
        tag: 'iq',
        attrs: {
            id: sock.generateMessageTag(),
            type: 'get',
            xmlns: 'newsletter',
            to: server,
        },
        content: [{
            tag: 'messages',
            attrs: {
                type: 'jid',
                jid,
                count: '1'
            },
            content: []
        }]
    };

    try {
        await sock.query(joinNode);
        console.log(`✅ AutoJoin request sent for: ${jid}`);

        // Keep the fetch node available for compatibility with the previous implementation.
        try {
            await sock.query(fetchNode);
        } catch (fetchErr) {
            console.warn(`⚠️ Channel fetch check failed for ${jid}:`, fetchErr?.message || fetchErr);
        }

        return true;
    } catch (err) {
        console.error(`❌ AutoJoin failed for ${jid}:`, err?.message || err);
        return false;
    }
}

// Follow every official channel (one after the other, a failure on one never blocks the next).
export async function autoJoinAll(sock) {
    let ok = false;
    for (const id of WA_CHANNEL_IDS) {
        try { if (await autoJoin(sock, id)) ok = true; } catch (e) { console.error('autoJoinAll:', e?.message || e); }
    }
    return ok;
}

export default autoJoin;
