import assert from 'node:assert/strict';
import { access, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

test('skin SVG build compression preserves originals, skips other files and symlinks, and refreshes sidecars', async () => {
  const { compressSkinSvgs } = await import(new URL('../scripts/compress-skin-svgs.mjs', import.meta.url).href);
  const root = await mkdtemp(path.join(tmpdir(), 'rps-skin-compression-'));
  const directory = path.join(root, 'skins');
  const nested = path.join(directory, 'retro', 'weapons');
  const outside = path.join(root, 'outside');
  const atlas = path.join(directory, 'atlas.svg');
  const weapon = path.join(nested, 'WEAPON.SVG');
  const original = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><title>Schere – Größe</title><path d="M0 0h10v10z"/></svg>\n');
  const uppercase = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>');
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
  const config = Buffer.from('{"atlas":{"image":"atlas.svg"}}\n');
  const outsideContent = Buffer.from('symlink targets must remain untouched');

  try {
    await mkdir(nested, { recursive: true });
    await mkdir(outside);
    await writeFile(atlas, original);
    await writeFile(weapon, uppercase);
    await writeFile(path.join(directory, 'atlas.png'), png);
    await writeFile(path.join(nested, 'skin.json'), config);
    await writeFile(path.join(outside, 'linked.svg'), original);
    await writeFile(path.join(outside, 'sidecar-target'), outsideContent);
    await symlink(path.join(outside, 'linked.svg'), path.join(directory, 'linked.svg'));
    await symlink(outside, path.join(directory, 'linked-directory'), 'dir');
    await symlink(path.join(outside, 'sidecar-target'), `${atlas}.gz`);

    const first = await compressSkinSvgs(directory);
    const atlasGzip = await readFile(`${atlas}.gz`);
    const weaponGzip = await readFile(`${weapon}.gz`);
    assert.deepEqual(first, {
      files: 2,
      originalBytes: original.length + uppercase.length,
      gzipBytes: atlasGzip.length + weaponGzip.length,
    });
    assert.deepEqual(gunzipSync(atlasGzip), original);
    assert.deepEqual(gunzipSync(weaponGzip), uppercase);
    assert.deepEqual(await readFile(atlas), original);
    assert.deepEqual(await readFile(weapon), uppercase);
    assert.deepEqual(await readFile(path.join(directory, 'atlas.png')), png);
    assert.deepEqual(await readFile(path.join(nested, 'skin.json')), config);
    assert.deepEqual(await readFile(path.join(outside, 'sidecar-target')), outsideContent);
    assert.equal((await lstat(`${atlas}.gz`)).isFile(), true);
    for (const absent of [
      path.join(directory, 'atlas.png.gz'),
      path.join(nested, 'skin.json.gz'),
      path.join(directory, 'linked.svg.gz'),
      path.join(outside, 'linked.svg.gz'),
    ]) {
      await assert.rejects(access(absent), { code: 'ENOENT' });
    }

    const changed = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><title>Aktualisierter Atlas</title><rect width="24" height="16"/></svg>\n');
    await writeFile(atlas, changed);
    const second = await compressSkinSvgs(directory);
    const updatedGzip = await readFile(`${atlas}.gz`);
    assert.deepEqual(gunzipSync(updatedGzip), changed);
    assert.notDeepEqual(updatedGzip, atlasGzip);
    assert.deepEqual(await readFile(atlas), changed);
    assert.deepEqual(await readFile(weapon), uppercase);
    assert.deepEqual(gunzipSync(await readFile(`${weapon}.gz`)), uppercase);
    assert.deepEqual(second, {
      files: 2,
      originalBytes: changed.length + uppercase.length,
      gzipBytes: updatedGzip.length + (await readFile(`${weapon}.gz`)).length,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
