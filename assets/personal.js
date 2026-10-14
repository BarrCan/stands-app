'use strict';
/* Módulo Personal (solo administradores): equipo con nivel, jornadas trabajadas y pagos semanales.
   Parte del módulo de técnicos de BarrCan, adaptado a niveles (oficial, semi oficial, chalán), reglas de
   costeo, roles y motivo obligatorio en los cambios. Los cálculos viven en calculo.js. */
const P = { personas:[], tarifas:[], reglas:null, jornadas:[], pagos:[], mes:[], sub:'equipo', desp:0, error:null };
const TIPOS_PERSONAL = { planta:'De planta', eventual:'Eventual' };
const ESTADOS_PAGO = {
  cubierto:['Cubierto', 'ok'], parcial:['Parcial', 'parcial'], pendiente:['Pendiente', 'pend'],
  excedido:['Pagado de más', 'pend'], sin_movimiento:['Sin movimiento', 'ok']
};

const nombrePersona = id => (P.personas.find(p => p.id === id) || {}).nombre || 'Persona no encontrada';
const tarifaDe = p => (p && p.tarifa_id) ? (P.tarifas.find(t => t.id === p.tarifa_id) || null) : null;
const semanaActual = () => semanaDesdeHoy(P.desp);

/* ── Carga de datos ── */
async function cargarBase(){
  const [pe, ta, re] = await Promise.all([
    S.sb.from('personal').select('*').order('nombre'),
    S.sb.from('tarifas_mano_obra').select('*').order('pago_dia', { ascending:false }),
    S.sb.from('parametros_costeo').select('*').maybeSingle()
  ]);
  const fallo = [pe, ta, re].find(r => r.error);
  if (fallo) { P.error = errMsg(fallo.error); return false; }
  P.error = null; P.personas = pe.data || []; P.tarifas = ta.data || []; P.reglas = re.data || null;
  return true;
}
async function cargarSemana(){
  const sem = semanaActual();
  const [jo, pa] = await Promise.all([
    S.sb.from('jornadas_personal').select('*').gte('fecha', sem.inicio).lte('fecha', sem.fin).order('fecha', { ascending:false }),
    S.sb.from('pagos_personal').select('*').eq('semana_inicio', sem.inicio).order('fecha_pago')
  ]);
  const fallo = [jo, pa].find(r => r.error);
  if (fallo) { P.error = errMsg(fallo.error); return false; }
  P.jornadas = jo.data || []; P.pagos = pa.data || [];
  return true;
}
async function cargarMes(){
  const hoy = hoyMX();
  const r = await S.sb.from('jornadas_personal').select('personal_id,monto,anulada').gte('fecha', hoy.slice(0, 8) + '01').lte('fecha', hoy);
  if (r.error) { P.error = errMsg(r.error); return false; }
  P.mes = r.data || [];
  return true;
}
async function dibujarPersonal(){
  $('#vista').innerHTML = '<div class="center">Cargando…</div>';
  if (!(await cargarBase())) return errorPersonal();
  await recargar();
}
async function recargar(){
  const ok = P.sub === 'equipo' ? await cargarMes() : await cargarSemana();
  if (!ok) return errorPersonal();
  pintarSeccionPersonal();
}
function errorPersonal(){
  document.querySelectorAll('.fab').forEach(f => f.remove());
  $('#vista').innerHTML = `<h1 class="page-title">Personal</h1><div class="empty"><h3>No se pudo cargar</h3><p>${esc(P.error)}</p><button class="btn" id="pe-re">Reintentar</button></div>`;
  $('#pe-re').onclick = dibujarPersonal;
}

