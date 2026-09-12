// 패들릿 회수 결과(padlet/posts.json + assets/)만으로 spec2.js 초안을 자동 생성한다.
// 사용: node scripts/auto_spec.mjs <프로젝트 폴더> [--title "남해 워케이션 2주차"] [--hero "금산에는<br>이런 노래가"] [--music music]
// 규칙(사람이 짠 대본보다 단순하지만 "일단 나오는" 초안):
//   섹션 1개 = 아이 1챕터. 이름 = 섹션 제목의 "|" 뒤 (예: "2주차 | 김민" → 김민)
//   이야기 글(가장 긴 본문) → 노래 인트로 동안 타이핑 (최대 3문장)
//   노래(mp3) 있으면: 가사 게시물([1절]/[후렴] 표식)을 whisper 타임스탬프(.lyrics.json)에 맞춰 1절~첫 후렴까지, 그림을 2줄마다 순환, AI영상은 후렴 첫 비트
//   노래 없으면: 이야기 문장을 4.5초씩 그림 위에 얹고 CC 음악 베드
//   인트로/아웃트로는 assets/photos/ 가 있으면 사진 스택, 없으면 타이틀·카드만
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';

const proj = path.resolve(process.argv[2] || '.');
const opt = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TITLE = opt('--title', '우리 반 이야기'); const HERO = opt('--hero', '아이들이<br>바꾼 이야기'); const MUSIC = opt('--music', 'music');
const posts = JSON.parse(fs.readFileSync(path.join(proj, 'padlet/posts.json'), 'utf8'));
const exists = f => fs.existsSync(path.join(proj, f));
const dur = f => { try { return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(proj, f)]).toString()); } catch { return 0; } };
const q = s => JSON.stringify(String(s));

