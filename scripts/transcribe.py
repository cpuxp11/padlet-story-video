#!/usr/bin/env python3
"""노래 mp3 → 가사 타임스탬프. 사용: python3 scripts/transcribe.py <mp3> [<mp3> ...]
결과: 같은 폴더에 <이름>.lyrics.json (segments/words) + <이름>.lyrics.txt (초 단위 줄)
Apple Silicon: pip install mlx-whisper   /  그 외: pip install openai-whisper (느림)
가사는 패들릿 원문이 정본이다. 여기서 나온 텍스트는 '언제 그 줄이 시작되나'를 보는 용도로만 쓴다."""
import sys, json, os
files = sys.argv[1:]
if not files: print(__doc__); sys.exit(1)
try:
    import mlx_whisper
    def run(f): return mlx_whisper.transcribe(f, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko', word_timestamps=True)
except ImportError:
    import whisper
    model = whisper.load_model('large-v3-turbo')
    def run(f): return model.transcribe(f, language='ko', word_timestamps=True)
for f in files:
    r = run(f); base = os.path.splitext(f)[0]
    json.dump(r, open(base + '.lyrics.json', 'w'), ensure_ascii=False)
    with open(base + '.lyrics.txt', 'w') as o:
        for s in r['segments']:
            o.write(f"{s['start']:7.2f} {s['end']:7.2f} {s['text'].strip()}\n")
            if s.get('words'): o.write('        ' + ' '.join(f"{w['word'].strip()}@{w['start']:.1f}" for w in s['words']) + '\n')
    print('→', base + '.lyrics.txt')
