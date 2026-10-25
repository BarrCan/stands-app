'use strict';
/* Módulo Costos (solo administradores): piezas, tarifas, reglas e historial. */
const ROL_TARIFA = { calificado:'Calificado (corta y arma)', chalan:'Chalán' };
const PARCIAL = { sin_definir:'Sin definir (se muestran ambos costos)', por_horas:'Se paga por horas', dia_completo:'Se paga el día completo' };
const TABLAS = { catalogo_precios:'Precio de pieza', catalogo_conceptos:'Pieza', tarifas_mano_obra:'Tarifa', parametros_costeo:'Reglas de costeo',
  personal:'Persona', jornadas_personal:'Jornada', pagos_personal:'Pago al personal', perfiles:'Usuario', invitaciones:'Invitación' };
const CAMPOS = { costo_material:'Material', minutos_calificado:'Min calificado', minutos_chalan:'Min chalán', pago_dia:'Pago por día',
  jornada_horas:'Jornada (h)', factor_hora_extra:'Factor hora extra', max_horas_extra_dia:'Máx. horas extra', pago_dia_parcial:'Pago día parcial',
  activo:'Activo', nombre:'Nombre', codigo:'Código', rol:'Rol', es_referencia:'Referencia', tipo:'Tipo', unidad:'Unidad', medidas:'Medidas', descripcion:'Descripción',
  costo_material_bajo:'Material (bajo)', costo_material_alto:'Material (para cotizar)', dias_entrega_bajo:'Entrega corta (días)', dias_entrega:'Entrega práctica (días)',
  dias_entrega_alto:'Entrega para cotizar (días)', fuente:'Fuente', grupo:'Grupo',
  monto:'Monto', semana_inicio:'Semana del', fecha_pago:'Fecha de pago', fecha:'Fecha', horas:'Horas', nivel_nombre:'Nivel', referencia:'Referencia',
  anulada:'Anulada', anulado:'Anulado', telefono:'Teléfono', puesto:'Puesto', pago_semanal:'Sueldo semanal', tarifa_id:'Nivel', personal_id:'Persona', correo:'Correo', estado:'Estado' };
const UNI = { pieza:'pieza', m2:'m²', ml:'metro lineal', dia:'día' };
const GRUPOS = { acabado_piso:'Acabado de piso', vinil:'Vinil', letreros:'Letreros y cortes', iluminacion:'Iluminación' };
const uni = u => UNI[u] || u;
const nombreGrupo = g => GRUPOS[g] || (g.charAt(0).toUpperCase() + g.slice(1).replace(/_/g, ' '));
const OCULTOS = new Set(['id','empresa_id','creado_en','actualizado_en','motivo_cambio','nota','concepto_id','vigente_desde','cobra_solo_material_sobre_pieza','registrado_por']);
S.costos = { cargado:false, vigente:[], tarifas:[], params:null, auditoria:[], sub:'piezas', error:null };

async function cargarCostos(){
  const c = S.costos; c.error = null;
  const [v, t, p] = await Promise.all([
    S.sb.from('v_catalogo_vigente').select('*').order('nombre'),
    S.sb.from('tarifas_mano_obra').select('*').order('pago_dia', { ascending:false }),
    S.sb.from('parametros_costeo').select('*').maybeSingle()
  ]);
  for (const r of [v, t, p]) if (r.error) { c.error = errMsg(r.error); return; }
  c.vigente = v.data || []; c.tarifas = t.data || []; c.params = p.data || null;
  if (S.perfil.es_superadmin) {
    const a = await S.sb.from('auditoria_costos').select('*').order('creado_en', { ascending:false }).limit(100);
    if (a.error) { c.error = errMsg(a.error); return; }
    c.auditoria = a.data || [];
    const pe = await S.sb.from('personal').select('id,nombre');   // para mostrar nombres en el historial
    c.personal = pe.error ? [] : (pe.data || []);
  }
  c.cargado = true;
}

async function pintarCostos(){
  $('#vista').innerHTML = '<div class="center">Cargando costos…</div>';
  await cargarCostos();
  dibujarCostos();
}

