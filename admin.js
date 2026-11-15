(()=>{
const $=s=>document.querySelector(s),notice=$('#notice');let data={prices:[],crops:[],news:[],history:[]};
async function api(path,opts={}){const r=await fetch('/api/'+path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});let j={};try{j=await r.json()}catch{}if(!r.ok)throw Error(j.error||'Permintaan gagal ('+r.status+')');return j}
function msg(t,bad=false){notice.textContent=t;notice.style.background=bad?'#fbe9e7':'#f0f4e9';notice.style.color=bad?'#9d342c':'#315b3b'}
function showAuthed(on){$('#login-view').classList.toggle('hidden',on);$('#dashboard').classList.toggle('hidden',!on);$('#logout').classList.toggle('hidden',!on)}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function table(items,cols,kind){
  if(!items.length)return '<p class="admin-help">Belum ada data.</p>';
  return '<table class="admin-list"><thead><tr>'+
    cols.map(c=>'<th>'+c[1]+'</th>').join('')+
    '<th>Aksi</th></tr></thead><tbody>'+
    items.map(x=>'<tr>'+
      cols.map(c=>'<td>'+esc(x[c[0]])+'</td>').join('')+
      '<td>'+
      `<button data-edit="${kind}" data-id="${esc(x.id)}">Edit</button> `+
      `<button class="danger" data-delete="${kind}" data-id="${esc(x.id)}">Hapus</button>`+
      '</td></tr>').join('')+
    '</tbody></table>';
}
function chart(canvas,rows){const ctx=canvas.getContext('2d'),w=canvas.width=canvas.clientWidth*devicePixelRatio,h=canvas.height=250*devicePixelRatio,p=36*devicePixelRatio;ctx.clearRect(0,0,w,h);if(!rows.length)return;const v=rows.map(x=>Number(x.price)),lo=Math.min(...v),hi=Math.max(...v);ctx.strokeStyle='#dce6d8';for(let i=0;i<4;i++){let y=p+i*(h-2*p)/3;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}ctx.strokeStyle='#477b43';ctx.lineWidth=3*devicePixelRatio;ctx.beginPath();rows.forEach((x,i)=>{let xx=p+(rows.length===1?0:i*(w-2*p)/(rows.length-1)),yy=h-p-(Number(x.price)-lo)/(hi-lo||1)*(h-2*p);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke()}
async function refresh(){const [p,c,n,s]=await Promise.all([api('prices'),api('crops'),api('news'),api('stats')]);data={prices:p.items||[],crops:c.items||[],news:n.items||[],history:s.history||[]};$('#count-prices').textContent=data.prices.length;$('#count-crops').textContent=data.crops.length;$('#count-news').textContent=data.news.length;$('#price-list').innerHTML=table(data.prices,[['commodity','Komoditas'],['price','Harga Rp'],['date','Tanggal'],['source','Sumber']], 'prices');$('#crop-list').innerHTML=table(data.crops,[['name','Komoditas'],['variety','Varietas'],['status','Status']], 'crops');$('#news-list').innerHTML=table(data.news,[['title','Judul'],['date','Tanggal'],['status','Status']], 'news');const sel=$('#stats-commodity'),names=[...new Set(data.history.map(x=>x.commodity))];sel.innerHTML=names.map(n=>`<option>${esc(n)}</option>`).join('');drawStats();msg('Data berhasil dimuat.');}
function drawStats(){const name=$('#stats-commodity').value,rows=data.history.filter(x=>x.commodity===name).sort((a,b)=>a.date.localeCompare(b.date));$('#stats-empty').classList.toggle('hidden',rows.length>0);chart($('#admin-chart'),rows)}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('login',{method:'POST',body:JSON.stringify({password:$('#password').value})});showAuthed(true);await refresh()}catch(err){msg(err.message,true)}});
$('#logout').addEventListener('click',async()=>{try{await api('logout',{method:'POST'})}catch{}showAuthed(false);msg('Anda telah keluar.')});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('hidden',x.id!=='tab-'+b.dataset.tab));if(b.dataset.tab==='stats')drawStats()}));$('#stats-commodity').addEventListener('change',drawStats);
function formObj(form){
  return Object.fromEntries(new FormData(form).entries());
}

const f=kind==='prices'?$('#price-form'):$('#'+kind+'-form');
if(!priceForm.elements.id){
  const hiddenId=document.createElement('input');
  hiddenId.type='hidden';
  hiddenId.name='id';
  priceForm.appendChild(hiddenId);
}
$('#price-form').date.value=new Date().toISOString().slice(0,10);
$('#price-form').addEventListener('submit',async e=>{
  e.preventDefault();

  const form=e.target;
  const data=formObj(form);
  const id=data.id;
  delete data.id;

  try{
    await api('prices'+(id?'/'+id:''),{
      method:id?'PUT':'POST',
      body:JSON.stringify(data)
    });

    form.reset();
    form.elements.id.value='';
    form.date.value=new Date().toISOString().slice(0,10);

    await refresh();

    msg(id?'Harga berhasil diperbarui.':'Riwayat harga berhasil disimpan.');
  }catch(err){
    msg(err.message,true);
  }
});
['crop','news'].forEach(k=>{$('#'+k+'-form').addEventListener('submit',async e=>{e.preventDefault();let o=formObj(e.target),id=o.id;delete o.id;try{await api(k+(id?'/'+id:''),{method:id?'PUT':'POST',body:JSON.stringify(o)});e.target.reset();await refresh();msg('Data berhasil disimpan.')}catch(err){msg(err.message,true)}})});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-delete],[data-edit]');if(!b)return;const kind=b.dataset.delete||b.dataset.edit,id=b.dataset.id,items=data[kind],item=items.find(x=>String(x.id)===id);if(b.dataset.delete){if(!confirm('Hapus data ini?'))return;try{await api(kind+'/'+id,{method:'DELETE'});await refresh();msg('Data dihapus.')}catch(err){msg(err.message,true)}}else if(item){const f=$('#'+kind+'-form');Object.entries(item).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v});f.scrollIntoView({behavior:'smooth'})}});
(async()=>{try{await api('me');showAuthed(true);await refresh()}catch(e){showAuthed(false);msg('Silakan masuk untuk mengelola website.')}})();
})();
