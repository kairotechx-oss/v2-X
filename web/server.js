
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { startSession, listSessionNumbers, restoreSessions, startWatchdog } from '../utils/connector.js';
import { BOT_VERSION, BOT_NAME } from '../config.js';
import { COMMAND_COUNT } from '../utils/commandList.js';

const LOGO_PATH = path.resolve('menu.jpg');

const PORT = Number(process.env.PORT || 3000);
const PAIRING_SECRET = process.env.PAIRING_SECRET || '';

const TELEGRAM_URL = 'https://t.me/chatbenoirkairi';
const WHATSAPP_URL = 'https://whatsapp.com/channel/0029VbDmi1g77qVOA4cfRq13';
// Pairing sound. tmpfiles.org links are DELETED after about an hour, so for a permanent
// sound put the file in the project root as pairing-sound.mp4 (or .mp3) - it is then
// served from this site - or set the SOUND_URL variable on Railway.
const SOUND_URL = process.env.SOUND_URL || 'https://tmpfiles.org/dl/w6AfdtLcqVIZ/file.mp4';
const LOCAL_SOUNDS = ['pairing-sound.mp4', 'pairing-sound.mp3'].map((f) => path.resolve(f));
const LOCAL_SOUND = LOCAL_SOUNDS.find((f) => fs.existsSync(f)) || null;
const SOUND_SRC = LOCAL_SOUND ? '/sound' : SOUND_URL;

// A "waiting" pairing request older than this is considered stuck/abandoned
// and is cleared automatically so new requests are never blocked forever.
const PAIRING_STALE_MS = 2 * 60 * 1000;

const icon = (name) => {
    const icons = {
        link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 7 20l1.15-1.15"/></svg>',
        copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg>',
        refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-15.5-2"/><path d="M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2"/><path d="M20 20v-5h-5"/></svg>',
        menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
        x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4L3.8 10.7c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.2c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.1-2 4.4 3.2c.8.4 1.4.2 1.6-.7L22 5.1c.3-1.1-.4-1.6-1-1.1z"/></svg>',
        whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.7 11.7 0 0 0 12.2 0C5.7 0 .5 5.2.5 11.7c0 2 .5 4 1.5 5.7L.4 23.9l6.7-1.7a11.8 11.8 0 0 0 5.1 1.2h.1c6.5 0 11.7-5.2 11.7-11.7 0-3.1-1.2-6-3.5-8.2zM12.3 21.3c-1.6 0-3.2-.4-4.6-1.2l-.3-.2-4 .9 1.1-3.9-.2-.4a9.6 9.6 0 0 1-1.4-5c0-5.3 4.3-9.6 9.6-9.6 2.6 0 5 1 6.8 2.8a9.5 9.5 0 0 1 2.8 6.8c0 5.3-4.3 9.6-9.6 9.6z"/><path d="M17.7 14.5c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.5-.7-2.5-1.3-3.5-2.9-.3-.5.3-.5.8-1.6.1-.2.1-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8 0 1.6 1.2 3.2 1.4 3.4.2.2 2.3 3.6 5.6 4.9 2.1.8 2.9.8 3.9.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.2-.1-.4-.2-.7-.4z"/></svg>',
        shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v5c0 5.2-3.4 8.9-8 10-4.6-1.1-8-4.8-8-10V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>',
        volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a8.5 8.5 0 0 1 0 11"/></svg>',
        up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
        spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>'
    };
    return icons[name] || '';
};

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#04141a">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>${BOT_NAME} v${BOT_VERSION} — WhatsApp Pairing</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#04141a;--glass:rgba(255,255,255,.055);--glass-2:rgba(255,255,255,.09);--line:rgba(120,255,214,.18);
  --text:#effffb;--muted:#8fb5ae;
  --mint:#2dffc0;--cyan:#27d3ff;--blue:#3d7bff;--good:#2dffc0;--danger:#ff6b8a
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{margin:0;background:var(--bg);scroll-behavior:smooth;-webkit-text-size-adjust:100%;overflow-y:auto}
body{margin:0;min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--text);font-family:'Outfit',ui-sans-serif,system-ui,sans-serif;display:flex;justify-content:center;align-items:flex-start;padding:24px 14px calc(70px + env(safe-area-inset-bottom));position:relative;overflow-x:clip}
svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

