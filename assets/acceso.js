'use strict';
/* Página de entrada: entrar, primer acceso (con invitación), recuperar contraseña y estados sin acceso.
   Ya no se crean empresas desde aquí: a una persona nueva la ubica la invitación que le hizo un administrador. */
const CLAVE_MIN = 8;

function pintarAcceso(){
  const entrar = S.modo === 'entrar';
  $('#app').innerHTML = `
  <div class="auth">
    ${marca(44,'var(--accent)','var(--muted)')}
    <h1>Stands</h1>
    <p class="lead">Clientes, fabricación y montaje de tus stands, desde el celular.</p>
    <div class="seg" role="group" aria-label="Modo">
      <button type="button" data-m="entrar" aria-pressed="${entrar}">Entrar</button>
      <button type="button" data-m="crear" aria-pressed="${!entrar}">Primer acceso</button>
    </div>
    ${entrar ? '' : '<div class="note">Si un administrador te invitó, crea aquí tu cuenta con <b>el mismo correo</b> en el que te invitó. Sin invitación no podrás entrar.</div>'}
    <div class="field"><label for="a-mail">Correo</label><input id="a-mail" type="email" autocomplete="email" inputmode="email"></div>
    <div class="field"><label for="a-pass">Contraseña</label><input id="a-pass" type="password" autocomplete="${entrar ? 'current-password' : 'new-password'}">${entrar ? '' : `<div class="hint">Mínimo ${CLAVE_MIN} caracteres.</div>`}</div>
    ${entrar ? '' : '<div class="field"><label for="a-pass2">Repite la contraseña</label><input id="a-pass2" type="password" autocomplete="new-password"></div>'}
    <button class="btn block" id="a-go">${entrar ? 'Entrar' : 'Crear mi cuenta'}</button>
    <p class="err" id="a-err" role="alert"></p>
    ${entrar ? '<button class="btn plain block" id="a-olvide" type="button">Olvidé mi contraseña</button>' : ''}
  </div>`;
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { S.modo = b.dataset.m; pintarAcceso(); });
  $('#a-go').onclick = enviarAcceso;
  const ultimo = entrar ? '#a-pass' : '#a-pass2';
  $(ultimo).addEventListener('keydown', e => { if (e.key === 'Enter') enviarAcceso(); });
  const ol = $('#a-olvide'); if (ol) ol.onclick = pintarRecuperar;
}

async function enviarAcceso(){
  const email = $('#a-mail').value.trim().toLowerCase(), password = $('#a-pass').value, err = $('#a-err'), btn = $('#a-go');
  err.textContent = '';
  if (!email || !password) { err.textContent = 'Escribe tu correo y tu contraseña.'; return; }
  if (S.modo === 'crear') {
    if (password.length < CLAVE_MIN) { err.textContent = `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`; return; }
    if (password !== $('#a-pass2').value) { err.textContent = 'Las contraseñas no coinciden.'; return; }
  }
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
      else pintarRevisaCorreo();
    }
  } catch (e) { err.textContent = errMsg(e); btn.disabled = false; }
}

function pintarRevisaCorreo(){
  $('#app').innerHTML = `<div class="auth"><h1>Revisa tu correo</h1><p class="lead">Te enviamos un enlace para confirmar tu cuenta. Ábrelo y después regresa aquí a <b>Entrar</b> con tu correo y contraseña. Revisa también la carpeta de spam.</p><button class="btn block" id="v">Ir a Entrar</button></div>`;
  $('#v').onclick = () => { S.modo = 'entrar'; pintarAcceso(); };
}

/* Quien inicia sesión pero no tiene lugar en ninguna empresa, o fue desactivado */
function pintarSinAcceso(mensaje){
  $('#app').innerHTML = `
  <div class="auth">
    ${marca(44,'var(--accent)','var(--muted)')}
    <h1>Sin acceso</h1>
    <p class="lead" id="sa-msg"></p>
    <button class="btn block" id="sa-re">Reintentar</button>
    <button class="btn plain block" id="sa-out" style="margin-top:10px">Cerrar sesión</button>
  </div>`;
  $('#sa-msg').textContent = mensaje;
  $('#sa-re').onclick = entrarAlSitio;
  $('#sa-out').onclick = cerrarSesion;
}

