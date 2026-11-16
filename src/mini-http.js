import fs from 'node:fs';
import path from 'node:path';
const typeOf={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml; charset=utf-8','.ico':'image/x-icon','.png':'image/png','.woff2':'font/woff2'};
function match(route,pathname){const src=route.replace(/\//g,'\\/').replace(/:([A-Za-z_]+)/g,'(?<$1>[^/]+)');const rex=new RegExp('^'+src+'/?$');const m=pathname.match(rex);return m?.groups|| (m?{}:null);}
export default function miniExpress(){const routes=[],middleware=[];
 const app=(req,res)=>{
  const url=new URL(req.url,'http://local');req.path=url.pathname;req.query=Object.fromEntries(url.searchParams);
  res.status=function(n){res.statusCode=n;return res;};
  res.json=function(obj){if(res.writableEnded)return;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));return res;};
  res.send=function(data){if(res.writableEnded)return;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(String(data));return res;};
  res.redirect=function(dest){res.statusCode=302;res.setHeader('Location',dest);res.end();};
  res.cookie=function(name,value,opts={}){const out=`${name}=${encodeURIComponent(value)}; Path=${opts.path||'/'}; SameSite=${opts.sameSite||'Lax'}${opts.httpOnly?'; HttpOnly':''}${opts.secure?'; Secure':''}${opts.maxAge?'; Max-Age='+Math.floor(opts.maxAge/1000):''}`;res.setHeader('Set-Cookie',out);return res;};
  res.clearCookie=function(name,opts={}){res.setHeader('Set-Cookie',`${name}=; Path=${opts.path||'/'}; SameSite=Lax; HttpOnly; Max-Age=0`);return res;};
  res.sendFile=function(filename){try{if(res.writableEnded)return;const data=fs.readFileSync(filename);res.setHeader('Content-Type',typeOf[path.extname(filename)]||'application/octet-stream');res.end(data);}catch{res.status(404).send('Not found');}};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  let idx=0;function next(){if(res.writableEnded)return;
    if(idx<middleware.length){const {prefix,fn}=middleware[idx++];if(prefix && !req.path.startsWith(prefix))return next();return fn(req,res,next);}
    for(const r of routes){if(req.method!==r.method)continue;const params=match(r.path,req.path);if(params!==null){req.params=params;try{const result=r.handler(req,res);if(result?.catch)result.catch(e=>{console.error(e);if(!res.headersSent)res.status(500).json({error:'مشكلة في السيرفر'});});}catch(e){console.error(e);if(!res.headersSent)res.status(500).json({error:'مشكلة في السيرفر'});}return;}}
    res.status(404).json({error:'المسار غير موجود'});
  }next();
 };
 app.use=(prefix,fn)=>{if(typeof prefix==='function'){fn=prefix;prefix='';}middleware.push({prefix,fn});return app;};
 for(const verb of ['get','post','patch'])app[verb]=(route,...handlers)=>{for(const path of Array.isArray(route)?route:[route]){routes.push({method:verb.toUpperCase(),path,handler:(req,res)=>{let i=0;const next=()=>{const fn=handlers[i++];if(fn)return fn(req,res,next);};return next();}});}return app;};
 app.set=()=>{};return app;
}
miniExpress.json=({limit='12kb'}={})=>(req,res,next)=>{
 if(!['POST','PUT','PATCH'].includes(req.method))return next();
 let body='';const max=parseInt(limit)*1024;
 req.on('data',chunk=>{body+=chunk;if(body.length>max){res.status(413).json({error:'الطلب كبير'});req.destroy();}});
 req.on('end',()=>{if(res.writableEnded)return;try{req.body=body?JSON.parse(body):{};}catch{return res.status(400).json({error:'صيغة الطلب غير صحيحة'});}next();});
};
miniExpress.static=(directory)=>(req,res,next)=>{
 if(req.method!=='GET')return next();let p;try{p=decodeURIComponent(req.path);}catch{return res.status(400).send('Bad path');}
 if(p==='/'||p==='/index.html')p='/index.html';
 const candidate=path.resolve(directory,'.'+p);if(!candidate.startsWith(path.resolve(directory)+path.sep))return next();
 try{const st=fs.statSync(candidate);if(st.isFile())return res.sendFile(candidate);}catch{}
 next();
};