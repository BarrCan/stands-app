'use strict';
/* Módulo Clientes: lista, alta y edición, con canal de origen. */
const nombreCanal = id => (S.canales.find(c => c.id===id) || {}).nombre || '';

function pintarClientes(){
  const v = $('#vista');
  v.innerHTML = `
    <h1 class="page-title">Clientes</h1>
    <p class="page-sub">Quién te contrata y de dónde llegó.</p>
    <div class="search">${IC.lupa}<input type="search" id="c-q" placeholder="Buscar cliente" value="${esc(S.q)}" aria-label="Buscar clientes"></div>
    <div id="c-lista"></div>
    ${esAdmin() ? '<button class="btn plain block" id="c-export" style="margin-top:14px">Exportar clientes a Excel</button>' : ''}`;
  $('#c-q').addEventListener('input', e => { S.q = e.target.value; listaClientes(); });
  if (puedeEditar()) fab('Nuevo cliente', () => formCliente(null));
  const ex = $('#c-export'); if (ex) ex.onclick = exportarClientes;
  listaClientes();
}

function listaClientes(){
  const q = S.q.trim().toLowerCase();
  const items = S.clientes.filter(c => !q || [c.nombre,c.empresa_cliente,c.telefono,c.correo,nombreCanal(c.canal_id)].some(x => String(x||'').toLowerCase().includes(q)));
  const box = $('#c-lista');
  if (!S.clientes.length) {
    box.innerHTML = `<div class="empty"><h3>Aún no hay clientes</h3><p>Registra al primero y anota de qué canal llegó.</p>${puedeEditar()?'<button class="btn" id="c-nuevo">Agregar cliente</button>':''}</div>`;
    const b = $('#c-nuevo'); if (b) b.onclick = () => formCliente(null);
    return;
  }
  if (!items.length) { box.innerHTML = '<div class="empty"><h3>Sin resultados</h3><p>Prueba con otro nombre o canal.</p></div>'; return; }
  box.innerHTML = `<p class="count">${items.length} de ${S.clientes.length}</p><div class="list">` + items.map(c => `
    <button class="row" data-id="${esc(c.id)}">
      <span class="tile">${esc(iniciales(c.nombre))}</span>
      <span class="main">
        <div class="nm">${esc(c.nombre)}</div>
        <div class="ln">${esc([c.empresa_cliente,c.cargo].filter(Boolean).join(' · ') || c.telefono || 'Sin más datos')}</div>
        ${nombreCanal(c.canal_id)?`<span class="chip">${esc(nombreCanal(c.canal_id))}</span>`:''}
      </span>
    </button>`).join('') + '</div>';
  box.querySelectorAll('.row').forEach(r => r.onclick = () => formCliente(S.clientes.find(c => c.id===r.dataset.id)));
}

function opcionesCanal(sel){
  const act = S.canales.filter(c => c.activo || c.id===sel);
  return '<option value="">Elige un canal…</option>' + act.map(c => `<option value="${esc(c.id)}" ${c.id===sel?'selected':''}>${esc(c.nombre)}${c.activo?'':' (inactivo)'}</option>`).join('') + (puedeEditar()?'<option value="__nuevo">＋ Agregar otro canal…</option>':'');
}

function formCliente(c){
  const edit = !!c, ro = !puedeEditar();
  const can = 'contacts' in navigator && 'ContactsManager' in window;
  abrirHoja(`
    <div class="sheet-head"><h2>${edit?'Cliente':'Nuevo cliente'}</h2><button class="x" aria-label="Cerrar" id="h-x">✕</button></div>
    ${can && !ro ? '<button class="btn ghost block sm" id="f-contactos" style="margin-bottom:14px">Importar de mis contactos</button>' : ''}
    <div class="field"><label for="f-canal">¿De dónde llegó? *</label><select id="f-canal" ${ro?'disabled':''}>${opcionesCanal(c?.canal_id)}</select>
      <div id="f-canal-nuevo" hidden class="inline-new"><input type="text" id="f-canal-txt" placeholder="Nombre del canal" aria-label="Nombre del nuevo canal"><button class="btn sm" id="f-canal-ok" type="button">Agregar</button></div></div>
    <div class="field"><label for="f-nombre">Nombre *</label><input type="text" id="f-nombre" value="${esc(c?.nombre)}" autocomplete="off" ${ro?'disabled':''}></div>
    <div class="field"><label for="f-tel">Teléfono</label><input type="tel" id="f-tel" value="${esc(c?.telefono)}" inputmode="tel" ${ro?'disabled':''}></div>
    <div class="field"><label for="f-mail">Correo</label><input type="email" id="f-mail" value="${esc(c?.correo)}" inputmode="email" ${ro?'disabled':''}></div>
    <div class="field"><label for="f-emp">Empresa del cliente</label><input type="text" id="f-emp" value="${esc(c?.empresa_cliente)}" ${ro?'disabled':''}></div>
    <div class="field"><label for="f-cargo">Cargo</label><input type="text" id="f-cargo" value="${esc(c?.cargo)}" ${ro?'disabled':''}></div>
    <div class="field"><label for="f-dir">Dirección</label><input type="text" id="f-dir" value="${esc(c?.direccion)}" ${ro?'disabled':''}></div>
    <div class="field"><label for="f-notas">Notas</label><textarea id="f-notas" ${ro?'disabled':''}>${esc(c?.notas)}</textarea></div>
    <p class="err" id="f-err" role="alert"></p>
    ${ro ? '' : `<button class="btn block" id="f-ok">${edit?'Guardar cambios':'Guardar cliente'}</button>`}
    ${edit && !ro && esAdmin() ? '<button class="btn danger block" id="f-del" style="margin-top:10px">Eliminar cliente</button>' : ''}
  `);
  $('#h-x').onclick = cerrarHoja;
  const selC = $('#f-canal');
  selC.onchange = () => {
    const nuevo = selC.value === '__nuevo';
    $('#f-canal-nuevo').hidden = !nuevo;
    if (nuevo) $('#f-canal-txt').focus();
  };
  const okC = $('#f-canal-ok');
  if (okC) okC.onclick = async () => {
    const nombre = $('#f-canal-txt').value.trim();
    if (!nombre) return;
    const dup = S.canales.find(x => x.nombre.toLowerCase()===nombre.toLowerCase());
    if (dup) { selC.innerHTML = opcionesCanal(dup.id); $('#f-canal-nuevo').hidden = true; if(!dup.activo) toast('Ese canal estaba inactivo; actívalo en Ajustes.'); return; }
    const orden = (S.canales.reduce((m,x)=>Math.max(m,x.orden),0)) + 1;
    const { data, error } = await S.sb.from('canales_origen').insert({ nombre, orden }).select().single();
    if (error) { $('#f-err').textContent = errMsg(error); return; }
    S.canales.push(data); selC.innerHTML = opcionesCanal(data.id); $('#f-canal-nuevo').hidden = true; toast('Canal agregado');
  };
  const bc = $('#f-contactos');
  if (bc) bc.onclick = async () => {
    try {
      const r = await navigator.contacts.select(['name','tel','email'], { multiple:false });
      if (r && r[0]) { const p = r[0];
        if (p.name && p.name[0]) $('#f-nombre').value = p.name[0];
        if (p.tel && p.tel[0]) $('#f-tel').value = p.tel[0];
        if (p.email && p.email[0]) $('#f-mail').value = p.email[0]; }
    } catch(_){ /* el usuario canceló */ }
  };
  const ok = $('#f-ok'); if (ok) ok.onclick = () => guardarCliente(c);
  const del = $('#f-del'); if (del) del.onclick = () => borrarCliente(c);
}