async function entrarAlSitio(){
  const { data:perfil, error } = await S.sb.from('perfiles').select('id,activo').eq('id', S.user.id).maybeSingle();
  if (error) { pintarSinAcceso(errMsg(error)); return; }
  if (perfil) {
    if (!perfil.activo) { pintarSinAcceso('Tu acceso está desactivado. Habla con el administrador de tu empresa.'); return; }
    location.replace('clientes.html'); return;
  }
  const r = await S.sb.rpc('unirse_por_invitacion');   // ubica a la persona si la invitaron con este correo
  if (r.error) { pintarSinAcceso(/invitaci/i.test(r.error.message || '') ? 'Este correo no tiene invitación. Pide a un administrador que te invite con este mismo correo y vuelve a entrar.' : errMsg(r.error)); return; }
  location.replace('clientes.html');
}

/* ── Recuperar contraseña ── */
function pintarRecuperar(){
  $('#app').innerHTML = `
  <div class="auth">
    ${marca(44,'var(--accent)','var(--muted)')}
    <h1>Recuperar contraseña</h1>
    <p class="lead">Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.</p>
    <div class="field"><label for="r-mail">Correo</label><input id="r-mail" type="email" autocomplete="email" inputmode="email"></div>
    <button class="btn block" id="r-go">Enviar enlace</button>
    <p class="err" id="r-err" role="alert"></p>
    <p class="hint" id="r-ok"></p>
    <button class="btn plain block" id="r-volver" style="margin-top:10px">Volver</button>
  </div>`;
  $('#r-volver').onclick = pintarAcceso;
  $('#r-go').onclick = async () => {
    const email = $('#r-mail').value.trim().toLowerCase(); $('#r-err').textContent = ''; $('#r-ok').textContent = '';
    if (!email) { $('#r-err').textContent = 'Escribe tu correo.'; return; }
    $('#r-go').disabled = true;
    const { error } = await S.sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('index.html', location.href).href });
    $('#r-go').disabled = false;
    if (error) { $('#r-err').textContent = errMsg(error); return; }
    $('#r-ok').textContent = 'Si ese correo tiene cuenta, te llegará un enlace en unos minutos. Revisa también el spam.';   // misma respuesta exista o no
  };
}

function pintarNuevaClave(){
  $('#app').innerHTML = `
  <div class="auth">
    ${marca(44,'var(--accent)','var(--muted)')}
    <h1>Nueva contraseña</h1>
    <p class="lead">Elige una contraseña nueva para tu cuenta.</p>
    <div class="field"><label for="n-pass">Contraseña nueva</label><input id="n-pass" type="password" autocomplete="new-password"><div class="hint">Mínimo ${CLAVE_MIN} caracteres.</div></div>
    <div class="field"><label for="n-pass2">Repite la contraseña</label><input id="n-pass2" type="password" autocomplete="new-password"></div>
    <button class="btn block" id="n-go">Guardar contraseña</button>
    <p class="err" id="n-err" role="alert"></p>
  </div>`;
  $('#n-go').onclick = async () => {
    const p1 = $('#n-pass').value, err = $('#n-err'); err.textContent = '';
    if (p1.length < CLAVE_MIN) { err.textContent = `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`; return; }
    if (p1 !== $('#n-pass2').value) { err.textContent = 'Las contraseñas no coinciden.'; return; }
    $('#n-go').disabled = true;
    const { error } = await S.sb.auth.updateUser({ password: p1 });
    if (error) { err.textContent = errMsg(error); $('#n-go').disabled = false; return; }
    history.replaceState(null, '', location.pathname);
    S.recuperando = false;
    const { data } = await S.sb.auth.getSession();
    if (data.session) { S.user = data.session.user; await entrarAlSitio(); } else pintarAcceso();
  };
}

async function iniciarAcceso(){
  if (!conectar()) return;
  S.recuperando = /type=recovery/.test(location.hash);
  S.sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { S.recuperando = true; pintarNuevaClave(); } });
  const { data } = await S.sb.auth.getSession();
  if (S.recuperando) { pintarNuevaClave(); return; }
  if (data.session) { S.user = data.session.user; await entrarAlSitio(); } else pintarAcceso();
}
document.addEventListener('DOMContentLoaded', iniciarAcceso);
