"""Check the actual local film, then prepare a private review player."""
from collections import Counter
from pathlib import Path
import hashlib
import html
import json
import re
import subprocess

root = Path('.local/submission')
film = root / 'denlumi-submission-film.mp4'
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-count_frames', '-show_format', '-show_streams',
    '-of', 'json', str(film)], text=True))
streams = {s['codec_type']: s for s in probe['streams']}
video, audio, captions = (streams[k] for k in ['video', 'audio', 'subtitle'])
duration = float(probe['format']['duration'])
assert 103.9 <= duration <= 104.1 and duration < 180
assert (video['codec_name'], video['width'], video['height']) == ('h264', 1920, 1080)
assert video['avg_frame_rate'] == '30/1'
assert abs(float(video['duration']) - 104) <= 1 / 30 + .001
assert int(video['nb_read_frames']) == round(float(video['duration']) * 30)
assert audio['codec_name'] == 'aac' and audio['sample_rate'] == '48000'
assert captions['codec_name'] == 'mov_text' and captions['tags']['language'] == 'eng'
decode = subprocess.run([
    'ffmpeg', '-hide_banner', '-nostdin', '-xerror', '-threads', '2', '-i', str(film),
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
    capture_output=True, text=True, check=True)
(root / 'film-decode-check.log').write_text(decode.stderr)
levels = json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}', decode.stderr)[-1])
assert -18 <= float(levels['input_i']) <= -14
assert float(levels['input_tp']) <= -.8
capture = json.loads((root / 'paced-timeline.json').read_text())
caption_check = json.loads((root / 'caption-check.json').read_text())
assert capture['status'] == caption_check['status'] == 'PASS'
assert not any('/speech' in n['path'] for n in capture['network'])
assert caption_check['last_caption_end_seconds'] < duration
evidence = {
    'checked_on': '2026-10-20', 'status': 'PASS',
    'scope': 'Local replacement film media validation; YouTube upload remains paused.',
    'film': {'filename': film.name, 'bytes': film.stat().st_size,
             'sha256': hashlib.sha256(film.read_bytes()).hexdigest(),
             'duration_seconds': duration, 'dimensions': [1920, 1080],
             'frames': int(video['nb_read_frames']), 'video_duration_seconds': float(video['duration']), 'fps': video['avg_frame_rate'],
             'codecs': {'video': video['codec_name'], 'audio': audio['codec_name'],
                        'captions': captions['codec_name']},
             'sample_rate_hz': int(audio['sample_rate'])},
    'full_decode': {'exit_code': decode.returncode, 'error_policy': 'ffmpeg -xerror'},
    'measured_audio': {'integrated_lufs': float(levels['input_i']),
                       'true_peak_dbtp': float(levels['input_tp']),
                       'loudness_range_lu': float(levels['input_lra'])},
    'captions': caption_check,
    'capture': {'status': capture['status'], 'actions': len(capture['actions']),
                'duration_seconds': capture['duration'],
                'http_status_counts': dict(Counter(str(n['status']) for n in capture['network'])),
                'speech_endpoint_requests': 0,
                'maximum_action_clock_slip_seconds': max(a['actual'] - a['planned'] for a in capture['actions'])},
    'narration': {'provider': 'Higgsfield', 'model': 'Seed Audio', 'preset': 'Grady',
                  'requested_direction': 'General American English',
                  'new_generation_this_continuation': False},
    'resolved_intermediate_failures': [
        'Closing-shot fade rejected d=.32; changed duration syntax to d=0.32 and rerendered the affected chapter.',
        'Initial media validation found 3113 frames and a variable average rate after concatenation. Intermediate CFR adjustments yielded about 81 seconds of video and were rejected. Frame inspection identified a yuv444p closing shot among yuv420p clips; changing frame properties reset filter state. Forced yuv420p scene output, disabled filter reinitialization on the fixed-size picture input, reset PTS by frame index and enforced CFR. Caption input uses fixed-size raw RGBA. Encoder completion checks constant rate, frame-count/duration consistency and the 104-second target within one video frame before replacing the final file. The observed final picture is 3119 frames (103.966667 seconds); AAC/container duration is checked separately. Narration ends at 100.14 seconds, before the closing hold.'
    ],
    'limits': ['Automated media and fictional local capture checks are not human listening or usability acceptance.',
               'No native Alexa integration, successful Bedrock inference, qualified practical review or animal outcome claimed.',
               'No upload, deployment, provider generation or event submission in this continuation.']
}
Path('evidence/phase10/video-natural.json').write_text(json.dumps(evidence, indent=2) + '\n')
render_check_path = root / 'submission-film-check.json'
render_check = json.loads(render_check_path.read_text())
render_check.update({k: evidence['film'][k] for k in ['bytes', 'sha256', 'duration_seconds']})
render_check['toolchain'].update({'svg_asset_sharp': '0.35.4', 'caption_sharp': '0.35.5',
                                'ffmpeg': '9.0.1', 'capture_playwright': '1.63.0'})
