const menuButton=document.querySelector('.menu-toggle');
const nav=document.querySelector('.nav');
menuButton?.addEventListener('click',()=>{
  const open=nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded',String(open));
});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded','false');
}));
const rupiah=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number.isFinite(n)?n:0);
function calculate(){
  const val=id=>Math.max(0,Number(document.getElementById(id).value)||0);
  const revenue=val('yield')*val('price');
  const cost=val('seed')+val('fertilizer')+val('labor')+val('other');
  const profit=revenue-cost;
  document.getElementById('revenue').textContent=rupiah(revenue);
  document.getElementById('cost').textContent=rupiah(cost);
  document.getElementById('profit').textContent=rupiah(profit);
  document.getElementById('profit').style.color=profit<0?'#b33b32':'#173f2a';
  document.getElementById('margin').textContent='Margin keuntungan: '+(revenue>0?(profit/revenue*100).toLocaleString('id-ID',{maximumFractionDigits:1}):'0')+'%';
}
document.getElementById('profit-form')?.addEventListener('submit',e=>{e.preventDefault();calculate();});
document.querySelectorAll('#profit-form input').forEach(i=>i.addEventListener('input',calculate));
const year=document.getElementById('year');
if(year) year.textContent=new Date().getFullYear();
calculate();