function dibujarCostos(){
  const c = S.costos, sup = !!S.perfil.es_superadmin;
  document.querySelectorAll('.fab').forEach(f => f.remove());
  if (c.error) {
    $('#vista').innerHTML = `<h1 class="page-title">Costos</h1><div class="empty"><h3>No se pudieron cargar</h3><p>${esc(c.error)}</p><button class="btn" id="co-re">Reintentar</button></div>`;
    $('#co-re').onclick = () => pintarCostos(); return;
  }
  const subs = [['piezas','Piezas'],['tarifas','Tarifas'],['reglas','Reglas']].concat(sup ? [['historial','Historial']] : []);
  if (!subs.some(x => x[0] === c.sub)) c.sub = 'piezas';
  $('#vista').innerHTML = `
    <h1 class="page-title">Costos</h1>
    <p class="page-sub">Todo sin IVA. Cada cambio pide un motivo y queda registrado${sup ? '' : '; solo el administrador supremo lo revisa'}.</p>
    <div class="seg sm" role="group" aria-label="Secciones de costos">${subs.map(([k,t]) => `<button type="button" data-s="${k}" aria-pressed="${c.sub===k}">${t}</button>`).join('')}</div>
    <div id="co-cuerpo"></div>`;
  document.querySelectorAll('.seg button[data-s]').forEach(b => b.onclick = () => { c.sub = b.dataset.s; dibujarCostos(); });
  ({ piezas:vistaPiezas, tarifas:vistaTarifas, reglas:vistaReglas, historial:vistaHistorial })[c.sub]();
}
async function tras(okMsg){ await cargarCostos(); cerrarHoja(); dibujarCostos(); toast(okMsg); }

/* ── Piezas ── */
function vistaPiezas(){
  const c = S.costos, box = $('#co-cuerpo');
  fab('Nueva pieza', () => formPiezaNueva());
  if (!c.vigente.length) { box.innerHTML = '<div class="empty"><h3>Aún no hay piezas</h3><p>Agrega la primera con su costo de material y su tiempo de fabricación.</p><button class="btn" id="co-nueva">Agregar pieza</button></div>'; $('#co-nueva').onclick = () => formPiezaNueva(); return; }
  box.innerHTML = '<div class="list">' + c.vigente.map(p => `
    <button class="row ${p.activo ? '' : 'off'}" data-id="${esc(p.concepto_id)}">
      <span class="main">
        <div class="nm">${esc(p.nombre)}${p.activo ? '' : ' (inactiva)'}</div>
        <div class="ln">${esc(p.codigo)} · por ${esc(uni(p.unidad))}${p.grupo ? ' · ' + esc(nombreGrupo(p.grupo)) : ''}</div>
        <div class="ln wrap">Material ${MXN(p.costo_material)} · ${p.costo_mano_obra !== null ? 'Mano de obra ' + MXN(p.costo_mano_obra) : 'tiempo o tarifa pendiente'}</div>
        ${(p.costo_material_alto != null || p.dias_entrega_alto != null) ? `<div class="ln wrap">Para cotizar: ${p.costo_total_cotizar != null ? MXN(p.costo_total_cotizar) : MXN(p.costo_material_alto)}${p.dias_entrega_alto != null ? ' · entrega ' + p.dias_entrega_alto + ' d' : ''}</div>` : ''}
      </span>
      <span class="precio">${p.costo_total !== null ? MXN(p.costo_total) : '<span class="chip">Sin total</span>'}</span>
    </button>`).join('') + '</div><p class="hint" style="margin-top:10px">El total suma material y mano de obra por horas, con el costo real. "Para cotizar" usa el valor más alto; la diferencia es tu beneficio previsto. El costo por día completo depende de la cuadrilla y se calcula al cotizar.</p>';
  box.querySelectorAll('.row').forEach(r => r.onclick = () => formPieza(c.vigente.find(x => x.concepto_id === r.dataset.id)));
}