function pintarSeccionPersonal(){
  document.querySelectorAll('.fab').forEach(f => f.remove());
  const secs = [['equipo', 'Equipo'], ['jornadas', 'Jornadas'], ['pagos', 'Pagos']];
  $('#vista').innerHTML = `
    <h1 class="page-title">Personal</h1>
    <p class="page-sub">Equipo, jornadas y pagos. Solo administradores; cada cambio queda registrado.</p>
    <div class="seg sm" role="group" aria-label="Secciones de personal">${secs.map(([k, t]) => `<button type="button" data-s="${k}" aria-pressed="${P.sub === k}">${t}</button>`).join('')}</div>
    <div id="pe-cuerpo"></div>`;
  document.querySelectorAll('.seg button[data-s]').forEach(b => b.onclick = async () => { P.sub = b.dataset.s; await recargar(); });
  ({ equipo:vistaEquipo, jornadas:vistaJornadas, pagos:vistaPagos })[P.sub]();
}

function selectorSemana(){
  const s = semanaActual();
  return `<div class="semana"><button class="btn plain sm" id="se-ant" aria-label="Semana anterior">◀</button>
    <div class="sem-txt"><b>${esc(fechaCorta(s.inicio))} — ${esc(fechaCorta(s.fin))}</b>${P.desp === 0 ? '<div class="hint">Semana actual</div>' : ''}</div>
    <button class="btn plain sm" id="se-sig" aria-label="Semana siguiente" ${P.desp >= 0 ? 'disabled' : ''}>▶</button></div>`;
}
function enlazarSemana(){
  $('#se-ant').onclick = async () => { P.desp--; await recargar(); };
  $('#se-sig').onclick = async () => { if (P.desp < 0) { P.desp++; await recargar(); } };
}

/* ───────── EQUIPO ───────── */
function vistaEquipo(){
  const box = $('#pe-cuerpo');
  fab('Nueva persona', () => formPersona(null));
  if (!P.personas.length) {
    box.innerHTML = '<div class="empty"><h3>Aún no hay personal</h3><p>Agrega a tu equipo con su nivel (oficial, semi oficial o chalán) para calcular jornadas y pagos.</p><button class="btn" id="pe-nueva">Agregar persona</button></div>';
    $('#pe-nueva').onclick = () => formPersona(null); return;
  }
  const est = {};
  P.mes.filter(j => !j.anulada).forEach(j => { const e = est[j.personal_id] || (est[j.personal_id] = { n:0, monto:0 }); e.n++; e.monto = redondear(e.monto + Number(j.monto)); });
  box.innerHTML = '<div class="list">' + P.personas.map(p => {
    const t = tarifaDe(p), e = est[p.id];
    return `<button class="row ${p.activo ? '' : 'off'}" data-id="${esc(p.id)}">
      <span class="tile">${esc(iniciales(p.nombre))}</span>
      <span class="main">
        <div class="nm">${esc(p.nombre)}${p.activo ? '' : ' (baja)'}</div>
        <div class="ln">${esc(t ? t.nombre : 'Sin nivel')} · ${esc(TIPOS_PERSONAL[p.tipo] || p.tipo)}${p.puesto ? ' · ' + esc(p.puesto) : ''}</div>
        <div class="ln wrap">Este mes: ${e ? e.n + (e.n === 1 ? ' jornada' : ' jornadas') + ' · ' + MXN(e.monto) : 'sin jornadas'}</div>
      </span>
      <span class="precio">${t ? MXN(t.pago_dia) + '<div class="ln" style="font-weight:400">por día</div>' : ''}</span>
    </button>`;
  }).join('') + '</div>';
  box.querySelectorAll('.row').forEach(r => r.onclick = () => formPersona(P.personas.find(x => x.id === r.dataset.id)));
}

