'use strict';
/* Módulo Ajustes: apariencia, canales de origen, datos de la empresa y cuenta. */
function miniPlano(p, acento){
  const v = p.vars, a = acento || v['--accent'];
  let s=''; for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    const lleno = (i===0||j===0);
    s += `<i style="background:${lleno?a:v['--bg']};border:1.5px solid ${lleno?a:v['--line']}"></i>`;
  }
  return `<div class="plan" style="background:${v['--ink']};padding:4px;border-radius:4px;width:62px">${s}</div>`;
}

function pintarAjustes(){
  const t = S.empresa?.tema || {preset:'taller'}, adm = esAdmin();
  const e = S.empresa || {};
  const acentoActual = t.acento || (PRESETS[t.preset]||PRESETS.taller).vars['--accent'];
  $('#vista').innerHTML = `
    <h1 class="page-title">Ajustes</h1>
    <p class="page-sub">${adm ? 'Personaliza tu empresa.' : 'Solo el administrador puede cambiar estos ajustes.'}</p>

    <section class="block-s" aria-labelledby="s-ap">
      <h2 id="s-ap">Apariencia</h2>
      <p>Elige una paleta. Puedes cambiarla cuando quieras.</p>
      <div class="presets" role="radiogroup" aria-label="Paleta de colores">
        ${Object.entries(PRESETS).map(([k,p]) => `
          <button class="preset" role="radio" aria-checked="${(t.preset||'taller')===k}" data-p="${k}" ${adm?'':'disabled'}>
            ${miniPlano(p, (t.preset||'taller')===k ? t.acento : null)}
            <div class="nm">${esc(p.nombre)}</div><div class="ds">${esc(p.desc)}</div>
          </button>`).join('')}
      </div>
      <div class="colorrow">
        <label for="s-acento" class="lbl" style="margin:0">Color de acento propio</label>
        <input type="color" id="s-acento" value="${esc(acentoActual)}" ${adm?'':'disabled'}>
        <button class="btn plain sm" id="s-reset" ${adm&&t.acento?'':'disabled'}>Quitar color propio</button>
      </div>
      <p class="hint" id="s-aviso"></p>
    </section>

    <section class="block-s" aria-labelledby="s-lg">
      <h2 id="s-lg">Logo de la empresa</h2>
      <p>Aparece en el encabezado de la app y, más adelante, en tus presupuestos. PNG, JPG o WEBP; se ajusta solo a un tamaño ligero.</p>
      <div class="logo-prev" id="lg-prev">${S.empresa?.logo_path ? `<img src="${esc(urlLogo(S.empresa.logo_path))}" alt="Logo actual">` : '<span class="hint">Aún no hay logo</span>'}</div>
      ${adm ? `<label class="btn block filebtn" id="lg-btn"><span>${S.empresa?.logo_path ? 'Cambiar logo' : 'Subir logo'}</span><input type="file" id="lg-file" accept="image/png,image/jpeg,image/webp" aria-label="Elegir imagen del logo"></label>
      ${S.empresa?.logo_path ? '<button class="btn plain block" id="lg-quitar" style="margin-top:10px">Quitar logo</button>' : ''}` : ''}
      <p class="err" id="lg-msg" role="alert"></p>
    </section>

    <section class="block-s" aria-labelledby="s-ca">
      <h2 id="s-ca">Canales de origen</h2>
      <p>Las opciones que aparecen al registrar un cliente. Si desactivas uno, deja de ofrecerse pero se conserva en los clientes que ya lo tienen.</p>
      <div id="s-canales"></div>
      ${puedeEditar() ? '<div class="inline-new"><input type="text" id="s-canal-nuevo" placeholder="Nuevo canal (ej. Instagram)" aria-label="Nuevo canal"><button class="btn sm" id="s-canal-add">Agregar</button></div><p class="err" id="s-canal-err" role="alert"></p>' : ''}
    </section>

    <section class="block-s" aria-labelledby="s-em">
      <h2 id="s-em">Datos de la empresa</h2>
      <p>Aparecerán en tus presupuestos y recibos.</p>
      <div class="field"><label for="s-nom">Nombre</label><input type="text" id="s-nom" value="${esc(e.nombre)}" ${adm?'':'disabled'}></div>
      <div class="field"><label for="s-rs">Razón social</label><input type="text" id="s-rs" value="${esc(e.razon_social)}" ${adm?'':'disabled'}></div>
      <div class="field"><label for="s-rfc">RFC</label><input type="text" id="s-rfc" value="${esc(e.rfc)}" autocapitalize="characters" ${adm?'':'disabled'}></div>
      <div class="field"><label for="s-dir">Dirección</label><input type="text" id="s-dir" value="${esc(e.direccion)}" ${adm?'':'disabled'}></div>
      ${adm ? '<button class="btn block" id="s-emp-ok">Guardar datos</button><p class="err" id="s-emp-err" role="alert"></p>' : ''}
    </section>

    <section class="block-s" aria-labelledby="s-cu">
      <h2 id="s-cu">Cuenta</h2>
      <p>${esc(S.user?.email||'')} · rol: ${esc(S.perfil?.es_superadmin ? 'administrador supremo' : (S.perfil?.rol||''))}</p>
      <button class="btn plain block" id="s-out">Cerrar sesión</button>
    </section>
    <p class="ver">Stands ${esc(APP_VERSION)}</p>`;

  document.querySelectorAll('.preset').forEach(b => b.onclick = () => guardarTema({ preset:b.dataset.p, acento:S.empresa.tema?.acento }));
  const ac = $('#s-acento');
  ac.addEventListener('input', () => avisoContraste(ac.value));
  ac.addEventListener('change', () => guardarTema({ preset:(S.empresa.tema?.preset||'taller'), acento:ac.value }));
  $('#s-reset').onclick = () => guardarTema({ preset:(S.empresa.tema?.preset||'taller') });
  avisoContraste(acentoActual);
  pintarCanalesAjustes();
  const add = $('#s-canal-add'); if (add) add.onclick = agregarCanalAjustes;
  const eok = $('#s-emp-ok'); if (eok) eok.onclick = guardarEmpresa;
  const lf = $('#lg-file'); if (lf) lf.addEventListener('change', () => { if (lf.files[0]) subirLogo(lf.files[0]); lf.value = ''; });
  const lq = $('#lg-quitar'); if (lq) lq.onclick = quitarLogo;
  $('#s-out').onclick = cerrarSesion;
}

