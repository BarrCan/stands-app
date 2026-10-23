'use strict';
/* VERSIÓN DEL SITIO: único lugar donde se escribe. Se muestra en Ajustes.
   v0.6.0 - 2026-10-16
     - Usuarios y accesos: invitación por correo con rol; la persona crea su cuenta y el sistema la ubica.
       Ya no se crean empresas desde la pantalla de entrada. Recuperar contraseña. Acceso desactivado.
     - Exportar clientes a Excel y borrar clientes solo para administradores.
   v0.5.0 - 2026-10-14
     - Módulo Personal (solo administradores): equipo con nivel, jornadas con monto calculado por tarifa y
       hora extra, y pagos semanales con pagos parciales. Basado en el módulo de técnicos de BarrCan.
     - Cálculos de mano de obra y fechas en assets/calculo.js, con pruebas propias.
   v0.4.0 - 2026-10-14
     - Logo de la empresa: se sube desde Ajustes (solo administrador) y aparece en el encabezado.
   v0.3.0 - 2026-10-14
     - El sitio se separa en páginas por módulo (clientes, costos, ajustes) y piezas
       compartidas (assets/). Cada archivo se sella con una huella para que el navegador
       nunca mezcle versiones. Verificador automático antes de cada entrega.
   v0.2.0 - Pantalla Costos (piezas, tarifas, reglas) con historial para el supremo.
   v0.1.0 - Acceso, clientes con canales editables, ajustes y colores. */
const APP_VERSION = 'v0.6.0';