function formPersona(p){
  const edit = !!p;
  const niveles = '<option value="">Sin nivel (el monto se escribe a mano)</option>' + P.tarifas.filter(t => t.activo || (p && t.id === p.tarifa_id)).map(t =>
    `<option value="${esc(t.id)}" ${p && p.tarifa_id === t.id ? 'selected' : ''}>${esc(t.nombre)} · ${MXN(t.pago_dia)} por día</option>`).join('');
  abrirHoja(`
    <div class="sheet-head"><h2>${edit ? esc(p.nombre) : 'Nueva persona'}</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <div class="field"><label for="pe-nom">Nombre *</label><input id="pe-nom" type="text" autocomplete="off" value="${esc(p && p.nombre)}"></div>
    <div class="field"><label for="pe-tipo">Tipo</label><select id="pe-tipo"><option value="eventual" ${p && p.tipo === 'planta' ? '' : 'selected'}>Eventual (se le paga por día trabajado)</option><option value="planta" ${p && p.tipo === 'planta' ? 'selected' : ''}>De planta</option></select></div>
    <div class="field"><label for="pe-niv">Nivel</label><select id="pe-niv">${niveles}</select><div class="hint">Define cuánto se le paga por día. Las tarifas se administran en Costos.</div></div>
    <div class="field"><label for="pe-pue">Puesto</label><input id="pe-pue" type="text" placeholder="Ej. Taller, instalación" value="${esc(p && p.puesto)}"></div>
    <div class="field"><label for="pe-sue">Sueldo semanal fijo (opcional)</label><input id="pe-sue" type="number" inputmode="decimal" step="0.01" min="0" value="${p && p.pago_semanal != null ? esc(p.pago_semanal) : ''}"><div class="hint">Solo si tiene sueldo fijo; se suma a lo que gane por jornadas.</div></div>
    <div class="field"><label for="pe-tel">Teléfono</label><input id="pe-tel" type="tel" inputmode="tel" value="${esc(p && p.telefono)}"></div>
    <div class="field"><label for="pe-dir">Dirección</label><input id="pe-dir" type="text" value="${esc(p && p.direccion)}"></div>
    <div class="field"><label for="pe-ing">Fecha de ingreso</label><input id="pe-ing" type="date" value="${esc(p && p.fecha_ingreso)}"></div>
    <div class="field"><label for="pe-not">Notas</label><textarea id="pe-not">${esc(p && p.notas)}</textarea></div>
    ${edit ? `<label class="chk"><input type="checkbox" id="pe-act" ${p.activo ? 'checked' : ''}> Activo (si lo quitas, queda de baja y se puede reactivar)</label>
      ${motivoCampo('pe-mot', 'Obligatorio solo si cambias el nivel o el sueldo fijo. Queda en el historial.')}` : ''}
    <p class="err" id="pe-err" role="alert"></p>
    <button class="btn block" id="pe-ok">${edit ? 'Guardar cambios' : 'Agregar persona'}</button>`);
  $('#h-x').onclick = cerrarHoja;
  $('#pe-ok').onclick = async () => {
    const err = $('#pe-err'); err.textContent = '';
    const v = id => $(id).value.trim() || null, nombre = $('#pe-nom').value.trim(), sue = num('#pe-sue');
    if (!nombre) { err.textContent = 'Escribe el nombre.'; return; }
    if (sue !== null && (Number.isNaN(sue) || sue < 0)) { err.textContent = 'El sueldo semanal debe ser un número válido.'; return; }
    const datos = { nombre, tipo:$('#pe-tipo').value, tarifa_id:$('#pe-niv').value || null, puesto:v('#pe-pue'), pago_semanal:sue, telefono:v('#pe-tel'), direccion:v('#pe-dir'), fecha_ingreso:v('#pe-ing'), notas:v('#pe-not') };
    if (edit) {
      datos.activo = $('#pe-act').checked;
      const sueAntes = p.pago_semanal == null ? null : Number(p.pago_semanal), mot = $('#pe-mot').value.trim();
      const sensible = (datos.tarifa_id || null) !== (p.tarifa_id || null) || sue !== sueAntes;
      if (sensible && mot.length < 5) { err.textContent = 'Cambiaste el nivel o el sueldo fijo: escribe el motivo (mínimo 5 letras).'; return; }
      if (mot) datos.motivo_cambio = mot;
    } else datos.activo = true;
    $('#pe-ok').disabled = true;
    const { error } = edit ? await S.sb.from('personal').update(datos).eq('id', p.id) : await S.sb.from('personal').insert(datos);
    if (error) { err.textContent = errMsg(error); $('#pe-ok').disabled = false; return; }
    cerrarHoja(); await dibujarPersonal(); toast(edit ? 'Cambios guardados' : 'Persona agregada');
  };
}

