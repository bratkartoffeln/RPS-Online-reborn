import assert from 'node:assert/strict';
import { access, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { gunzipSync } from 'node:zlib';

async function symlinkOrSkip(t: TestContext, target: string, link: string, type: 'file' | 'dir'): Promise<boolean> {
  try {
    await symlink(target, link, type);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (process.platform === 'win32' && (code === 'EPERM' || code === 'EACCES')) {
      t.skip(`Windows cannot create symbolic links (${code}); enable Developer Mode or run with symlink privileges.`);
      return false;
    }
    throw error;
  }
}

test('skin SVG build compression preserves originals, skips other files, and refreshes sidecars', async () => {
  const { compressSkinSvgs } = await import(new URL('../scripts/compress-skin-svgs.mjs', import.meta.url).href);
  const root = await mkdtemp(path.join(tmpdir(), 'rps-skin-compression-'));
  const directory = path.join(root, 'skins');
  const nested = path.join(directory, 'retro', 'weapons');
  const atlas = path.join(directory, 'atlas.svg');
  const weapon = path.join(nested, 'WEAPON.SVG');
  const original = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><title>Schere – Größe</title><path d="M0 0h10v10z"/></svg>\n');
  const uppercase = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>');
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
  const config = Buffer.from('{"atlas":{"image":"atlas.svg"}}\n');

  try {
    await mkdir(nested, { recursive: true });
    await writeFile(atlas, original);
    await writeFile(weapon, uppercase);
    await writeFile(path.join(directory, 'atlas.png'), png);
    await writeFile(path.join(nested, 'skin.json'), config);

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
    assert.equal((await lstat(`${atlas}.gz`)).isFile(), true);
    for (const absent of [path.join(directory, 'atlas.png.gz'), path.join(nested, 'skin.json.gz')]) {
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

for (const type of ['file', 'dir'] as const) {
  test(`skin SVG build compression skips ${type} symlinks`, async t => {
    const { compressSkinSvgs } = await import(new URL('../scripts/compress-skin-svgs.mjs', import.meta.url).href);
    const root = await mkdtemp(path.join(tmpdir(), 'rps-skin-compression-'));
    const directory = path.join(root, 'skins');
    const outside = path.join(root, 'outside');
    const original = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const target = path.join(outside, 'linked.svg');
    const link = path.join(directory, type === 'file' ? 'linked.svg' : 'linked-directory');
    try {
      await mkdir(directory);
      await mkdir(outside);
      await writeFile(target, original);
      if (!await symlinkOrSkip(t, type === 'file' ? target : outside, link, type)) return;

      assert.deepEqual(await compressSkinSvgs(directory), { files: 0, originalBytes: 0, gzipBytes: 0 });
      assert.deepEqual(await readFile(target), original);
      assert.equal((await lstat(link)).isSymbolicLink(), true);
      await assert.rejects(access(`${target}.gz`), { code: 'ENOENT' });
      await assert.rejects(access(type === 'file' ? `${link}.gz` : path.join(link, 'linked.svg.gz')), { code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('skin SVG build compression replaces a sidecar symlink without touching its target', async t => {
  const { compressSkinSvgs } = await import(new URL('../scripts/compress-skin-svgs.mjs', import.meta.url).href);
  const root = await mkdtemp(path.join(tmpdir(), 'rps-skin-compression-'));
  const directory = path.join(root, 'skins');
  const atlas = path.join(directory, 'atlas.svg');
  const target = path.join(root, 'sidecar-target');
  const original = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const outsideContent = Buffer.from('symlink targets must remain untouched');
  try {
    await mkdir(directory);
    await writeFile(atlas, original);
    await writeFile(target, outsideContent);
    if (!await symlinkOrSkip(t, target, `${atlas}.gz`, 'file')) return;

    const result = await compressSkinSvgs(directory);
    const compressed = await readFile(`${atlas}.gz`);
    assert.deepEqual(result, { files: 1, originalBytes: original.length, gzipBytes: compressed.length });
    assert.equal((await lstat(`${atlas}.gz`)).isFile(), true);
    assert.deepEqual(gunzipSync(compressed), original);
    assert.deepEqual(await readFile(atlas), original);
    assert.deepEqual(await readFile(target), outsideContent);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