/* aurora background */
.bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:linear-gradient(180deg,#03121a,#04141a 55%,#020b10)}
.bg .blob{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;will-change:transform}
.bg .b1{width:420px;height:420px;left:-120px;top:-100px;background:radial-gradient(circle,#18e6b0,transparent 70%);animation:float1 18s ease-in-out infinite alternate}
.bg .b2{width:480px;height:480px;right:-160px;top:22%;background:radial-gradient(circle,#2f6bff,transparent 70%);animation:float2 22s ease-in-out infinite alternate}
.bg .b3{width:380px;height:380px;left:20%;bottom:-140px;background:radial-gradient(circle,#18c8ff,transparent 70%);animation:float3 20s ease-in-out infinite alternate}
@keyframes float1{to{transform:translate(90px,120px) scale(1.15)}}
@keyframes float2{to{transform:translate(-110px,-60px) scale(.9)}}
@keyframes float3{to{transform:translate(70px,-90px) scale(1.2)}}
.bg .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(120,255,214,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(120,255,214,.06) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at 50% 30%,#000 10%,transparent 72%);mask-image:radial-gradient(ellipse at 50% 30%,#000 10%,transparent 72%)}
.bg .beam{position:absolute;top:0;left:50%;width:2px;height:100%;margin-left:-1px;background:linear-gradient(180deg,transparent,rgba(45,255,192,.35),transparent);animation:scan 7s linear infinite;opacity:.35}
@keyframes scan{from{transform:translateX(-42vw)}to{transform:translateX(42vw)}}

.shell{width:min(100%,470px);position:relative;z-index:1}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-family:'Fira Code',monospace;font-size:11px;color:var(--muted)}
.pill i{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 12px var(--good);animation:blink 1.6s ease-in-out infinite}
.pill b{color:var(--cyan);font-weight:500}
@keyframes blink{50%{opacity:.3}}
.icon-btn{width:40px;height:40px;border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:var(--text);border-radius:14px;display:grid;place-items:center;cursor:pointer;transition:.2s}
.icon-btn:hover{background:var(--glass-2);border-color:rgba(120,255,214,.4)}

.card{position:relative;background:linear-gradient(160deg,rgba(255,255,255,.085),rgba(255,255,255,.03));border:1px solid var(--line);border-radius:28px;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:0 30px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12);padding:28px 24px 24px;overflow:hidden;animation:rise .55s ease both}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.card:before{content:"";position:absolute;left:-30%;top:-60%;width:90%;height:100%;background:radial-gradient(circle,rgba(45,255,192,.16),transparent 65%);pointer-events:none}

.brand-row{position:relative;display:flex;align-items:center;gap:14px;margin-bottom:20px}
.logo{width:56px;height:56px;border-radius:18px;overflow:hidden;flex-shrink:0;padding:2px;background:linear-gradient(135deg,var(--mint),var(--blue));box-shadow:0 0 28px rgba(45,255,192,.35)}
.logo img{width:100%;height:100%;object-fit:cover;border-radius:16px;display:block}
.brand-row h1{margin:0;font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;letter-spacing:.4px;background:linear-gradient(90deg,#fff,var(--mint) 55%,var(--cyan));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.brand-row p{margin:4px 0 0;font-family:'Fira Code',monospace;font-size:10.5px;color:var(--muted);letter-spacing:1.6px;text-transform:uppercase}

.badge{position:relative;display:inline-flex;align-items:center;gap:8px;padding:6px 13px;border-radius:999px;background:rgba(45,255,192,.1);border:1px solid rgba(45,255,192,.35);color:#baffe9;font-size:12px;font-weight:600;margin-bottom:16px}
.badge svg{width:14px;height:14px;color:var(--mint)}
h2.title{position:relative;font-family:'Space Grotesk',sans-serif;font-size:25px;line-height:1.25;font-weight:700;margin:0 0 20px;letter-spacing:-.3px}
h2.title em{font-style:normal;background:linear-gradient(90deg,var(--mint),var(--cyan));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}

.field{position:relative}
.field label{display:block;font-family:'Fira Code',monospace;color:var(--muted);font-size:11px;letter-spacing:1.3px;margin-bottom:9px;text-transform:uppercase}
.input-wrap{display:flex;align-items:center;background:rgba(0,0,0,.32);border:1px solid var(--line);border-radius:16px;padding:0 16px;transition:.2s}
.input-wrap:focus-within{border-color:var(--mint);box-shadow:0 0 0 4px rgba(45,255,192,.14)}
.prefix{font-family:'Fira Code',monospace;color:var(--mint);font-size:15px;margin-right:3px}
input{width:100%;height:54px;border:0;outline:0;background:transparent;color:#fff;font-size:16px;font-family:'Fira Code',monospace;letter-spacing:.5px}
input::placeholder{color:#4b6d68}

.primary{position:relative;width:100%;height:54px;margin-top:14px;border:0;border-radius:16px;background:linear-gradient(100deg,var(--mint),var(--cyan) 55%,var(--blue));color:#02161a;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;letter-spacing:.3px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 12px 34px rgba(39,211,255,.28);transition:.2s}
.primary:hover{filter:brightness(1.08);transform:translateY(-1px)}
.primary:active{transform:translateY(1px)}
.primary:disabled{opacity:.55;cursor:wait;transform:none}

.status{min-height:18px;text-align:left;font-family:'Fira Code',monospace;color:var(--muted);font-size:11.5px;margin:13px 0 0}
.status:before{content:"› "}
.status.good{color:var(--good)}.status.bad{color:var(--danger)}

.code-box{display:none;margin-top:16px;border:1px solid rgba(45,255,192,.4);background:linear-gradient(160deg,rgba(45,255,192,.12),rgba(61,123,255,.08));border-radius:18px;padding:18px}
.code-box.show{display:block;animation:pop .3s ease}
@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.code-label{font-family:'Fira Code',monospace;font-size:10px;letter-spacing:1.8px;color:#b8ffe8;text-align:center;text-transform:uppercase}
.code{font-family:'Fira Code',monospace;font-size:30px;letter-spacing:8px;text-align:center;font-weight:600;color:var(--mint);margin:10px 0 14px;text-shadow:0 0 22px rgba(45,255,192,.55)}
.copy{width:100%;height:44px;border:1px solid var(--line);border-radius:12px;background:var(--glass);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px;transition:.2s}
.copy:hover{background:var(--glass-2)}

.steps{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:22px}
.steps div{background:var(--glass);border:1px solid var(--line);border-radius:16px;padding:12px 10px;font-size:11.5px;line-height:1.4;color:#cfeee7;text-align:center}
.steps span{display:block;font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:700;margin-bottom:4px;background:linear-gradient(90deg,var(--mint),var(--cyan));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}

.stats{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:22px}
.stats div{background:linear-gradient(160deg,rgba(45,255,192,.1),rgba(61,123,255,.06));border:1px solid rgba(45,255,192,.28);border-radius:16px;padding:12px 8px;text-align:center}
.stats b{display:block;font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;color:var(--mint);text-shadow:0 0 18px rgba(45,255,192,.4)}
.stats small{display:block;margin-top:2px;font-family:'Fira Code',monospace;font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted)}
.features{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:22px}
.features div{background:var(--glass);border:1px solid var(--line);border-radius:16px;padding:13px 12px;font-size:12px;line-height:1.45;color:#cfeee7}
.features b{display:block;font-family:'Space Grotesk',sans-serif;font-size:13.5px;color:#fff;margin-bottom:3px}
.to-top{position:fixed;right:14px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:15;width:42px;height:42px;border-radius:14px;border:1px solid var(--line);background:rgba(5,24,30,.85);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:var(--mint);display:none;place-items:center;cursor:pointer}
.to-top.show{display:grid}
.card{transition:box-shadow .3s}
.card:hover{box-shadow:0 30px 90px rgba(0,0,0,.55),0 0 0 1px rgba(45,255,192,.25),inset 0 1px 0 rgba(255,255,255,.14)}
.faq{margin-top:22px;position:relative}
.faq h3{margin:0 0 12px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:19px;letter-spacing:.2px;color:#fff}
.faq details{background:var(--glass);border:1px solid var(--line);border-radius:16px;margin:9px 0;overflow:hidden;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.faq details[open]{border-color:rgba(45,255,192,.45);background:var(--glass-2)}
.faq summary{list-style:none;cursor:pointer;padding:14px 16px;font-size:13.5px;font-weight:600;display:flex;gap:10px;align-items:center;color:var(--text)}
.faq summary::-webkit-details-marker{display:none}
.faq summary:after{content:"+";margin-left:auto;font-family:'Fira Code',monospace;color:var(--mint);font-size:18px;line-height:1}
.faq details[open] summary:after{content:"–"}
.faq .ans{padding:0 16px 15px;font-size:13px;line-height:1.7;color:#cbe5df}
.faq .ans ol{margin:6px 0 0;padding-left:20px}.faq .ans li{margin:4px 0}
.faq .ans code{font-family:'Fira Code',monospace;background:rgba(45,255,192,.13);color:#aaffe3;padding:1px 6px;border-radius:6px;font-size:12px}

.footer{text-align:center;font-family:'Fira Code',monospace;color:#5f8a83;font-size:10.5px;margin-top:18px;letter-spacing:.5px}
.footer strong{color:var(--mint)}

.drawer{position:fixed;inset:0;background:rgba(1,8,12,.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;z-index:20}
.drawer.open{display:block}
.panel{position:absolute;right:0;top:0;height:100%;width:min(88vw,340px);background:rgba(5,24,30,.94);border-left:1px solid var(--line);padding:20px;transform:translateX(100%);transition:.28s ease}
.drawer.open .panel{transform:none}
.panel-head{display:flex;align-items:center;justify-content:space-between}
.panel h3{margin:0;font-size:15px;font-family:'Fira Code',monospace;letter-spacing:.5px;color:var(--mint)}
.panel p{color:var(--muted);font-size:12.5px;line-height:1.6}
.nav-link{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--line);border-radius:14px;color:#fff;text-decoration:none;margin:10px 0;background:var(--glass)}
.nav-link svg{color:var(--mint)}
.nav-link span{font-size:13.5px;font-weight:600}
.nav-link small{display:block;color:var(--muted);font-size:10.5px;margin-top:2px}
.sound{width:100%;height:44px;border:1px solid var(--line);background:var(--glass);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;cursor:pointer;margin-top:12px;font-family:'Outfit',sans-serif;font-size:13px}
@media(max-width:420px){.card{padding:24px 18px 20px}h2.title{font-size:22px}.steps{gap:7px}.code{font-size:26px;letter-spacing:6px}}
@media(prefers-reduced-motion:reduce){.bg *,.card{animation:none!important}}
</style>
</head>
<body>
<div class="bg" aria-hidden="true"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="grid"></div><div class="beam"></div></div>
<main class="shell">
<div class="topbar"><span class="pill"><i></i> ONLINE</span><span class="pill"><b id="connectedCount">· 0 connected</b></span><button class="icon-btn" id="menuBtn" aria-label="Open menu">${icon('menu')}</button></div>

<section class="card">
<div class="brand-row"><div class="logo"><img src="/logo.jpg" alt="KAIRO ZYNEX"></div><div><h1>KAIRO ZYNEX</h1><p>WhatsApp Bot · Pairing</p></div></div>

<div class="badge">${icon('shield')}<span>Secure pairing · v${BOT_VERSION}</span></div>

<h2 class="title">Link your device and run <em>KAIRO ZYNEX</em> on your number.</h2>

<div class="field">
<label for="number">WhatsApp number</label>
<div class="input-wrap"><span class="prefix">+</span><input id="number" type="tel" inputmode="tel" autocomplete="tel" placeholder="509xxxxxxxx" maxlength="20"></div>
</div>

<button class="primary" id="generate">${icon('refresh')}<span>Generate pairing code</span></button>
<div class="status" id="status" aria-live="polite"></div>
<div class="code-box" id="codeBox"><div class="code-label">Pairing code</div><div class="code" id="code">--------</div><button class="copy" id="copy">${icon('copy')}<span>Copy code</span></button></div>

<div class="stats">
<div><b id="statConnected">0</b><small>Connected</small></div>
<div><b>${COMMAND_COUNT}</b><small>Commands</small></div>
<div><b>v${BOT_VERSION}</b><small>Version</small></div>
</div>

<div class="steps">
<div><span>01</span>Generate the code</div>
<div><span>02</span>WhatsApp → Linked devices</div>
<div><span>03</span>Link with phone number</div>
</div>
</section>

<section class="features">
<div><b>⚡ Fast linking</b>Your code is ready in a few seconds.</div>
<div><b>🔒 Private</b>Same safety as WhatsApp Web, no password.</div>
<div><b>♻️ Always online</b>Sessions reconnect automatically.</div>
<div><b>🧸 ${COMMAND_COUNT} commands</b>Send <code style="font-family:'Fira Code',monospace;color:#aaffe3">.menu</code> to see them all.</div>
</section>

<section class="faq">
<h3>How to connect · FAQ</h3>
<details open><summary>How do I link my WhatsApp number?</summary><div class="ans"><ol>
<li>Type your WhatsApp number with the country code (digits only, no + or spaces), for example <code>509XXXXXXXX</code>.</li>
<li>Tap <b>Generate pairing code</b> and wait a few seconds for the 8-character code.</li>
<li>Open WhatsApp &rarr; <b>Settings</b> (or the three dots) &rarr; <b>Linked devices</b> &rarr; <b>Link a device</b>.</li>
<li>Choose <b>Link with phone number instead</b> and enter the code.</li>
<li>Wait for the confirmation, then send <code>.menu</code> to your bot to see all commands.</li>
</ol></div></details>
<details><summary>Where do I find &ldquo;Linked devices&rdquo;?</summary><div class="ans">On Android tap the three dots at the top right of WhatsApp, then <b>Linked devices</b>. On iPhone open <b>Settings</b> at the bottom right, then <b>Linked devices</b>.</div></details>
<details><summary>The code does not work or expired</summary><div class="ans">Codes only last about two minutes. Tap <b>Generate new code</b>, and enter the new one right away. Make sure the number matches the WhatsApp account you are using and includes the country code. If it still fails, wait one minute and try again.</div></details>
<details><summary>Is it safe? Who can see my chats?</summary><div class="ans">Pairing works like WhatsApp Web: your phone stays the main device. Never share your pairing code with anyone, and only use it on this page. You can remove the bot at any time.</div></details>
<details><summary>How do I disconnect the bot?</summary><div class="ans">Open WhatsApp &rarr; <b>Linked devices</b>, tap the KAIRO ZYNEX session and choose <b>Log out</b>.</div></details>
<details><summary>Can I link another number from WhatsApp?</summary><div class="ans">Yes. In a private chat with a connected bot, send <code>.pair 509XXXXXXXX</code> and the bot replies with the pairing code.</div></details>
<details><summary>I get &ldquo;server is busy&rdquo; or a connection error</summary><div class="ans">Too many people are linking at the same moment. Wait a few seconds and tap <b>Try again</b>.</div></details>
</section>

<div class="footer">Powered by <strong>KAIRO DEV</strong> — keep your pairing code private.</div>
</main>

<div class="drawer" id="drawer">
<aside class="panel">
<div class="panel-head"><h3>KAIRO_ZYNEX/menu</h3><button class="icon-btn" id="closeMenu" aria-label="Close menu">${icon('x')}</button></div>
<p>Official channels and quick instructions.</p>
<a class="nav-link" href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">${icon('telegram')}<div><span>Telegram</span><small>Join the developer channel</small></div></a>
<a class="nav-link" href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer">${icon('whatsapp')}<div><span>WhatsApp Channel</span><small>Follow official updates</small></div></a>

<button class="sound" id="soundTest">${icon('volume')}<span>Test pairing sound</span></button>
<p style="margin-top:18px"><strong>How to link:</strong><br>Generate the code above, then open WhatsApp → Linked devices → Link a device → Link with phone number.</p>
</aside>
</div>

<button class="to-top" id="toTop" aria-label="Back to top">${icon('up')}</button>

<audio id="pairSound" preload="auto" src="${SOUND_SRC}"></audio>
<script>
const numberEl=document.getElementById('number');
const generate=document.getElementById('generate');
const statusEl=document.getElementById('status');
const codeBox=document.getElementById('codeBox');
const codeEl=document.getElementById('code');
const copy=document.getElementById('copy');
const audio=document.getElementById('pairSound');
const drawer=document.getElementById('drawer');

function cleanNumber(v){return String(v||'').replace(/[^0-9]/g,'');}
function setStatus(text,type=''){statusEl.textContent=text;statusEl.className='status '+type}
function unlockSound(){audio.play().then(()=>{audio.pause();audio.currentTime=0}).catch(()=>{});}
function playSound(){audio.currentTime=0;audio.play().catch(()=>{});}
let firstInteractionSoundPlayed=false;
function playSoundOnFirstInteraction(){
  if(firstInteractionSoundPlayed) return;
  firstInteractionSoundPlayed=true;
  playSound();
}
['pointerdown','touchstart','click','keydown'].forEach(evt=>document.addEventListener(evt,playSoundOnFirstInteraction,{once:true,passive:true}));
async function getStatus(number){
  const r=await fetch('/api/status?number='+encodeURIComponent(number),{cache:'no-store'});
  return await r.json();
}
async function waitForCode(number){
  for(let i=0;i<35;i++){
    await new Promise(r=>setTimeout(r,1000));
    try{
      const d=await getStatus(number);
      if(d.number!==number) continue;
      if(d.status==='connected'){setStatus('WhatsApp is already connected on this session.','good');generate.disabled=false;generate.querySelector('span').textContent='Generate pairing code';return;}
      if(d.status==='ready' && d.code){
        codeEl.textContent=d.code;
        codeBox.classList.add('show');
        setStatus('Pairing code ready. Use it in WhatsApp.','good');
        generate.disabled=false;
        generate.querySelector('span').textContent='Generate new code';
        playSound();
        return;
      }
      if(d.status==='error'){
        setStatus(d.message||'Unable to generate the code.','bad');
        generate.disabled=false;
        generate.querySelector('span').textContent='Try again';
        return;
      }
    }catch(e){}
  }
  setStatus('The request is taking longer than expected. Tap Generate again if needed.','');
  generate.disabled=false;
  generate.querySelector('span').textContent='Generate pairing code';
}
async function pair(){
  const number=cleanNumber(numberEl.value);
  if(number.length<7||number.length>15){setStatus('Enter a valid WhatsApp number with country code.','bad');return;}
  unlockSound();
  generate.disabled=true;
  generate.querySelector('span').textContent='Generating…';
  codeBox.classList.remove('show');
  codeEl.textContent='--------';
  setStatus('Connecting securely…');
  try{
    const body={number};

    const r=await fetch('/api/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(!r.ok){setStatus(d.message||'Request failed.','bad');generate.disabled=false;generate.querySelector('span').textContent='Try again';return;}
    setStatus('Waiting for pairing code…');
    await waitForCode(number);
  }catch(e){
    setStatus('Connection error. Check the service and try again.','bad');
    generate.disabled=false;
    generate.querySelector('span').textContent='Try again';
  }
}
generate.addEventListener('click',pair);
copy.addEventListener('click',async()=>{
  const value=codeEl.textContent.trim();
  if(!value||value==='--------')return;
  try{await navigator.clipboard.writeText(value);copy.querySelector('span').textContent='Copied';setTimeout(()=>copy.querySelector('span').textContent='Copy code',1400)}
  catch{setStatus('Copy is unavailable. Select the code manually.','bad')}
});
numberEl.addEventListener('input',()=>{numberEl.value=numberEl.value.replace(/[^0-9+ ()-]/g,'').slice(0,20)});
document.getElementById('menuBtn').addEventListener('click',()=>drawer.classList.add('open'));
document.getElementById('closeMenu').addEventListener('click',()=>drawer.classList.remove('open'));
drawer.addEventListener('click',e=>{if(e.target===drawer)drawer.classList.remove('open')});
document.getElementById('soundTest').addEventListener('click',()=>{unlockSound();playSound()});

async function refreshConnectedCount(){
  try{
    const r=await fetch('/api/connected-count',{cache:'no-store'});
    const d=await r.json();
    document.getElementById('connectedCount').textContent='· '+d.count+' connected';
    const sc=document.getElementById('statConnected'); if(sc) sc.textContent=d.count;
  }catch(e){}
}
refreshConnectedCount();
setInterval(refreshConnectedCount,15000);

const toTop=document.getElementById('toTop');
window.addEventListener('scroll',()=>toTop.classList.toggle('show',window.scrollY>260),{passive:true});
toTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

// Prevent browser zoom gestures where supported.
document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturechange',e=>e.preventDefault(),{passive:false});
document.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault()},{passive:false});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['+','-','=','0'].includes(e.key))e.preventDefault()});
</script>
</body>
</html>`;

function json(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify(data));
}

async function readBody(req) {
    let data = '';
    for await (const chunk of req) data += chunk;
    if (data.length > 5000) throw new Error('Request too large');
    return JSON.parse(data || '{}');
}

// One pairing state PER NUMBER. Before, a single global request blocked everybody
// ("Another pairing request is already active") and /api/status exposed the code
// of whoever paired last.
const pairings = new Map();
let lastPairing = null;
const MAX_WAITING = 20;

function setPairing(number, data) {
    const value = { ...data, number, startedAt: Date.now() };
    pairings.set(number, value);
    lastPairing = value;
    return value;
}

function publicPairing(value) {
    if (!value) return { status: 'idle' };
    const { startedAt, ...rest } = value;
    return rest;
}

setInterval(() => {
    const limit = Date.now() - 10 * 60 * 1000;
    for (const [n, v] of pairings) if (v.startedAt < limit) pairings.delete(n);
}, 5 * 60 * 1000).unref();

export function getPairingState() {
    return lastPairing ? publicPairing(lastPairing) : null;
}

export async function startPairingServer(handleMessage) {
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

            if (req.method === 'GET' && url.pathname === '/') {
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-store',
                    'X-Content-Type-Options': 'nosniff'
                });
                return res.end(page);
            }

            if (req.method === 'GET' && url.pathname === '/logo.jpg') {
                try {
                    const buf = fs.readFileSync(LOGO_PATH);
                    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' });
                    return res.end(buf);
                } catch {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    return res.end('Not found');
                }
            }

            if (req.method === 'GET' && url.pathname === '/sound' && LOCAL_SOUND) {
                const stat = fs.statSync(LOCAL_SOUND);
                const type = LOCAL_SOUND.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4';
                const range = req.headers.range;
                if (range) {
                    const m = /bytes=(\d*)-(\d*)/.exec(range);
                    const start = m && m[1] ? parseInt(m[1], 10) : 0;
                    const end = m && m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
                    res.writeHead(206, {
                        'Content-Type': type, 'Accept-Ranges': 'bytes',
                        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                        'Content-Length': end - start + 1
                    });
                    return fs.createReadStream(LOCAL_SOUND, { start, end }).pipe(res);
                }
                res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size, 'Cache-Control': 'public, max-age=3600' });
                return fs.createReadStream(LOCAL_SOUND).pipe(res);
            }

            if (req.method === 'GET' && url.pathname === '/health') {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('ok');
            }

            if (req.method === 'GET' && url.pathname === '/api/status') {
                const asked = String(url.searchParams.get('number') || '').replace(/\D/g, '');
                return json(res, 200, asked ? publicPairing(pairings.get(asked)) : { status: 'idle' });
            }

            if (req.method === 'GET' && url.pathname === '/api/connected-count') {
                return json(res, 200, { count: listSessionNumbers().length });
            }

            if (req.method === 'POST' && url.pathname === '/api/pair') {
                const body = await readBody(req);
                const number = String(body.number || '').replace(/\D/g, '');
                if (number.length < 7 || number.length > 15) {
                    return json(res, 400, { message: 'Invalid phone number.' });
                }

                // A "waiting" request stuck longer than the stale threshold is abandoned
                let current = pairings.get(number);
                if (current?.status === 'waiting' && Date.now() - current.startedAt > PAIRING_STALE_MS) {
                    pairings.delete(number);
                    current = null;
                }

                if (current?.status === 'waiting') {
                    return json(res, 200, { message: 'Pairing request already active.', status: current.status, code: current.code });
                }

                const waitingNow = [...pairings.values()].filter((v) => v.status === 'waiting').length;
                if (waitingNow >= MAX_WAITING) {
                    return json(res, 429, { message: 'The server is busy right now. Try again in a few seconds.' });
                }

                setPairing(number, { status: 'waiting', code: null });

                const existing = await import('../utils/connector.js');
                if (existing.getSession(number)?.user) {
                    const done = setPairing(number, { status: 'connected', code: null, message: 'This WhatsApp session is already connected.' });
                    return json(res, 200, { message: done.message, status: done.status });
                }

                try {
                    await startSession(number, handleMessage, true, (code, n, error) => {
                        const key = String(n || number);
                        if (error) setPairing(key, { status: 'error', code: null, message: error.message });
                        else if (code) setPairing(key, { status: 'ready', code });
                    }, false, () => {
                        // Fired once WhatsApp actually finishes linking, so the
                        // pairing page stops waiting on the old code.
                        setPairing(number, { status: 'connected', code: null });
                    });
                } catch (err) {
                    setPairing(number, { status: 'error', code: null, message: err.message });
                }

                const now = pairings.get(number);
                return json(res, 200, { message: 'Pairing request started.', status: now?.status, code: now?.code });
            }

            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
        } catch (e) {
            console.error('Web server:', e);
            // A crashed pairing attempt must not leave the server stuck
            // in "waiting" forever.
            json(res, 500, { message: e.message });
        }
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Pairing website listening on port ${PORT}`);

        // Bring all saved sessions back online (nothing did this before, so a
        // restart left every user offline until they paired again).
        restoreSessions(handleMessage).catch((e) => console.error('restoreSessions:', e?.message || e));
        startWatchdog(handleMessage);

        // Keep-alive: ping our own public URL so free hosts do not put the site/bot to sleep.
        // Set APP_URL (or it is auto-detected on Railway/Render) to enable.
        const publicUrl = process.env.APP_URL
            || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')
            || process.env.RENDER_EXTERNAL_URL || '';
        if (publicUrl) {
            const ping = () => fetch(`${publicUrl.replace(/\/$/, '')}/health`, { cache: 'no-store' })
                .catch((e) => console.log('keep-alive ping failed:', e?.message || e));
            setInterval(ping, 4 * 60 * 1000).unref();
            console.log(`🔔 Keep-alive enabled -> ${publicUrl}/health`);
        }

        // Memory/uptime heartbeat in the logs, useful to spot crashes and OOM kills.
        setInterval(() => {
            const mb = Math.round(process.memoryUsage().rss / 1024 / 1024);
            let disk = '';
            try {
                const st = fs.statfsSync(process.env.DATA_DIR || '.');
                disk = ` | disk free ${Math.round((st.bavail * st.bsize) / 1024 / 1024)}MB`;
            } catch {}
            console.log(`💓 uptime ${Math.round(process.uptime() / 60)}min | memory ${mb}MB${disk} | sessions online ${listSessionNumbers().length}`);
        }, 5 * 60 * 1000).unref();
    });

    return server;
}
