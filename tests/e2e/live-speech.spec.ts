import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const wav = process.env.DENLUMI_FAKE_MIC_WAV;
test.skip(!process.env.DENLUMI_LIVE_SPEECH || !wav, 'Opt-in live AWS speech test requires a fictional WAV fixture.');
test.use({ launchOptions: { args: [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${wav}`,
  '--autoplay-policy=no-user-gesture-required',
] } });

test('synthetic browser microphone reaches live Transcribe; Polly playback stops offline', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = function(source?: string) {
      const audio = new NativeAudio(source);
      (window as typeof window & { denlumiAudio?: HTMLAudioElement }).denlumiAudio = audio;
      return audio;
    } as unknown as typeof Audio;
  });
  await page.goto('/');
  await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button', { name: 'Open sample household' }).click();
  await expect(page.getByRole('heading', { name: 'Finn & Nora' })).toBeVisible();

  await page.getByRole('button', { name: 'Record a check-in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish recording' })).toBeVisible();
  await page.waitForTimeout(2700);
  const transcriptionPromise = page.waitForResponse(response => response.url().endsWith('/api/transcription'));
  await page.getByRole('button', { name: 'Finish recording' }).click();
  const transcription = await transcriptionPromise;
  expect(transcription.status()).toBe(200);
  const recognized = await transcription.json();
  expect(recognized.provider).toBe('Amazon Transcribe');
  expect(recognized.saved).toBe(false);
  expect(recognized.requires_review).toBe(true);
  expect(recognized.transcript).toMatch(/connection test/i);
  await expect(page.getByText('Transcript ready. Review the words before continuing.')).toBeVisible();
  await expect(page.getByLabel('Your check-in', { exact: true })).toHaveValue(recognized.transcript);

  const speechPromise = page.waitForResponse(response => response.url().endsWith('/api/speech'));
  await page.getByRole('button', { name: 'Read update aloud' }).click();
  const speech = await speechPromise;
  expect(speech.status()).toBe(200);
  expect(speech.headers()['x-denlumi-source']).toBe('Amazon-Polly');
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as typeof window & { denlumiAudio?: HTMLAudioElement }).denlumiAudio;
    return !!audio && !audio.paused && audio.currentTime > 0;
  })).toBe(true);
  const beforeStop = await page.evaluate(() => {
    const audio = (window as typeof window & { denlumiAudio?: HTMLAudioElement }).denlumiAudio!;
    return { paused: audio.paused, currentTime: audio.currentTime };
  });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Stop guidance', exact: true }).click();
  await expect(page.getByText('Stopped on this device.', { exact: true })).toBeVisible();
  const afterStop = await page.evaluate(() => {
    const audio = (window as typeof window & { denlumiAudio?: HTMLAudioElement }).denlumiAudio!;
    return { paused: audio.paused, currentTime: audio.currentTime };
  });
  expect(beforeStop.paused).toBe(false);
  expect(afterStop.paused).toBe(true);
  const evidence = {
    checked_at: new Date().toISOString(),
    source: 'Chrome synthetic microphone WAV, real authenticated local app, real Amazon Transcribe and Polly',
    human_microphone: 'NOT_TESTED', human_audibility: 'NOT_TESTED',
    transcription: { http_status: transcription.status(), request_id: recognized.request_id, transcript: recognized.transcript, saved: recognized.saved, requires_review: recognized.requires_review },
    speech: { http_status: speech.status(), source: speech.headers()['x-denlumi-source'], audio_bytes: 'NOT_MEASURED_IN_BROWSER' },
    playback: { started_in_browser: true, stopped_while_offline: true, paused_after_stop: afterStop.paused },
  };
  await mkdir('evidence/phase6', { recursive: true });
  await writeFile('evidence/phase6/voice-browser.json', `${JSON.stringify(evidence, null, 2)}\n`);
  await context.setOffline(false);
});
