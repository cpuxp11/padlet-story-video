// 최종 조립: 촬영 클립(선택) + 챕터 렌더 + AI영상 카드 오버레이 + 음악 믹스 → 완성 mp4
// 사용: node scripts/assemble.mjs <프로젝트 폴더> [출력파일명.mp4]
//
// spec2.js 에서 읽는 것 (챕터 객체):
//   clips:["c1","t1"]      이 챕터 "앞"에 끼울 촬영 클립 이름(clips.conf 의 이름)
//   music:{file, ss:0, I:-14, fadeIn:0.05, fadeOut:4, tail:0.2}   챕터 0초에 맞춰 까는 음악(아이 노래 등)
//   music:"carry"          앞 챕터 음악을 그대로 이어감(끊지 않음)
// 전역: window.AUDIO = { bridge:{file, ss:0, I:-16, fadeIn:0.3, fadeOut:1.0, jumps:[0,36.4,66.6]} }  음악이 없는 구간을 채우는 배경음.
//        jumps 를 주면 빈 구간마다 곡의 다른 프레이즈(초)에서 시작 — 매번 같은 도입부가 반복되지 않게
// clips.conf: 이름:파일(확장자 포함, 절대경로 가능):시작초:길이[:라벨[:crop w,h,x,y[:캡션1[:캡션2[:캡션머리말]]]]]   (LUT는 window.AUDIO.lut 또는 CLIPS_LUT 환경변수)
//   캡션머리말 기본값 "실제로 이렇게 쳤습니다" — 태블릿 화면 컷이면 "화면에 나온 그림" 등으로
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import vm from 'vm';

const proj = path.resolve(process.argv[2] || '.');
const outName = process.argv[3] || 'final_v1.mp4';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(proj);
const ff = (args) => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// spec2.js 를 브라우저 없이 읽는다 (window 흉내)
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('spec2.js', 'utf8'), ctx);
const SPEC = ctx.window.SPEC2; const AUDIO = ctx.window.AUDIO || {};
const FONT = fs.existsSync('fonts/BMJUA.otf') ? './fonts/BMJUA.otf' : path.join(repo, 'fonts/BMJUA.otf');
const LUT = process.env.CLIPS_LUT || AUDIO.lut || '';
const CLIP_SRC = process.env.CLIPS_SRC || AUDIO.clipsSrc || 'footage';