/* Campos de cotización y entrega, compartidos por "editar" y "nueva pieza" (x = prefijo de los ids). */
function htmlExtra(x, p){
  const v = k => (p && p[k] != null) ? p[k] : '';
  const n = (id, k, et, ay) => `<div class="field"><label for="${x}-${id}">${et}</label><input id="${x}-${id}" type="number" inputmode="${id === 'alto' || id === 'bajo' ? 'decimal' : 'numeric'}" step="${id === 'alto' || id === 'bajo' ? '0.01' : '1'}" min="0" value="${v(k)}">${ay ? `<div class="hint">${ay}</div>` : ''}</div>`;
  return n('alto', 'costo_material_alto', 'Para cotizar: material más alto (sin IVA)', 'Opcional. Si lo dejas vacío se cotiza con el costo real. Lo que sobra frente al costo real es tu beneficio previsto.')
    + n('bajo', 'costo_material_bajo', 'Material más bajo (solo referencia)', '')
    + n('db', 'dias_entrega_bajo', 'Entrega más corta (días naturales)', '')
    + n('dm', 'dias_entrega', 'Entrega en la práctica (días)', '')
    + n('da', 'dias_entrega_alto', 'Entrega para cotizar: la más larga (días)', 'Es la que se promete al cotizar.')
    + `<div class="field"><label for="${x}-fte">Fuente del precio</label><input id="${x}-fte" type="text" placeholder="Tienda, SKU o proveedor" value="${esc(v('fuente'))}"></div>`;
}
function leerExtra(x, m){
  const alto = num('#' + x + '-alto'), bajo = num('#' + x + '-bajo'), db = num('#' + x + '-db'), dm = num('#' + x + '-dm'), da = num('#' + x + '-da');
  const fte = $('#' + x + '-fte').value.trim() || null;
  if ([alto, bajo].some(z => z !== null && (Number.isNaN(z) || z < 0))) return { error:'Revisa el material para cotizar y el material bajo.' };
  if (alto !== null && alto < m) return { error:'El valor para cotizar no puede ser menor que el costo real.' };
  if (bajo !== null && bajo > m) return { error:'El valor bajo no puede ser mayor que el costo real.' };
  if ([db, dm, da].some(z => z !== null && (Number.isNaN(z) || z < 0 || !Number.isInteger(z)))) return { error:'Los días de entrega deben ser números enteros.' };
  if ((db !== null && dm !== null && db > dm) || (dm !== null && da !== null && dm > da) || (db !== null && da !== null && db > da)) return { error:'Los días van de menor a mayor: corta, práctica y para cotizar.' };
  return { campos:{ costo_material_alto:alto, costo_material_bajo:bajo, dias_entrega_bajo:db, dias_entrega:dm, dias_entrega_alto:da, fuente:fte } };
}

function formPieza(p){
  const hc = p.costo_hora_calificado, hch = p.costo_hora_chalan;
  abrirHoja(`
    <div class="sheet-head"><h2>${esc(p.nombre)}</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <p class="hint" style="margin:-6px 0 14px">${esc(p.codigo)} · por ${esc(uni(p.unidad))}${p.vigente_desde ? ' · precio vigente desde ' + esc(p.vigente_desde) : ''}</p>
    <div class="field"><label for="p-mat">Costo de material real (sin IVA)</label><input id="p-mat" type="number" inputmode="decimal" step="0.01" min="0" value="${p.costo_material ?? ''}"><div class="hint">Lo que esperas pagar en la práctica.</div></div>
    <div class="field"><label for="p-cal">Minutos de trabajo calificado</label><input id="p-cal" type="number" inputmode="numeric" step="1" min="0" value="${p.minutos_calificado ?? ''}"><div class="hint">Cortar y armar. 60 min = 1 hora.</div></div>
    <div class="field"><label for="p-cha">Minutos de chalán</label><input id="p-cha" type="number" inputmode="numeric" step="1" min="0" value="${p.minutos_chalan ?? ''}"><div class="hint">Lijar, pintar, tareas repetitivas.</div></div>
    ${htmlExtra('p', p)}
    <div class="prev" id="p-prev" aria-live="polite"></div>
    ${motivoCampo('p-mot')}
    <p class="err" id="p-err" role="alert"></p>
    <button class="btn block" id="p-ok">Guardar nuevo costo</button>
    <button class="btn plain block" id="p-act" style="margin-top:10px">${p.activo ? 'Desactivar pieza' : 'Activar pieza'}</button>`);
  $('#h-x').onclick = cerrarHoja;
  const prev = () => {
    const m = num('#p-mat'), a = num('#p-cal'), b = num('#p-cha');
    if (m === null || a === null || b === null || [m,a,b].some(Number.isNaN)) { $('#p-prev').textContent = 'Completa material y minutos para ver el costo.'; return; }
    if (hc == null || hch == null) { $('#p-prev').textContent = 'Define las tarifas de referencia (calificado y chalán) para ver el costo total.'; return; }
    const mo = a/60*hc + b/60*hch, alto = num('#p-alto');
    let t = 'Costo calculado: ' + MXN(m + mo) + ' (material ' + MXN(m) + ' + mano de obra ' + MXN(mo) + ')';
    if (alto !== null && !Number.isNaN(alto) && alto >= m) t += '. Para cotizar: ' + MXN(alto + mo) + '. Beneficio previsto por ' + uni(p.unidad) + ': ' + MXN(alto - m) + '.';
    $('#p-prev').textContent = t;
  };
  ['#p-mat','#p-cal','#p-cha','#p-alto'].forEach(i => $(i).addEventListener('input', prev)); prev();
  $('#p-ok').onclick = async () => {
    const err = $('#p-err'); err.textContent = '';
    const m = num('#p-mat'), a = num('#p-cal'), b = num('#p-cha'), mot = $('#p-mot').value.trim();
    if (m === null || Number.isNaN(m) || m < 0) { err.textContent = 'Escribe el costo de material.'; return; }
    if ([a,b].some(x => x !== null && (Number.isNaN(x) || x < 0 || !Number.isInteger(x)))) { err.textContent = 'Los minutos deben ser números enteros.'; return; }
    const ex = leerExtra('p', m); if (ex.error) { err.textContent = ex.error; return; }
    if (mot.length < 5) { err.textContent = 'Escribe el motivo del cambio (mínimo 5 letras).'; return; }
    $('#p-ok').disabled = true;
    const { error } = await S.sb.from('catalogo_precios').insert({ concepto_id:p.concepto_id, costo_material:m, minutos_calificado:a, minutos_chalan:b, nota:mot, ...ex.campos });
    if (error) { err.textContent = errMsg(error); $('#p-ok').disabled = false; return; }
    await tras('Costo guardado');
  };
  $('#p-act').onclick = async () => {
    const err = $('#p-err'); err.textContent = ''; const mot = $('#p-mot').value.trim();
    if (mot.length < 5) { err.textContent = 'Escribe el motivo (mínimo 5 letras) para ' + (p.activo ? 'desactivar' : 'activar') + ' la pieza.'; return; }
    const { error } = await S.sb.from('catalogo_conceptos').update({ activo: !p.activo, motivo_cambio: mot }).eq('id', p.concepto_id);
    if (error) { err.textContent = errMsg(error); return; }
    await tras(p.activo ? 'Pieza desactivada' : 'Pieza activada');
  };
}

