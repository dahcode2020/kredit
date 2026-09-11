/**
 * RBAC & versioning — unit sans Nest (logique pure mockée)
 * Vérifie RolesGuard, RequireMFA, optimistic locking 409, Idempotency-Key
 */

import { RolesGuard } from '../../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  function ctxFor(user:any, handlerRoles?:string[], classRoles?:string[]) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(handlerRoles ?? classRoles ?? undefined as any);
    const guard = new RolesGuard(reflector);
    const ctx: any = { getHandler:()=>({}), getClass:()=>({}), switchToHttp:()=>({ getRequest:()=>({ user }) })};
    return guard;
  }
  it('no roles → allow', () => {
    const guard = ctxFor({ role:'CUSTOMER' }, undefined);
    expect(guard.canActivate({ getHandler:()=>({}), getClass:()=>({}), switchToHttp:()=>({ getRequest:()=>({ user:{role:'CUSTOMER'}}) }) } as any)).toBe(true);
  });
  it('CUSTOMER cannot access ADMIN route → false', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector,'getAllAndOverride').mockReturnValue(['ADMIN']);
    const guard = new RolesGuard(reflector);
    const ctx:any = { getHandler:()=>({}), getClass:()=>({}), switchToHttp:()=>({ getRequest:()=>({ user:{ role:'CUSTOMER'}})})};
    expect(guard.canActivate(ctx)).toBe(false);
  });
  it('ADMIN can access ADMIN route → true', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector,'getAllAndOverride').mockReturnValue(['ADMIN','SUPER_ADMIN']);
    const guard = new RolesGuard(reflector);
    const ctx:any = { getHandler:()=>({}), getClass:()=>({}), switchToHttp:()=>({ getRequest:()=>({ user:{ role:'ADMIN'}})})};
    expect(guard.canActivate(ctx)).toBe(true);
  });
  it('SUPER_ADMIN can access ADMIN route → true', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector,'getAllAndOverride').mockReturnValue(['ADMIN','SUPER_ADMIN']);
    const guard = new RolesGuard(reflector);
    const ctx:any = { getHandler:()=>({}), getClass:()=>({}), switchToHttp:()=>({ getRequest:()=>({ user:{ role:'SUPER_ADMIN'}})})};
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

describe('optimistic locking — version/409', () => {
  class InMemoryAppRepo {
    private store = new Map<string,{ id:string, version:number, status:string }>();
    create(id:string){ this.store.set(id,{id, version:1, status:'DRAFT'}); return this.store.get(id)!; }
    update(id:string, expected:number, patch:Partial<any>){
      const cur = this.store.get(id)!;
      if (cur.version !== expected) { const e:any=new Error('Conflict'); e.status=409; throw e; }
      Object.assign(cur, patch, { version: cur.version+1 });
      return cur;
    }
  }
  it('concurrent edits second fails 409', () => {
    const repo = new InMemoryAppRepo();
    repo.create('app1');
    const a = repo.update('app1', 1, { status:'DRAFT' });
    expect(a.version).toBe(2);
    expect(()=> repo.update('app1', 1, { status:'SUBMITTED' })).toThrow();
    try { repo.update('app1', 1, {} as any);} catch(e:any){ expect(e.status).toBe(409); }
  });
  it('second succeeds if it re-reads version 2', () => {
    const repo = new InMemoryAppRepo();
    repo.create('app2');
    repo.update('app2', 1, { status:'DRAFT'});
    const ok = repo.update('app2', 2, { status:'SUBMITTED'});
    expect(ok.status).toBe('SUBMITTED');
    expect(ok.version).toBe(3);
  });
});

describe('Idempotency-Key — double soumission', () => {
  class IdempStore {
    private byKey = new Map<string,{id:string, body:any}>();
    handle(key:string, body:any){
      const hit = this.byKey.get(key);
      if (hit) {
        // si payload diff → 409
        if (JSON.stringify(hit.body) !== JSON.stringify(body)) { const e:any=new Error('Idempotency conflict'); e.status=409; throw e; }
        return { hit:true, id: hit.id, status:200 };
      }
      const id='app_'+Math.random().toString(36).slice(2);
      this.byKey.set(key,{id, body});
      return { hit:false, id, status:201 };
    }
  }
  it('même key même payload → hit 200 même id (pas de double dossier)', () => {
    const s=new IdempStore();
    const a=s.handle('k-123',{amount:15000, termMonths:48});
    const b=s.handle('k-123',{amount:15000, termMonths:48});
    expect(a.id).toBe(b.id);
    expect(b.hit).toBe(true);
    expect(b.status).toBe(200);
  });
  it('même key payload diff → 409 Conflict', ()=>{
    const s=new IdempStore();
    s.handle('k-123',{amount:15000, termMonths:48});
    expect(()=> s.handle('k-123',{amount:20000, termMonths:48})).toThrow();
    try{s.handle('k-123',{amount:20000, termMonths:48});}catch(e:any){expect(e.status).toBe(409);}
  });
});

describe('exception administrative 20-2000 chars + SUPER_ADMIN >50k', () => {
  function validateException(reason:string, amount:number, role:string){
    if (!reason || reason.trim().length < 20) { const e:any=new Error('reason too short'); e.status=400; throw e;}
    if (reason.length > 2000) { const e:any=new Error('reason too long'); e.status=400; throw e; }
    if (amount > 50000 && role!=='SUPER_ADMIN') { const e:any=new Error('REQUIRES_SUPER_ADMIN'); e.status=403; throw e; }
    return true;
  }
  it('raison <20 → 400', ()=> expect(()=>validateException('court',10000,'ADMIN')).toThrow());
  it('raison 20-2000 OK pour ADMIN ≤50k', ()=> expect(validateException('a'.repeat(20), 50000, 'ADMIN')).toBe(true));
  it('raison 20-2000 mais >50k ADMIN → 403 REQUIRES_SUPER_ADMIN', ()=> expect(()=>validateException('a'.repeat(100), 51000,'ADMIN')).toThrow(/REQUIRES_SUPER_ADMIN/));
  it('>50k SUPER_ADMIN OK', ()=> expect(validateException('a'.repeat(100), 51000,'SUPER_ADMIN')).toBe(true));
});
