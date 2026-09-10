// 패들릿 보드 → 게시물 텍스트 + 첨부(그림·노래·영상) 회수
// 사용: node scripts/padlet_fetch.mjs <패들릿 URL> <프로젝트 폴더> [--section "2주차"]
// 결과: <프로젝트>/padlet/posts.json, posts.md, assets/<섹션>/<파일들>
//
// 왜 브라우저로 여나: 패들릿은 curl 요청을 Cloudflare 보안체크로 막는다. 헤드리스 크롬으로 페이지를 연 뒤
// 그 페이지 안에서 /api/9/wishes 를 호출하면 게시물 JSON이 그대로 나온다. 첨부 URL은 서명(expiry_token)이
// 붙어 있어서 그 URL은 curl/fetch 로 바로 받을 수 있다.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const [,, url, projDir, ...rest] = process.argv;
if (!url || !projDir) {
  console.error('사용법: node scripts/padlet_fetch.mjs <패들릿 URL> <프로젝트 폴더> [--section "섹션 이름 일부"]');
  process.exit(1);
}
const secFilter = rest.includes('--section') ? rest[rest.indexOf('--section') + 1] : null;
const outDir = path.join(projDir, 'padlet');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'ko-KR' });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
const html = await page.content();
const m = html.match(/wall_hashid=([A-Za-z0-9_]+)/);
if (!m) { console.error('wall_hashid 를 찾지 못했습니다. 보드가 공개(링크 열람) 상태인지 확인하세요.'); process.exit(2); }
const wall = m[1];
console.log('wall_hashid', wall);

async function api(p) {
  return await page.evaluate(async (p) => {
    const r = await fetch(p, { headers: { Accept: 'application/json' } });
    return await r.json();
  }, p);
}
const wishes = await api(`/api/9/wishes?wall_hashid=${wall}`);
let sections = {};
try {
  const s = await api(`/api/9/wall-sections?wall_hashid=${wall}`);
  for (const d of (s.data || [])) sections[d.id] = d.attributes?.title || d.attributes?.name || String(d.id);
} catch { /* 섹션 API 없으면 id 로 대체 */ }
// 섹션 API 가 404 인 보드가 있어 DOM 에서 제목을 읽는다: #section-add-post-button-<id> 의 data-testid = "<제목>SectionAddPostButton"
const domSec = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[id^="section-add-post-button-"]')]
  .map(e => [e.id.replace('section-add-post-button-', ''), (e.dataset.testid || '').replace(/SectionAddPostButton$/, '').trim()])));
for (const [id, title] of Object.entries(domSec)) if (title && !sections[id]) sections[id] = title;
console.log('섹션:', Object.values(sections).join(' | ') || '(없음)');
await browser.close();

const clean = h => (h || '').replace(/<\/p>|<\/li>|<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

const posts = [];
for (const d of wishes.data || []) {
  const a = d.attributes;
  const secName = sections[a.wall_section_id] || String(a.wall_section_id);
  if (secFilter && !secName.includes(secFilter) && !String(a.wall_section_id).includes(secFilter)) continue;
  // 앨범(사진 여러 장)은 attachment 에 1장만 오므로 raw JSON 에서 같은 게시물의 업로드 URL 을 추가로 긁는다
  const raw = JSON.stringify(a);
  const urls = new Set();
  if (a.attachment) urls.add(a.attachment);
  for (const u of raw.matchAll(/https:\\?\/\\?\/u\d\.padletusercontent\.com\\?\/uploads\\?\/[^"\\]+\?expiry_token=[A-Za-z0-9_=\-]+/g)) {
    urls.add(u[0].replace(/\\\//g, '/'));
  }
  posts.push({
    id: a.id, section_id: a.wall_section_id, section: secName, subject: a.subject || '', body: clean(a.body),
    attachments: [...urls], updated_at: a.updated_at, created_at: a.created_at,
  });
}
posts.sort((x, y) => (x.section > y.section ? 1 : x.section < y.section ? -1 : x.created_at > y.created_at ? 1 : -1));

// 첨부 다운로드
let n = 0;
for (const p of posts) {
  p.files = [];
  const dir = path.join(projDir, 'assets', p.section.replace(/[\/\\:]/g, '_'));
  for (const u of p.attachments) {
    if (!/padletusercontent|padletcdn|storage\.googleapis/.test(u)) { p.files.push({ url: u, note: '링크(다운로드 대상 아님)' }); continue; }
    fs.mkdirSync(dir, { recursive: true });
    let name = decodeURIComponent(u.split('?')[0].split('/').pop()).replace(/^_+/, '') || 'file';
    name = `${p.id}_${name}`;
    const fp = path.join(dir, name);
    if (!fs.existsSync(fp)) {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) { console.warn('다운로드 실패', r.status, u.slice(0, 80)); continue; }
      fs.writeFileSync(fp, Buffer.from(await r.arrayBuffer()));
      n++;
    }
    p.files.push({ path: path.relative(projDir, fp) });
  }
}
fs.writeFileSync(path.join(outDir, 'posts.json'), JSON.stringify(posts, null, 1));

// 사람/AI가 읽는 정리본
let md = `# 패들릿 게시물 정리\n\n출처: ${url}\n\n`;
let cur = null;
for (const p of posts) {
  if (p.section !== cur) { cur = p.section; md += `\n## 섹션: ${cur}\n`; }
  md += `\n### ${p.subject || '(제목 없음)'}  <sub>id ${p.id} · ${p.created_at?.slice(0, 16)}</sub>\n`;
  if (p.body) md += '\n' + p.body + '\n';
  for (const f of p.files) md += f.path ? `- 파일: \`${f.path}\`\n` : `- 링크: ${f.url}\n`;
}
fs.writeFileSync(path.join(outDir, 'posts.md'), md);
console.log(`게시물 ${posts.length}개, 새로 받은 파일 ${n}개 → ${outDir}/posts.md`);
