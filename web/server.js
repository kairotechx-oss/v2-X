import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { startSession, listSessionNumbers, restoreSessions } from '../utils/connector.js';

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
        spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>'
    };
    return icons[name] || '';
};

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0b0610">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>🎃 KAIRO ZYNEX — Whatsapp Pairing</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Creepster&family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0b0610;--panel:#18101f;--panel-2:#1f1226;--line:rgba(255,140,50,.22);
  --text:#fff3e6;--muted:#a592b8;
  --accent:#ff7a18;--accent2:#b66dff;--good:#8dff5e;--danger:#ff6b7a
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:'Sora',ui-sans-serif,system-ui,sans-serif;overflow-x:hidden}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:26px 14px 120px;overscroll-behavior:none;position:relative}
body:before{content:"";position:fixed;z-index:0;pointer-events:none;width:460px;height:460px;top:-170px;left:50%;transform:translateX(-50%);background:radial-gradient(circle,rgba(255,122,24,.35),transparent 70%);filter:blur(20px)}
body:after{content:"";position:fixed;z-index:0;pointer-events:none;width:380px;height:380px;bottom:-160px;right:-80px;background:radial-gradient(circle,rgba(139,61,255,.18),transparent 70%);filter:blur(30px)}
svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.shell{width:min(100%,460px);position:relative;z-index:1}

.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);letter-spacing:.5px}
.topbar .live{display:inline-flex;align-items:center;gap:7px;color:var(--good)}
.topbar .live i{width:6px;height:6px;border-radius:50%;background:var(--good);box-shadow:0 0 10px var(--good);animation:blink 1.6s ease-in-out infinite}
@keyframes blink{50%{opacity:.35}}
.icon-btn{width:36px;height:36px;border:1px solid var(--line);background:rgba(255,122,24,.08);color:#ffe2c4;border-radius:10px;display:grid;place-items:center;cursor:pointer;transition:.2s}
.icon-btn:hover{background:rgba(255,122,24,.18)}

.card{position:relative;background:linear-gradient(165deg,var(--panel),var(--panel-2));border:1px solid var(--line);border-radius:22px;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 1px rgba(255,122,24,.06) inset;animation:rise .5s ease both;overflow:hidden;padding:30px 26px 26px}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.card:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,122,24,.10),transparent 45%,rgba(139,61,255,.06));pointer-events:none}

