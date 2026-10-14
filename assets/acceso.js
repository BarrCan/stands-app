'use strict';
/* Página de entrada: acceso, alta de cuenta y alta de empresa. */
function pintarAcceso(){
  const entrar = S.modo === 'entrar';
  $('#app').innerHTML = `
  <div class="auth">
    ${marca(44,'var(--accent)','var(--muted)')}
    <h1>Stands</h1>
    <p class="lead">Clientes, fabricación y montaje de tus stands, desde el celular.</p>
    <div class="seg" role="group" aria-label="Modo">
      <button type="button" data-m="entrar" aria-pressed="${entrar}">Entrar</button>
      <button type="button" data-m="crear" aria-pressed="${!entrar}">Crear cuenta</button>
    </div>
    <div class="field"><label for="a-mail">Correo</label><input id="a-mail" type="email" autocomplete="email" inputmode="email"></div>
    <div class="field"><label for="a-pass">Contraseña</label><input id="a-pass" type="password" autocomplete="${entrar?'current-password':'new-password'}"><div class="hint">${entrar?'':'Mínimo 6 caracteres.'}</div></div>
    <button class="btn block" id="a-go">${entrar?'Entrar':'Crear cuenta'}</button>
    <p class="err" id="a-err" role="alert"></p>
  </div>`;
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { S.modo = b.dataset.m; pintarAcceso(); });
  $('#a-go').onclick = enviarAcceso;
  $('#a-pass').addEventListener('keydown', e => { if (e.key==='Enter') enviarAcceso(); });
}

async function enviarAcceso(){
  const email = $('#a-mail').value.trim(), password = $('#a-pass').value, err = $('#a-err'), btn = $('#a-go');
  err.textContent = '';
  if (!email || !password) { err.textContent = 'Escribe tu correo y tu contraseña.'; return; }
  btn.disabled = true;
  try {
    if (S.modo === 'entrar') {
      const { data, error } = await S.sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      S.user = data.user; await entrarAlSitio();
    } else {
      const { data, error } = await S.sb.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) { S.user = data.user; await entrarAlSitio(); }
      else { $('#app').innerHTML = `<div class="auth"><h1>Revisa tu correo</h1><p class="lead">Te enviamos un enlace para confirmar tu cuenta. Después de confirmarlo, entra aquí con tu correo y contraseña.</p><button class="btn block" id="v">Volver a entrar</button></div>`; $('#v').onclick = () => { S.modo='entrar'; pintarAcceso(); }; }
    }
  } catch(e){ err.textContent = errMsg(e); btn.disabled = false; }
}

function pintarCrearEmpresa(){
  $('#app').innerHTML = `
  <div class="auth">
    ${marca(44,'var(--accent)','var(--muted)')}
    <h1>Tu empresa</h1>
    <p class="lead">Escribe el nombre con el que quieres identificar tu taller o empresa. Lo puedes cambiar después.</p>
    <div class="field"><label for="e-nom">Nombre de la empresa</label><input id="e-nom" type="text" autocomplete="organization"></div>
    <button class="btn block" id="e-go">Crear empresa</button>
    <p class="err" id="e-err" role="alert"></p>
    <button class="btn plain block" id="e-out" style="margin-top:10px">Cerrar sesión</button>
  </div>`;
  $('#e-out').onclick = cerrarSesion;
  $('#e-go').onclick = async () => {
    const nombre = $('#e-nom').value.trim(), err = $('#e-err'), btn = $('#e-go');
    if (!nombre) { err.textContent = 'Escribe el nombre de la empresa.'; return; }
    btn.disabled = true; err.textContent = '';
    const { error } = await S.sb.rpc('crear_empresa', { p_nombre: nombre });
    if (error) { err.textContent = errMsg(error); btn.disabled = false; return; }
    location.replace('clientes.html');
  };
}


async function entrarAlSitio(){
  const { data:perfil, error } = await S.sb.from('perfiles').select('id').eq('id', S.user.id).maybeSingle();
  if (error) { toast(errMsg(error)); return; }
  if (perfil) location.replace('clientes.html'); else pintarCrearEmpresa();
}

async function iniciarAcceso(){
  if (!conectar()) return;
  const { data } = await S.sb.auth.getSession();
  if (data.session) { S.user = data.session.user; await entrarAlSitio(); } else pintarAcceso();
}
document.addEventListener('DOMContentLoaded', iniciarAcceso);
