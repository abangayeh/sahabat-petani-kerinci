const enc = new TextEncoder();

const json = (data, status=200, headers={}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });

const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g,'-')
  .replace(/\//g,'_')
  .replace(/=+$/,'');

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    {name:'HMAC',hash:'SHA-256'},
    false,
    ['sign']
  );
  return b64(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}

async function makeToken(secret) {
  const payload = b64(enc.encode(JSON.stringify({
    exp:Date.now()+8*60*60*1000,
    role:'admin'
  })));
  return payload+'.'+await sign(payload,secret);
}

async function valid(req,env) {
  const cookie = req.headers.get('Cookie')||'';
  const m = cookie.match(/spk_admin=([^;]+)/);
  if(!m||!env.SESSION_SECRET)return false;

  const [p,s] = m[1].split('.');
  if(!p||!s||s!==await sign(p,env.SESSION_SECRET))return false;

  try {
    return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/'))).exp>Date.now();
  } catch {
    return false;
  }
}

const cookie = (v,max) =>
  `spk_admin=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${max}`;

async function body(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function onRequest({request,env,params}) {
  const path = Array.isArray(params.path)
    ? params.path.join('/')
    : String(params.path||'');

  const [resource,id] = path.split('/');
  const method = request.method;

  if(!env.DB)
    return json({
      error:'Database D1 belum terhubung. Ikuti PETUNJUK_DEPLOY.md.'
    },503);

  if(resource==='login'&&method==='POST') {
    const b = await body(request);

    if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)
      return json({
        error:'Secret ADMIN_PASSWORD dan SESSION_SECRET belum dipasang.'
      },503);

    if(typeof b.password!=='string'||b.password!==env.ADMIN_PASSWORD)
      return json({error:'Kata sandi salah.'},401);

    return json(
      {ok:true},
      200,
      {'set-cookie':cookie(await makeToken(env.SESSION_SECRET),28800)}
    );
  }

  if(resource==='logout'&&method==='POST')
    return json({ok:true},200,{'set-cookie':cookie('',0)});

  if(resource==='me'&&method==='GET')
    return await valid(request,env)
      ? json({authenticated:true})
      : json({error:'Belum masuk.'},401);

  const protectedWrite = !['GET','HEAD'].includes(method);

  if(protectedWrite&&!await valid(request,env))
    return json({
      error:'Sesi admin tidak valid. Silakan masuk kembali.'
    },401);

  try {
    if(resource==='prices') {
      if(method==='GET') {
        const {results} = await env.DB.prepare(
          'SELECT id,commodity,price,unit,date,location,source,created_at FROM prices ORDER BY date DESC, id DESC LIMIT 300'
        ).all();

        const latest = Object.values(
          (results||[]).reduce((a,x)=>{
            if(!a[x.commodity]||x.date>a[x.commodity].date)
              a[x.commodity]=x;
            return a;
          },{})
        );

        return json({
          items:latest.sort((a,b)=>a.commodity.localeCompare(b.commodity)),
          history:results||[]
        });
      }

      if(method==='POST') {
        const b = await body(request);

        if(!b.commodity||!Number.isFinite(Number(b.price))||
          Number(b.price)<0||!b.date||!b.location||!b.source)
          return json({
            error:'Lengkapi komoditas, harga, tanggal, wilayah, dan sumber.'
          },400);

        await env.DB.prepare(
          'INSERT INTO prices (commodity,price,unit,date,location,source) VALUES (?,?,?,?,?,?)'
        ).bind(
          String(b.commodity).slice(0,100),
          Number(b.price),
          String(b.unit||'kg').slice(0,20),
          b.date,
          String(b.location).slice(0,100),
          String(b.source).slice(0,200)
        ).run();

        return json({ok:true},201);
      }
    }

    if(resource==='crops') {
      if(method==='GET') {
        const {results} = await env.DB.prepare(
          'SELECT * FROM crops ORDER BY name, variety'
        ).all();

        return json({items:results||[]});
      }

      if(method==='POST') {
        const b = await body(request);

        if(!b.name)
          return json({error:'Nama komoditas wajib diisi.'},400);

        await env.DB.prepare(
          'INSERT INTO crops (name,variety,description,status) VALUES (?,?,?,?)'
        ).bind(
          String(b.name).slice(0,80),
          String(b.variety||'').slice(0,100),
          String(b.description||'').slice(0,5000),
          b.status==='published'?'published':'draft'
        ).run();

        return json({ok:true},201);
      }

      if(id&&method==='PUT') {
        const b = await body(request);

        await env.DB.prepare(
          'UPDATE crops SET name=?,variety=?,description=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
        ).bind(
          String(b.name||'').slice(0,80),
          String(b.variety||'').slice(0,100),
          String(b.description||'').slice(0,5000),
          b.status==='published'?'published':'draft',
          Number(id)
        ).run();

        return json({ok:true});
      }

      if(id&&method==='DELETE') {
        await env.DB.prepare(
          'DELETE FROM crops WHERE id=?'
        ).bind(Number(id)).run();

        return json({ok:true});
      }
    }

    if(resource==='news') {
      if(method==='GET') {
        const isAdmin = await valid(request,env);

        const query = isAdmin
          ? "SELECT * FROM news ORDER BY date DESC,id DESC LIMIT 100"
          : "SELECT * FROM news WHERE status='published' ORDER BY date DESC,id DESC LIMIT 50";

        const {results} = await env.DB.prepare(query).all();

        return json({items:results||[]});
      }

      if(method==='POST') {
        const b = await body(request);

        if(!b.title||!b.summary||!b.date)
          return json({
            error:'Judul, ringkasan, dan tanggal wajib diisi.'
          },400);

        await env.DB.prepare(
          'INSERT INTO news (title,summary,date,status) VALUES (?,?,?,?)'
        ).bind(
          String(b.title).slice(0,180),
          String(b.summary).slice(0,2000),
          b.date,
          b.status==='published'?'published':'draft'
        ).run();

        return json({ok:true},201);
      }

      if(id&&method==='PUT') {
        const b = await body(request);

        await env.DB.prepare(
          'UPDATE news SET title=?,summary=?,date=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
        ).bind(
          String(b.title||'').slice(0,180),
          String(b.summary||'').slice(0,2000),
          b.date,
          b.status==='published'?'published':'draft',
          Number(id)
        ).run();

        return json({ok:true});
      }

      if(id&&method==='DELETE') {
        await env.DB.prepare(
          'DELETE FROM news WHERE id=?'
        ).bind(Number(id)).run();

        return json({ok:true});
      }
    }

    if(resource==='stats'&&method==='GET') {
      const {results} = await env.DB.prepare(
        'SELECT commodity,price,unit,date,location,source FROM prices ORDER BY date ASC,id ASC LIMIT 2000'
      ).all();

      return json({history:results||[]});
    }

    return json({error:'Endpoint tidak ditemukan.'},404);

  } catch(e) {
    return json({
      error:'Kesalahan server saat mengakses database.'
    },500);
  }
}
