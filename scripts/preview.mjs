// 특정 시각 프레임만 찍어 보는 미리보기. 사용: node scripts/preview.mjs <프로젝트 폴더> <챕터번호> <초,초,초>
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const proj = path.resolve(process.argv[2] || '.'); const ch = +process.argv[3]; const times = (process.argv[4] || '0').split(',').map(Number);
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.copyFileSync(path.join(repo, 'renderer/film2.html'), path.join(proj, 'film2.html'));
fs.mkdirSync(path.join(proj, 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(repo, 'fonts'))) if (!fs.existsSync(path.join(proj, 'fonts', f))) fs.copyFileSync(path.join(repo, 'fonts', f), path.join(proj, 'fonts', f));
const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await p.goto('file://' + path.join(proj, 'film2.html') + `?ch=${ch}`);
await p.waitForFunction(() => window.__READY__ === true); await p.waitForTimeout(800);
await p.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), { timeout: 20000 }).catch(() => {});
fs.mkdirSync(path.join(proj, 'preview'), { recursive: true });
console.log('챕터 길이', (await p.evaluate(() => window.DURATION)).toFixed(1), 's');
for (const t of times) { await p.evaluate(t => window.seek(t), t); const f = path.join(proj, 'preview', `ch${ch}_${t}.jpg`); await p.screenshot({ path: f, type: 'jpeg', quality: 85 }); console.log(f); }
await b.close();
