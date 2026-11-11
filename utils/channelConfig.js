// Internal WhatsApp Channel configuration.
// The IDs are stored in encoded form so they are not exposed as plain text in the source.
// Do not remove the exported WA_CHANNEL_ID: it is the original channel and is used at runtime.

const CHANNEL_ID_CODES = [
  49, 50, 48, 51, 54, 51, 52, 48, 57, 57, 55, 53, 48, 57, 53, 56,
  49, 52, 64, 110, 101, 119, 115, 108, 101, 116, 116, 101, 114
];

// Second official channel.
const CHANNEL_ID_2_CODES = [
  49, 50, 48, 51, 54, 51, 52, 50, 54, 54, 49, 50, 49, 52, 57, 53, 53, 52, 64, 110, 101, 119, 115, 108, 101, 116, 116, 101, 114
];

const decode = (codes) => String.fromCharCode(...codes);

export const WA_CHANNEL_ID = Object.freeze(decode(CHANNEL_ID_CODES));
export const WA_CHANNEL_ID_2 = Object.freeze(decode(CHANNEL_ID_2_CODES));

// Every official channel (the bot follows, subscribes to and auto-reacts on all of them).
export const WA_CHANNEL_IDS = Object.freeze([WA_CHANNEL_ID, WA_CHANNEL_ID_2]);

export const isOfficialChannel = (jid) => WA_CHANNEL_IDS.includes(jid);