async function guardarCliente(c){
  const v = id => $(id).value.trim() || null;
  const err = $('#f-err'); err.textContent = '';
  const canal_id = $('#f-canal').value;
  const nombre = $('#f-nombre').value.trim();
  if (!canal_id || canal_id==='__nuevo') { err.textContent = 'Elige de dónde llegó el cliente.'; return; }
  if (!nombre) { err.textContent = 'Escribe el nombre del cliente.'; return; }
  const datos = { nombre, canal_id, telefono:v('#f-tel'), correo:v('#f-mail'), empresa_cliente:v('#f-emp'), cargo:v('#f-cargo'), direccion:v('#f-dir'), notas:v('#f-notas') };
  const btn = $('#f-ok'); btn.disabled = true;
  const q = c ? S.sb.from('clientes').update(datos).eq('id', c.id).select().single() : S.sb.from('clientes').insert(datos).select().single();
  const { data, error } = await q;
  if (error) { err.textContent = errMsg(error); btn.disabled = false; return; }
  if (c) S.clientes = S.clientes.map(x => x.id===c.id ? data : x); else S.clientes.unshift(data);
  cerrarHoja(); listaClientes(); toast(c ? 'Cambios guardados' : 'Cliente guardado');
}

async function borrarCliente(c){
  if (!confirm(`¿Eliminar a ${c.nombre}? Esta acción no se puede deshacer.`)) return;
  const { error } = await S.sb.from('clientes').delete().eq('id', c.id);
  if (error) { $('#f-err').textContent = errMsg(error); return; }
  S.clientes = S.clientes.filter(x => x.id !== c.id);
  cerrarHoja(); listaClientes(); toast('Cliente eliminado');
}

/* Exportar a CSV (abre en Excel). Solo administradores. Las celdas que parecen fórmula se neutralizan. */
function celdaCsv(v){
  let t = v === null || v === undefined ? '' : String(v);
  if (/^[=@\t\r]/.test(t) || (/^[+\-]/.test(t) && /[A-Za-z]/.test(t))) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}
function exportarClientes(){
  const enc = ['Fecha de alta', 'Nombre', 'Canal de origen', 'Teléfono', 'Correo', 'Empresa del cliente', 'Cargo', 'Dirección', 'Notas'];
  const filas = S.clientes.map(c => [fechaMX(c.creado_en), c.nombre, nombreCanal(c.canal_id), c.telefono, c.correo, c.empresa_cliente, c.cargo, c.direccion, c.notas]);
  const csv = '\uFEFF' + [enc, ...filas].map(f => f.map(celdaCsv).join(',')).join('\r\n');
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' })); a.download = `clientes-${hoy}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Clientes exportados');
}

async function dibujarClientes(){
  $('#vista').innerHTML = '<div class="center">Cargando…</div>';
  const [can, cli] = await Promise.all([
    S.sb.from('canales_origen').select('*').order('orden').order('nombre'),
    S.sb.from('clientes').select('*').order('creado_en', { ascending:false })
  ]);
  const fallo = [can, cli].find(r => r.error);
  if (fallo) { $('#vista').innerHTML = `<div class="empty"><h3>No se pudieron cargar</h3><p>${esc(errMsg(fallo.error))}</p><button class="btn" id="cl-re">Reintentar</button></div>`; $('#cl-re').onclick = dibujarClientes; return; }
  S.canales = can.data || []; S.clientes = cli.data || [];
  pintarClientes();
}
iniciarPagina({ modulo:'clientes', dibujar:dibujarClientes });
