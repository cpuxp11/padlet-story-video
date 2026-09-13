// spec2.js 예시 — "과정 + 노래" 합본 (남해 2주차 v10 구조)
// 아이마다 [과정 챕터] → [노래 챕터] 한 쌍.
//   과정 챕터: 질문 카드 → 아이의 답(채팅 원문) → 히어로 → 그림·수정 전후(아이가 다시 시킨 문장)
//   노래 챕터: 그 아이 노래의 후렴만. 가사 타이핑 + AI 영상 카드 + 그림
// 과정 챕터에는 music 을 주지 않는다 → AUDIO.bridge(배경음)가 채우고, jumps 로 챕터마다 다른 프레이즈에서 시작.
// 규칙: 화면의 아이 문장·AI 답변·가사 = 패들릿/Gemini 원문 그대로(오타·말투 수정 금지).
window.G = 0.43;   // g 1개 = 0.43초 (비음악 구간은 g, 노래 구간은 s/at 초)

function build(list){  // s(절대 초) → d(길이), lines.at/end → 비트 기준 상대 초. 노래 챕터용
  const out=[];
  for(let i=0;i<list.length;i++){
    const b=list[i]; if(b.t==="END") break;
    const nx=list[i+1]; b.d=+(nx.s-b.s).toFixed(3);
    if(b.lines) b.lines=b.lines.map(l=>({...l, at:+(l.at-b.s).toFixed(3), end:l.end!=null?+(l.end-b.s).toFixed(3):null}));
    out.push(b);
  }
  return out;
}

// ── 아이 1 노래 파트: 노래의 69.2초(후렴 시작)부터 ──────────────────────
// s/at 은 "노래 파일 기준 초". 챕터 music.ss 를 첫 s 와 같게 두면 챕터 0초 = 노래 69.2초.
// 가사 줄은 <br> 로 의미 단위 줄바꿈을 지정한다(안 주면 폭에 맞춰 아무 데서나 꺾임).
const KID1_SONG = [
 {s:69.2, t:"mv", vid:"assets/kid1/ai_video.mp4", tag:"후렴 · 아이1이 만든 영상", tagc:"#E8590C", lines:[
   {at:69.5, text:"비행기 바닥을 살며시 열고"},
   {at:75.5, text:"따스한 햇살 아래<br><b>오만원권</b>을 바람에 날려", end:84.5}]},
 {s:79.3, t:"mv", src:"assets/kid1/img3.jpeg", cant:2, lines:[
   {at:75.5, text:"따스한 햇살 아래<br><b>오만원권</b>을 바람에 날려", end:84.5}]},   // 앞 비트에서 뜬 줄 이어가기 = 같은 at
 {s:86.0, t:"mv", src:"assets/kid1/img4.jpeg", cant:-2, lines:[
   {at:86.5, text:"하늘에서 내려오는<br>초록빛 선물에"},
   {at:91.9, text:"길 가던 백성들이<br>손을 모아 줍고 미소 짓네", end:100.8}]},
 {s:101.6, t:"END"},
];