function formPiezaNueva(){
  abrirHoja(`
    <div class="sheet-head"><h2>Nueva pieza</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <div class="field"><label for="n-cod">Código *</label><input id="n-cod" type="text" autocapitalize="characters" placeholder="Ej. MURO-1X2"></div>
    <div class="field"><label for="n-nom">Nombre *</label><input id="n-nom" type="text"></div>
    <div class="field"><label for="n-tipo">Tipo</label><select id="n-tipo"><option value="fabricado">Fabricado</option><option value="especial">Especial (pieza distinta)</option><option value="renta">Renta</option><option value="servicio">Servicio</option></select></div>
    <div class="field"><label for="n-uni">Se cobra por</label><select id="n-uni"><option value="pieza">Pieza</option><option value="m2">Metro cuadrado</option><option value="ml">Metro lineal</option><option value="dia">Día</option></select></div>
    <div class="field"><label for="n-grp">Grupo</label><input id="n-grp" type="text" list="n-grps" placeholder="Ej. vinil, iluminacion" autocomplete="off"><datalist id="n-grps">${[...new Set(S.costos.vigente.map(x => x.grupo).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join('')}</datalist><div class="hint">Opcional. Sirve para agrupar piezas y elegir una entre varias (por ejemplo, el acabado de piso).</div></div>
    <div class="field"><label for="n-med">Medidas</label><input id="n-med" type="text" placeholder="Ej. 1 x 2 m"></div>
    <div class="field"><label for="n-des">Descripción</label><textarea id="n-des"></textarea></div>
    <div class="field"><label for="n-mat">Costo de material real (sin IVA) *</label><input id="n-mat" type="number" inputmode="decimal" step="0.01" min="0"></div>
    <div class="field"><label for="n-cal">Minutos de trabajo calificado</label><input id="n-cal" type="number" inputmode="numeric" step="1" min="0"></div>
    <div class="field"><label for="n-cha">Minutos de chalán</label><input id="n-cha" type="number" inputmode="numeric" step="1" min="0"></div>
    ${htmlExtra('n', null)}
    ${motivoCampo('n-mot')}
    <p class="err" id="n-err" role="alert"></p>
    <button class="btn block" id="n-ok">Agregar pieza</button>`);
  $('#h-x').onclick = cerrarHoja;
  $('#n-ok').onclick = async () => {
    const err = $('#n-err'); err.textContent = '';
    const codigo = $('#n-cod').value.trim().toUpperCase(), nombre = $('#n-nom').value.trim(), mot = $('#n-mot').value.trim();
    const m = num('#n-mat'), a = num('#n-cal'), b = num('#n-cha');
    if (!codigo || !nombre) { err.textContent = 'Escribe el código y el nombre.'; return; }
    if (m === null || Number.isNaN(m) || m < 0) { err.textContent = 'Escribe el costo de material.'; return; }
    if ([a,b].some(x => x !== null && (Number.isNaN(x) || x < 0 || !Number.isInteger(x)))) { err.textContent = 'Los minutos deben ser números enteros.'; return; }
    const ex = leerExtra('n', m); if (ex.error) { err.textContent = ex.error; return; }
    if (mot.length < 5) { err.textContent = 'Escribe el motivo (mínimo 5 letras).'; return; }
    $('#n-ok').disabled = true;
    const med = $('#n-med').value.trim() || null, des = $('#n-des').value.trim() || null;
    const grupo = $('#n-grp').value.trim().toLowerCase().replace(/\s+/g, '_') || null;
    const r1 = await S.sb.from('catalogo_conceptos').insert({ codigo, nombre, tipo:$('#n-tipo').value, unidad:$('#n-uni').value, medidas:med, descripcion:des, grupo, motivo_cambio:mot }).select().single();
    if (r1.error) { err.textContent = errMsg(r1.error); $('#n-ok').disabled = false; return; }
    const r2 = await S.sb.from('catalogo_precios').insert({ concepto_id:r1.data.id, costo_material:m, minutos_calificado:a, minutos_chalan:b, nota:mot, ...ex.campos });
    if (r2.error) { await cargarCostos(); err.textContent = 'La pieza se creó pero su costo no se guardó: ' + errMsg(r2.error) + ' Ábrela desde la lista para capturarlo.'; $('#n-ok').disabled = false; return; }
    await tras('Pieza agregada');
  };
}

