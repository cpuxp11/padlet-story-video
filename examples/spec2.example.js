// spec2.js 예시 — 이 파일을 프로젝트 폴더에 spec2.js 로 복사해서 내용만 바꾼다.
// 규칙: 화면에 나오는 아이 문장·가사는 패들릿 원문 그대로(오타·말투 수정 금지). 그림은 결과일 뿐, "아이가 시킨 문장"이 주인공.
// 시간: 챕터 안 비트는 s(챕터 시작 기준 절대 초)로 쓰고 build()가 d(길이)로 바꾼다. 노래는 챕터 0초에 깔린다(assemble 이 처리).
window.G = 0.43;   // g 단위(비트) 1개 = 0.43초 — 인트로/아웃트로 같은 비음악 구간은 g 로 써도 된다

// ── 아이 1 챕터: 노래가 있는 경우 (뮤직비디오) ─────────────────────────────
// lines 의 at/end 는 노래 타임스탬프(초). scripts/transcribe.py 결과(.lyrics.txt)를 보고 적는다.
const KID1 = [
 {s:0,    t:"chatpage", msgs:[                         // 노래 인트로(반주) 동안 아이가 쓴 이야기를 타이핑
   {who:"me", text:"옛날에 왕이 산을 비단으로 덮어주겠다고 약속했어요.", g:7},
   {who:"me", text:"나는 비행기를 타고 산 위로 올라갔어요.", g:8}]},
 {s:11.6, t:"mv", src:"assets/kid1/img1.jpeg", cant:-2, tag:"1절", lines:[   // 폴라로이드 그림 + 가사 타이핑
   {at:11.8, text:"옛날 옛적 어느 왕이"},
   {at:18.3, text:"산의 은혜에 보답하려"}]},
 {s:31.4, t:"mv", src:"assets/kid1/img2.jpeg", cant:2, lines:[
   {at:31.7, text:"하지만 너무나 거대했던 산,", end:40.0}]},   // end 를 주면 그 시각에 가사가 사라진다
 {s:41.0, t:"mv", vid:"assets/kid1/ai_video.mp4", tag:"후렴 · 아이가 만든 10초 영상", tagc:"#E8590C", lines:[  // AI 영상 카드(assemble 이 합성)
   {at:41.3, text:"비행기 바닥을 살며시 열고"},
   {at:47.0, text:"따스한 햇살 아래 <b>오만원권</b>을 바람에 날려", end:55.0}]},   // <b>…</b> = 오렌지 강조
 {s:51.0, t:"mv", src:"assets/kid1/img3.jpeg", cant:2, lines:[
   {at:47.0, text:"따스한 햇살 아래 <b>오만원권</b>을 바람에 날려", end:55.0}]},   // 앞 비트에서 이미 뜬 줄은 at 을 그대로 두면 "이미 다 쳐진 상태"로 이어진다
 {s:56.0, t:"hero", word:"고맙습니다", rows:4, dark:true, size:190},       // 펀치라인(검정 배경·노랑)
 {s:61.0, t:"END"},
];

// ── 아이 2 챕터: 노래가 없는 경우 (이야기 + 그림 + CC 음악) ──────────────
const KID2 = [
 {s:0,    t:"card", label:"OO의 이야기", text:"축구장을<br>덮은 <b>산</b>", size:92},
 {s:3.4,  t:"chatpage", msgs:[{who:"me", text:"축구선수가 축구장으로 산을 덮어보기로 마음먹었어요.", g:10}]},
 {s:9.0,  t:"hero", word:"쾅!", rows:4, dark:true, size:260},
 {s:11.8, t:"mv", vid:"assets/kid2/ai_video.mp4", tag:"OO가 만든 10초 영상", tagc:"#E8590C", lines:[
   {at:12.2, text:"축구장을 <b>번쩍</b> 들어 올려", end:21.0}]},
 {s:22.0, t:"mv", src:"assets/kid2/img1.jpeg", cant:-2, lines:[{at:22.4, text:"너무 세게 누르는 바람에", end:29.0}]},
 {s:30.0, t:"END"},
];

function build(list){  // s(절대 초) → d(길이), lines.at/end → 비트 기준 상대 초
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
 {t:"title", g:6, l1:"OO 워케이션 2주차", l2:"아이들이 노래를 만들었습니다", hero:"산에는<br>이런 노래가", acc:["만들었습니다","노래가"]},   // acc = 오렌지로 칠할 단어
 {t:"stack", g:11, items:[{img:"assets/photos/p1.jpg"},{cap:"2026. 9. 8"},{img:"assets/photos/p2.jpg"},{cap:"내가 바꾼 전설로"},{img:"assets/photos/p3.jpg"}]},
 {t:"card", g:7, label:"오늘의 미션", text:"바꾼 이야기로<br><b>노래</b>를 만들자"},
]},
// clips: 이 챕터 앞에 끼울 촬영 클립(clips.conf 의 이름). music: 챕터 0초에 까는 노래.
{ id:"ch1", nick:"아이1", clips:["c1","t1"], music:{file:"assets/kid1/song.mp3", I:-14, fadeIn:0.05, fadeOut:4}, beats: build(KID1) },
{ id:"ch2", nick:"아이2", music:{file:"music/Monkeys_Spinning_Monkeys.mp3", I:-15, fadeIn:0.4, fadeOut:2, tail:1.0}, beats: build(KID2) },
{ id:"outro", music:{file:"music/Almost_in_F.mp3", ss:0.6, I:-14, fadeIn:1.2, fadeOut:4}, beats:[
 {t:"answers", g:12, title:"두 개의 노래", rows:[["아이1","오만원의 따뜻한 인사"],["아이2","축구장을 덮은 산"]]},
 {t:"stack", g:14, slow:true, items:[{img:"assets/photos/p4.jpg"},{cap:"이야기를 바꾸고"},{img:"assets/photos/p5.jpg"},{cap:"노래로 불렀습니다"}]},
 {t:"endcard", g:11, src:"assets/photos/p3.jpg", l1:"AI는 곡을 붙였고", l2:"가사는 아이들 이야기입니다",
  s1:"OO 워케이션 2주차", s2:"산에는 이런 노래가", credit:"Music: Monkeys Spinning Monkeys · Almost in F — Kevin MacLeod (CC BY 4.0)"},
]},
];

// 전역 오디오/클립 설정 (assemble 이 읽음)
window.AUDIO = {
  bridge:{file:"music/Wholesome.mp3", ss:0, I:-16, fadeIn:0.3, fadeOut:1.2},   // 음악이 지정 안 된 구간(인트로·촬영클립)을 채우는 배경음
  lut:"",                 // 파나소닉 V-Log 등 로그 촬영본이면 .cube LUT 경로 (없으면 빈 문자열)
  clipsSrc:"footage",     // clips.conf 의 파일이 들어 있는 폴더
};
