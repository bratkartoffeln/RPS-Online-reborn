import test from 'node:test';
import assert from 'node:assert/strict';
import { AppUpdates, releaseUpdate, UPDATE_API } from './app-updates';

function release(version = '0.4.36') {
  const filename = `RPS-Arena-${version}-debug.apk`;
  return { draft: false, prerelease: false, tag_name: `v${version}`, assets: [{ name: filename, size: 1234,
    browser_download_url: `https://github.com/bratkartoffeln/RPS-Online-reborn/releases/download/v${version}/${filename}` }] };
}

test('updates compare numeric versions and never offer equal, older or prerelease APKs', () => {
  assert.equal(releaseUpdate(release('0.4.10'), '0.4.9')?.version, '0.4.10');
  assert.equal(releaseUpdate(release('0.5.0'), '0.4.99')?.version, '0.5.0');
  for (const version of ['0.4.35', '0.4.9', '0.3.99']) assert.equal(releaseUpdate(release(version), '0.4.35'), null);
  for (const change of [{ draft: true }, { prerelease: true }, { tag_name: 'v0.4.36-beta.1' }, { assets: [] }]) {
    assert.equal(releaseUpdate({ ...release(), ...change }, '0.4.35'), null);
  }
});

test('updates require the exact repository, tag and APK name and reject malformed metadata', () => {
  for (const value of [null, {}, 'v1.0.0', { ...release(), draft: undefined }]) assert.equal(releaseUpdate(value, '0.4.35'), null);
  for (const change of [{ browser_download_url: 'https://example.com/update.apk' }, { size: 0 }, { name: 'other.apk' }]) {
    const data = release();
    Object.assign(data.assets[0], change);
    assert.equal(releaseUpdate(data, '0.4.35'), null);
  }
});

test('checking is throttled automatically, manual retry recovers, and downloads need an explicit action', async () => {
  const downloads: string[] = [];
  let calls = 0, fail = true;
  const updates = new AppUpdates('0.4.35', () => {}, async (input) => {
    assert.equal(input, UPDATE_API);
    calls++;
    if (fail) throw new Error('offline');
    return new Response(JSON.stringify(release()), { status: 200 });
  }, async url => { downloads.push(url); });
  await updates.check();
  assert.match(updates.markup(), /nicht erreichbar/);
  await updates.check();
  assert.equal(calls, 1);
  fail = false;
  await updates.check(true);
  assert.match(updates.markup(), /0.4.36 ist verfügbar/);
  assert.deepEqual(downloads, []);
  await updates.open();
  assert.equal(downloads.length, 1);
});

test('missing releases offer no download and rate limiting remains retryable', async () => {
  const missing = new AppUpdates('0.4.35', () => {}, async () => new Response(null, { status: 404 }));
  await missing.check();
  assert.doesNotMatch(missing.markup(), /id="download-update"/);
  const limited = new AppUpdates('0.4.35', () => {}, async () => new Response(null, { status: 403 }));
  await limited.check();
  assert.match(limited.markup(), /nicht erreichbar/);
});
