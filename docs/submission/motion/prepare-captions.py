"""Align reviewed wording to the existing actual narration transcript, locally."""
from pathlib import Path
import difflib
import json
import re
import textwrap

root = Path('.local/submission')
normalize = lambda word: re.sub(r'[^a-z0-9]', '', word.lower())
script = (root / 'narration-natural.txt').read_text().strip()
expected = script.split()
transcript = json.loads((root / 'narration-natural-transcript.json').read_text())
observed = [w for s in transcript['segments'] for w in s['words'] if normalize(w['word'])]
matcher = difflib.SequenceMatcher(None, list(map(normalize, expected)),
                                [normalize(w['word']) for w in observed], autojunk=False)
matches = {i + k: j + k for i, j, count in matcher.get_matching_blocks() for k in range(count)}
coverage = len(matches) / len(expected)
assert coverage >= .95, 'Transcript needs manual alignment review'
assert 0 in matches and len(expected) - 1 in matches
timed = []
for i in range(len(expected)):
    if i in matches:
        word = observed[matches[i]]
        timed.append((word['start'], word['end']))
    else:
        before = max(k for k in matches if k < i)
        after = min(k for k in matches if k > i)
        lo, hi = observed[matches[before]]['end'], observed[matches[after]]['start']
        step = max(.02, (hi - lo) / (after - before))
        timed.append((lo + (i - before - 1) * step, lo + (i - before) * step))

def stamp(seconds, separator=','):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}{separator}{ms % 1000:03}'

# Keep sentence boundaries; split longer sentences at a clause where possible.
cues = []
start = 0
while start < len(expected):
    end = start + 1
    while end < len(expected) and not re.search(r'[.!?]$', expected[end - 1]):
        if len(' '.join(expected[start:end + 1])) > 80 or timed[end][1] - timed[start][0] > 5.5:
            candidates = [k for k in range(start + 4, end + 1)
                          if re.search(r'[,;:]$', expected[k - 1])]
            if candidates:
                end = candidates[-1]
            break
        end += 1
    lines = textwrap.wrap(' '.join(expected[start:end]), width=42, break_long_words=False)
    assert len(lines) <= 2, lines
    lo, hi = timed[start][0], max(timed[start][0] + .12, timed[end - 1][1])
    cues.append({'start': lo, 'end': hi, 'lines': lines})
    start = end

assert ' '.join(line for c in cues for line in c['lines']) == ' '.join(expected)
assert all(a['end'] <= b['start'] + .001 for a, b in zip(cues, cues[1:]))
for extension, separator in [('srt', ','), ('vtt', '.')]:
    blocks = [f'{i}\n{stamp(c["start"], separator)} --> {stamp(c["end"], separator)}\n' +
              '\n'.join(c['lines']) for i, c in enumerate(cues, 1)]
    (root / f'denlumi-submission-film.{extension}').write_text(
        ('WEBVTT\n\n' if extension == 'vtt' else '') + '\n\n'.join(blocks) + '\n')
(root / 'denlumi-submission-film-transcript.txt').write_text(script + '\n')
(root / 'caption-check.json').write_text(json.dumps({
    'status': 'PASS', 'cues': len(cues), 'words': len(expected),
    'transcript_exact_token_coverage': coverage,
    'maximum_lines': max(len(c['lines']) for c in cues),
    'maximum_characters_per_line': max(len(s) for c in cues for s in c['lines']),
    'last_caption_end_seconds': cues[-1]['end'],
    'limits': 'Reviewed script wording aligned to existing automated ASR; no human audible acceptance.'
}, indent=2) + '\n')
print(json.dumps({'caption_cues': len(cues), 'coverage': coverage}))