window.SPEC2 = [
{ id:"intro", beats:[
 {t:"title", g:6, l1:"OO 워케이션 2주차", l2:"아이들이 전설을 바꿨습니다", hero:"금산에는<br>이런 이야기가", acc:["바꿨습니다","금산"]},
 {t:"stack", g:12, items:[{img:"assets/photos/p1.jpg"},{cap:"2026. 9. 8"},{img:"assets/photos/p2.jpg"}]},
 {t:"still", g:7, src:"assets/legend.png", cant:-2, subs:[{at:0.3,text:"왕이 되면 이 산을"},{at:1.3,text:"<b>비단으로 덮어주겠다</b>"}]},
 {t:"card", g:8, label:"오늘의 질문", text:"이성계는 왜<br>약속을 <b>못 지켰을까?</b>", acc:["못 지켰을까?"]},
]},

// ── 아이 1 과정 챕터 ─────────────────────────────────────────────
// clips: 이 챕터 앞에 끼울 촬영 클립(이름 컷 → 태블릿 타이핑 컷)
{ id:"ch1", nick:"아이1", clips:["c1","t1"], beats:[
 {t:"card", g:6, label:"아이1의 답", text:"이성계는 왜<br>약속을 못 지켰을까?", size:88},
 {t:"chatpage", g:8, msgs:[{who:"me", text:"비단 가격이 올라서", g:8}]},
 {t:"hero", g:4, word:"비단값 폭등", rows:3, dark:true, size:170},
 {t:"chatpage", g:13, msgs:[
   {who:"ai", text:"너는 금산을 비단 대신 무엇으로 덮어보고 싶니?", g:3},
   {who:"me", text:"돈", g:2},
   {who:"ai", text:"돈을 고른 특별한 이유가 있니?", g:3},
   {who:"me", text:"백성이 주우면 굶진 않을꺼아니야", g:5}]},
 {t:"order", g:6, text:"비행기에서 50000원짜리를 많이 뿌리고 백성이 주우러 뛰어오는걸 글려줘"},
 {t:"still", g:7, src:"assets/kid1/first.jpeg", cant:-2, tag:"첫 그림", subs:[{at:0.6,text:"나무 비행기에서 <b>오만 원</b>이"}]},
 {t:"order", g:5, text:"기장이 있게 그려줘", bg:"assets/kid1/before.jpeg"},          // bg = 직전 그림을 흐리게 깔아 맥락 유지
 {t:"still", g:7, src:"assets/kid1/before.jpeg", cant:2, tag:"수정 전", subs:[{at:0.5,text:"그런데…"},{at:1.4,text:"<b>기장 어디갔어?</b>"}]},
 {t:"still", g:7, src:"assets/kid1/after.jpeg", cant:-2, flash:true, tag:"수정 후", subs:[{at:0.5,text:"기장 <b>복귀</b>"}]},
]},

// ── 아이 1 노래 챕터 ─────────────────────────────────────────────
// music.ss = 노래에서 시작할 초(첫 비트 s 와 같게). fadeOut 3초로 다음 과정 챕터 배경음과 겹치며 넘어간다.
{ id:"ch1s", nick:"아이1", music:{file:"assets/kid1/song.mp3", ss:69.2, I:-14, fadeIn:0.05, fadeOut:3}, beats: build(KID1_SONG) },

// (아이 2·3 도 [과정 챕터 clips:["c2","t2"]] → [노래 챕터] 로 반복)

{ id:"outro", music:{file:"music/Wholesome.mp3", ss:0, I:-14, fadeIn:1.2, fadeOut:4}, beats:[
 {t:"answers", g:13, title:"세 개의 답, 세 개의 노래", rows:[["아이1","오만원의 따뜻한 인사"],["아이2","이성계의 승리 만세"],["아이3","붉은 제국의 전사들"]]},
 {t:"stack", g:20, slow:true, items:[{img:"assets/photos/p3.jpg"},{cap:"같이 듣고"},{img:"assets/photos/p4.jpg"},{cap:"직접 쓰고"}]},
 {t:"endcard", g:11, src:"assets/photos/p5.jpg", l1:"AI는 그리고 곡을 붙였고", l2:"이야기와 가사는 아이들 것입니다",
  s1:"OO 워케이션 2주차", s2:"이성계는 왜 약속을 못 지켰을까", credit:"Music: 아이들 창작 노래 / Wholesome — Kevin MacLeod (CC BY 4.0)"},
]},
];

window.AUDIO = {
  // 과정 챕터·인트로·클립처럼 music 이 없는 구간을 채움. jumps = 빈 구간마다 곡의 다른 프레이즈(초)에서 시작
  bridge:{file:"music/Wholesome.mp3", I:-15, fadeIn:0.8, fadeOut:1.2, jumps:[0, 36.4, 66.6, 96.4]},
  lut:"v709.cube",      // 파나소닉 V-Log 촬영본이면 LUT 경로, 아니면 ""
  clipsSrc:"footage",
};