/* ── Tarifas ── */
function jornadaActual(){ return (S.costos.params && Number(S.costos.params.jornada_horas)) || 8; }
function vistaTarifas(){
  const c = S.costos, box = $('#co-cuerpo'), j = jornadaActual();
  fab('Nueva tarifa', () => formTarifaNueva());
  if (!c.tarifas.length) { box.innerHTML = '<div class="empty"><h3>Aún no hay tarifas</h3><p>Agrega oficial, semi oficial y chalán con su pago por día. Marca una de referencia por tipo para calcular costos.</p><button class="btn" id="co-nt">Agregar tarifa</button></div>'; $('#co-nt').onclick = () => formTarifaNueva(); return; }
  box.innerHTML = '<div class="list">' + c.tarifas.map(t => `
    <button class="row ${t.activo ? '' : 'off'}" data-id="${esc(t.id)}">
      <span class="main">
        <div class="nm">${esc(t.nombre)}${t.activo ? '' : ' (inactiva)'}</div>
        <div class="ln">${esc(ROL_TARIFA[t.rol] || t.rol)} · ${MXN(t.pago_dia / j)} por hora</div>
        ${t.es_referencia ? '<span class="chip">Referencia de tiempos</span>' : ''}
      </span>
      <span class="precio">${MXN(t.pago_dia)}<div class="ln" style="font-weight:400">por día</div></span>
    </button>`).join('') + '</div>';
  box.querySelectorAll('.row').forEach(r => r.onclick = () => formTarifa(c.tarifas.find(x => x.id === r.dataset.id)));
}
function formTarifa(t){
  abrirHoja(`
    <div class="sheet-head"><h2>${esc(t.nombre)}</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <div class="field"><label for="t-pago">Pago por día</label><input id="t-pago" type="number" inputmode="decimal" step="0.01" min="0" value="${t.pago_dia}"></div>
    ${motivoCampo('t-mot')}
    <p class="err" id="t-err" role="alert"></p>
    <button class="btn block" id="t-ok">Guardar pago</button>
    <button class="btn plain block" id="t-act" style="margin-top:10px">${t.activo ? 'Desactivar tarifa' : 'Activar tarifa'}</button>`);
  $('#h-x').onclick = cerrarHoja;
  const guardar = async (cambios, msg) => {
    const err = $('#t-err'); err.textContent = ''; const mot = $('#t-mot').value.trim();
    if (mot.length < 5) { err.textContent = 'Escribe el motivo del cambio (mínimo 5 letras).'; return; }
    const { error } = await S.sb.from('tarifas_mano_obra').update({ ...cambios(), motivo_cambio: mot }).eq('id', t.id);
    if (error) { err.textContent = errMsg(error); return; }
    await tras(msg);
  };
  $('#t-ok').onclick = () => { const p = num('#t-pago'); if (p === null || Number.isNaN(p) || p < 0) { $('#t-err').textContent = 'Escribe el pago por día.'; return; } guardar(() => ({ pago_dia:p }), 'Tarifa guardada'); };
  $('#t-act').onclick = () => guardar(() => ({ activo: !t.activo }), t.activo ? 'Tarifa desactivada' : 'Tarifa activada');
}
function formTarifaNueva(){
  abrirHoja(`
    <div class="sheet-head"><h2>Nueva tarifa</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <div class="field"><label for="tn-nom">Nombre *</label><input id="tn-nom" type="text" placeholder="Ej. Semi oficial"></div>
    <div class="field"><label for="tn-rol">Tipo de trabajo</label><select id="tn-rol"><option value="calificado">Calificado (corta y arma)</option><option value="chalan">Chalán (lija, pinta, apoya)</option></select></div>
    <div class="field"><label for="tn-pago">Pago por día *</label><input id="tn-pago" type="number" inputmode="decimal" step="0.01" min="0"></div>
    <label class="chk"><input type="checkbox" id="tn-ref"> Es la referencia con la que se miden los tiempos</label>
    ${motivoCampo('tn-mot')}
    <p class="err" id="tn-err" role="alert"></p>
    <button class="btn block" id="tn-ok">Agregar tarifa</button>`);
  $('#h-x').onclick = cerrarHoja;
  $('#tn-ok').onclick = async () => {
    const err = $('#tn-err'); err.textContent = '';
    const nombre = $('#tn-nom').value.trim(), pago = num('#tn-pago'), mot = $('#tn-mot').value.trim();
    if (!nombre) { err.textContent = 'Escribe el nombre.'; return; }
    if (pago === null || Number.isNaN(pago) || pago < 0) { err.textContent = 'Escribe el pago por día.'; return; }
    if (mot.length < 5) { err.textContent = 'Escribe el motivo (mínimo 5 letras).'; return; }
    $('#tn-ok').disabled = true;
    const { error } = await S.sb.from('tarifas_mano_obra').insert({ nombre, rol:$('#tn-rol').value, pago_dia:pago, es_referencia:$('#tn-ref').checked, motivo_cambio:mot });
    if (error) { err.textContent = /duplicate key|23505|uq_tarifa/i.test(error.message || '') ? 'Ya existe esa tarifa o ya hay una referencia de ese tipo de trabajo.' : errMsg(error); $('#tn-ok').disabled = false; return; }
    await tras('Tarifa agregada');
  };
}

