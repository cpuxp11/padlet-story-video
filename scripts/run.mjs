// 원샷: 패들릿 URL → 완성 mp4
// 사용: node scripts/run.mjs <패들릿 URL> --name <프로젝트이름> [--section 2주차] [--title "남해 워케이션 2주차"] [--hero "금산에는<br>이런 노래가"] [--music <CC음악 폴더>]
// 단계: fetch → transcribe(python whisper, 없으면 건너뜀) → auto_spec → render → assemble
import fs from 'fs'; import path from 'path'; import { spawnSync } from 'child_process';
const url = process.argv[2];
const opt = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
if (!url || !opt('--name')) { console.error('사용법: node scripts/run.mjs <패들릿 URL> --name <프로젝트이름> [--section 2주차] [--title ..] [--hero ..] [--music ..]'); process.exit(1); }
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const proj = path.join(repo, 'projects', opt('--name'));
const run = (cmd, args, must = true) => { console.log('\n$', cmd, args.join(' ')); const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: repo }); if (r.status !== 0 && must) { console.error('실패:', cmd); process.exit(r.status || 1); } return r.status === 0; };

run('node', ['scripts/padlet_fetch.mjs', url, proj, ...(opt('--section') ? ['--section', opt('--section')] : [])]);
// CC 음악 폴더: --music 이 주어지면 프로젝트 안 music/ 으로 링크
const musicSrc = opt('--music'); const musicDst = path.join(proj, 'music');
if (musicSrc && !fs.existsSync(musicDst)) fs.symlinkSync(path.resolve(musicSrc), musicDst);
const mp3s = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.mp3$/i.test(f)) mp3s.push(p); } };
if (fs.existsSync(path.join(proj, 'assets'))) walk(path.join(proj, 'assets'));
// 가사 원문을 whisper 프롬프트로: <mp3>.prompt.txt (노래 받아쓰기 환각 방지)
if (mp3s.length) {
  const posts = JSON.parse(fs.readFileSync(path.join(proj, 'padlet/posts.json'), 'utf8')); const bySec = {};
  for (const p of posts) (bySec[p.section] ||= []).push(p);
  for (const ps of Object.values(bySec)) {
    const mp3 = ps.flatMap(p => p.files || []).map(f => f.path).find(f => f && /\.mp3$/i.test(f));
    const ly = ps.map(p => p.body || '').find(b => /\[\s*(1절|후렴|Chorus)/i.test(b));
    if (mp3 && ly) fs.writeFileSync(path.join(proj, mp3.replace(/\.mp3$/i, '.prompt.txt')), ly);
  }
}
if (mp3s.length) { const ok = run('python3', ['scripts/transcribe.py', ...mp3s], false); if (!ok) console.warn('whisper 없음 → 가사는 등간격으로 배치합니다 (pip install mlx-whisper 로 정밀 싱크)'); }
run('node', ['scripts/auto_spec.mjs', proj, '--title', opt('--title', '우리 반 이야기'), '--hero', opt('--hero', '아이들이<br>바꾼 이야기'), '--music', 'music']);
run('node', ['scripts/render.mjs', proj]);
const out = `${opt('--name')}_auto_v1.mp4`;
run('node', ['scripts/assemble.mjs', proj, out]);
console.log('\n완성:', path.join(proj, out));
