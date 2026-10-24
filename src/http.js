import {readFile} from 'node:fs/promises';

const PREFIX='/api/dsh-medals';
const STATIC=/^(?:index\.html|styles\.css|app\.js|i18n\.js|theme\.js|medal-renderer\.js|assets\/medals\/(?:orbit|rise|dawn|first|beyond|evergreen|compass|rosette|starfire|starchart|starriver|moon|earth|sun|solarsystem|daily-[124]|week-days-[357]|days-(?:7|30)|month-days-(?:10|20))-(?:front|back)\.png)$/;
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png'};
function trusted(req) {
  try {
    const host=new URL(`http://${req.headers.host}`);
    return ['localhost','127.0.0.1','[::1]'].includes(host.hostname) && req.headers['sec-fetch-site']!=='cross-site' && (!req.headers.origin || new URL(req.headers.origin).host===host.host);
  } catch {return false;}
}
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
async function body(req) {
  let text='';
  for await (const chunk of req) {text+=chunk;if(Buffer.byteLength(text)>16384) throw new Error('Body too large');}
  return JSON.parse(text);
}

export function createHandler({service,uiRoot,admit=()=>({rejection:401})}) {
  return async (req,res)=>{
    if (!trusted(req)) return json(res,403,{error:'Forbidden'});
    try {
      const admission=admit(req);
      if (!admission || 'rejection' in admission) return json(res,admission?.rejection??401,{error:'Authentication required'});
      const url=new URL(req.url,'http://localhost');
      const path=url.pathname;
      if (path===`${PREFIX}/status`) {
        if(req.method!=='GET') return json(res,405,{error:'Method not allowed'});
        try {return json(res,200,await service.refresh());}
        catch {return json(res,503,service.latest?{...service.latest,complete:false,errorCode:'SYNC_FAILED',error:'同步失败，已保留上次记录；请稍后重试。'}:{errorCode:'UNAVAILABLE',error:'奖牌馆暂时无法读取会话或收藏账本，请检查服务日志。'});}
      }
      if (path===`${PREFIX}/ack`||path===`${PREFIX}/challenges/ack`) {
        if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
        if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON required'});
        let ids;
        try {const data=await body(req);ids=data.ids;if(!Array.isArray(ids)||ids.length>1000||ids.some(x=>typeof x!=='string'||x.length>100))throw new Error();}
        catch {return json(res,400,{error:'Invalid award ids'});}
        try {return json(res,200,await (path===`${PREFIX}/challenges/ack`?service.acknowledgeChallenges(ids):service.acknowledge(ids)));}
        catch {return json(res,400,{errorCode:'ACK_FAILED',error:'奖牌记录未确认，请稍后重试。'});}
      }
      if(path.startsWith(`${PREFIX}/ui/`)) {
        const file=path.slice(`${PREFIX}/ui/`.length)||'index.html';
        if(!STATIC.test(file))return json(res,404,{error:'Not found'});
        if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
        const content=await readFile(new URL(file,uiRoot));
        res.writeHead(200,{'content-type':mime[file.split('.').pop()],'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"});
        return res.end(req.method==='HEAD'?undefined:content);
      }
      return json(res,404,{error:'Not found'});
    } catch(e) {return json(res,e.code==='ENOENT'?404:500,{error:'Unable to serve medals'});}
  };
}