/* ───────── JORNADAS ───────── */
function vistaJornadas(){
  const box = $('#pe-cuerpo');
  fab('Nueva jornada', () => formJornada(null));
  const validas = P.jornadas.filter(j => !j.anulada), total = validas.reduce((s, j) => redondear(s + Number(j.monto)), 0);
  let html = selectorSemana();
  if (!P.jornadas.length) html += '<div class="empty"><h3>Sin jornadas esta semana</h3><p>Registra cada día trabajado con su nivel y sus horas; el monto se calcula solo.</p></div>';
  else {
    html += `<p class="count">${validas.length} ${validas.length === 1 ? 'jornada' : 'jornadas'} · total ${MXN(total)}</p><div class="list">`;
    let dia = null;
    P.jornadas.forEach(j => {
      if (j.fecha !== dia) { dia = j.fecha; html += `<div class="dia-cab">${esc(diaSemanaCorto(j.fecha))} ${esc(fechaCorta(j.fecha))}</div>`; }
      html += `<button class="row ${j.anulada ? 'off' : ''}" data-id="${esc(j.id)}">
        <span class="main"><div class="nm">${esc(nombrePersona(j.personal_id))}${j.anulada ? ' (anulada)' : ''}</div>
          <div class="ln">${esc(j.nivel_nombre || 'Sin nivel')} · ${esc(j.horas)} h${j.referencia ? ' · ' + esc(j.referencia) : ''}</div></span>
        <span class="precio" ${j.anulada ? 'style="text-decoration:line-through"' : ''}>${MXN(j.monto)}</span></button>`;
    });
    html += '</div>';
  }
  box.innerHTML = html; enlazarSemana();
  box.querySelectorAll('.row[data-id]').forEach(r => r.onclick = () => formJornada(P.jornadas.find(x => x.id === r.dataset.id)));
}

