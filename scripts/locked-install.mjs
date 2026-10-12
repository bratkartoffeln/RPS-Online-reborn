import {spawnSync} from 'node:child_process';
for(const args of [['import'],['install','--frozen-lockfile','--ignore-scripts']]){
 const result=spawnSync(process.execPath,["C:/Users/BeQuiet/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pnpm/bin/pnpm.cjs",...args],{stdio:'inherit',windowsHide:true});
 if(result.status!==0)process.exit(result.status??1);
}
