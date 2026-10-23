'use strict';
/* Módulo Usuarios y accesos (solo administradores): invitar por correo, ver quién tiene acceso y cambiar o desactivar.
   El administrador supremo es el único que invita o cambia a otros administradores. Todo cambio pide motivo. */
const U = { perfiles:[], invitaciones:[] };
const ROLES = { admin:'Administrador', operador:'Operador', lectura:'Lectura' };
const DESC_ROL = {
  admin:'Ve costos, personal y utilidad, e invita o administra usuarios.',
  operador:'Captura clientes y cotizaciones. No ve costos, personal ni dinero.',
  lectura:'Solo consulta lo no sensible.'
};
const esSupremo = () => !!(S.perfil && S.perfil.es_superadmin);
const rolesQuePuedoDar = () => esSupremo() ? ['operador', 'lectura', 'admin'] : ['operador', 'lectura'];
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function dibujarUsuarios(){
  $('#vista').innerHTML = '<div class="center">Cargando…</div>';
  const [pe, inv] = await Promise.all([
    S.sb.from('perfiles').select('*').order('creado_en'),
    S.sb.from('invitaciones').select('*').eq('estado', 'pendiente').order('creado_en', { ascending:false })
  ]);
  const fallo = [pe, inv].find(r => r.error);
  if (fallo) { $('#vista').innerHTML = `<div class="empty"><h3>No se pudo cargar</h3><p>${esc(errMsg(fallo.error))}</p><button class="btn" id="us-re">Reintentar</button></div>`; $('#us-re').onclick = dibujarUsuarios; return; }
  U.perfiles = pe.data || []; U.invitaciones = inv.data || [];
  pintarUsuarios();
}

function pintarUsuarios(){
  fab('Invitar usuario', () => formInvitar());
  $('#vista').innerHTML = `
    <a class="volver" href="ajustes.html">← Ajustes</a>
    <h1 class="page-title">Usuarios y accesos</h1>
    <p class="page-sub">Quién puede entrar a tu empresa y qué puede ver. Cada cambio pide un motivo y queda registrado.</p>
    <h2 class="sub">Invitaciones pendientes</h2>
    ${U.invitaciones.length ? '<div class="list">' + U.invitaciones.map(i => `
      <div class="row" style="cursor:default">
        <span class="main"><div class="nm">${esc(i.correo)}</div><div class="ln">${esc(i.nombre || 'Sin nombre')} · ${esc(ROLES[i.rol] || i.rol)}</div></span>
        <button class="btn plain sm" data-cancelar="${esc(i.id)}">Cancelar</button>
      </div>`).join('') + '</div>' : '<p class="hint">No hay invitaciones pendientes. Con el botón + invitas a alguien por su correo.</p>'}
    <h2 class="sub">Usuarios</h2>
    <div class="list">${U.perfiles.map(p => `
      <button class="row ${p.activo ? '' : 'off'}" data-id="${esc(p.id)}">
        <span class="tile">${esc(iniciales(p.nombre || p.correo))}</span>
        <span class="main">
          <div class="nm">${esc(p.nombre || p.correo || 'Sin nombre')}${p.id === S.user.id ? ' (tú)' : ''}</div>
          <div class="ln">${esc(p.correo || '')}</div>
          <span class="chip">${esc(p.es_superadmin ? 'Administrador supremo' : (ROLES[p.rol] || p.rol))}</span>${p.activo ? '' : ' <span class="chip">Desactivado</span>'}
        </span>
      </button>`).join('')}</div>`;
  document.querySelectorAll('[data-cancelar]').forEach(b => b.onclick = () => cancelarInvitacion(U.invitaciones.find(i => i.id === b.dataset.cancelar)));
  document.querySelectorAll('.row[data-id]').forEach(r => r.onclick = () => formUsuario(U.perfiles.find(p => p.id === r.dataset.id)));
}

function formInvitar(){
  const roles = rolesQuePuedoDar();
  abrirHoja(`
    <div class="sheet-head"><h2>Invitar usuario</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <div class="field"><label for="iv-mail">Correo *</label><input id="iv-mail" type="email" autocomplete="off" inputmode="email"><div class="hint">Debe crear su cuenta con este mismo correo.</div></div>
    <div class="field"><label for="iv-nom">Nombre</label><input id="iv-nom" type="text" autocomplete="off"></div>
    <div class="field"><label for="iv-rol">Qué podrá hacer</label><select id="iv-rol">${roles.map(r => `<option value="${r}">${esc(ROLES[r])}</option>`).join('')}</select><div class="hint" id="iv-desc"></div></div>
    ${esSupremo() ? '' : '<p class="hint">Solo el administrador supremo puede invitar a otros administradores.</p>'}
    <p class="err" id="iv-err" role="alert"></p>
    <button class="btn block" id="iv-ok">Invitar</button>`);
  $('#h-x').onclick = cerrarHoja;
  const desc = () => { $('#iv-desc').textContent = DESC_ROL[$('#iv-rol').value]; };
  $('#iv-rol').addEventListener('change', desc); desc();
  $('#iv-ok').onclick = async () => {
    const err = $('#iv-err'); err.textContent = '';
    const correo = $('#iv-mail').value.trim().toLowerCase(), nombre = $('#iv-nom').value.trim() || null, rol = $('#iv-rol').value;
    if (!CORREO_VALIDO.test(correo)) { err.textContent = 'Escribe un correo válido.'; return; }
    $('#iv-ok').disabled = true;
    const { error } = await S.sb.from('invitaciones').insert({ correo, nombre, rol });
    if (error) {
      err.textContent = /uq_invitacion|duplicate key|23505/i.test(error.message || '') ? 'Ese correo ya tiene una invitación pendiente.' : errMsg(error);
      $('#iv-ok').disabled = false; return;
    }
    cerrarHoja(); await dibujarUsuarios(); mensajeInvitacion(correo, nombre);
  };
}

