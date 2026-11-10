import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME, OWNER_NUM, BOT_VERSION } from '../config.js';
import { bold, COMMAND_COUNT } from '../utils/commandList.js';

const startedAt = Date.now();

function jidOf(message) {
  return message.key?.remoteJid || '';
}
function senderJid(message) {
  return message.key?.participant || message.key?.remoteJid || '';
}
function text(message, value) {
  return message.client?.sendMessage?.(jidOf(message), { text: value }, { quoted: message });
}

export async function alive(message, client) {
  const uptime = formatDuration(process.uptime() * 1000);
  await client.sendMessage(jidOf(message), {
    text: `╭━━━〔 ${bold(BOT_NAME)} 〕╾━━━⟡\n┃✧ ${bold('STATUS')} : ${bold('ONLINE')}\n┃✧ ${bold('UPTIME')} : ${bold(uptime)}\n┃✧ ${bold('VERSION')} : ${bold(BOT_VERSION)}\n┃✧ ${bold('COMMANDS')} : ${bold(COMMAND_COUNT)}\n┃✧ ${bold('DEV')} : ${bold(String(OWNER_NAME).toUpperCase())}\n╰━━━━━━━━━━━━━━━━━━━𖤓`
  }, { quoted: message });
}

export async function runtime(message, client) {
  await client.sendMessage(jidOf(message), {
    text: `⏱️ *RUNTIME*\n\nBot process: ${formatDuration(process.uptime() * 1000)}\nMemory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\nNode: ${process.version}`
  }, { quoted: message });
}

export async function jid(message, client) {
  const sender = senderJid(message);
  const remote = jidOf(message);
  await client.sendMessage(remote, {
    text: `🆔 *JID INFO*\n\nChat: ${remote}\nSender: ${sender}`
  }, { quoted: message });
}

export async function groupinfo(message, client) {
  const remote = jidOf(message);
  if (!remote.endsWith('@g.us')) return client.sendMessage(remote, { text: '❌ This command only works in a group.' }, { quoted: message });
  const meta = await client.groupMetadata(remote);
  const admins = meta.participants.filter(p => p.admin).length;
  await client.sendMessage(remote, {
    text: `╭━━〔 👥 GROUP INFO 〕━━╮\n┃ Name: ${meta.subject || 'Unknown'}\n┃ Members: ${meta.participants.length}\n┃ Admins: ${admins}\n┃ ID: ${remote}\n╰━━━━━━━━━━━━━━━━━━━━╯`
  }, { quoted: message });
}

export async function admins(message, client) {
  const remote = jidOf(message);
  if (!remote.endsWith('@g.us')) return client.sendMessage(remote, { text: '❌ This command only works in a group.' }, { quoted: message });
  const meta = await client.groupMetadata(remote);
  const list = meta.participants.filter(p => p.admin).map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`);
  await client.sendMessage(remote, { text: `👑 *GROUP ADMINS*\n\n${list.join('\n') || 'No admins found.'}`, mentions: meta.participants.filter(p => p.admin).map(p => p.id) }, { quoted: message });
}

export async function members(message, client) {
  const remote = jidOf(message);
  if (!remote.endsWith('@g.us')) return client.sendMessage(remote, { text: '❌ This command only works in a group.' }, { quoted: message });
  const meta = await client.groupMetadata(remote);
  const lines = meta.participants.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}${p.admin ? ' 👑' : ''}`);
  await client.sendMessage(remote, { text: `👥 *MEMBERS (${lines.length})*\n\n${lines.join('\n')}`, mentions: meta.participants.map(p => p.id) }, { quoted: message });
}

export async function botinfo(message, client) {
  const remote = jidOf(message);
  const number = client.user?.id?.split(':')[0] || OWNER_NUM;
  const cfg = configManager.config?.users?.[number] || {};
  await client.sendMessage(remote, {
    text: `╭━━━〔 ${bold(BOT_NAME)} 〕╾━━━⟡\n┃✧ ${bold('VERSION')} : ${bold(BOT_VERSION)}\n┃✧ ${bold('COMMANDS')} : ${bold(COMMAND_COUNT)}\n┃✧ ${bold('DEVELOPER')} : ${bold(String(OWNER_NAME).toUpperCase())}\n┃✧ ${bold('PREFIX')} : ${cfg.prefix || '.'}\n┃✧ ${bold('MODE')} : ${bold('MULTI-DEVICE')}\n┃✧ ${bold('NODE')} : ${process.version}\n╰━━━━━━━━━━━━━━━━━━━𖤓`
  }, { quoted: message });
}

export async function calc(message, client, expression) {
  const remote = jidOf(message);
  if (!expression) return client.sendMessage(remote, { text: 'Usage: .calc 25*4+10' }, { quoted: message });
  if (!/^[0-9+\-*/().%\s]+$/.test(expression) || expression.length > 100) {
    return client.sendMessage(remote, { text: '❌ Only numbers and basic math operators are allowed.' }, { quoted: message });
  }
  try {
    const result = Function(`"use strict"; return (${expression})`)();
    if (!Number.isFinite(result)) throw new Error('Invalid result');
    await client.sendMessage(remote, { text: `🧮 *CALCULATOR*\n\n${expression} = *${result}*` }, { quoted: message });
  } catch {
    await client.sendMessage(remote, { text: '❌ Invalid calculation.' }, { quoted: message });
  }
}

export async function quote(message, client) {
  const remote = jidOf(message);
  const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) return client.sendMessage(remote, { text: '❌ Reply to a message with .quote' }, { quoted: message });
  const q = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || quoted.videoMessage?.caption || '[media message]';
  await client.sendMessage(remote, { text: `💬 *QUOTED MESSAGE*\n\n> ${String(q).replace(/\n/g, '\n> ')}` }, { quoted: message });
}

export async function help(message, client) {
  const remote = jidOf(message);
  await client.sendMessage(remote, {
    text: `╭━━━〔 ${bold('QUICK HELP')} 〕╾━━━⟡\n┃✧ ${bold('COMMANDS')} : ${bold(COMMAND_COUNT)}\n┃✧ ${bold('VERSION')} : ${bold(BOT_VERSION)}\n┃\n┃ .menu       → All commands\n┃ .alive      → Bot status\n┃ .runtime    → Process uptime\n┃ .jid        → Chat/sender IDs\n┃ .groupinfo  → Group statistics\n┃ .admins     → List group admins\n┃ .members    → List group members\n┃ .botinfo    → Bot information\n┃ .calc       → Safe calculator\n┃ .quote      → Quote a replied message\n╰━━━━━━━━━━━━━━━━━━━𖤓`
  }, { quoted: message });
}

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

export default { alive, runtime, jid, groupinfo, admins, members, botinfo, calc, quote, help };
