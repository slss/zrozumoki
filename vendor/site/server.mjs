import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),port=Number(process.argv[2]);
if(!Number.isInteger(port))throw Error('Podaj port');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(root,'.'+pathname);
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 if((await stat(file)).isDirectory())file=resolve(file,'index.html');
 const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
}catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Nie znaleziono strony.');}}).listen(port,'127.0.0.1',()=>console.log(`Local: http://localhost:${port}`));
