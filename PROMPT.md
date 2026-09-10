# Claude Code 마스터 프롬프트

패들릿 회수(`padlet_fetch.mjs`)를 끝낸 뒤, 레포 루트에서 Claude Code 를 열고 아래를 붙여넣습니다. `<...>` 만 바꾸세요.

```
패들릿에 올린 아이들 결과물로 부모 공유용 세로 영상(1080×1920)을 만들어줘. 이 레포(padlet-story-video)의 파이프라인을 그대로 쓴다.

[목적] "이런 이야기가 있었고 → 아이가 이렇게 바꿨고 → AI한테 이렇게 시켰다(또는 노래로 불렀다)"를 부모가 보는 영상. 그림은 결과일 뿐, 아이가 쓴 문장이 주인공.
[입력]
 - 패들릿 정리본: projects/<프로젝트>/padlet/posts.md  (섹션 = 아이별)
 - 자산: projects/<프로젝트>/assets/<섹션>/  (그림 jpeg, 노래 mp3, AI 영상 mp4)
 - 가사 타이밍: assets/*/*.lyrics.txt (있으면)
 - 수업 사진: projects/<프로젝트>/assets/photos/  /  촬영본: projects/<프로젝트>/footage/  (있으면)
 - 아이 이름·표기: <실명 / 별명 / 이니셜 중 무엇으로 넣을지>
[절대 규칙]
 - 화면의 아이 문장·가사는 posts.md 원문 그대로. 오타·말투 수정 금지.
 - 노래가 있는 아이: 노래를 챕터 0초에 깔고(music:), 가사 at 은 .lyrics.txt 의 초. 1절~첫 후렴까지만 쓰고 fadeOut:4. 
 - 노래가 없는 아이: music 에 CC 곡(music/ 폴더) 지정, 가사 자리에 이야기 문장.
 - AI 영상(10초)은 mv 비트의 vid 로 카드에 넣는다. 후렴 시작에 맞추면 좋다.
 - 유료 이미지/영상 API 호출 0회. 새 그림을 만들지 않는다. 있는 자산만 쓴다.
 - 크림 배경(#FFF8EC)·오렌지(#E8590C)·주아체 히어로·Gmarket 자막. 렌더러(renderer/film2.html)는 고치지 않는다.
[절차]
 1. posts.md 를 읽고 아이별로 (이야기 / 가사 / 그림 / 노래 / 영상 / 빠진 것) 표로 정리해 나한테 먼저 보여줘. 빠진 게 있으면 묻는다.
 2. examples/spec2.example.js 를 본떠 projects/<프로젝트>/spec2.js 작성 (인트로 → 아이별 챕터 → 아웃트로). 비트는 docs/spec-cheatsheet.md.
 3. node scripts/preview.mjs 로 챕터마다 3~4 프레임 찍어 보여주고, 통과되면 node scripts/render.mjs 전체.
 4. node scripts/assemble.mjs 로 완성 mp4. 프레임 실측(AI영상 카드·가사 줄바꿈)과 오디오 RMS 를 확인한 뒤 경로를 보고.
 5. 피드백은 국소 수정만(spec 숫자·문구·자산 교체). 전면 재작업 금지.
```

## 자주 하는 수정 요청 (spec 숫자만)

| 요청 | 어디 |
|---|---|
| 노래 전곡 다 넣고 싶다 | 챕터 마지막 `{s:…, t:"END"}` 의 초를 노래 길이로, 그 앞에 `mv` 비트 추가 |
| 가사가 반 박자 빠르다/느리다 | 해당 `lines[].at` ±0.3 |
| 그림이 자막에 가린다 | 렌더러가 자동 축소하지만, `w:880` 처럼 카드 폭 지정 가능 |
| 이름을 별명으로 | 챕터 `nick`, `answers.rows`, `clips.conf` 라벨 |
| 특정 아이 빼기 | `window.SPEC2` 배열에서 챕터 제거 + `answers.rows` |
