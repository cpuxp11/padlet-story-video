// 챕터별 프레임 렌더 → mp4.  사용: node scripts/render.mjs <프로젝트 폴더> [챕터번호,번호]
// 프로젝트 폴더에 spec2.js 와 assets/ 가 있어야 한다. 렌더러(renderer/film2.html)는 레포 공용.
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
const FPS = 30, W = 1080, H = 1920;
const proj = path.resolve(process.argv[2] || '.');
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// 렌더러는 프로젝트 폴더 기준 상대경로(assets/...)를 쓰므로 프로젝트 안에 복사본을 둔다
fs.copyFileSync(path.join(repo, 'renderer/film2.html'), path.join(proj, 'film2.html'));
fs.mkdirSync(path.join(proj, 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(repo, 'fonts'))) if (!fs.existsSync(path.join(proj, 'fonts', f))) fs.copyFileSync(path.join(repo, 'fonts', f), path.join(proj, 'fonts', f));
const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
fs.mkdirSync(path.join(proj, 'out'), { recursive: true });
const nCh = (fs.readFileSync(path.join(proj, 'spec2.js'), 'utf8').match(/\{\s*id:"/g) || []).length;
for (const ci of (only || [...Array(nCh).keys()])) {
  await p.goto('file://' + path.join(proj, 'film2.html') + `?ch=${ci}`);
  await p.waitForFunction(() => window.__READY__ === true);
  await p.waitForTimeout(800);
  await p.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), { timeout: 20000 }).catch(() => {});
  const dur = await p.evaluate(() => window.DURATION);
  const id = await p.evaluate(() => window.SPEC2[+new URLSearchParams(location.search).get('ch')].id);
  const vids = await p.evaluate(() => window.SPEC2[+new URLSearchParams(location.search).get('ch')].beats.filter(b => b.vid).map(b => ({ vid: b.vid, s: b._s, d: b._d })));
  const tag = `${String(ci).padStart(2, '0')}_${id}`;
  fs.writeFileSync(path.join(proj, 'out', `${tag}.vid.json`), JSON.stringify(vids));
  const dir = path.join(proj, `frames_${id}`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const N = Math.round(dur * FPS);
  for (let i = 0; i < N; i++) {
    await p.evaluate(t => window.seek(t), i / FPS);
    await p.screenshot({ path: `${dir}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (i % 300 === 0) process.stdout.write(`\r${id} ${i}/${N}`);
  }
  execSync(`ffmpeg -v error -framerate ${FPS} -i "${dir}/f%05d.jpg" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium "${path.join(proj, 'out', tag + '.mp4')}" -y`);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\r✓ ${id}  ${dur.toFixed(1)}s  ${N}f`);
}
await b.close();
