'use strict';
/* Sesión, conexión y cascarón compartido (encabezado y navegación). Cada página llama a iniciarPagina().
   Para agregar un módulo nuevo: crear su página y su archivo, y sumar una línea a PAGINAS. */
const S = { sb:null, user:null, perfil:null, empresa:null, canales:[], clientes:[], q:'', modo:'entrar' };
const puedeEditar = () => S.perfil && S.perfil.rol !== 'lectura';
const esAdmin = () => S.perfil && S.perfil.rol === 'admin';

const PAGINAS = [
  { k:'clientes', t:'Clientes', icono:'clientes', url:'clientes.html', admin:false },
  { k:'costos',   t:'Costos',   icono:'costos',   url:'costos.html',   admin:true  },
  { k:'ajustes',  t:'Ajustes',  icono:'ajustes',  url:'ajustes.html',  admin:false }
];

function conectar(){
  const app = $('#app');
  if (!window.supabase) { app.innerHTML = '<div class="center">No se pudo cargar la librería de acceso. Revisa tu conexión y recarga.</div>'; return false; }
  if (SUPABASE_KEY.startsWith('PEGA_AQUI')) {
    app.innerHTML = '<div class="auth"><h1>Falta la llave pública</h1><p class="lead">Pega la Publishable key de tu proyecto en la constante SUPABASE_KEY del archivo assets/config.js.</p></div>';
    return false;
  }
  S.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:true, autoRefreshToken:true } });
  return true;
}

/* cfg: { modulo, dibujar, soloAdmin } */
async function iniciarPagina(cfg){
  if (!conectar()) return;
  const { data } = await S.sb.auth.getSession();
  if (!data.session) { location.replace('index.html'); return; }
  S.user = data.session.user;
  S.sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.replace('index.html'); });
  try {
    const { data:perfil, error:e1 } = await S.sb.from('perfiles').select('*').eq('id', S.user.id).maybeSingle();
    if (e1) throw e1;
    if (!perfil) { location.replace('index.html'); return; }
    S.perfil = perfil;
    const emp = await S.sb.from('empresas').select('*').maybeSingle();
    if (emp.error) throw emp.error;
    S.empresa = emp.data;
  } catch(e){
    $('#app').innerHTML = `<div class="auth"><h1>No se pudo cargar</h1><p class="lead">${esc(errMsg(e))}</p><button class="btn block" id="reint">Reintentar</button></div>`;
    $('#reint').onclick = () => iniciarPagina(cfg);
    return;
  }
  if (cfg.soloAdmin && !esAdmin()) { location.replace('clientes.html'); return; }
  aplicarTema(S.empresa && S.empresa.tema);
  pintarShell(cfg.modulo);
  await cfg.dibujar();
}

function pintarShell(modulo){
  const tabs = PAGINAS.filter(p => !p.admin || esAdmin()).map(p =>
    `<a class="tab" href="${p.url}" ${p.k === modulo ? 'aria-current="page"' : ''}>${IC[p.icono]}<span>${p.t}</span></a>`).join('');
  $('#app').innerHTML = `
    <header class="top">${marca(28)}<div style="min-width:0"><div class="name">${esc(S.empresa?.nombre || 'Stands')}</div></div></header>
    <main id="vista"></main>
    <nav class="tabs" aria-label="Secciones">${tabs}</nav>`;
}

async function cerrarSesion(){ await S.sb.auth.signOut(); S.modo = 'entrar'; location.replace('index.html'); }
