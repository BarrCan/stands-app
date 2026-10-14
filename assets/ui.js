'use strict';
/* Piezas de interfaz compartidas: íconos, marca, hoja inferior y botón flotante. */
const IC = {
  mas:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  lupa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  clientes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.9c1.7.7 2.8 2.3 3.1 5.1"/></svg>',
  costos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
  ajustes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.3"/><circle cx="8" cy="17" r="2.3"/></svg>'
};
/* Marca: 3×3 módulos (el stand base de 3 × 3 m) con la esquina rellena */
function marca(size=28, colorRelleno='var(--accent)', colorLinea='rgba(255,255,255,.55)'){
  let g=''; for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    const lleno = (i===0||j===0);
    g += `<rect x="${1+j*8}" y="${1+i*8}" width="7" height="7" rx="1" ${lleno?`fill="${colorRelleno}"`:`fill="none" stroke="${colorLinea}" stroke-width="1.2"`}/>`;
  }
  return `<svg viewBox="0 0 26 26" width="${size}" height="${size}" aria-hidden="true">${g}</svg>`;
}

let _foco = null;
function abrirHoja(html){
  _foco = document.activeElement;
  $('#layer').innerHTML = `<div class="veil" id="veil"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  $('#veil').onclick = cerrarHoja;
  document.body.style.overflow = 'hidden';
  const p = $('#layer input:not([type=hidden]), #layer select'); if (p) setTimeout(() => p.focus({preventScroll:true}), 30);
}
function cerrarHoja(){
  $('#layer').innerHTML = ''; document.body.style.overflow = '';
  if (_foco && _foco.focus) try { _foco.focus({preventScroll:true}); } catch(_){}
}
document.addEventListener('keydown', e => { if (e.key==='Escape' && $('#layer').innerHTML) cerrarHoja(); });

/* Botón flotante de acción (+) */
function fab(texto, fn){
  document.querySelectorAll('.fab').forEach(f => f.remove());
  const f = document.createElement('button'); f.className = 'fab'; f.setAttribute('aria-label', texto); f.innerHTML = IC.mas; f.onclick = fn; document.body.appendChild(f);
}
