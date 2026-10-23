import {build} from 'esbuild';
import {cp,mkdir,readFile,rm} from 'node:fs/promises';
const {name}=JSON.parse(await readFile('package.json','utf8'));
await rm('lib',{recursive:true,force:true});await mkdir('lib/ui',{recursive:true});
await build({entryPoints:['src/index.js'],outfile:'lib/index.js',bundle:true,format:'esm',platform:'node',target:'node22'});
await build({entryPoints:['src/client.js'],outfile:'lib/client.js',bundle:true,format:'cjs',platform:'browser',target:'es2022',external:['react'],banner:{js:`window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;`},footer:{js:'return module.exports;}});'}});
await cp('ui','lib/ui',{recursive:true});
await build({entryPoints:['src/i18n.js'],outfile:'lib/ui/i18n.js',bundle:true,format:'iife',globalName:'MedalsI18n',platform:'browser',target:'es2020',minify:true});
await build({entryPoints:['src/medal-renderer.js'],outfile:'lib/ui/medal-renderer.js',bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,legalComments:'eof'});

await cp('vendor/three/LICENSE','lib/THREE-LICENSE');

await cp('vendor/numerals','lib/numerals',{recursive:true});
