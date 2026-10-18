import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() :
      reject(new Error(`${path.basename(command)} wurde mit ${code ?? signal} beendet.`)));
  });
}

try {
  if (!process.env.npm_execpath) throw new Error('Bitte mit npm run android:apk starten.');
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Die Android-Version muss major.minor.patch verwenden.');

  await run(process.execPath, [process.env.npm_execpath, 'run', 'android:sync']);
  const nativeRoot = path.join(root, 'android');
  if (process.platform === 'win32') {
    await run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat --no-daemon :app:assembleDebug'], nativeRoot);
  } else {
    await run('sh', ['./gradlew', '--no-daemon', ':app:assembleDebug'], nativeRoot);
  }

  const outputDirectory = path.join(root, 'dist/android-apk');
  await mkdir(outputDirectory, { recursive: true });
  const filename = `RPS-Arena-${version}-debug.apk`;
  const destination = path.join(outputDirectory, filename);
  await copyFile(path.join(nativeRoot, 'app/build/outputs/apk/debug/app-debug.apk'), destination);
  const checksum = createHash('sha256').update(await readFile(destination)).digest('hex');
  await writeFile(`${destination}.sha256`, `${checksum}  ${filename}\n`);
  console.log(`\nAndroid-Testversion gebaut: ${destination}`);
  console.log(`SHA-256: ${checksum}`);
  console.log('Spieloberfläche, Grafiksets und Sounds sind enthalten. Onlinepartien benötigen den eingestellten Spielserver.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
