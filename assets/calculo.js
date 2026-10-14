'use strict';
/* Cálculos de mano de obra y fechas de semana. Funciones puras: no tocan pantalla ni base de datos,
   así se pueden probar solas (herramientas/pruebas_calculo.js). Las usan los módulos que manejan personal y cotizaciones. */

const redondear = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* Fecha de hoy (AAAA-MM-DD) en la Ciudad de México. Nunca en UTC: a partir de las 6 pm UTC ya sería "mañana". */
function hoyMX(ahora){ return (ahora || new Date()).toLocaleDateString('en-CA', { timeZone:'America/Mexico_City' }); }

function sumarDias(iso, dias){
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}
/* Lunes de la semana a la que pertenece una fecha (la semana va de lunes a domingo). */
function lunesDe(iso){
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();   // 0 = domingo
  return sumarDias(iso, -(dow === 0 ? 6 : dow - 1));
}
/* Semana de trabajo: desplazamiento 0 = actual, -1 = anterior, etc. */
function semanaDesdeHoy(desplazamiento, ahora){
  const inicio = sumarDias(lunesDe(hoyMX(ahora)), (desplazamiento || 0) * 7);
  return { inicio, fin: sumarDias(inicio, 6) };
}
function fechaCorta(iso){
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-MX', { day:'numeric', month:'short', timeZone:'UTC' });
}
function diaSemanaCorto(iso){
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-MX', { weekday:'short', timeZone:'UTC' });
}

/* Monto de una jornada según el pago por día del nivel, las horas trabajadas y las reglas de costeo.
   - Más horas que la jornada: hora extra = hora normal x factor, por cada hora de más.
   - Menos horas: depende de la regla de día parcial. Si está "sin_definir" se sugiere por horas
     (la opción más barata) y se devuelven ambas cifras para decidir. */
function montoJornada(pagoDia, horas, reglas){
  const r = Object.assign({ jornada_horas:8, factor_hora_extra:2, max_horas_extra_dia:3, pago_dia_parcial:'sin_definir' }, reglas || {});
  const J = Number(r.jornada_horas), h = Number(horas), pd = Number(pagoDia);
  const vacio = { sugerido:null, parcial:false, porHoras:null, diaCompleto:null, horasExtra:0, pagoExtra:0, excedeMaxExtra:false, regla:r.pago_dia_parcial };
  if (pagoDia === null || pagoDia === undefined || pagoDia === '' || !(pd >= 0) || !(h > 0) || !(J > 0)) return vacio;
  const horaNormal = pd / J;
  if (h > J) {
    const extra = h - J, pagoExtra = redondear(extra * horaNormal * Number(r.factor_hora_extra));
    return { ...vacio, sugerido:redondear(pd + pagoExtra), horasExtra:extra, pagoExtra, excedeMaxExtra:extra > Number(r.max_horas_extra_dia) };
  }
  if (h === J) return { ...vacio, sugerido:redondear(pd) };
  const porHoras = redondear(horaNormal * h), diaCompleto = redondear(pd);
  return { ...vacio, parcial:true, porHoras, diaCompleto, sugerido: r.pago_dia_parcial === 'dia_completo' ? diaCompleto : porHoras };
}

/* Resumen de una semana por persona: sueldo fijo + jornadas, lo ya pagado y lo que falta.
   Las jornadas y pagos anulados no cuentan. Estado: cubierto, parcial, pendiente, excedido o sin_movimiento. */
function resumenSemana(personas, jornadas, pagos, semana){
  const filas = {};
  const fila = id => filas[id] || (filas[id] = { personal_id:id, base:0, jornadas:[], pagos:[], sumaJornadas:0, pagado:0 });
  personas.forEach(p => {
    const ingresoDespues = p.fecha_ingreso && p.fecha_ingreso > semana.fin;   // aún no trabajaba esa semana
    if (p.activo !== false && Number(p.pago_semanal) > 0 && !ingresoDespues) fila(p.id).base = redondear(p.pago_semanal);
  });
  jornadas.filter(j => !j.anulada && j.fecha >= semana.inicio && j.fecha <= semana.fin).forEach(j => {
    const f = fila(j.personal_id); f.jornadas.push(j); f.sumaJornadas = redondear(f.sumaJornadas + Number(j.monto));
  });
  pagos.filter(p => !p.anulado && p.semana_inicio === semana.inicio).forEach(p => {
    const f = fila(p.personal_id); f.pagos.push(p); f.pagado = redondear(f.pagado + Number(p.monto));
  });
  return Object.values(filas).map(f => {
    f.total = redondear(f.base + f.sumaJornadas);
    f.restante = redondear(f.total - f.pagado);
    f.estado = f.total === 0 && f.pagado === 0 ? 'sin_movimiento'
      : f.restante < -0.5 ? 'excedido'
      : f.restante <= 0.5 ? 'cubierto'
      : f.pagado > 0 ? 'parcial' : 'pendiente';
    return f;
  });
}
