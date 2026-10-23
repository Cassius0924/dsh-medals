import {homedir} from 'node:os';
import {join} from 'node:path';
import {Ledger} from './store.js';
import {MedalsService} from './service.js';
import {createHandler} from './http.js';

export const name='dsh-medals';
export const inject=['webServer','sessionPersistence','connection'];

export function apply(ctx, options={}) {
  const ledgerPath=options.ledgerPath??join(process.env.DSH_HOME??join(homedir(),'.dsh'),'storages','dsh-medals','ledger.json');
  const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const service=new MedalsService({persistence:ctx.sessionPersistence,ledger:new Ledger(ledgerPath,timeZone)});
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/api/dsh-medals',handler:createHandler({service,admit:req=>ctx.connection.admit(req),uiRoot:new URL('./ui/',import.meta.url)})}),'dsh-medals: local API and gallery');
  ctx.effect(()=>{
    const sync=()=>service.refresh().catch(()=>{});
    void sync();
    const timer=setInterval(sync,30_000);timer.unref?.();
    return async()=>{clearInterval(timer);await service.pending;};
  },'dsh-medals: periodic settlement');
}