function formJornada(j){
  const edit = !!j, jor = Number((P.reglas && P.reglas.jornada_horas) || 8), hoy = hoyMX();
  const gente = P.personas.filter(p => p.activo || (j && p.id === j.personal_id));
  if (!edit && !gente.length) { toast('Primero agrega a una persona en Equipo.'); return; }
  abrirHoja(`
    <div class="sheet-head"><h2>${edit ? 'Jornada' : 'Nueva jornada'}</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <div class="field"><label for="jo-per">Persona *</label><select id="jo-per" ${edit ? 'disabled' : ''}>${edit ? '' : '<option value="">Elige a la persona…</option>'}${gente.map(p => `<option value="${esc(p.id)}" ${j && j.personal_id === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
    <div class="field"><label for="jo-fec">Fecha *</label><input id="jo-fec" type="date" max="${esc(hoy)}" value="${esc(j ? j.fecha : hoy)}"></div>
    <div class="field"><label for="jo-hor">Horas trabajadas *</label><input id="jo-hor" type="number" inputmode="decimal" step="0.5" min="0.5" max="24" value="${esc(j ? j.horas : jor)}"><div class="hint">Jornada normal: ${esc(jor)} horas.</div></div>
    <div class="prev" id="jo-calc" aria-live="polite"></div>
    <div class="field"><label for="jo-mon">Monto a pagar *</label><input id="jo-mon" type="number" inputmode="decimal" step="0.01" min="0" value="${j ? esc(j.monto) : ''}"></div>
    <div class="field"><label for="jo-ref">Stand, folio o evento</label><input id="jo-ref" type="text" placeholder="Ej. STAN-003A" value="${esc(j && j.referencia)}"></div>
    <div class="field"><label for="jo-not">Nota</label><input id="jo-not" type="text" value="${esc(j && j.nota)}"></div>
    ${edit ? motivoCampo('jo-mot') : ''}
    <p class="err" id="jo-err" role="alert"></p>
    <button class="btn block" id="jo-ok">${edit ? 'Guardar cambios' : 'Registrar jornada'}</button>
    ${edit && !j.anulada ? '<button class="btn danger block" id="jo-anu" style="margin-top:10px">Anular jornada</button>' : ''}`);
  $('#h-x').onclick = cerrarHoja;
  let manual = edit;   // si el monto lo escribió la persona, no se pisa con el sugerido
  const calcular = () => {
    const per = P.personas.find(p => p.id === $('#jo-per').value), t = tarifaDe(per), h = num('#jo-hor'), caja = $('#jo-calc');
    const pagoDia = edit ? j.pago_dia : (t ? t.pago_dia : null), nivel = edit ? j.nivel_nombre : (t ? t.nombre : null);
    if (!per) { caja.textContent = 'Elige a la persona para calcular el monto.'; return; }
    if (pagoDia === null || pagoDia === undefined) { caja.textContent = 'Esta persona no tiene nivel con tarifa: escribe el monto a mano.'; return; }
    if (h === null || Number.isNaN(h) || h <= 0) { caja.textContent = 'Escribe las horas trabajadas.'; return; }
    const r = montoJornada(pagoDia, h, P.reglas);
    let txt = `${nivel || 'Nivel'} a ${MXN(pagoDia)} por día.`;
    if (r.horasExtra) txt += ` ${r.horasExtra} h extra: +${MXN(r.pagoExtra)}.`;
    if (r.excedeMaxExtra) txt += ` Atención: pasa del máximo de ${(P.reglas && P.reglas.max_horas_extra_dia) || 3} horas extra por día; confirma que esté permitido.`;
    if (r.parcial) txt += ` Jornada incompleta: por horas ${MXN(r.porHoras)}, día completo ${MXN(r.diaCompleto)}.` + (r.regla === 'sin_definir' ? ' La regla de día parcial aún no está definida (Costos → Reglas).' : '');
    caja.textContent = txt + ` Sugerido: ${MXN(r.sugerido)}.`;
    if (!manual) $('#jo-mon').value = r.sugerido;
  };
  ['#jo-per', '#jo-hor'].forEach(i => $(i).addEventListener('input', calcular));
  $('#jo-mon').addEventListener('input', () => { manual = true; });
  calcular();
  $('#jo-ok').onclick = async () => {
    const err = $('#jo-err'); err.textContent = '';
    const perId = $('#jo-per').value, fecha = $('#jo-fec').value, h = num('#jo-hor'), m = num('#jo-mon'), mot = edit ? $('#jo-mot').value.trim() : '';
    if (!perId) { err.textContent = 'Elige a la persona.'; return; }
    if (!fecha) { err.textContent = 'Elige la fecha.'; return; }
    if (h === null || Number.isNaN(h) || h <= 0 || h > 24) { err.textContent = 'Las horas deben estar entre 0.5 y 24.'; return; }
    if (m === null || Number.isNaN(m) || m < 0) { err.textContent = 'Escribe el monto a pagar.'; return; }
    if (edit && mot.length < 5) { err.textContent = 'Escribe el motivo del cambio (mínimo 5 letras).'; return; }
    const datos = { fecha, horas:h, monto:m, referencia:$('#jo-ref').value.trim() || null, nota:$('#jo-not').value.trim() || null };
    $('#jo-ok').disabled = true;
    let r;
    if (edit) r = await S.sb.from('jornadas_personal').update({ ...datos, motivo_cambio:mot }).eq('id', j.id);
    else { const t = tarifaDe(P.personas.find(p => p.id === perId)); r = await S.sb.from('jornadas_personal').insert({ ...datos, personal_id:perId, nivel_nombre:t ? t.nombre : null, pago_dia:t ? t.pago_dia : null }); }
    if (r.error) { err.textContent = errMsg(r.error); $('#jo-ok').disabled = false; return; }
    cerrarHoja(); await recargar(); toast(edit ? 'Jornada actualizada' : 'Jornada registrada');
  };
  const anu = $('#jo-anu');
  if (anu) anu.onclick = async () => {
    const err = $('#jo-err'); err.textContent = ''; const mot = $('#jo-mot').value.trim();
    if (mot.length < 5) { err.textContent = 'Escribe el motivo para anular (mínimo 5 letras).'; return; }
    const { error } = await S.sb.from('jornadas_personal').update({ anulada:true, motivo_cambio:mot }).eq('id', j.id);
    if (error) { err.textContent = errMsg(error); return; }
    cerrarHoja(); await recargar(); toast('Jornada anulada');
  };
}

/* ───────── PAGOS ───────── */
const filasSemana = () => resumenSemana(P.personas, P.jornadas, P.pagos, semanaActual());

function vistaPagos(){
  const box = $('#pe-cuerpo'), sem = semanaActual();
  const filas = filasSemana().sort((a, b) => b.total - a.total);
  const tot = filas.reduce((s, f) => ({ total:redondear(s.total + f.total), pagado:redondear(s.pagado + f.pagado) }), { total:0, pagado:0 });
  let html = selectorSemana();
  if (!filas.length) html += '<div class="empty"><h3>Nada que pagar esta semana</h3><p>Aquí aparece el sueldo fijo y las jornadas de cada persona.</p></div>';
  else {
    html += `<div class="prev"><b>Total de la semana ${MXN(tot.total)}</b> · pagado ${MXN(tot.pagado)} · falta ${MXN(redondear(tot.total - tot.pagado))}</div>`;
    html += filas.map(f => {
      const [etq, clase] = ESTADOS_PAGO[f.estado];
      const falta = f.estado === 'parcial' ? ` · falta ${MXN(f.restante)}` : (f.estado === 'pendiente' ? ` · falta ${MXN(f.restante)}` : (f.estado === 'excedido' ? ` · ${MXN(-f.restante)} de más` : ''));
      return `<details class="pcard"><summary><span class="pn">${esc(nombrePersona(f.personal_id))}<span class="pill ${clase}">${esc(etq)}${esc(falta)}</span></span><span class="precio">${MXN(f.total)}</span></summary>
        <div class="pbody">
          ${f.base ? `<div class="pl"><span>Sueldo fijo</span><span>${MXN(f.base)}</span></div>` : ''}
          ${f.jornadas.map(j => `<div class="pl"><span>${esc(diaSemanaCorto(j.fecha))} ${esc(fechaCorta(j.fecha))} · ${esc(j.horas)} h${j.referencia ? ' · ' + esc(j.referencia) : ''}</span><span>${MXN(j.monto)}</span></div>`).join('')}
          <div class="pl pt"><span>Total de la semana</span><span>${MXN(f.total)}</span></div>
          ${f.pagos.map(pg => `<button class="pl pago" data-pg="${esc(pg.id)}"><span>Pagado el ${esc(fechaCorta(pg.fecha_pago))}${pg.nota ? ' · ' + esc(pg.nota) : ''} ✎</span><span>−${MXN(pg.monto)}</span></button>`).join('')}
          ${f.restante > 0.5 ? `<button class="btn sm block" data-pagar="${esc(f.personal_id)}" style="margin-top:10px">Registrar pago</button>` : ''}
        </div></details>`;
    }).join('');
  }
  box.innerHTML = html; enlazarSemana();
  box.querySelectorAll('[data-pagar]').forEach(b => b.onclick = () => formPago(null, b.dataset.pagar));
  box.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { const pg = P.pagos.find(x => x.id === b.dataset.pg); if (pg) formPago(pg, pg.personal_id); });
}

function formPago(pg, personaId){
  const edit = !!pg, sem = semanaActual(), fila = filasSemana().find(f => f.personal_id === personaId), restante = fila ? Math.max(0, fila.restante) : 0, hoy = hoyMX();
  abrirHoja(`
    <div class="sheet-head"><h2>${edit ? 'Pago' : 'Registrar pago'}</h2><button class="x" id="h-x" aria-label="Cerrar">✕</button></div>
    <p class="hint" style="margin:-6px 0 14px">${esc(nombrePersona(personaId))} · semana del ${esc(fechaCorta(sem.inicio))} al ${esc(fechaCorta(sem.fin))}${fila ? ' · total ' + MXN(fila.total) : ''}</p>
    <div class="field"><label for="pg-mon">Monto *</label><input id="pg-mon" type="number" inputmode="decimal" step="0.01" min="0.01" value="${esc(edit ? pg.monto : (restante || ''))}"><div class="hint" id="pg-ayuda"></div></div>
    <div class="field"><label for="pg-fec">Fecha de pago *</label><input id="pg-fec" type="date" max="${esc(hoy)}" value="${esc(edit ? pg.fecha_pago : hoy)}"></div>
    <div class="field"><label for="pg-not">Nota</label><input id="pg-not" type="text" placeholder="Ej. sábado, resto el lunes" value="${esc(pg && pg.nota)}"></div>
    ${edit ? motivoCampo('pg-mot') : ''}
    <p class="err" id="pg-err" role="alert"></p>
    <button class="btn block" id="pg-ok">${edit ? 'Guardar cambios' : 'Registrar pago'}</button>
    ${edit ? '<button class="btn danger block" id="pg-anu" style="margin-top:10px">Anular pago</button>' : ''}`);
  $('#h-x').onclick = cerrarHoja;
  const ayuda = () => { const m = num('#pg-mon'), tope = edit ? redondear(restante + Number(pg.monto)) : restante; $('#pg-ayuda').textContent = (m !== null && m > tope + 0.5) ? `Es más de lo que falta (${MXN(tope)}).` : (tope > 0 ? `Falta por pagar: ${MXN(tope)}.` : ''); };
  $('#pg-mon').addEventListener('input', ayuda); ayuda();
  $('#pg-ok').onclick = async () => {
    const err = $('#pg-err'); err.textContent = '';
    const m = num('#pg-mon'), fecha = $('#pg-fec').value, mot = edit ? $('#pg-mot').value.trim() : '';
    if (m === null || Number.isNaN(m) || m <= 0) { err.textContent = 'Escribe un monto mayor a cero.'; return; }
    if (!fecha) { err.textContent = 'Elige la fecha de pago.'; return; }
    if (edit && mot.length < 5) { err.textContent = 'Escribe el motivo del cambio (mínimo 5 letras).'; return; }
    const datos = { monto:m, fecha_pago:fecha, nota:$('#pg-not').value.trim() || null };
    $('#pg-ok').disabled = true;
    const r = edit ? await S.sb.from('pagos_personal').update({ ...datos, motivo_cambio:mot }).eq('id', pg.id)
                   : await S.sb.from('pagos_personal').insert({ ...datos, personal_id:personaId, semana_inicio:sem.inicio });
    if (r.error) { err.textContent = errMsg(r.error); $('#pg-ok').disabled = false; return; }
    cerrarHoja(); await recargar(); toast(edit ? 'Pago actualizado' : 'Pago registrado');
  };
  const anu = $('#pg-anu');
  if (anu) anu.onclick = async () => {
    const err = $('#pg-err'); err.textContent = ''; const mot = $('#pg-mot').value.trim();
    if (mot.length < 5) { err.textContent = 'Escribe el motivo para anular el pago (mínimo 5 letras).'; return; }
    const { error } = await S.sb.from('pagos_personal').update({ anulado:true, motivo_cambio:mot }).eq('id', pg.id);
    if (error) { err.textContent = errMsg(error); return; }
    cerrarHoja(); await recargar(); toast('Pago anulado');
  };
}

iniciarPagina({ modulo:'personal', soloAdmin:true, dibujar:dibujarPersonal });
