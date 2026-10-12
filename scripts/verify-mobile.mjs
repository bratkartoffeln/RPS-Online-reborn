import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const commands = [
 ['node_modules/typescript/bin/tsc', '--noEmit'],
 ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json', '--noEmit'],
 ['node_modules/vite/bin/vite.js', 'build'],
 ['scripts/compress-skin-svgs.mjs'],
 ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json'],
 ['--import', 'tsx', '--test', ...['tests', 'client'].flatMap(dir => readdirSync(dir).filter(file => file.endsWith('.test.ts')).map(file => dir + '/' + file))],
];
for (const args of commands) {
 console.log('VERIFY', args.slice(0, 4).join(' '));
 const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true });
 if (result.status !== 0) process.exit(result.status ?? 1);
}