// ── 섹션별 자산 분류 ─────────────────────────────────────────────
const bySec = {};
for (const p of posts) (bySec[p.section] ||= []).push(p);
const isLyrics = b => /\[\s*(1절|후렴|Chorus|Verse)/i.test(b) || /후렴/.test(b) && b.split('\n').length > 6;
const isPrompt = b => /애니메이션|프롬프트|cinematic|animation|style/i.test(b) && b.split('\n').length <= 3;
const stripTags = t => t.replace(/\[\s*(제목|title)[^\]]*\][^\[\n]*/i, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/^\s*(제목|title)\s*[:：]\s*/i, '').trim();
const sentences = t => t.replace(/\s+/g, ' ').split(/(?<=[.!?。])\s+/).map(s => s.trim()).filter(s => s.length > 4);
const kids = [];
for (const [sec, ps] of Object.entries(bySec)) {
  const name = sec.includes('|') ? sec.split('|').pop().trim() : sec.trim();
  const files = ps.flatMap(p => (p.files || []).filter(f => f.path).map(f => f.path));
  const imgs = files.filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const song = files.find(f => /\.mp3$/i.test(f)); const vid = files.find(f => /\.mp4$/i.test(f));
  const bodies = ps.map(p => p.body || '').filter(Boolean);
  const lyricsBody = bodies.find(isLyrics) || '';
  const story = stripTags(bodies.filter(b => !isLyrics(b) && !isPrompt(b)).sort((a, b) => b.length - a.length)[0] || '');
  let subject = ps.map(p => p.subject).find(s => s && s.length > 1 && !/영상|음악|모음|줄거리|이야기$/.test(s)) || '';
  subject = subject.replace(/^\[?\s*(제목|title)\s*[:：]?\s*/i, '').replace(/[\[\]]/g, '').trim();
  const bodyTitle = (bodies.map(b => (b.match(/\[\s*제목\s*[:：]?\s*([^\]]+)\]/) || [])[1]).find(Boolean) || '').trim();
  subject = subject || bodyTitle;
  if (!imgs.length && vid) {
    const dir = path.dirname(path.join(proj, vid));
    for (const [i, t] of [[1, 2.0], [2, 5.0], [3, 8.5]]) {
      const f = path.join(dir, `_frame${i}.jpg`);
      if (!fs.existsSync(f)) try { execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', path.join(proj, vid), '-frames:v', '1', '-q:v', '2', f]); } catch {}
      if (fs.existsSync(f)) imgs.push(path.relative(proj, f));
    }
  }
  if (!imgs.length && !song && !vid && !story) continue;
  kids.push({ name, imgs, song, vid, story, lyricsBody, subject, sec });
}
if (!kids.length) { console.error('아이 섹션을 찾지 못했습니다(그림/노래/이야기가 있는 섹션이 없음).'); process.exit(2); }

// ── 가사 줄 → 시각 정렬 ─────────────────────────────────────────
function splitLong(l) { // 24자 넘는 줄은 공백 기준으로 2~3토막
  if (l.length <= 24) return [l]; const w = l.split(' '); const n = Math.ceil(l.length / 20); const per = Math.ceil(w.length / n); const out = [];
  for (let i = 0; i < w.length; i += per) out.push(w.slice(i, i + per).join(' ')); return out;
}
function lyricLines(body) { // [1절] ~ 첫 [후렴] 블록까지, 표식/빈줄 제외
  const lines = body.replace(/(\[[^\]]*\])/g, '\n$1\n').split('\n').map(l => l.trim());
  const out = []; let seenChorus = false, inChorus = false;
  for (const l of lines) {
    if (/^\[/.test(l)) { if (/후렴|(?<!pre-?)chorus/i.test(l) && !/pre/i.test(l)) { if (seenChorus) break; seenChorus = true; inChorus = true; } else if (inChorus) break; continue; }
    if (!l || /^(제목|title)/i.test(l) || /가사로 새로|적어보았습니다/.test(l)) continue;
    out.push(...splitLong(l));
  }
  return out.length ? out : lines.filter(l => l && !/^\[/.test(l)).flatMap(splitLong).slice(0, 10);
}
const bigrams = s => { s = s.replace(/[^가-힣a-z0-9]/gi, ''); const b = new Set(); for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2)); return b; };
const sim = (a, b) => { const A = bigrams(a), B = bigrams(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.max(1, Math.min(A.size, B.size)); };
function alignLyrics(lines, songFile) {
  const js = path.join(proj, songFile.replace(/\.mp3$/i, '.lyrics.json'));
  const total = dur(songFile) || 180;
  let segs = [];
  if (fs.existsSync(js)) segs = (JSON.parse(fs.readFileSync(js, 'utf8').replace(/\bNaN\b/g, 'null')).segments || [])
    .filter(s => s.text.trim().length >= 4 && /[가-힣]/.test(s.text) && !/자막 by|NOR NOR|어떤 어떤|작가님의 작가님의/.test(s.text));
  const at = new Array(lines.length).fill(null);
  let cursor = 0, prevT = -9, prevSeg = -1, prevWord = -1;
  lines.forEach((l, i) => {
    let best = -1, bs = 0.5;
    for (let j = Math.max(0, cursor); j < segs.length; j++) {
      if (prevT >= 0 && segs[j].start > prevT + 45) break;          // 너무 먼 점프(2절·후렴 반복으로 새는 것) 금지
      const sc = sim(l, segs[j].text); if (sc > bs) { bs = sc; best = j; }
      if (bs >= 0.9) break;                                           // 첫 번째 확실한 매치에서 멈춤(반복 후렴 오매칭 방지)
    }
    if (best < 0) return;
    const seg = segs[best]; let t = seg.start;
    // 세그먼트 하나에 여러 줄이 붙어 있으면(whisper 가 두 줄을 합침) 단어 타임스탬프로 줄 시작 위치를 찾는다
    const words = seg.words || [];
    if (words.length) {
      const first = l.replace(/<[^>]+>/g, '').split(' ')[0];
      const from = (best === prevSeg) ? prevWord + 1 : 0; let wb = -1, ws = 0.4;
      for (let w = from; w < words.length; w++) { const sc = sim(first, words[w].word); if (sc > ws) { ws = sc; wb = w; } }
      if (wb >= 0) { t = words[wb].start; prevWord = wb; } else if (best === prevSeg) { t = prevT + (seg.end - prevT) / 2; }
    }
    if (prevT >= 0 && t < prevT + 1.0) return;                        // 역행/겹침이면 버림(보간으로 처리)
    at[i] = +t.toFixed(2); prevT = at[i]; prevSeg = best; cursor = best;
  });
  const intro = (() => { const f = segs[0]; return f ? Math.max(4, f.start) : 10; })();
  const known = at.filter(v => v != null).length;
  console.log(`  가사 싱크 ${path.basename(songFile)}: ${known}/${lines.length}줄 매칭` + (known ? '' : ' (등간격 배치)'));
  if (!known) { const step = Math.min(7, (Math.min(total, 130) - intro) / lines.length); return { intro, at: lines.map((_, i) => +(intro + i * step).toFixed(2)), end: +(intro + lines.length * step).toFixed(2) }; }
  for (let i = 0; i < at.length; i++) if (at[i] == null) {
    let p = i - 1; while (p >= 0 && at[p] == null) p--; let n = i + 1; while (n < at.length && at[n] == null) n++;
    const pv = p >= 0 ? at[p] : Math.max(4, at[n] - 6 * (n - i) - 1), nv = n < at.length ? at[n] : Math.min(total, pv + 6 * (n - p));
    at[i] = +(pv + (nv - pv) * (i - p) / (n - p)).toFixed(2);
  }
  const lastSeg = segs.find(s => s.start >= at[at.length - 1] - 0.1 && s.start < at[at.length - 1] + 12);
  const end = Math.min(total, (lastSeg ? lastSeg.end : at[at.length - 1] + 6) + 0.5);
  return { intro: Math.max(4, at[0] - 0.3), at, end: +end.toFixed(2) };
}

// ── 챕터 생성 ───────────────────────────────────────────────────
const beatsJs = [];
let chapterJs = [];
kids.forEach((k, ki) => {
  const beats = []; let imgIdx = 0; const nextImg = () => k.imgs.length ? k.imgs[imgIdx++ % k.imgs.length] : null;
  const storyS = sentences(k.story);
  const cant = i => (i % 2 ? 2 : -2);
  if (k.song) {
    const lines = lyricLines(k.lyricsBody); const { intro, at, end } = alignLyrics(lines, k.song);
    // 노래 인트로 동안 이야기 타이핑
    const msgs = storyS.slice(0, 3); const gTot = Math.max(6, Math.floor((intro - 0.4) / 0.43));
    if (msgs.length) beats.push(`{s:0, t:"chatpage", msgs:[${msgs.map(m => `{who:"me", text:${q(m)}, g:${Math.max(4, Math.floor(gTot / msgs.length))}}`).join(',')}]}`);
    else beats.push(`{s:0, t:"card", label:${q(k.name + '의 노래')}, text:${q(k.subject || '내가 만든 노래')}, size:92}`);
    // 2줄씩 한 비트, 후렴 첫 비트에 AI 영상
    const chorusIdx = (() => { const ls = k.lyricsBody.replace(/(\[[^\]]*\])/g, '\n$1\n').split('\n').map(l => l.trim()); let n = 0; for (const l of ls) { if (/^\[.*(후렴|chorus)/i.test(l) && !/pre/i.test(l)) return n; if (l && !/^\[/.test(l) && !/^(제목|title)/i.test(l) && !/적어보았습니다/.test(l)) n += splitLong(l).length; } return Math.floor(lines.length / 2); })();
    let vidUsed = false;
    for (let i = 0; i < lines.length; i += 2) {
      const s = +(at[i] - 0.3).toFixed(2); const ln = [i, i + 1].filter(j => j < lines.length);
      const endT = i + 2 < lines.length ? at[i + 2] : end;
      const linesJs = ln.map(j => `{at:${at[j]}, text:${q(lines[j])}${j === ln[ln.length - 1] ? `, end:${(endT - 0.2).toFixed(2)}` : ''}}`).join(',');
      const useVid = k.vid && !vidUsed && i >= chorusIdx;
      if (useVid) { vidUsed = true; beats.push(`{s:${s}, t:"mv", vid:${q(k.vid)}, tag:${q(k.name + '이(가) 만든 10초 영상')}, tagc:"#E8590C", lines:[${linesJs}]}`); }
      else { const im = nextImg(); beats.push(im ? `{s:${s}, t:"mv", src:${q(im)}, cant:${cant(i)}, ${i === 0 ? 'tag:"1절", ' : ''}lines:[${linesJs}]}` : `{s:${s}, t:"card", label:"", text:${q(lines[i])}, size:80}`); }
    }
    if (k.vid && !vidUsed) { const s = +(end - 10).toFixed(2); beats.push(`{s:${s}, t:"mv", vid:${q(k.vid)}, tag:${q(k.name + '이(가) 만든 10초 영상')}, tagc:"#E8590C", lines:[]}`); }
    beats.push(`{s:${(end + 1.0).toFixed(2)}, t:"END"}`);
    chapterJs.push(`{ id:"ch${ki + 1}", nick:${q(k.name)}, music:{file:${q(k.song)}, I:-14, fadeIn:0.05, fadeOut:4}, beats: build(K${ki}) }`);
  } else {
    let s = 0;
    beats.push(`{s:0, t:"card", label:${q(k.name + '의 이야기')}, text:${q(k.subject || storyS[0] || '내가 바꾼 이야기')}, size:88}`); s = 3.4;
    const msgs = storyS.slice(0, 2); if (msgs.length) { beats.push(`{s:${s}, t:"chatpage", msgs:[${msgs.map(m => `{who:"me", text:${q(m)}, g:9}`).join(',')}]}`); s += msgs.length * 9 * 0.43 + 0.6; }
    const rest = storyS.slice(2); let vidUsed = false; const STEP = 4.5;
    for (let i = 0; i < Math.max(rest.length, k.imgs.length ? 1 : 0); i += 2) {
      const ln = rest.slice(i, i + 2); const len = Math.max(STEP, ln.length * STEP);
      const linesJs = ln.map((l, j) => `{at:${(s + 0.4 + j * STEP).toFixed(2)}, text:${q(l)}${j === ln.length - 1 ? `, end:${(s + len - 0.3).toFixed(2)}` : ''}}`).join(',');
      if (k.vid && !vidUsed) { vidUsed = true; beats.push(`{s:${s.toFixed(2)}, t:"mv", vid:${q(k.vid)}, tag:${q(k.name + '이(가) 만든 10초 영상')}, tagc:"#E8590C", lines:[${linesJs}]}`); s += Math.max(10.2, len); }
      else { const im = nextImg(); if (!im) break; beats.push(`{s:${s.toFixed(2)}, t:"mv", src:${q(im)}, cant:${cant(i)}, lines:[${linesJs}]}`); s += len; }
    }
    beats.push(`{s:${(s + 0.6).toFixed(2)}, t:"END"}`);
    const bed = fs.existsSync(path.join(proj, MUSIC)) ? fs.readdirSync(path.join(proj, MUSIC)).filter(f => /\.mp3$/i.test(f)).sort()[0] : null;
    chapterJs.push(`{ id:"ch${ki + 1}", nick:${q(k.name)}, ${bed ? `music:{file:${q(MUSIC + '/' + bed)}, I:-16, fadeIn:0.4, fadeOut:2, tail:1.0}, ` : ''}beats: build(K${ki}) }`);
  }
  beatsJs.push(`const K${ki} = [ // ${k.name}\n ${beats.join(',\n ')}\n];`);
});

// ── 인트로 / 아웃트로 ───────────────────────────────────────────
const photos = exists('assets/photos') ? fs.readdirSync(path.join(proj, 'assets/photos')).filter(f => /\.(jpe?g|png)$/i.test(f)).sort().map(f => 'assets/photos/' + f) : [];
const musicFiles = exists(MUSIC) ? fs.readdirSync(path.join(proj, MUSIC)).filter(f => /\.mp3$/i.test(f)) : [];
const pick = re => { const f = musicFiles.find(x => re.test(x)); return f ? MUSIC + '/' + f : null; };
const outroMusic = pick(/almost|heart|calm|slow/i) || (musicFiles[1] ? MUSIC + '/' + musicFiles[1] : null);
const bridge = pick(/wholesome|bright|happy/i) || (musicFiles[0] ? MUSIC + '/' + musicFiles[0] : null);
const intro = [`{t:"title", g:6, l1:${q(TITLE)}, l2:"아이들이 이야기를 바꿨습니다", hero:${q(HERO)}, acc:["바꿨습니다"]}`];
if (photos.length >= 2) intro.push(`{t:"stack", g:11, items:[{img:${q(photos[0])}},{cap:${q(TITLE)}},{img:${q(photos[1])}}${photos[2] ? `,{cap:"내가 바꾼 이야기로"},{img:${q(photos[2])}}` : ''}]}`);
const outro = [`{t:"answers", g:${8 + kids.length * 2}, title:${q(kids.length + '개의 이야기')}, rows:[${kids.map(k => `[${q(k.name)},${q((k.subject || sentences(k.story)[0] || '').slice(0, 16))}]`).join(',')}]}`];
if (photos.length >= 3) outro.push(`{t:"stack", g:14, slow:true, items:[{img:${q(photos[photos.length - 2])}},{cap:"이야기를 바꾸고"},{img:${q(photos[photos.length - 1])}}]}`);
outro.push(`{t:"endcard", g:11, src:${q(photos[0] || kids[0].imgs[0] || '')}, l1:"AI는 그리고 불렀고", l2:"이야기는 아이들이 지었습니다", s1:${q(TITLE)}, s2:${q(HERO.replace(/<br>/g, ' '))}, credit:${q(musicFiles.length ? 'Music: Kevin MacLeod (CC BY 4.0)' : '')}}`);

const js = `// 자동 생성 초안 (scripts/auto_spec.mjs) — 손으로 고쳐도 된다. 아이 문장·가사 = 패들릿 원문.
window.G = 0.43;
${beatsJs.join('\n\n')}

function build(list){
  const out=[];
  for(let i=0;i<list.length;i++){
    const b=list[i]; if(b.t==="END") break;
    const nx=list[i+1]; b.d=+(nx.s-b.s).toFixed(3);
    if(b.lines) b.lines=b.lines.map(l=>({...l, at:+(l.at-b.s).toFixed(3), end:l.end!=null?+(l.end-b.s).toFixed(3):null}));
    out.push(b);
  }
  return out;
}

window.SPEC2 = [
{ id:"intro", beats:[
 ${intro.join(',\n ')}
]},
${chapterJs.join(',\n')},
{ id:"outro", ${outroMusic ? `music:{file:${q(outroMusic)}, ss:0.6, I:-14, fadeIn:1.2, fadeOut:4}, ` : ''}beats:[
 ${outro.join(',\n ')}
]},
];
window.AUDIO = { ${bridge ? `bridge:{file:${q(bridge)}, ss:0, I:-16, fadeIn:0.3, fadeOut:1.2}, ` : ''}lut:"", clipsSrc:"footage" };
`;
fs.writeFileSync(path.join(proj, 'spec2.js'), js);
console.log(`spec2.js 생성: 아이 ${kids.length}명 (${kids.map(k => `${k.name}${k.song ? '♪' : ''}${k.vid ? '▶' : ''}${k.imgs.length}장`).join(', ')})`);
