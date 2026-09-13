// 화면 밖으로 잘리는 글자 자동 검사. 사용: node scripts/qa_overflow.mjs <프로젝트 폴더>
// 렌더 없이 몇 초. 모든 챕터·비트의 50%·90% 시점에서 보이는 글자 박스가 1080×1920 밖으로 나가는지 본다.
// 눈으로 프레임을 훑으면 긴 자막 잘림을 놓치기 쉽다 → render 전에 이걸 먼저 돌린다. 잘림이 있으면 종료 코드 1.
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const proj = path.resolve(process.argv[2] || '.');
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.copyFileSync(path.join(repo, 'renderer/film2.html'), path.join(proj, 'film2.html'));
fs.mkdirSync(path.join(proj, 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(repo, 'fonts'))) if (!fs.existsSync(path.join(proj, 'fonts', f))) fs.copyFileSync(path.join(repo, 'fonts', f), path.join(proj, 'fonts', f));
const nCh = (fs.readFileSync(path.join(proj, 'spec2.js'), 'utf8').match(/\{\s*id:"/g) || []).length;

const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
let total = 0, bad = 0;
for (let ch = 0; ch < nCh; ch++) {
  await p.goto('file://' + path.join(proj, 'film2.html') + `?ch=${ch}`);
  await p.waitForFunction(() => window.__READY__ === true); await p.waitForTimeout(500);
  await p.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), { timeout: 15000 }).catch(() => {});
  const beats = await p.evaluate(() => window.SPEC2[+new URLSearchParams(location.search).get('ch')].beats.map(x => ({ t: x.t, s: x._s, d: x._d })));
  for (const [i, bt] of beats.entries()) for (const frac of [0.5, 0.9]) {
    total++;
    const t = bt.s + bt.d * frac;
    const issues = await p.evaluate(tt => {
      window.seek(tt); const out = [];
      document.querySelectorAll('.b').forEach(beat => {
        if (getComputedStyle(beat).opacity === '0') return;
        beat.querySelectorAll('*').forEach(el => {
          if (el.children.length || !el.textContent.trim()) return;
          if (getComputedStyle(el).opacity === '0') return;
          const r = el.getBoundingClientRect(); if (!r.width) return;
          if (r.left < -1 || r.right > 1081 || r.top < -1 || r.bottom > 1921) out.push(`"${el.textContent.trim().slice(0, 20)}" x ${Math.round(r.left)}..${Math.round(r.right)}`);
        });
      });
      return out;
    }, t);
    if (issues.length) { bad++; console.log(`✗ 챕터${ch} 비트${i}(${bt.t}) ${t.toFixed(1)}초: ${issues.slice(0, 4).join(' / ')}`); }
  }
}
await b.close();
console.log(`${bad ? '✗' : '✓'} 검사 ${total}지점, 잘림 ${bad}지점`);
process.exit(bad ? 1 : 0);
