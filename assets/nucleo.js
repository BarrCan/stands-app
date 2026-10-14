'use strict';
/* Piezas básicas compartidas: paletas, utilidades, formato y tema. */
const PRESETS = {
  taller:   { nombre:'Taller',   desc:'Grafito y naranja de seguridad',
              vars:{'--bg':'#EDEFF1','--surface':'#FFFFFF','--ink':'#1C2228','--muted':'#566170','--line':'#D5DAE0','--accent':'#C2410C','--accent-ink':'#FFFFFF','--accent2':'#B98A52'} },
  plano:    { nombre:'Plano',    desc:'Azul de plano técnico',
              vars:{'--bg':'#EEF3F8','--surface':'#FFFFFF','--ink':'#0A2342','--muted':'#4F6179','--line':'#CBD7E5','--accent':'#1A5FD0','--accent-ink':'#FFFFFF','--accent2':'#7FA6D6'} },
  pabellon: { nombre:'Pabellón', desc:'Verde azulado y ámbar',
              vars:{'--bg':'#EFF3F2','--surface':'#FFFFFF','--ink':'#12302F','--muted':'#4D6B69','--line':'#CFDBD9','--accent':'#0B7A6F','--accent-ink':'#FFFFFF','--accent2':'#E3A82B'} }
};

const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iniciales = n => (String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('') || '?').toUpperCase();
const fechaMX = iso => iso ? new Date(iso).toLocaleDateString('es-MX',{timeZone:ZONA,day:'numeric',month:'short',year:'numeric'}) : '';
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('on'),2600); }
function errMsg(e){
  const m = (e && (e.message||e.error_description)) || String(e||'Error desconocido');
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene cuenta. Entra con tu contraseña.';
  if (/Email not confirmed/i.test(m)) return 'Confirma tu correo (revisa tu bandeja) y vuelve a entrar.';
  if (/at least 6|Password should/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/duplicate key|23505/i.test(m)) return 'Ya existe un registro con ese nombre.';
  if (/violates foreign key|23503/i.test(m)) return 'Tiene información ligada (presupuestos o stands); no se puede borrar.';
  if (/row-level security|permission denied/i.test(m)) return 'Tu rol no permite esta acción.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  return m;
}

/* Contraste de color (para que el texto sobre el acento se lea siempre) */
function lum(hex){ const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }
function contraste(a,b){ const x=lum(a),y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
function tintaSobre(hex){ return contraste(hex,'#FFFFFF') >= contraste(hex,'#14181C') ? '#FFFFFF' : '#14181C'; }

function aplicarTema(t){
  t = t || {};
  const p = PRESETS[t.preset] || PRESETS.taller;
  const v = {...p.vars};
  if (t.acento && /^#[0-9a-f]{6}$/i.test(t.acento)) { v['--accent']=t.acento; v['--accent-ink']=tintaSobre(t.acento); }
  const st = document.documentElement.style;
  Object.entries(v).forEach(([k,val]) => st.setProperty(k,val));
  $('#meta-theme').setAttribute('content', v['--ink']);
  try { localStorage.setItem('stands_tema', JSON.stringify(t)); } catch(_){}
}
try { aplicarTema(JSON.parse(localStorage.getItem('stands_tema')||'{}')); } catch(_){ aplicarTema({}); }

/* Formato de dinero y tiempo (compartido) */
const MXN = n => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('es-MX', { style:'currency', currency:'MXN' });
const fmtMin = m => { if (m === null || m === undefined) return 'sin dato'; m = Number(m); const h = Math.floor(m/60), r = m % 60; return h && r ? `${h} h ${r} min` : h ? `${h} h` : `${r} min`; };
