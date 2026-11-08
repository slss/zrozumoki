import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve('dist'),errors=[];let count=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())await walk(p);else if(entry.name.endsWith('.html')){
 const html=await readFile(p,'utf8');count++;
 if((html.match(/<h1[ >]/g)||[]).length!==1)errors.push(p+': H1');
 for(const marker of ['lang="pl"','name="description"','rel="canonical"','name="robots"'])if(!html.includes(marker))errors.push(p+': '+marker);
 for(const [,link] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(/^(https?:|#|mailto:|data:)/.test(link))continue;
  const target=resolve(dirname(p),link.split('#')[0]);
  try{const s=await stat(target);if(s.isDirectory())await stat(resolve(target,'index.html'));}catch{errors.push(p+': brak '+link);}
 }
}}}
await walk(root);if(errors.length){console.error(errors);process.exitCode=1;}else console.log(`Sprawdzono ${count} stron: metadane, H1 i odnośniki lokalne poprawne.`);
