#!/usr/bin/env python3
"""노래 mp3 → 가사 타임스탬프. 사용: python3 scripts/transcribe.py <mp3> [<mp3> ...]
같은 이름의 <mp3이름>.prompt.txt 가 있으면(패들릿 가사 원문) whisper 의 initial_prompt 로 넣어 받아쓰기 정확도를 올린다 — 노래는 이게 없으면 환각이 심하다.
결과: 같은 폴더에 <이름>.lyrics.json (segments/words) + <이름>.lyrics.txt (초 단위 줄)
Apple Silicon: pip install mlx-whisper   /  그 외: pip install openai-whisper (느림)
가사는 패들릿 원문이 정본이다. 여기서 나온 텍스트는 '언제 그 줄이 시작되나'를 보는 용도로만 쓴다."""
import sys, json, os
files = sys.argv[1:]
if not files: print(__doc__); sys.exit(1)
def prompt_for(f):
    p = os.path.splitext(f)[0] + '.prompt.txt'
    if not os.path.exists(p): return None
    t = ' '.join(l.strip() for l in open(p) if l.strip() and not l.strip().startswith('['))
    return t[:400]  # whisper 프롬프트 한도(≈224토큰) 안쪽
OPTS = dict(language='ko', word_timestamps=True, temperature=0.0, condition_on_previous_text=False,
            compression_ratio_threshold=2.0, no_speech_threshold=0.5)
try:
    import mlx_whisper
    def run(f): return mlx_whisper.transcribe(f, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', initial_prompt=prompt_for(f), **OPTS)
except ImportError:
    import whisper
    model = whisper.load_model('large-v3-turbo')
    def run(f): return model.transcribe(f, initial_prompt=prompt_for(f), **OPTS)
def valid(r): return sum(1 for s in r['segments'] if len(s['text'].strip()) >= 4 and any('가' <= c <= '힣' for c in s['text']))
for f in files:
    r = run(f); base = os.path.splitext(f)[0]
    firsts = [s['start'] for s in r['segments'] if len(s['text'].strip()) >= 4 and any('가' <= c <= '힣' for c in s['text'])]
    if valid(r) < 5 or (firsts and firsts[0] > 25):  # 거의 못 받아썼거나 앞 25초(1절)가 통째로 비면 → 프롬프트 없이·온도 폴백 켜고 한 번 더
        print('  받아쓰기 부실 → 프롬프트 없이 재시도', f)
        try:
            import mlx_whisper as _m; r2 = _m.transcribe(f, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko', word_timestamps=True, condition_on_previous_text=False)
        except ImportError:
            r2 = model.transcribe(f, language='ko', word_timestamps=True, condition_on_previous_text=False)
        f2 = [s['start'] for s in r2['segments'] if len(s['text'].strip()) >= 4 and any('가' <= c <= '힣' for c in s['text'])]
        if valid(r2) > valid(r) or (f2 and firsts and f2[0] < firsts[0] - 5): r = r2
    # whisper 가 avg_logprob 에 NaN 을 넣는 경우가 있어(JSON 규격 위반) 세그먼트/단어만 남겨 저장
    slim = {'text': r.get('text', ''), 'segments': [{'start': s['start'], 'end': s['end'], 'text': s['text'],
            'words': [{'word': w['word'], 'start': w['start'], 'end': w['end']} for w in s.get('words', [])]} for s in r['segments']]}
    json.dump(slim, open(base + '.lyrics.json', 'w'), ensure_ascii=False)
    with open(base + '.lyrics.txt', 'w') as o:
        for s in r['segments']:
            o.write(f"{s['start']:7.2f} {s['end']:7.2f} {s['text'].strip()}\n")
            if s.get('words'): o.write('        ' + ' '.join(f"{w['word'].strip()}@{w['start']:.1f}" for w in s['words']) + '\n')
    print('→', base + '.lyrics.txt')