render_check['toolchain'].pop('sharp', None)
render_check['toolchain'].pop('playwright', None)
render_check_path.write_text(json.dumps(render_check, indent=2) + '\n')
transcript = (root / 'denlumi-submission-film-transcript.txt').read_text()
paragraphs = ''.join(f'<p>{html.escape(p)}</p>' for p in transcript.strip().split('\n\n'))
(root / 'review-film.html').write_text('''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Denlumi — submission film review</title><style>
body{margin:0;background:#f5f5f5;color:#1f1f1f;font:17px/1.6 system-ui}
main{max-width:1100px;margin:32px auto;padding:0 20px}h1{font-size:clamp(26px,5vw,42px);line-height:1.2}
video{display:block;width:100%;background:#1f1f1f}a{color:#a72b18}summary{cursor:pointer;font-weight:650}
.meta{color:#4a5565}nav{display:flex;gap:24px;flex-wrap:wrap;margin:18px 0}p{max-width:78ch}
</style><main><h1>Same home. Same update.</h1>
<p class="meta">Denlumi submission film · 1:44 · 1080p · Grady narration<br>Local review only. YouTube upload remains paused.</p>
<video controls preload="metadata" playsinline src="denlumi-submission-film.mp4">
<track kind="captions" label="English" srclang="en" src="denlumi-submission-film.vtt"></video>
<p>English captions are also burned into the picture. Playback starts only when you choose Play.</p>
<nav><a href="denlumi-submission-film.mp4" download>Download MP4</a>
<a href="denlumi-submission-film.srt" download>English captions</a>
<a href="denlumi-submission-film-transcript.txt" download>Transcript</a></nav>
<details><summary>Read the complete transcript</summary>''' + paragraphs + '''</details>
<p class="meta">Fictional Alexa-style browser simulation. Original explanatory SVG graphics are labeled separately from real local application footage. All protocols are demo_only; no native Alexa connection, professional approval or animal outcome is claimed. Grady is generated narration, separate from the application's AWS speech integration.</p></main></html>''')
times = [1, 7, 14, 19, 22.5, 25, 30.8, 35.8, 40.5, 44.7, 53.5, 60, 67.5, 81, 84.8, 99]
selection = '+'.join(f'eq(n\\,{round(t * 30)})' for t in times)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2',
                '-i', str(film), '-vf', f'select={selection},scale=480:270,tile=4x4',
                '-frames:v', '1', '-threads', '2', str(root / 'film-contact-sheet.png')], check=True)
for name, seconds in [('confirmation', 40.5), ('offline', 67.5), ('mcp', 53.5), ('outro', 99)]:
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2',
                    '-ss', str(seconds), '-i', str(film), '-frames:v', '1', '-threads', '2',
                    str(root / f'film-{name}.png')], check=True)
(root / 'film-frame-times.json').write_text(json.dumps(times) + '\n')
print(json.dumps({'status': 'PASS', 'duration_seconds': duration,
                  'frames': video['nb_read_frames'], 'audio_lufs': levels['input_i'],
                  'sha256': evidence['film']['sha256']}, indent=2))
