# Local submission film tools

These tools compose actual fictional browser footage with original SVG graphics and the existing continuous Higgsfield Grady narration. They make no provider requests and do not upload anything. Capture/transcript/audio inputs stay in ignored `.local/submission`; they are not bundled in the public source snapshot.

Required private inputs: `denlumi-paced.webm`, `paced-timeline.json`, `narration-natural.wav`, `narration-natural.txt` and `narration-natural-transcript.json`. The capture timeline must report PASS. No screen, response or provider outcome is generated as a substitute for missing footage.

Use Node with `sharp` resolvable (the scripts accept CommonJS `NODE_PATH`), Python 3 and FFmpeg/ffprobe. October 20 final caption rendering used bundled sharp **0.35.5** and FFmpeg **9.0.1**; existing SVG assets used sharp **0.35.4**. Browser capture used Playwright **1.63.0**. The independent localhost player check used bundled Playwright **1.62.1**. No application dependencies were installed or changed in this continuation.

From the repository root, run these steps serially:

```sh
node docs/submission/motion/render-assets.mjs
python3 docs/submission/motion/render-film.py
python3 docs/submission/motion/verify-film.py
```

`--reuse` preserves existing scene clips; use only when their exact inputs have not changed. `--refresh=9` with `--reuse` explicitly rebuilds chapter nine. To rerender captions/final encoding against an unchanged picture, run `prepare-captions.py`, then `finish-film.mjs`, then `verify-film.py`. Final MP4 replacement happens only after the encoder succeeds.

The media check requires the actual 104-second file to decode fully, have a consistent decoded frame count at constant 30 fps with picture duration within one frame of 104 seconds, H.264/AAC, English selectable captions, measured audio within the configured bounds, and the complete 239-word caption transcript. It writes the local review player and a redacted media result. Visual inspection remains a separate check.

All scene encodes explicitly use yuv420p. The final fixed-size picture input disables filter reinitialization, then assigns timestamps by frame index: changing pixel format can otherwise reset filter state and its frame counter, as described in the [official FFmpeg documentation](https://ffmpeg.org/ffmpeg.html#Advanced-options). Failed intermediate exports remain documented in the media evidence; they are not acceptance results.

For the browser check, serve `.local/submission` on loopback port 3411, then run `node docs/submission/motion/verify-player.cjs`. It checks three widths, all 34 WebVTT cues, and complete muted playback at 4x. Shut down only that task-owned review server afterward. The checker closes its own browser. This does not establish human listening, real-time playback on every device, animal-content approval or event eligibility.

The review player starts only on user action, includes a static transcript, and leaves selectable captions off initially because the picture already includes English captions. YouTube upload remains paused by the owner. Reproduction never authorizes publication, application changes or hosted Supabase.