function avisoContraste(hex){
  const el = $('#s-aviso'); if (!el) return;
  const c = contraste(hex, '#FFFFFF');
  el.textContent = c < 3 ? 'Este color se lee poco sobre fondo blanco (enlaces y detalles). Prueba uno más oscuro.' : '';
}

async function guardarTema(tema){
  const limpio = { preset: tema.preset || 'taller' }; if (tema.acento) limpio.acento = tema.acento;
  const { error } = await S.sb.from('empresas').update({ tema: limpio }).eq('id', S.empresa.id);
  if (error) { toast(errMsg(error)); return; }
  S.empresa.tema = limpio; aplicarTema(limpio); pintarAjustes(); toast('Apariencia guardada');
}

function pintarCanalesAjustes(){
  const ed = puedeEditar();
  $('#s-canales').innerHTML = S.canales.map(c => `
    <div class="canal-row ${c.activo?'':'off'}" data-id="${esc(c.id)}">
      <input type="text" value="${esc(c.nombre)}" aria-label="Nombre del canal" ${ed?'':'disabled'}>
      <label class="sw" title="${c.activo?'Activo':'Inactivo'}"><input type="checkbox" ${c.activo?'checked':''} ${ed?'':'disabled'} aria-label="Canal activo"><span></span></label>
    </div>`).join('') || '<p class="hint">Todavía no hay canales.</p>';
  document.querySelectorAll('#s-canales .canal-row').forEach(row => {
    const id = row.dataset.id, txt = row.querySelector('input[type=text]'), sw = row.querySelector('input[type=checkbox]');
    txt.addEventListener('change', async () => {
      const c = S.canales.find(x => x.id===id), nombre = txt.value.trim();
      if (!nombre) { txt.value = c.nombre; return; }
      if (nombre === c.nombre) return;
      const { error } = await S.sb.from('canales_origen').update({ nombre }).eq('id', id);
      if (error) { txt.value = c.nombre; toast(errMsg(error)); return; }
      c.nombre = nombre; toast('Canal renombrado');
    });
    sw.addEventListener('change', async () => {
      const c = S.canales.find(x => x.id===id);
      const { error } = await S.sb.from('canales_origen').update({ activo: sw.checked }).eq('id', id);
      if (error) { sw.checked = c.activo; toast(errMsg(error)); return; }
      c.activo = sw.checked; row.classList.toggle('off', !c.activo);
    });
  });
}

async function agregarCanalAjustes(){
  const inp = $('#s-canal-nuevo'), err = $('#s-canal-err'), nombre = inp.value.trim(); err.textContent = '';
  if (!nombre) return;
  const orden = S.canales.reduce((m,x)=>Math.max(m,x.orden),0) + 1;
  const { data, error } = await S.sb.from('canales_origen').insert({ nombre, orden }).select().single();
  if (error) { err.textContent = errMsg(error); return; }
  S.canales.push(data); inp.value = ''; pintarCanalesAjustes(); toast('Canal agregado');
}

