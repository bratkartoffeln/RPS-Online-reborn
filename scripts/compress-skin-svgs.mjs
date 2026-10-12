import { lstat, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

const gzipAsync = promisify(gzip);

export async function compressSkinSvgs(directory = path.resolve('dist/client/skins')) {
  const statistics = { files: 0, originalBytes: 0, gzipBytes: 0 };
  if (!(await lstat(directory)).isDirectory()) {
    throw new Error(`SVG-Verzeichnis ist kein reguläres Verzeichnis: ${directory}`);
  }

  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
      } else if (entry.isFile() && /\.svg$/i.test(entry.name)) {
        const original = await readFile(file);
        const compressed = await gzipAsync(original, { level: 9 });
        const sidecar = `${file}.gz`;
        // Replace an existing sidecar, including a symlink, without following it.
        await rm(sidecar, { force: true });
        await writeFile(sidecar, compressed);
        statistics.files++;
        statistics.originalBytes += original.length;
        statistics.gzipBytes += compressed.length;
      }
    }
  }

  await visit(directory);
  return statistics;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const statistics = await compressSkinSvgs(process.argv[2]);
    console.log(`SVG-Komprimierung: ${statistics.files} Dateien, ${statistics.originalBytes} Originalbytes, ${statistics.gzipBytes} gzip-Bytes.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