.brand-row{position:relative;display:flex;align-items:center;gap:14px;margin-bottom:22px}
.logo{width:50px;height:50px;border-radius:14px;overflow:hidden;border:1px solid rgba(139,61,255,.5);box-shadow:0 0 24px rgba(255,122,24,.4);flex-shrink:0}
.logo img{width:100%;height:100%;object-fit:cover}
.brand-row h1{margin:0;font-size:19px;font-weight:800;letter-spacing:.3px;background:linear-gradient(90deg,#fff3e0,#ff9a3d);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.brand-row p{margin:3px 0 0;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase}

.badge{position:relative;display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;background:rgba(255,122,24,.12);border:1px solid var(--line);color:#ffd9b0;font-size:11px;font-weight:600;letter-spacing:.3px;margin-bottom:18px}
.badge svg{width:13px;height:13px;color:var(--accent2)}

h2.title{position:relative;font-size:23px;line-height:1.3;font-weight:700;margin:0 0 20px;letter-spacing:-.2px}

.field{position:relative}
.field label{display:block;font-family:'JetBrains Mono',monospace;color:#d9b8ff;font-size:11px;letter-spacing:1.2px;margin-bottom:9px;text-transform:uppercase}
.input-wrap{display:flex;align-items:center;background:rgba(0,0,0,.28);border:1px solid var(--line);border-radius:12px;padding:0 14px;transition:.2s}
.input-wrap:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px rgba(255,122,24,.18)}
.prefix{font-family:'JetBrains Mono',monospace;color:var(--accent2);font-size:14px;margin-right:2px}
input{width:100%;height:52px;border:0;outline:0;background:transparent;color:#fff;font-size:15px;font-family:'JetBrains Mono',monospace;letter-spacing:.4px}
input::placeholder{color:#5a4a6e}

.primary{position:relative;width:100%;height:52px;margin-top:13px;border:0;border-radius:12px;background:linear-gradient(100deg,#ffb02e,#ff6a13);color:#1a0a00;font-weight:800;font-size:13.5px;letter-spacing:.3px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;transition:.2s;font-family:'Sora',sans-serif;box-shadow:0 14px 34px rgba(255,122,24,.35)}
.primary:hover{filter:brightness(1.07);transform:translateY(-1px)}
.primary:active{transform:translateY(1px)}
.primary:disabled{opacity:.5;cursor:wait;transform:none}

.status{min-height:18px;text-align:left;font-family:'JetBrains Mono',monospace;color:var(--muted);font-size:11.5px;margin:12px 0 0}
.status:before{content:"> "}
.status.good{color:var(--good)}.status.bad{color:var(--danger)}

.code-box{display:none;margin-top:16px;border:1px solid rgba(141,255,94,.3);background:rgba(141,255,94,.06);border-radius:12px;padding:17px}
.code-box.show{display:block;animation:pop .3s ease}
@keyframes pop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
.code-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.5px;color:#c6ffb0;text-align:center;text-transform:uppercase}
.code{font-family:'JetBrains Mono',monospace;font-size:28px;letter-spacing:7px;text-align:center;font-weight:700;color:var(--good);margin:9px 0 13px}
.copy{width:100%;height:42px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.03);color:#fff0e0;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px}
.copy:hover{background:rgba(255,255,255,.08)}

.steps{position:relative;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#d9b8ff;margin-top:24px;line-height:2.2;border-top:1px solid var(--line);padding-top:17px}
.steps span{display:inline-block;width:20px;color:var(--accent2);font-weight:700}

.footer{text-align:center;font-family:'JetBrains Mono',monospace;color:#6d5a82;font-size:10px;margin-top:17px;letter-spacing:.5px}
.footer strong{color:#ff9a3d}

.drawer{position:fixed;inset:0;background:rgba(5,2,10,.65);backdrop-filter:blur(6px);display:none;z-index:20}
.drawer.open{display:block}
.panel{position:absolute;right:0;top:0;height:100%;width:min(88vw,340px);background:#120a18;border-left:1px solid var(--line);padding:20px;transform:translateX(100%);transition:.28s ease}
.drawer.open .panel{transform:none}
.panel-head{display:flex;align-items:center;justify-content:space-between}
.panel h3{margin:0;font-size:16px;font-family:'JetBrains Mono',monospace;letter-spacing:.5px}
.panel p{color:var(--muted);font-size:12px;line-height:1.55}
.nav-link{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--line);border-radius:12px;color:#fff;text-decoration:none;margin:9px 0;background:rgba(255,122,24,.06)}
.nav-link span{font-size:13px;font-weight:600}
.nav-link small{display:block;color:#9a86b0;font-size:10px;margin-top:2px}
.sound{width:100%;height:42px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;cursor:pointer;margin-top:12px;font-family:'JetBrains Mono',monospace;font-size:12px}
@media(max-width:420px){.card{padding:24px 18px 20px}h2.title{font-size:20px}}

.bg{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0;background:radial-gradient(ellipse at 50% 0%,#2a1245 0%,#12071f 45%,#07030c 100%)}
.bg .stars{position:absolute;inset:0;background-image:radial-gradient(1.5px 1.5px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 28% 8%,#ffe9c9,transparent),radial-gradient(1.5px 1.5px at 44% 24%,#fff,transparent),radial-gradient(1px 1px at 63% 12%,#ffe9c9,transparent),radial-gradient(1.5px 1.5px at 78% 28%,#fff,transparent),radial-gradient(1px 1px at 90% 10%,#fff,transparent),radial-gradient(1px 1px at 6% 40%,#ffe9c9,transparent),radial-gradient(1.5px 1.5px at 36% 46%,#fff,transparent),radial-gradient(1px 1px at 86% 52%,#ffe9c9,transparent);opacity:.7;animation:twinkle 5s ease-in-out infinite alternate}
@keyframes twinkle{from{opacity:.4}to{opacity:.85}}
.bg .moon{position:absolute;bottom:58px;left:50%;margin-left:-42px;width:84px;height:84px;border-radius:50%;background:radial-gradient(circle at 34% 32%,#fff3c9,#ffc266 60%,#e0902f);box-shadow:0 0 70px rgba(255,170,60,.55),0 0 160px rgba(255,140,40,.25)}
.bg .moon:before{content:"";position:absolute;left:22px;top:30px;width:16px;height:16px;border-radius:50%;background:rgba(190,110,30,.35);box-shadow:34px 20px 0 -3px rgba(190,110,30,.3),10px 42px 0 -5px rgba(190,110,30,.28)}

.ghosts .g{position:absolute;top:0;left:var(--x);width:var(--s);color:#ece3ff;opacity:var(--o);animation:driftUp var(--d) linear infinite;animation-delay:var(--dl);will-change:transform}
.ghosts .g.down{animation-name:driftDown}
.ghosts .gh{display:block;width:100%;height:auto;fill:currentColor;stroke:none;filter:drop-shadow(0 0 16px rgba(190,150,255,.65));animation:sway 5.5s ease-in-out infinite alternate,fade 9s ease-in-out infinite}
.ghosts .g.far .gh{filter:blur(1.5px) drop-shadow(0 0 10px rgba(190,150,255,.5))}
@keyframes driftUp{from{transform:translateY(110vh)}to{transform:translateY(-30vh)}}
@keyframes driftDown{from{transform:translateY(-30vh)}to{transform:translateY(110vh)}}
@keyframes sway{from{transform:translateX(-22px) rotate(-6deg)}to{transform:translateX(22px) rotate(6deg)}}
@keyframes fade{0%,100%{opacity:1}45%{opacity:.35}60%{opacity:.9}}
.ghosts .g[data-say]:after{content:attr(data-say);position:absolute;left:92%;top:-6px;white-space:nowrap;font-family:'JetBrains Mono',monospace;font-size:11px;color:#e6d6ff;background:rgba(40,16,70,.75);border:1px solid rgba(190,150,255,.35);border-radius:10px;padding:3px 8px;opacity:0;animation:whisper 11s ease-in-out infinite;animation-delay:var(--dl)}
@keyframes whisper{0%,62%,100%{opacity:0;transform:translateY(4px)}70%,84%{opacity:.95;transform:none}}

.bg .bat{position:absolute;left:-10%;font-size:24px;opacity:.85;animation:fly 15s linear infinite}
.bg .b1{top:16%}.bg .b2{top:30%;font-size:18px;animation-duration:21s;animation-delay:-7s}.bg .b3{top:9%;font-size:20px;animation-duration:26s;animation-delay:-13s}
@keyframes fly{0%{transform:translate(0,0) rotate(-8deg)}25%{transform:translate(35vw,-18px) rotate(6deg)}50%{transform:translate(70vw,10px) rotate(-6deg)}75%{transform:translate(105vw,-14px) rotate(8deg)}100%{transform:translate(135vw,0) rotate(-4deg)}}

.bg .fog{position:absolute;left:-30%;width:160%;height:200px;background:radial-gradient(ellipse at 50% 50%,rgba(150,100,230,.22),transparent 68%);filter:blur(14px);animation:fogmove 28s ease-in-out infinite alternate}
.bg .f1{bottom:60px}.bg .f2{bottom:-30px;animation-duration:36s;animation-direction:alternate-reverse;opacity:.8}
@keyframes fogmove{from{transform:translateX(-8%)}to{transform:translateX(8%)}}
.bg .yard{position:absolute;left:0;bottom:0;width:100%;height:170px;stroke:none}
.bg .pumpkin{position:absolute;bottom:14px;line-height:1;filter:drop-shadow(0 0 20px rgba(255,122,24,.8));animation:bob 3.2s ease-in-out infinite}
.bg .p1{left:10px;font-size:54px}.bg .p2{right:12px;font-size:40px;animation-delay:-1.4s}
@keyframes bob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-6px) rotate(3deg)}}

.spider{position:absolute;top:50px;right:44px;width:2px;pointer-events:none;z-index:2;animation:swing 4.5s ease-in-out infinite;transform-origin:top center}
.spider i{display:block;width:1px;height:46px;margin:0 auto;background:rgba(255,230,200,.45)}
.spider b{display:block;font-size:22px;line-height:1;margin-left:-10px;font-weight:400}
@keyframes swing{0%,100%{transform:rotate(-5deg) translateY(0)}50%{transform:rotate(5deg) translateY(10px)}}

h2.title,.brand-row h1{font-family:'Creepster','Sora',cursive;font-weight:400;letter-spacing:1px}
.brand-row h1{font-size:28px;line-height:1}
h2.title{font-size:27px;line-height:1.15}
.card{border-color:rgba(255,122,24,.45);box-shadow:0 0 0 1px rgba(255,122,24,.1) inset,0 0 40px rgba(255,122,24,.18),0 40px 90px rgba(0,0,0,.6)}
.badge.hw{border-color:rgba(255,122,24,.5);background:rgba(255,122,24,.15);color:#ffd9b0}

.faq{margin-top:22px;position:relative}
.faq h3{margin:0 0 12px;font-family:'Creepster','Sora',cursive;font-weight:400;font-size:24px;letter-spacing:1px;color:#ffb066}
.faq details{background:rgba(14,6,22,.78);border:1px solid var(--line);border-radius:14px;margin:9px 0;overflow:hidden;backdrop-filter:blur(4px)}
.faq details[open]{border-color:rgba(255,122,24,.5);box-shadow:0 0 22px rgba(255,122,24,.12)}
.faq summary{list-style:none;cursor:pointer;padding:14px 16px;font-size:13px;font-weight:600;display:flex;gap:10px;align-items:center;color:#fff3e6}
.faq summary::-webkit-details-marker{display:none}
.faq summary:before{content:"🎃";font-size:16px}
.faq details[open] summary:before{content:"👻"}
.faq .ans{padding:0 16px 15px;font-size:12.5px;line-height:1.7;color:#dccdf0}
.faq .ans ol{margin:6px 0 0;padding-left:20px}.faq .ans li{margin:4px 0}
.faq .ans code{font-family:'JetBrains Mono',monospace;background:rgba(255,122,24,.14);color:#ffc890;padding:1px 6px;border-radius:6px;font-size:12px}
@media(prefers-reduced-motion:reduce){.bg *,.spider,.ghosts .g{animation:none!important}.ghosts .g{transform:translateY(40vh)}}
@media(max-width:420px){.bg .moon{width:66px;height:66px;margin-left:-33px}.bg .p1{font-size:44px}.brand-row h1{font-size:25px}h2.title{font-size:23px}}
</style>
</head>
<body>
<div class="bg" aria-hidden="true">
<svg width="0" height="0" style="position:absolute"><symbol id="ghost" viewBox="0 0 64 80"><path d="M32 4C16 4 6 16 6 34v38l9-7 8 8 9-8 9 8 8-8 9 7V34C58 16 48 4 32 4z"/><ellipse cx="23" cy="34" rx="5" ry="6.5" fill="#1a0f2a"/><ellipse cx="41" cy="34" rx="5" ry="6.5" fill="#1a0f2a"/><ellipse cx="32" cy="50" rx="5" ry="7" fill="#1a0f2a"/></symbol></svg>
<div class="stars"></div><div class="moon"></div>
<div class="ghosts">
<div class="g " style="--x:6%;--s:74px;--o:0.4;--d:26s;--dl:-4s" data-say="boo..."><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
<div class="g down" style="--x:22%;--s:54px;--o:0.3;--d:31s;--dl:-12s"><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
<div class="g far" style="--x:38%;--s:110px;--o:0.34;--d:38s;--dl:-20s"><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
<div class="g " style="--x:54%;--s:62px;--o:0.36;--d:29s;--dl:-9s" data-say="psst... link me"><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
<div class="g down" style="--x:68%;--s:84px;--o:0.3;--d:35s;--dl:-3s"><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
<div class="g far" style="--x:82%;--s:100px;--o:0.22;--d:40s;--dl:-17s"><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
<div class="g " style="--x:90%;--s:48px;--o:0.38;--d:24s;--dl:-7s" data-say="hehehe"><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
<div class="g down" style="--x:14%;--s:44px;--o:0.34;--d:22s;--dl:-15s"><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
<div class="g " style="--x:46%;--s:40px;--o:0.3;--d:20s;--dl:-1s"><svg class="gh" viewBox="0 0 64 80"><use href="#ghost"/></svg></div>
</div>
<span class="bat b1">🦇</span><span class="bat b2">🦇</span><span class="bat b3">🦇</span>
<div class="fog f1"></div><div class="fog f2"></div>
<svg class="yard" viewBox="0 0 800 170" preserveAspectRatio="xMidYMax slice"><path d="M0 170V118Q110 84 240 112T520 104T800 88V170Z" fill="#0a0412"/><path d="M0 170V138Q150 112 300 134T620 126T800 118V170Z" fill="#05020a"/><g fill="#05020a"><path d="M70 170v-44a15 15 0 0 1 30 0v44z"/><path d="M150 170v-30h24v30z"/><path d="M360 170v-40a13 13 0 0 1 26 0v40z"/><path d="M440 170v-26l12-10 12 10v26z"/><path d="M610 170v-42a15 15 0 0 1 30 0v42z"/><path d="M720 150c0-30 6-52 4-76l-22-22 14 4-6-18 12 14 5-20 5 22 16-12-10 20 18-4-20 20c-2 24 4 50 4 72z"/></g></svg>
<span class="pumpkin p1">🎃</span><span class="pumpkin p2">🎃</span>
</div>
<main class="shell">
<div class="spider" aria-hidden="true"><i></i><b>🕷️</b></div>
<div class="topbar"><span class="live"><i></i> SYSTEM ONLINE</span><span id="connectedCount" class="live" style="color:var(--accent2)">· 0 connected</span><button class="icon-btn" id="menuBtn" aria-label="Open menu">${icon('menu')}</button></div>

<section class="card">
<div class="brand-row"><div class="logo"><img src="/logo.jpg" alt="KAIRO ZYNEX"></div><div><h1>KAIRO ZYNEX</h1><p>WhatsApp Bot · Pairing</p></div></div>

<div class="badge hw">🎃 Happy Halloween · Secure pairing 👻</div>

<h2 class="title">Link a device to run KAIRO ZYNEX on your number.</h2>

<div class="field">
<label for="number">WhatsApp number</label>
<div class="input-wrap"><span class="prefix">+</span><input id="number" type="tel" inputmode="tel" autocomplete="tel" placeholder="509xxxxxxxx" maxlength="20"></div>
</div>

<button class="primary" id="generate">${icon('refresh')}<span>Generate pairing code</span></button>
<div class="status" id="status" aria-live="polite"></div>
<div class="code-box" id="codeBox"><div class="code-label">Pairing code</div><div class="code" id="code">--------</div><button class="copy" id="copy">${icon('copy')}<span>Copy code</span></button></div>

<div class="steps">
<div><span>01</span>Generate the code above</div>
<div><span>02</span>WhatsApp → Linked devices</div>
<div><span>03</span>Link with phone number → enter code</div>
</div>
</section>

<section class="faq">
<h3>How to connect &middot; FAQ</h3>
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

<div class="footer">🎃 Powered by <strong>KAIRO DEV</strong> — keep your pairing code private. 🦇</div>
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
  }catch(e){}
}
refreshConnectedCount();
setInterval(refreshConnectedCount,15000);

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

            if (req.method === 'GET' && url.pathname === '/zonic') {
                try {
                    const html = fs.readFileSync(new URL('./zonic.html', import.meta.url), 'utf8');
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
                    return res.end(html);
                } catch {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    return res.end('Game not found');
                }
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
