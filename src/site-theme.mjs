// Shared look for every Buzzer page: tokens, embedded fonts and base elements.
// Fonts are inlined so a page still works when opened from file:// with no network.
import {existsSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const FONT_DIR=join(dirname(fileURLToPath(import.meta.url)),'..','assets','fonts');
const RANGE='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
function face(family,file,weight){
 const path=join(FONT_DIR,file);
 if(!existsSync(path))return '';
 return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(path).toString('base64')}) format("woff2");unicode-range:${RANGE}}`;
}

export function themeCss(){
 return `${face('Instrument Sans','InstrumentSans-latin-wght.woff2','400 700')}${face('IBM Plex Mono','IBMPlexMono-latin-400.woff2','400')}
:root{color-scheme:dark;
 --canvas:#0a1826;--surface:#0f2233;--surface-2:#142c41;--line:#213a50;--line-strong:#2f4d66;
 --ink:#e9f0f5;--ink-2:#b4c5d3;--ink-3:#8a9eb0;
 --accent:#7fe0c8;--accent-ink:#082621;
 --supported:#199e70;--mention:#3987e5;--disputed:#c98500;--rejected:#6f8598;--star:#e9b872;
 --sans:"Instrument Sans",ui-sans-serif,system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
 --ease:cubic-bezier(.16,1,.3,1)}
*{box-sizing:border-box}
html{scrollbar-color:var(--line-strong) var(--canvas)}
body{margin:0;background:var(--canvas);color:var(--ink);font:1rem/1.55 var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
::selection{background:var(--accent);color:var(--accent-ink)}
a{color:var(--accent);text-underline-offset:.18em}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
h1,h2,h3{font-weight:600;letter-spacing:-.015em;line-height:1.15;margin:0}
code,pre{font-family:var(--mono)}
.muted{color:var(--ink-2)}
.num{font-variant-numeric:tabular-nums}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
`;
}
