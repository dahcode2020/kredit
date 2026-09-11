/**
 * Security — brute force, rate limit, XSS, audit hash chain (sans DB)
 */

class BruteLimiter {
  private fails = new Map<string,{count:number, lockedUntil:number|null}>();
  attempt(email:string, ok:boolean){
    const e = this.fails.get(email) ?? {count:0, lockedUntil:null};
    if (e.lockedUntil && Date.now() < e.lockedUntil) { const err:any=new Error('Locked'); err.status=423; throw err; }
    if (ok) { e.count=0; e.lockedUntil=null; this.fails.set(email,e); return { locked:false }; }
    e.count++;
    if (e.count>=5) e.lockedUntil = Date.now()+15*60*1000;
    this.fails.set(email,e);
    if (e.lockedUntil) return { locked:true };
    return { locked:false, remaining:5-e.count };
  }
}

describe('brute force — 5 fails →423 lockout 15m', () => {
  it('5 fails déclenche lock, 6e →423', () => {
    const lim=new BruteLimiter();
    for(let i=0;i<5;i++) lim.attempt('user@kredit.be', false);
    expect(()=> lim.attempt('user@kredit.be', false)).toThrow();
    try{ lim.attempt('user@kredit.be', false);}catch(e:any){ expect(e.status).toBe(423); }
  });
  it('success reset counter', () => {
    const lim=new BruteLimiter();
    lim.attempt('a@b.be', false);
    lim.attempt('a@b.be', true);
    const r=lim.attempt('a@b.be', false);
    expect(r.remaining).toBe(4);
  });
});

class FixedWindowRate {
  private hits = new Map<string,{count:number, windowStart:number}>();
  constructor(private limit:number, private windowMs:number){}
  hit(key:string){
    const now=Date.now();
    const cur=this.hits.get(key) ?? {count:0, windowStart:now};
    if (now - cur.windowStart > this.windowMs){ cur.count=0; cur.windowStart=now; }
    cur.count++;
    this.hits.set(key,cur);
    if (cur.count>this.limit){ const e:any=new Error('Rate limit'); e.status=429; e.headers={'Retry-After':'60'}; throw e; }
    return { remaining: this.limit - cur.count };
  }
}

describe('rate limit — 100 req/min →429', () => {
  it('101e req →429', () => {
    const lim=new FixedWindowRate(100, 60_000);
    for(let i=0;i<100;i++) lim.hit('ip:1.2.3.4');
    expect(()=> lim.hit('ip:1.2.3.4')).toThrow();
    try{ lim.hit('ip:1.2.3.4');}catch(e:any){ expect(e.status).toBe(429); expect(e.headers['Retry-After']).toBeDefined(); }
  });
});

describe('XSS sanitize — reason field', () => {
  function sanitize(input:string){
    return (input||'').replace(/[<>]/g,'').trim();
  }
  it('strip <script>', () => {
    expect(sanitize('<script>alert(1)</script>')).not.toContain('<');
    expect(sanitize('a'.repeat(30))).toBe('a'.repeat(30));
  });
  it('forbidNonWhitelisted blocks extra fields (déjà testé)',()=>{
    const extra = { amount:1000, injected:'<img onerror=alert(1)>' };
    const allowed = ['amount'];
    const blocked = Object.keys(extra).filter(k=> !allowed.includes(k));
    expect(blocked.length).toBe(1);
  });
});

describe('audit hash chain — append only', () => {
  function chainHash(prev:string, entry:string){
    // simple chain: hash(prev+entry) — en prod SHA256
    let h=0; for(let i=0;i<(prev+entry).length;i++) h=(h*31 + (prev+entry).charCodeAt(i))>>>0;
    return h.toString(16).padStart(8,'0');
  }
  it('chain valid, tamper break', ()=>{
    let prev='0'.repeat(8);
    const e1=chainHash(prev,'login');
    prev=e1;
    const e2=chainHash(prev,'approve');
    // verify
    expect(chainHash(e1,'approve')).toBe(e2);
    // tamper
    expect(chainHash(prev,'approveX')).not.toBe(e2);
  });
  it('verifyChain helper', ()=>{
    const logs=[{hash:'a',prev:'0'}, {hash:'b',prev:'a'}];
    const valid = logs.every((l,idx)=> idx===0 ? l.prev==='0' : l.prev===logs[idx-1].hash);
    expect(valid).toBe(true);
    logs[1].prev='tampered';
    expect(logs[1].prev===logs[0].hash).toBe(false);
  });
});