// 1) 촬영 클립 정규화 (가로 소스 → 크림 배경 폴라로이드 카드 9:16)
const clips = {};
if (fs.existsSync('clips.conf')) {
  fs.mkdirSync('clips', { recursive: true });
  for (const line of fs.readFileSync('clips.conf', 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [nm, file, ss, len, label = '', crop = '', cap1 = '', cap2 = '', head = '실제로 이렇게 쳤습니다'] = line.split(':');
    const out = `clips/${nm}.mp4`; clips[nm] = out;
    if (fs.existsSync(out)) continue;
    let vf = LUT ? `lut3d='${LUT}'` : 'null';
    if (crop) { const [w, h, x, y] = crop.split(','); vf += `,crop=${w}:${h}:${x}:${y}`; }
    vf += ',scale=1000:-2,pad=iw+36:ih+36:18:18:white,pad=1080:1920:(ow-iw)/2:(oh-ih)/2-60:0xFFF8EC,fps=30,setsar=1';
    const dt = (t, y, size, color) => `,drawtext=fontfile='${FONT}':text='${t.replace(/'/g, '')}':x=(w-text_w)/2:y=${y}:fontsize=${size}:fontcolor=${color}`;
    if (label) vf += dt(label, 1330, 100, '0x2B2118');
    if (cap1) { vf += dt(head, 1290, 50, '0xB08968') + dt(cap1, 1370, 68, '0x2B2118'); if (cap2) vf += dt(cap2, 1455, 68, '0x2B2118'); }
    ff(['-ss', ss, '-t', len, '-i', path.isAbsolute(file) ? file : path.join(CLIP_SRC, file), '-vf', vf, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', out]);
    console.log('클립', out);
  }
}

// 2) AI 영상 카드 오버레이 (렌더 시 out/NN_id.vid.json 에 위치가 기록됨)
function overlay(base, json, out) {
  const vids = fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')) : [];
  if (!vids.length) return base;
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(base).mtimeMs) return out;
  const args = ['-i', base]; const fc = []; let prev = '[0:v]';
  vids.forEach((v, i) => {
    args.push('-i', v.vid);
    fc.push(`[${i + 1}:v]scale=1000:562,fps=30,tpad=stop_mode=clone:stop_duration=${Math.max(0, v.d).toFixed(2)},setpts=PTS-STARTPTS+${v.s}/TB[v${i}]`);  // 비트가 영상보다 길면 마지막 프레임 홀드
    fc.push(`${prev}[v${i}]overlay=40:619:enable='between(t,${v.s},${v.s + v.d})':eof_action=pass[o${i}]`); prev = `[o${i}]`;
  });
  ff([...args, '-filter_complex', fc.join(';'), '-map', prev, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', out]);
  console.log('오버레이', out, vids.length);
  return out;
}

// 3) 타임라인 구성
const seq = []; let t = 0;
SPEC.forEach((ch, ci) => {
  for (const c of (ch.clips || [])) { if (!clips[c]) throw new Error(`clips.conf 에 없는 클립: ${c}`); const d = dur(clips[c]); seq.push({ type: 'clip', file: clips[c], start: t, dur: d }); t += d; }
  const tag = `${String(ci).padStart(2, '0')}_${ch.id}`;
  const base = `out/${tag}.mp4`; if (!fs.existsSync(base)) throw new Error(`렌더가 없습니다: ${base} (먼저 npm run render)`);
  const file = overlay(base, `out/${tag}.vid.json`, `out/${tag}_ov.mp4`);
  const d = dur(file); seq.push({ type: 'chapter', file, start: t, dur: d, ch }); t += d;
});
const TOTAL = t;
fs.writeFileSync('_concat.txt', seq.map(s => `file '${path.resolve(s.file)}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', '_concat.txt', '-c', 'copy', '_video.mp4']);
console.log('영상', TOTAL.toFixed(1), 's');

// 4) 음악 레이어
const layers = []; let li = 0;
function seg(m, at, len) {
  const out = `_a${li++}.wav`;
  const fi = m.fadeIn ?? 0.3, fo = m.fadeOut ?? 1.0, I = m.I ?? -14, ss = m.ss ?? 0;
  ff(['-ss', String(ss), '-t', String(len), '-i', m.file, '-vn', '-af',
    `loudnorm=I=${I}:TP=-1.2,afade=t=in:st=0:d=${fi},afade=t=out:st=${Math.max(0, len - fo)}:d=${fo},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}`,
    '-ar', '48000', '-ac', '2', out]);
  layers.push(out);
}
// 챕터 음악: 챕터 시작에 맞춰. "carry" 는 앞 음악을 다음 chapter 끝까지 늘림
const covered = []; let cur = null;
for (const s of seq) {
  if (s.type !== 'chapter') continue;
  const m = s.ch.music;
  if (m && m !== 'carry') { if (cur) { covered.push(cur); } cur = { m, at: s.start, end: s.start + s.dur }; }
  else if (m === 'carry' && cur) cur.end = s.start + s.dur;
  else { if (cur) { covered.push(cur); cur = null; } }
}
if (cur) covered.push(cur);
for (const c of covered) seg(c.m, c.at, Math.min(c.end - c.at + (c.m.tail ?? 0.2), TOTAL - c.at));
// 빈 구간 → 브릿지 음악
if (AUDIO.bridge) {
  let gaps = []; let pos = 0;
  for (const c of covered.sort((a, b) => a.at - b.at)) { if (c.at - pos > 0.5) gaps.push([pos, c.at]); pos = Math.max(pos, c.end); }
  if (TOTAL - pos > 0.5) gaps.push([pos, TOTAL]);
  const J = AUDIO.bridge.jumps || [];
  gaps.forEach(([a, b], i) => seg({ ...AUDIO.bridge, ss: J.length ? J[i % J.length] : (AUDIO.bridge.ss ?? 0) }, a, b - a + 0.4));
  console.log('브릿지 구간', gaps.map(g => `${g[0].toFixed(1)}-${g[1].toFixed(1)}`).join(', '));
}
if (!layers.length) { fs.copyFileSync('_video.mp4', outName); console.log('음악 없음 →', outName); process.exit(0); }
const inputs = layers.flatMap(l => ['-i', l]);
ff([...inputs, '-filter_complex', `${layers.map((_, i) => `[${i}]`).join('')}amix=inputs=${layers.length}:normalize=0:duration=longest,alimiter=limit=0.95[a]`, '-map', '[a]', '-t', String(TOTAL), '-ar', '48000', '_mix.wav']);
ff(['-i', '_video.mp4', '-i', '_mix.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outName]);
for (const l of layers) fs.rmSync(l, { force: true });
console.log('완성', outName, dur(outName).toFixed(1), 's');
