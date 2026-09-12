# padlet-story-video

패들릿(Padlet)에 올린 **아이들 결과물(이야기·그림·노래·AI 영상)** 을 부모 공유용 **세로 영상(1080×1920)** 으로 만드는 파이프라인입니다.
"이런 전설이 있었고 → 아이가 이렇게 바꿨고 → AI한테 이렇게 시켰다"를 크림 배경·타이핑 말풍선·폴라로이드 카드 문법으로 보여줍니다. 노래가 있으면 가사가 노래에 맞춰 타이핑되는 뮤직비디오가 됩니다.

실제 사례: 남해 워케이션 수업(초등 4학년)에서 아이들이 금산 전설을 바꿔 쓰고 Gemini로 노래·그림·10초 영상을 만든 뒤, 패들릿에 올린 것을 이 파이프라인으로 4분 59초 영상으로 만들었습니다.

```
패들릿 링크 ──fetch──▶ posts.md + assets/ ──(사람+Claude Code)──▶ spec2.js(대본) ──render──▶ out/*.mp4 ──assemble──▶ 완성.mp4
                                 ▲                                       ▲
                          transcribe.py(노래→가사 타임스탬프)          preview.mjs(프레임 미리보기)
```

---

## 0. 처음 시작하는 사람이 준비할 것

| 준비물 | 자동으로 받아지나? | 어떻게 |
|---|---|---|
| Node.js 20+ | ✗ 직접 설치 | https://nodejs.org |
| ffmpeg / ffprobe | ✗ 직접 설치 | macOS `brew install ffmpeg`, Windows는 ffmpeg.org 빌드를 PATH에 |
| 헤드리스 크롬 | ✓ `npx playwright install chromium` 이 받아줌 (~150MB) | 아래 설치 단계 |
| 배민 주아체(BMJUA.otf) | ✓ 레포에 동봉(`fonts/`) — 무료 재배포 허용 폰트 | 없음 |
| Gmarket Sans TTF (Bold·Medium) | ✗ 직접 다운로드 | https://corp.gmarket.com/fonts/ 에서 TTF 받아 `fonts/GmarketSansTTFBold.ttf`, `fonts/GmarketSansTTFMedium.ttf` 로 저장. 없으면 시스템 기본 산세리프로 대체됨(모양이 조금 달라짐) |
| 배경음악(CC) | ✗ 직접 다운로드 | Kevin MacLeod(incompetech.com, CC BY 4.0)의 Wholesome / Almost in F / Monkeys Spinning Monkeys 를 프로젝트 `music/` 에. 다른 곡을 써도 됨 — 엔드카드 credit 문구만 맞출 것 |
| 촬영본 LUT | ✗ 선택 | 파나소닉 V-Log 촬영본이면 카메라 제조사 사이트에서 V-Log→V709 `.cube` 를 받아 `AUDIO.lut` 에 지정. 일반 촬영본은 비워둠 |
| 가사 타임스탬프(whisper) | ✗ 선택, Python 필요 | Apple Silicon: `pip install mlx-whisper` / 그 외: `pip install openai-whisper` |
| 아이들 자산(그림·노래·영상·사진) | ✓ 패들릿에서 fetch 가 받아줌 | 촬영 사진·영상은 직접 `assets/photos/`, `footage/` 에 |

**이 레포에 아이들 실제 자산은 들어 있지 않습니다**(초상권). `examples/` 는 구조만 보여주는 예시입니다.

## 빠른 시작 — URL 한 줄로 초안 mp4 (완전 자동)

```bash
node scripts/run.mjs "https://padlet.com/아이디/보드" --name w2 --section 2주차 \
  --title "남해 워케이션 2주차" --hero "금산에는<br>이런 노래가" --music ~/음악폴더
# → projects/w2/w2_auto_v1.mp4
```
`run.mjs` = fetch → transcribe(whisper 있으면) → **auto_spec**(규칙으로 대본 자동 생성) → render → assemble.
자동 대본 규칙: 섹션 1개=아이 1챕터, 이야기 글→타이핑, 노래 있으면 가사를 whisper 시각에 맞춰 그림 순환·AI영상은 후렴에, 노래 없으면 CC 음악 베드.
실제 남해 2주차 보드로 돌린 결과: 아이 3명, 4분 57초, 가사 싱크 김민 9/15줄·송시준 8/10·안현수 8/8 (나머지 줄은 이웃 사이 등분). 노래 앞부분(1절)은 whisper 가 잘 놓치므로 그 구간은 타이밍이 대충일 수 있습니다.
품질은 사람이 짠 대본보다 단순합니다. 마음에 안 드는 부분은 `projects/w2/spec2.js` 숫자·문구만 고치고 `render`·`assemble` 만 다시 돌리면 됩니다(아래 3~4단계).

## 1. 설치

```bash
git clone https://github.com/cpuxp11/padlet-story-video.git
cd padlet-story-video
npm install
npx playwright install chromium
```

## 2. 패들릿에서 회수

패들릿 보드는 "링크가 있으면 볼 수 있음" 상태여야 합니다(로그인 필요 보드는 안 됨).

```bash
node scripts/padlet_fetch.mjs "https://padlet.com/아이디/보드" projects/내프로젝트 --section 2주차
```

- `projects/내프로젝트/padlet/posts.md` — 섹션별 게시물 본문(이야기·가사·프롬프트)이 순서대로 정리됨. **이게 대본의 원문**입니다.
- `projects/내프로젝트/assets/<섹션명>/` — 그림·mp3·mp4 가 게시물 id 접두사로 저장됨. 앨범(사진 여러 장)도 전부.
- `--section` 은 섹션 제목에 포함된 글자로 거릅니다(예: `2주차`). 생략하면 보드 전체.