/* ── Reglas de costeo ── */
function vistaReglas(){
  const p = S.costos.params || { jornada_horas:8, factor_hora_extra:2, max_horas_extra_dia:3, pago_dia_parcial:'sin_definir' };
  $('#co-cuerpo').innerHTML = `
    <section class="block-s">
      <h2>Reglas de costeo</h2>
      <p>Aplican a todos los cálculos de mano de obra.</p>
      <div class="field"><label for="r-jor">Jornada normal (horas)</label><input id="r-jor" type="number" inputmode="decimal" step="0.5" min="1" max="24" value="${esc(p.jornada_horas)}"></div>
      <div class="field"><label for="r-fac">Hora extra: veces la hora normal</label><input id="r-fac" type="number" inputmode="decimal" step="0.5" min="1" value="${esc(p.factor_hora_extra)}"></div>
      <div class="field"><label for="r-max">Máximo de horas extra por día</label><input id="r-max" type="number" inputmode="decimal" step="0.5" min="0" value="${esc(p.max_horas_extra_dia)}"></div>
      <div class="field"><label for="r-par">Cuando alguien trabaja menos de un día</label><select id="r-par">${Object.entries(PARCIAL).map(([k,t]) => `<option value="${k}" ${p.pago_dia_parcial===k?'selected':''}>${esc(t)}</option>`).join('')}</select></div>
      ${motivoCampo('r-mot')}
      <p class="err" id="r-err" role="alert"></p>
      <button class="btn block" id="r-ok">Guardar reglas</button>
    </section>`;
  $('#r-ok').onclick = async () => {
    const err = $('#r-err'); err.textContent = '';
    const jor = num('#r-jor'), fac = num('#r-fac'), mx = num('#r-max'), mot = $('#r-mot').value.trim();
    if ([jor,fac,mx].some(x => x === null || Number.isNaN(x))) { err.textContent = 'Completa los tres números.'; return; }
    if (jor <= 0 || jor > 24 || fac < 1 || mx < 0) { err.textContent = 'Revisa los valores: la jornada va de 1 a 24 horas y el factor de hora extra es 1 o más.'; return; }
    if (mot.length < 5) { err.textContent = 'Escribe el motivo del cambio (mínimo 5 letras).'; return; }
    $('#r-ok').disabled = true;
    const datos = { jornada_horas:jor, factor_hora_extra:fac, max_horas_extra_dia:mx, pago_dia_parcial:$('#r-par').value, motivo_cambio:mot };
    const q = S.costos.params
      ? S.sb.from('parametros_costeo').update({ ...datos, actualizado_en:new Date().toISOString() }).eq('empresa_id', S.empresa.id)
      : S.sb.from('parametros_costeo').insert(datos);
    const { error } = await q;
    if (error) { err.textContent = errMsg(error); $('#r-ok').disabled = false; return; }
    await cargarCostos(); dibujarCostos(); toast('Reglas guardadas');
  };
}