function mensajeInvitacion(correo, nombre){
  const enlace = new URL('index.html', location.href).href;
  const texto = `Hola${nombre ? ' ' + nombre : ''}, te invité a Stands (${S.empresa && S.empresa.nombre ? S.empresa.nombre : 'mi empresa'}). Entra a ${enlace}, elige "Primer acceso" y crea tu cuenta con este correo: ${correo}. Después confirma el correo que te llegará y vuelve a entrar.`;
  abrirHoja(`
    <div class="sheet-head"><h2>Invitación creada</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <p>La app no envía este aviso por sí sola. Mándale este mensaje a la persona:</p>
    <div class="prev" id="iv-msg"></div>
    <button class="btn block" id="iv-copiar">Copiar mensaje</button>
    <button class="btn plain block" id="iv-listo" style="margin-top:10px">Listo</button>`);
  $('#iv-msg').textContent = texto;
  $('#h-x').onclick = cerrarHoja; $('#iv-listo').onclick = cerrarHoja;
  $('#iv-copiar').onclick = async () => {
    try { await navigator.clipboard.writeText(texto); toast('Mensaje copiado'); }
    catch (_) { const r = document.createRange(); r.selectNodeContents($('#iv-msg')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selecciónalo y cópialo'); }
  };
}

async function cancelarInvitacion(inv){
  if (!inv || !confirm(`¿Cancelar la invitación a ${inv.correo}?`)) return;
  const { error } = await S.sb.from('invitaciones').update({ estado:'cancelada', motivo_cambio:'Invitación cancelada por el administrador' }).eq('id', inv.id);
  if (error) { toast(errMsg(error)); return; }
  await dibujarUsuarios(); toast('Invitación cancelada');
}

function formUsuario(p){
  const yo = p.id === S.user.id, bloqueado = p.es_superadmin || yo || (p.rol === 'admin' && !esSupremo());
  const razon = p.es_superadmin ? 'Es el administrador supremo: su cargo y su rol no se pueden cambiar aquí.'
    : yo ? 'Eres tú: no puedes cambiar tu propio rol ni desactivarte.'
    : bloqueado ? 'Solo el administrador supremo cambia o desactiva a un administrador.' : '';
  const opciones = [...new Set([...rolesQuePuedoDar(), p.rol])];
  abrirHoja(`
    <div class="sheet-head"><h2>${esc(p.nombre || p.correo || 'Usuario')}</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <p class="hint" style="margin:-6px 0 14px">${esc(p.correo || '')}</p>
    <div class="field"><label for="us-nom">Nombre</label><input id="us-nom" type="text" autocomplete="off" value="${esc(p.nombre)}"></div>
    <div class="field"><label for="us-rol">Rol</label><select id="us-rol" ${bloqueado ? 'disabled' : ''}>${opciones.map(r => `<option value="${r}" ${p.rol === r ? 'selected' : ''}>${esc(ROLES[r] || r)}</option>`).join('')}</select><div class="hint" id="us-desc"></div></div>
    <label class="chk"><input type="checkbox" id="us-act" ${p.activo ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}> Activo (si lo quitas, pierde el acceso de inmediato)</label>
    ${razon ? `<p class="hint">${esc(razon)}</p>` : ''}
    ${bloqueado ? '' : motivoCampo('us-mot', 'Obligatorio si cambias el rol o el acceso. Queda en el historial.')}
    <p class="err" id="us-err" role="alert"></p>
    <button class="btn block" id="us-ok">Guardar cambios</button>`);
  $('#h-x').onclick = cerrarHoja;
  const desc = () => { $('#us-desc').textContent = DESC_ROL[$('#us-rol').value] || ''; };
  $('#us-rol').addEventListener('change', desc); desc();
  $('#us-ok').onclick = async () => {
    const err = $('#us-err'); err.textContent = '';
    const datos = { nombre: $('#us-nom').value.trim() || null };
    if (!bloqueado) { datos.rol = $('#us-rol').value; datos.activo = $('#us-act').checked; }
    const sensible = !bloqueado && (datos.rol !== p.rol || datos.activo !== p.activo);
    const mot = bloqueado ? '' : $('#us-mot').value.trim();
    if (sensible && mot.length < 5) { err.textContent = 'Cambiaste el rol o el acceso: escribe el motivo (mínimo 5 letras).'; return; }
    if (mot) datos.motivo_cambio = mot;
    $('#us-ok').disabled = true;
    const { error } = await S.sb.from('perfiles').update(datos).eq('id', p.id);
    if (error) { err.textContent = errMsg(error); $('#us-ok').disabled = false; return; }
    cerrarHoja(); await dibujarUsuarios(); toast('Cambios guardados');
  };
}

iniciarPagina({ modulo:'usuarios', soloAdmin:true, dibujar:dibujarUsuarios });