노래가 있으면 가사 타이밍을 뽑습니다:

```bash
python3 scripts/transcribe.py projects/내프로젝트/assets/*/*.mp3
# → 같은 폴더에 .lyrics.txt (줄 시작 초 + 단어 타임스탬프)
```
whisper 가 받아쓴 글자는 틀릴 수 있습니다. **가사 텍스트는 패들릿 원문을 쓰고, 여기서는 "몇 초에 그 줄이 시작하나"만 봅니다.**

## 3. 대본(spec2.js) 쓰기

`examples/spec2.example.js` 를 `projects/내프로젝트/spec2.js` 로 복사해서 채웁니다. 비트 종류는 [docs/spec-cheatsheet.md](docs/spec-cheatsheet.md).
Claude Code 를 쓰면 [PROMPT.md](PROMPT.md) 의 프롬프트를 붙여넣고 `posts.md` 와 `.lyrics.txt` 를 읽게 하면 초안이 나옵니다.

원칙:
- 아이 문장·가사는 **원문 그대로**. 오타·말투도 살립니다("굶진 않을꺼아니야" 류).
- 노래가 있는 아이는 노래를 챕터 0초에 깔고(`music:`), 가사 `at` 은 노래 초로 씁니다. 전곡은 길어지므로 보통 1절~첫 후렴에서 `fadeOut`.
- 노래가 없는 아이는 CC 음악을 `music:` 에 지정하고 이야기 문장을 가사 자리에 씁니다.
- 촬영 클립은 `clips.conf` 에 적고 챕터의 `clips:["c1"]` 로 그 챕터 앞에 끼웁니다(예: `examples/clips.conf.example`).

## 4. 미리보기 → 렌더 → 조립

```bash
# 특정 초의 프레임만 찍어 확인 (챕터 1 의 3초, 20초, 45초)
node scripts/preview.mjs projects/내프로젝트 1 3,20,45
#  → projects/내프로젝트/preview/ch1_20.jpg

# 전체 렌더 (챕터별 mp4, 30fps, 1080x1920). 4분 영상 ≈ 5분 소요, 디스크 여유 2GB 확인
node scripts/render.mjs projects/내프로젝트          # 또는 뒤에 0,2 처럼 챕터 번호만

# 클립 삽입 + AI영상 카드 합성 + 음악 믹스
node scripts/assemble.mjs projects/내프로젝트 완성_v1.mp4
```

`assemble` 이 하는 일: `clips.conf` 의 촬영본을 폴라로이드 카드 9:16 클립으로 → 챕터 앞에 삽입 → `mv` 비트의 `vid` 를 카드 구멍(40,619 / 1000×562)에 오버레이 → 챕터별 `music` 을 챕터 0초에 맞춰 깔고(loudnorm) → 음악이 없는 구간은 `AUDIO.bridge` 로 채움 → 최종 mp4.

## 5. 검수 (완료 주장 전에)

- 프레임 실측: `ffmpeg -ss 88 -i 완성_v1.mp4 -frames:v 1 f.jpg` 로 AI 영상이 카드 안에 들어갔는지, 가사가 단어 중간에서 안 끊기는지.
- 오디오: 노래 구간 RMS 가 -14 ~ -16 dB 근처인지(무음 구간이 생기면 `music`/`bridge` 설정 확인).
- 아이 문장이 원문과 같은지 `posts.md` 와 대조.

## 폴더 구조

```
scripts/run.mjs            원샷: URL → mp4 (아래 전부 순서대로)
scripts/padlet_fetch.mjs   패들릿 → posts.md + assets/
scripts/auto_spec.mjs      posts.json + assets → spec2.js 자동 초안
scripts/transcribe.py      mp3 → 가사 타임스탬프
scripts/preview.mjs        프레임 미리보기
scripts/render.mjs         spec2.js → out/NN_id.mp4 (+ vid.json)
scripts/assemble.mjs       클립·오버레이·음악 → 완성 mp4
renderer/film2.html        렌더러(단일 HTML). 비트 타입 구현
fonts/BMJUA.otf            배민 주아체(동봉)
examples/                  spec2.example.js, clips.conf.example
docs/spec-cheatsheet.md    비트 치트시트 + 함정
PROMPT.md                  Claude Code 에 붙여넣는 마스터 프롬프트
projects/                  (git 무시) 내 프로젝트들
```

## 함정 (실측으로 얻은 것)

- 패들릿은 curl 을 Cloudflare 로 막습니다. 스크립트는 헤드리스 크롬으로 페이지를 연 뒤 페이지 안에서 `/api/9/wishes` 를 부릅니다.
- 앨범 게시물은 API 가 첨부 1장만 주므로 raw JSON 에서 나머지 URL 을 긁습니다. 첨부 URL 은 서명이 있어 몇 시간 뒤 만료 — 회수는 바로.
- 프레임 렌더는 챕터당 수백 MB(jpeg)를 잠깐 씁니다. 디스크가 꽉 차면 렌더가 조용히 죽습니다.
- 가사 줄은 단어 단위로 줄바꿈합니다(글자 단위 X). 긴 줄은 자동 2줄.
- macOS 기본 bash 는 3.x — 셸 스크립트 대신 node 로 조립하는 이유입니다.
- ffmpeg `adelay` 뒤에 출력 `-t` 를 걸면 무음이 되는 케이스가 있어 입력 `-t` 로 자릅니다.

## 라이선스

코드 MIT. 배민 주아체는 우아한형제들 무료 배포 폰트(재배포 허용). 아이들 창작물·사진은 포함하지 않으며, 만든 영상의 초상권·저작권은 각 가정과 학교에 있습니다.