/* ── Historial (solo administrador supremo) ── */
function textoValor(v, k){
  if (k === 'tarifa_id' && v) { const t = S.costos.tarifas.find(x => x.id === v); return t ? t.nombre : 'otra tarifa'; }
  if (k === 'personal_id' && v) { const p = (S.costos.personal || []).find(x => x.id === v); return p ? p.nombre : 'otra persona'; }
  if (v === null || v === undefined) return '—'; if (typeof v === 'boolean') return v ? 'sí' : 'no'; return String(v); }
function difusion(a){
  const d = a.despues || {}, b = a.antes || null;
  const llaves = Object.keys(d).filter(k => !OCULTOS.has(k));
  const partes = b ? llaves.filter(k => JSON.stringify(b[k]) !== JSON.stringify(d[k])).map(k => `${CAMPOS[k] || k}: ${textoValor(b[k], k)} → ${textoValor(d[k], k)}`)
                   : llaves.filter(k => d[k] !== null && d[k] !== '').slice(0, 6).map(k => `${CAMPOS[k] || k}: ${textoValor(d[k], k)}`);
  return partes.join(' · ');
}
function nombreRegistro(a){
  const d = a.despues || {};
  if (a.tabla === 'jornadas_personal' || a.tabla === 'pagos_personal') return textoValor(d.personal_id, 'personal_id');
  const idc = a.tabla === 'catalogo_precios' ? d.concepto_id : (a.tabla === 'catalogo_conceptos' ? d.id : null);
  const p = idc && S.costos.vigente.find(x => x.concepto_id === idc);
  return p ? p.nombre : (d.nombre || d.correo || '');
}
function vistaHistorial(){
  const c = S.costos, box = $('#co-cuerpo');
  if (!c.auditoria.length) { box.innerHTML = '<div class="empty"><h3>Sin cambios registrados</h3><p>Aquí aparecerá cada cambio de costos con su motivo.</p></div>'; return; }
  box.innerHTML = '<p class="count">Últimos ' + c.auditoria.length + ' cambios</p>' + c.auditoria.map(a => {
    const cuando = new Date(a.creado_en).toLocaleString('es-MX', { timeZone:ZONA, day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    const quien = a.usuario_id === S.user.id ? 'Tú' : (a.usuario_id ? 'Administrador' : 'Sistema');
    const reg = nombreRegistro(a);
    return `<div class="hist"><div class="quien">${esc(cuando)} · ${esc(quien)}</div>
      <div class="que">${esc(TABLAS[a.tabla] || a.tabla)}${reg ? ' · ' + esc(reg) : ''}${a.accion === 'INSERT' ? ' (alta)' : ''}</div>
      <div class="mot">${esc(a.motivo)}</div>
      <div class="dif">${esc(difusion(a))}</div></div>`;
  }).join('');
}

iniciarPagina({ modulo:'costos', soloAdmin:true, dibujar:pintarCostos });