async function guardarEmpresa(){
  const v = id => $(id).value.trim() || null, err = $('#s-emp-err'); err.textContent = '';
  const nombre = $('#s-nom').value.trim();
  if (!nombre) { err.textContent = 'El nombre no puede quedar vacío.'; return; }
  const datos = { nombre, razon_social:v('#s-rs'), rfc:v('#s-rfc') ? v('#s-rfc').toUpperCase() : null, direccion:v('#s-dir') };
  const { data, error } = await S.sb.from('empresas').update(datos).eq('id', S.empresa.id).select().single();
  if (error) { err.textContent = errMsg(error); return; }
  S.empresa = data; const n = $('.top .name'); if (n) n.textContent = data.nombre; toast('Datos guardados');
}

/* ── Logo de la empresa ── */
const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp'];
async function prepararLogo(archivo){
  if (!TIPOS_LOGO.includes(archivo.type)) throw new Error('El logo debe ser una imagen PNG, JPG o WEBP.');
  if (archivo.size > 10 * 1024 * 1024) throw new Error('La imagen pesa demasiado (máximo 10 MB).');
  let bmp; try { bmp = await createImageBitmap(archivo); } catch (_) { throw new Error('No se pudo leer la imagen. Prueba con otra.'); }
  const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas'); lienzo.width = Math.max(1, Math.round(bmp.width * k)); lienzo.height = Math.max(1, Math.round(bmp.height * k));
  lienzo.getContext('2d').drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  const tipo = archivo.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';   // el PNG conserva la transparencia
  const blob = await new Promise(r => lienzo.toBlob(r, tipo, 0.9));
  if (!blob) throw new Error('No se pudo preparar la imagen. Prueba con otra.');
  if (blob.size > 2 * 1024 * 1024) throw new Error('Aun reducida, la imagen pesa más de 2 MB. Usa una más sencilla.');
  return { blob, tipo, ext: tipo === 'image/jpeg' ? 'jpg' : 'png' };
}
async function subirLogo(archivo){
  const msg = $('#lg-msg'); msg.textContent = '';
  const btn = $('#lg-btn'); btn.setAttribute('aria-busy', 'true'); btn.querySelector('span').textContent = 'Subiendo…';
  try {
    const { blob, tipo, ext } = await prepararLogo(archivo);
    const ruta = `${S.empresa.id}/logo-${Date.now()}.${ext}`, viejo = S.empresa.logo_path;
    const up = await S.sb.storage.from('logos').upload(ruta, blob, { contentType: tipo, cacheControl: '31536000', upsert: false });
    if (up.error) throw up.error;
    const { data, error } = await S.sb.from('empresas').update({ logo_path: ruta }).eq('id', S.empresa.id).select().single();
    if (error) { await S.sb.storage.from('logos').remove([ruta]); throw error; }
    S.empresa = data;
    if (viejo) await S.sb.storage.from('logos').remove([viejo]);   // se borra el anterior para no acumular archivos
    pintarShell('ajustes'); pintarAjustes(); toast('Logo guardado');
  } catch (e) { msg.textContent = errMsg(e); btn.removeAttribute('aria-busy'); btn.querySelector('span').textContent = S.empresa?.logo_path ? 'Cambiar logo' : 'Subir logo'; }
}
async function quitarLogo(){
  const msg = $('#lg-msg'); msg.textContent = ''; const viejo = S.empresa.logo_path;
  const { data, error } = await S.sb.from('empresas').update({ logo_path: null }).eq('id', S.empresa.id).select().single();
  if (error) { msg.textContent = errMsg(error); return; }
  S.empresa = data; if (viejo) await S.sb.storage.from('logos').remove([viejo]);
  pintarShell('ajustes'); pintarAjustes(); toast('Logo quitado');
}

async function dibujarAjustes(){
  $('#vista').innerHTML = '<div class="center">Cargando…</div>';
  const can = await S.sb.from('canales_origen').select('*').order('orden').order('nombre');
  if (can.error) { $('#vista').innerHTML = `<div class="empty"><h3>No se pudo cargar</h3><p>${esc(errMsg(can.error))}</p><button class="btn" id="aj-re">Reintentar</button></div>`; $('#aj-re').onclick = dibujarAjustes; return; }
  S.canales = can.data || [];
  pintarAjustes();
}
iniciarPagina({ modulo:'ajustes', dibujar:dibujarAjustes });
