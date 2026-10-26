(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var DEMO = Q.get('demo');
  var TODAY = { antes: '2026-10-25', recogida: '2027-02-20', datos: '2027-04-20' }[DEMO] || new Date().toISOString().slice(0, 10);
  var SRC = {
    estado: DEMO === 'antes' ? null : DEMO === 'datos' ? 'data/ejemplo/estado_unidades.csv' : 'data/estado_unidades.csv',
    celdas: DEMO === 'datos' ? 'data/ejemplo/celdas_publicadas.csv' : 'data/celdas_publicadas.csv',
    transp: 'data/transparencia.csv',
    geo: 'data/barris.geojson',
    estj: '/observatorio/estado.json'
  };
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MQ = window.matchMedia('(max-width: 899px)');
  var HOVER = window.matchMedia('(hover: hover)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var root = document.documentElement;

  var SECT = [['belleza', 'Belleza y cuidado personal'], ['hosteleria', 'Hostelería'], ['alimentacion', 'Alimentación'], ['otros', 'Otros comercios y servicios']];
  var SHORT = { all: 'Todos', belleza: 'Belleza', hosteleria: 'Hostelería', alimentacion: 'Alimentación', otros: 'Otros' };
  var MET = [['total_mensual', 'Total mensual'], ['tasa_efectiva', 'Cobro con tarjeta'], ['banco', 'Banco'], ['alarma', 'Alarma'], ['telefono', 'Teléfono e internet'], ['programas', 'Programas y plataformas']];
  var EST = { con_datos: 'Con datos', en_recogida: 'En recogida', proximamente: 'Próximamente' };
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var LOCK = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="6" width="9" height="6.5" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M4.5 6V4.3a2.5 2.5 0 015 0V6" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>';

  var S = { units: {}, barri: {}, layers: {}, cells: [], edition: null, editions: [], sel: null, sector: 'all', metric: 'total_mensual', map: null, ready: false };

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function get(u) { return u ? fetch(u).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }) : Promise.resolve(''); }
  function csv(t) {
    var lines = t.split(/\r?\n/).filter(function (l) { return l && l.charAt(0) !== '#'; });
    if (!lines.length) return [];
    var h = lines.shift().split(',');
    return lines.map(function (l) { var v = l.split(','), o = {}; h.forEach(function (k, i) { o[k] = v[i] === undefined ? '' : v[i]; }); return o; });
  }
  function EN() { return root.lang === 'en'; }
  function nf(v, d) { return Number(v).toLocaleString(EN() ? 'en-GB' : 'es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function fmt(v, u) { if (u === 'meses') return nf(Math.round(v), 0); if (u === 'pct') return nf(v, 1) + (EN() ? '%' : ' %'); return EN() ? '€' + nf(Math.round(v), 0) : nf(Math.round(v), 0) + ' €'; }
  function fmtMed(v, u) { return u === 'eur_mes' ? fmt(v, u) + (EN() ? '/month' : '/mes') : fmt(v, u); }
  function rango(a, b, u) { if (u === 'pct') return nf(a, 1) + '–' + nf(b, 1) + (EN() ? '%' : ' %'); return EN() ? '€' + nf(Math.round(a), 0) + '–' + nf(Math.round(b), 0) : nf(Math.round(a), 0) + '–' + nf(Math.round(b), 0) + ' €'; }
  var I18N = {
    'Cobro con tarjeta (tasa efectiva)': ['Cobrament amb targeta (taxa efectiva)', 'Card payments (effective rate)'],
    'Belleza y cuidado personal': ['Bellesa i cura personal', 'Beauty and personal care'],
    'Otros comercios y servicios': ['Altres comerços i serveis', 'Other shops and services'],
    'Hostelería': ['Hostaleria', 'Hospitality'], 'Alimentación': ['Alimentació', 'Food'],
    'Programas y plataformas': ['Programes i plataformes', 'Software and platforms'],
    'Teléfono e internet': ['Telèfon i internet', 'Phone and internet'],
    'Total mensual': ['Total mensual', 'Monthly total'], 'Cobro con tarjeta': ['Cobrament amb targeta', 'Card payments'],
    'Media del Banco de España:': ['Mitjana del Banc d\'Espanya:', 'Bank of Spain average:'], 'valor y fuente pendientes': ['valor i font pendents', 'value and source pending'],
    'Topes de las tasas de intercambio: 0,2 % (débito) y 0,3 % (crédito). Reglamento (UE) 2015/751.': ['Límits de les taxes d\'intercanvi: 0,2 % (dèbit) i 0,3 % (crèdit). Reglament (UE) 2015/751.', 'Interchange fee caps: 0.2% (debit) and 0.3% (credit). Regulation (EU) 2015/751.'],
    'La mitad de los negocios paga entre estas dos cifras. Una cuarta parte paga menos y otra cuarta parte, más.': ['La meitat dels negocis paga entre aquestes dues xifres. Una quarta part paga menys i una altra quarta part, més.', 'Half of businesses pay between these two figures. A quarter pay less and a quarter pay more.'],
    'Qué significa el rango habitual': ['Què significa el rang habitual', 'What the usual range means'],
    '— No se publica: menos de 10 negocios. Cobro con tarjeta en % de las ventas con tarjeta.': ['— No es publica: menys de 10 negocis. Cobrament amb targeta en % de les vendes amb targeta.', '— Not published: fewer than 10 businesses. Card payments as % of card sales.'],
    'No se publica: hay menos de 10 negocios en este grupo.': ['No es publica: hi ha menys de 10 negocis en aquest grup.', 'Not published: there are fewer than 10 businesses in this group.'],
    'Le mostramos el dato de toda la ciudad.': ['Li mostrem la dada de tota la ciutat.', 'We show you the figure for the whole city.'],
    'Le mostramos el dato de su distrito.': ['Li mostrem la dada del seu districte.', 'We show you the figure for your district.'],
    'Tasa efectiva por ventas con tarjeta · toda la ciudad': ['Taxa efectiva per vendes amb targeta · tota la ciutat', 'Effective rate by card sales · whole city'],
    'Sector × categoría · medianas': ['Sector × categoria · medianes', 'Sector × category · medians'],
    'Los datos se publican al cerrar la oleada y solo en grupos de 10 negocios o más.': ['Les dades es publiquen en tancar l\'onada i només en grups de 10 negocis o més.', 'Data is published when the wave closes, and only for groups of 10 or more businesses.'],
    '¿Tiene un negocio aquí? Déjeme su contacto y le aviso.': ['Té un negoci aquí? Deixi\'m el seu contacte i l\'avisaré.', 'Do you run a business here? Leave me your contact details and I will let you know.'],
    'Aún no hemos llegado a este barrio.': ['Encara no hem arribat a aquest barri.', 'We have not reached this neighbourhood yet.'],
    'No hay negocios de este sector en esta edición.': ['No hi ha negocis d\'aquest sector en aquesta edició.', 'There are no businesses from this sector in this edition.'],
    'Los primeros resultados se publicarán aquí.': ['Els primers resultats es publicaran aquí.', 'The first results will be published here.'],
    'Ver informe de ejemplo (datos ficticios)': ['Veure informe d\'exemple (dades fictícies)', 'See sample report (fictitious data)'],
    'Cuotas en €/mes, sin IVA': ['Quotes en €/mes, sense IVA', 'Fees in €/month, excluding VAT'],
    'Negocios con permanencia vigente': ['Negocis amb permanència vigent', 'Businesses with a contract lock-in'],
    'Meses restantes (mediana)': ['Mesos restants (mediana)', 'Months remaining (median)'],
    'Su posición frente a negocios parecidos de su barrio': ['La seva posició davant de negocis semblants del seu barri', 'Your position against similar businesses in your neighbourhood'],
    'Su tasa efectiva de cobro con tarjeta': ['La seva taxa efectiva de cobrament amb targeta', 'Your effective card acceptance rate'],
    'Comisiones, cuota del terminal y mínimos, como porcentaje de lo que vende con tarjeta.': ['Comissions, quota del terminal i mínims, com a percentatge del que ven amb targeta.', 'Fees, terminal rental and minimums, as a percentage of your card sales.'],
    'Calendario de permanencias': ['Calendari de permanències', 'Contract lock-in calendar'],
    'Alarma · penalización de 120 €': ['Alarma · penalització de 120 €', 'Alarm · €120 early-exit fee'],
    'Vence en 9 meses': ['Venç d\'aquí a 9 mesos', 'Ends in 9 months'], 'Vence en 17 meses': ['Venç d\'aquí a 17 mesos', 'Ends in 17 months'],
    'Sin permanencia': ['Sense permanència', 'No lock-in'],
    'Preguntas para su banco o su proveedor': ['Preguntes per al seu banc o el seu proveïdor', 'Questions for your bank or provider'],
    '¿Puedo quitar la cuota mensual del datáfono o pasar a una tarifa sin mínimos?': ['Puc treure la quota mensual del datàfon o passar a una tarifa sense mínims?', 'Can I drop the monthly terminal fee or move to a plan with no minimums?'],
    '¿Qué penalización exacta tengo si cambio de alarma antes de que venza la permanencia?': ['Quina penalització exacta tinc si canvio d\'alarma abans que venci la permanència?', 'What exactly is the penalty if I switch alarm provider before the lock-in ends?'],
    '¿Qué comisiones de mantenimiento puedo evitar en la cuenta del negocio?': ['Quines comissions de manteniment puc evitar al compte del negoci?', 'Which maintenance fees can I avoid on the business account?'],
    'El informe es suyo y es gratis.': ['L\'informe és seu i és gratuït.', 'The report is yours, and it is free.'],
    'Último trimestre publicado:': ['Darrer trimestre publicat:', 'Latest quarter published:'],
    'Gracias. Le avisaré cuando la oleada llegue a su barrio.': ['Gràcies. L\'avisaré quan l\'onada arribi al seu barri.', 'Thank you. I will let you know when the wave reaches your neighbourhood.'],
    'Participación hasta ahora:': ['Participació fins ara:', 'Participation so far:'],
    'menos de 10 negocios': ['menys de 10 negocis', 'fewer than 10 businesses'], '20 negocios o más': ['20 negocis o més', '20 or more businesses'],
    'Referencias citadas': ['Referències citades', 'Cited references'], 'Permanencias': ['Permanències', 'Contract lock-ins'],
    'Por sector': ['Per sector', 'By sector'], 'Menos de 5.000 €/mes': ['Menys de 5.000 €/mes', 'Under €5,000/month'], '5.000 €/mes o más': ['5.000 €/mes o més', '€5,000/month or more'],
    'Cómo participar →': ['Com participar →', 'How to take part →'], 'Toda la ciudad': ['Tota la ciutat', 'Whole city'], 'Su distrito': ['El seu districte', 'Your district'],
    ' · tasa efectiva': [' · taxa efectiva', ' · effective rate'], ' · €/mes sin IVA': [' · €/mes sense IVA', ' · €/month excl. VAT'],
    'Rango habitual': ['Rang habitual', 'Usual range'], 'Mediana': ['Mediana', 'Median'], 'Usted:': ['Vostè:', 'You:'], 'Usted': ['Vostè', 'You'],
    'Con datos': ['Amb dades', 'With data'], 'En recogida': ['En recollida', 'Collecting'], 'Próximamente': ['Properament', 'Coming soon'],
    'Agrupación': ['Agrupació', 'Group'], 'Sin resultados': ['Cap resultat', 'No results'], 'Qué ver': ['Què veure', 'Show'], 'Edición': ['Edició', 'Edition'],
    'Datáfono': ['Datàfon', 'Card terminal'], 'Cerrar': ['Tancar', 'Close'], 'Acercar': ['Apropar', 'Zoom in'], 'Alejar': ['Allunyar', 'Zoom out'],
    'Belleza': ['Bellesa', 'Beauty'], 'Todos': ['Tots', 'All'], 'Otros': ['Altres', 'Other'], 'Banco': ['Banc', 'Banking'], 'Alarma': ['Alarma', 'Alarm']
  };
  var I18N_KEYS = Object.keys(I18N).sort(function (a, b) { return b.length - a.length; });
  function tr(s) {
    var l = root.lang; if (l === 'es' || !s) return s;
    var k = l === 'ca' ? 0 : 1;
    [['Ocultar informe de ejemplo', "Amagar l'informe d'exemple", 'Hide sample report'], ['alt="Informe de ejemplo con datos ficticios"', 'alt="Informe d\'exemple amb dades fictícies"', 'alt="Sample report with fictitious data"'], ['>DATOS FICTICIOS<', '>DADES FICTÍCIES<', '>FICTITIOUS DATA<'], ['>Descargar PDF<', '>Descarregar PDF<', '>Download PDF<']].forEach(function (p) { s = s.split(p[0]).join(p[k + 1]); });
    s = s.replace(/Para proteger el anonimato, (.+?) y ([^<]+?) se publican juntos\./g, k ? 'To protect anonymity, $1 and $2 are published together.' : "Per protegir l'anonimat, $1 i $2 es publiquen junts.");
    I18N_KEYS.forEach(function (key) { if (s.indexOf(key) >= 0) s = s.split(key).join(I18N[key][k]); });
    s = s.replace(/\bnegocios\b/g, k ? 'businesses' : 'negocis');
    return s;
  }
  function ventana(v) {
    var p = (v || '').split('/'); if (p.length < 2) return v || '';
    var a = p[0].split('-'), b = p[1].split('-');
    return MES[+a[1] - 1] + (a[0] !== b[0] ? ' ' + a[0] : '') + '–' + MES[+b[1] - 1] + ' ' + b[0];
  }
  function banda(b) { return b === '<10' ? 'menos de 10 negocios' : b === '20+' ? '20 negocios o más' : (b || '').replace('-', '–') + ' negocios'; }
  function pend() { return ''; }

  /* data */
  function cell(niv, amb, sec, met, tramo) {
    tramo = tramo || 'todos';
    for (var i = 0; i < S.cells.length; i++) {
      var c = S.cells[i];
      if (c.edicion === S.edition && c.nivel === niv && c.ambito_id === amb && c.sector === sec && c.metrica === met && c.tramo === tramo) return c;
    }
    return null;
  }
  function ok(c) { return c && c.publicado === 'true' && +c.n >= 10; }
  function maxOf(met) {
    var m = 0;
    S.cells.forEach(function (c) { if (c.metrica === met && ok(c)) m = Math.max(m, +c.p75 || +c.mediana); });
    return m * 1.15 || 1;
  }
  function nOf(niv, amb) {
    var n = 0;
    S.cells.forEach(function (c) { if (c.edicion === S.edition && c.nivel === niv && c.ambito_id === amb && c.metrica === 'total_mensual' && c.tramo === 'todos' && c.sector !== 'todos') n += +c.n || 0; });
    return n;
  }

  /* figure component */
  var figId = 0;
  function fig(c, ref, opts) {
    opts = opts || {};
    var u = c.unidad_medida, max = opts.max || maxOf(c.metrica), pc = function (v) { return Math.max(0, Math.min(100, v / max * 100)); };
    var id = 'fh' + (++figId);
    var bar = '<span class="fig-iqr" style="left:' + pc(c.p25) + '%;width:' + (pc(c.p75) - pc(c.p25)) + '%"></span>' +
      (ref && ok(ref) ? '<span class="fig-ref" style="left:' + pc(ref.mediana) + '%"></span>' : '') +
      '<span class="fig-med" style="left:' + pc(c.mediana) + '%"></span>' +
      (opts.you != null ? '<span class="fig-you" style="left:' + pc(opts.you) + '%"></span>' : '');
    var lbl = (opts.you != null ? 'Usted: <strong>' + fmtMed(opts.you, u) + '</strong> · ' : '') +
      'Mediana <strong>' + fmtMed(c.mediana, u) + '</strong> · Rango habitual ' + rango(c.p25, c.p75, u) + ' · ' + c.n + ' negocios';
    return '<div class="fig"><div class="fig-bar" role="img" aria-label="' + esc(lbl.replace(/<[^>]+>/g, '')) + '">' + bar + '</div>' +
      '<p class="fig-lbl">' + lbl + ' <button type="button" class="fig-i" aria-expanded="false" aria-controls="' + id + '" aria-label="Qué significa el rango habitual"><span>i</span></button></p>' +
      '<p class="fig-help" id="' + id + '" hidden>La mitad de los negocios paga entre estas dos cifras. Una cuarta parte paga menos y otra cuarta parte, más.</p></div>';
  }
  function key(withRef, withYou) {
    return '<p class="obs-key"><span><i style="width:22px;background:var(--navy-15)"></i>Rango habitual</span><span><i style="width:2px;background:var(--navy)"></i>Mediana</span>' +
      (withRef ? '<span><i style="width:1px;background:rgba(11,18,32,.45)"></i>Toda la ciudad</span>' : '') +
      (withYou ? '<span><i style="width:3px;background:var(--gold);outline:1px solid var(--navy)"></i>Usted</span>' : '') + '</p>';
  }
  function supp(fallback) {
    return '<p class="obs-supp">' + LOCK + '<span>No se publica: hay menos de 10 negocios en este grupo.' + (fallback ? ' Le mostramos el dato de ' + fallback + '.' : '') + '</span></p>';
  }

  /* panel */
  var panel = $('#obs-panel'), body = $('#obs-panel-body');
  function filters() {
    var chips = [['all', 'Todos']].concat(SECT).map(function (s) {
      return '<button type="button" class="chip" data-sector="' + s[0] + '" aria-pressed="' + (S.sector === s[0]) + '">' + SHORT[s[0]] + '</button>';
    }).join('');
    var sel = MET.map(function (m) { return '<option value="' + m[0] + '"' + (S.metric === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('');
    var ed = S.editions.length > 1 ? '<label class="obs-sel"><span class="obs-lbl">Edición</span><select data-edition>' + S.editions.map(function (e) { return '<option' + (e === S.edition ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label>' : '';
    return '<div class="obs-filters"><div class="chips" role="group" aria-label="Sector">' + chips + '</div>' +
      '<label class="obs-sel"><span class="obs-lbl">Qué ver</span><select data-metric>' + sel + '</select></label>' + ed + '</div>';
  }
  function sectors() { return SECT.filter(function (s) { return S.sector === 'all' || S.sector === s[0]; }); }
  function closeBtn() { return S.sel ? '<button class="obs-close obs-close--in" type="button" data-panel-close aria-label="Cerrar">✕</button>' : ''; }

  function L3(es, ca, en) { return root.lang === 'ca' ? ca : root.lang === 'en' ? en : es; }
  var DEMO_CARDS = [
    [['Tasa efectiva al cobrar con tarjeta', 'Taxa efectiva en cobrar amb targeta', 'Effective rate for card payments'], 0.6, 1, ' %', 0.4, 0.9, 1.5],
    [['Cuota del datáfono', 'Quota del datàfon', 'Card terminal fee'], 18, 0, ' €/mes', 12, 25, 40],
    [['Mantenimiento de la cuenta del negocio', 'Manteniment del compte del negoci', 'Business account maintenance'], 14, 0, ' €/mes', 9, 20, 30],
    [['Total de costes recurrentes', 'Total de costos recurrents', 'Total recurring costs'], 96, 0, ' €/mes', 72, 130, 180]
  ];
  function demoNum(v, d) { return Number(v).toLocaleString(root.lang === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function demoUnit(u) { return root.lang === 'en' ? u.replace('€/mes', '€/month') : u; }
  function miniPanel() {
    var fict = L3('Vista previa · datos ficticios', 'Vista prèvia · dades fictícies', 'Preview · fictitious data');
    var wm = L3('DATOS FICTICIOS', 'DADES FICTÍCIES', 'FICTITIOUS DATA');
    var title = L3('Así se verán los resultados', 'Així es veuran els resultats', 'This is how results will look');
    var avg = L3('Media del barrio', 'Mitjana del barri', 'Neighbourhood average');
    return '<div class="obs-mini" role="group" aria-label="' + esc(fict) + '" data-mini>' +
      '<div class="obs-mini-wm" aria-hidden="true"><span>' + wm + '</span><span>' + wm + '</span><span>' + wm + '</span></div>' +
      '<div class="obs-mini-head"><p class="obs-mini-tag">' + fict + '</p></div>' +
      '<div class="obs-mini-grid">' + DEMO_CARDS.map(function (c) {
        var mx = c[6], fin = demoNum(c[1], c[2]) + demoUnit(c[3]);
        return '<div class="obs-mini-card"><p class="obs-mini-l">' + L3(c[0][0], c[0][1], c[0][2]) + '</p>' +
          '<p class="obs-mini-v"><span class="obs-sr">' + avg + ': ' + fin + '</span><span aria-hidden="true"><span data-count="' + c[1] + '" data-dec="' + c[2] + '">' + demoNum(S.countDone || RM ? c[1] : 0, c[2]) + '</span>' + demoUnit(c[3]) + '</span></p>' +
          '</div>';
      }).join('') + '</div><p class="obs-mini-foot" aria-hidden="true">' + L3('Medias del barrio', 'Mitjanes del barri', 'Neighbourhood averages') + '</p></div>';
  }
  function runCount() {
    var el = $('[data-mini]', body); if (!el) return;
    if (S.countDone || RM) { S.countDone = true; return; }
    if (S.countIO) S.countIO.disconnect();
    var go = function () {
      S.countDone = true;
      var t0 = null;
      var step = function (t) {
        if (t0 == null) t0 = t;
        var k = Math.min(1, (t - t0) / 1000), e = 1 - Math.pow(1 - k, 3);
        $$('[data-count]', body).forEach(function (n) { n.textContent = demoNum(+n.getAttribute('data-count') * (k < 1 ? e : 1), +n.getAttribute('data-dec')); });
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) return go();
    S.countIO = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { S.countIO.disconnect(); go(); } }, { threshold: 0.4 });
    S.countIO.observe(el);
  }
  function renderCity() {
    if (!S.edition) {
      return '<div class="obs-city0"><p class="label muted">Barcelona</p>' +
        '<p class="obs-panel-big">Los primeros resultados se publicarán aquí.</p>' +
        miniPanel() + '</div>';
    }
    var met = MET.filter(function (m) { return m[0] === S.metric; })[0];
    var h = pend() + '<div class="obs-ph"><p class="label muted">Toda la ciudad</p><h3>Barcelona</h3><p class="meta">' + nOf('ciudad', 'barcelona') + ' negocios · Cuotas en €/mes, sin IVA</p></div>' + filters();
    h += '<section class="obs-block"><h4>Por sector</h4>' + key(false) + sectors().map(function (s) {
      var parts = [S.metric === 'tasa_efectiva' ? ['tasa_efectiva', 'Cobro con tarjeta (tasa efectiva)'] : met, S.metric === 'tasa_efectiva' ? null : ['tasa_efectiva', 'Cobro con tarjeta (tasa efectiva)']].filter(Boolean);
      var cs = parts.map(function (m) { return cell('ciudad', 'barcelona', s[0], m[0]); });
      if (cs.every(function (c) { return c && !ok(c); })) return '<div class="obs-row"><p class="t">' + s[1] + '</p>' + supp() + '</div>';
      return '<div class="obs-row"><p class="t">' + s[1] + '</p>' + parts.map(function (m) {
        var c = cell('ciudad', 'barcelona', s[0], m[0]);
        if (!c) return '';
        return '<p class="small muted">' + m[1] + '</p>' + (ok(c) ? fig(c) : supp());
      }).join('') + '</div>';
    }).join('') + '</section>';
    h += '<section class="obs-block"><h4>Sector × categoría · medianas</h4><div class="obs-mt-wrap"><table class="obs-mt"><thead><tr><th scope="col">Sector</th>' +
      MET.map(function (m) { return '<th scope="col">' + m[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      SECT.map(function (s) {
        return '<tr><th scope="row">' + s[1] + '</th>' + MET.map(function (m) {
          var c = cell('ciudad', 'barcelona', s[0], m[0]);
          return ok(c) ? '<td>' + fmt(c.mediana, c.unidad_medida) + '</td>' : '<td class="off" aria-label="No se publica">—</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody><caption>— No se publica: menos de 10 negocios. Cobro con tarjeta en % de las ventas con tarjeta.</caption></table></div></section>';
    var t1 = cell('ciudad', 'barcelona', 'todos', 'tasa_efectiva', 'lt5000'), t2 = cell('ciudad', 'barcelona', 'todos', 'tasa_efectiva', 'ge5000');
    if (t1 || t2) {
      h += '<section class="obs-block"><h4>Tasa efectiva por ventas con tarjeta · toda la ciudad</h4>' +
        [[t1, 'Menos de 5.000 €/mes'], [t2, '5.000 €/mes o más']].map(function (x) { return x[0] ? '<div class="obs-row"><p class="t">' + x[1] + '</p>' + (ok(x[0]) ? fig(x[0]) : supp()) + '</div>' : ''; }).join('') + '</section>';
    }
    var p1 = cell('ciudad', 'barcelona', 'todos', 'permanencia_pct'), p2 = cell('ciudad', 'barcelona', 'todos', 'permanencia_meses');
    if (p1 || p2) {
      h += '<section class="obs-block"><h4>Permanencias</h4><dl class="obs-kv">' +
        (ok(p1) ? '<dt>Negocios con permanencia vigente</dt><dd>' + nf(p1.mediana, 0) + ' % · ' + p1.n + ' negocios</dd>' : '') +
        (ok(p2) ? '<dt>Meses restantes (mediana)</dt><dd>' + nf(p2.mediana, 0) + ' · ' + p2.n + ' negocios</dd>' : '') + '</dl></section>';
    }
    h += '<section class="obs-block"><h4>Referencias citadas</h4><ul class="obs-refs">' +
      '<li>Media del Banco de España: <span class="pend">valor y fuente pendientes</span></li>' +
      '<li>Topes de las tasas de intercambio: 0,2 % (débito) y 0,3 % (crédito). Reglamento (UE) 2015/751.</li></ul></section>';
    return h;
  }

  function header(u, label, meta) {
    var note = '';
    if (u.barris.length > 1) {
      var names = u.barris.map(function (b) { return S.barri[b] ? S.barri[b].name : String(b); }).sort(function (a, b) { var ia = u.name.indexOf(a), ib = u.name.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      note = '<p class="obs-note">Para proteger el anonimato, ' + names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1] + ' se publican juntos.</p>';
    }
    return pend() + '<div class="obs-ph" style="position:relative;padding-right:56px"><p class="label muted">' + label + '</p><h3>' + esc(u.name) + '</h3>' + (meta ? '<p class="meta">' + meta + '</p>' : '') + closeBtn().replace('class="obs-close', 'style="position:absolute;top:0;right:0" class="obs-close') + '</div>' + note;
  }

  function renderUnit(u) {
    if (u.estado === 'con_datos' && S.edition) {
      var met = MET.filter(function (m) { return m[0] === S.metric; })[0];
      var h = header(u, 'Con datos', nOf('unidad', u.id) + ' negocios') + filters();
      h += '<section class="obs-block"><h4>' + met[1] + (S.metric === 'tasa_efectiva' ? ' · tasa efectiva' : ' · €/mes sin IVA') + '</h4>' + key(true);
      var any = false;
      sectors().forEach(function (s) {
        var c = cell('unidad', u.id, s[0], S.metric);
        if (!c) return;
        any = true;
        var city = cell('ciudad', 'barcelona', s[0], S.metric);
        if (ok(c)) { h += '<div class="obs-row"><p class="t">' + s[1] + '</p>' + fig(c, city) + '</div>'; return; }
        var d = cell('distrito', u.districte, s[0], S.metric), fb = ok(d) ? [d, 'su distrito'] : ok(city) ? [city, 'toda la ciudad'] : null;
        h += '<div class="obs-row"><p class="t">' + s[1] + '</p>' + supp(fb && fb[1]) + (fb ? '<p class="small muted">' + (fb[1] === 'su distrito' ? 'Su distrito' : 'Toda la ciudad') + '</p>' + fig(fb[0]) : '') + '</div>';
      });
      if (!any) h += '<p class="muted">No hay negocios de este sector en esta edición.</p>';
      return h + '</section>';
    }
    if (u.estado === 'en_recogida' || u.estado === 'con_datos') {
      if (u.part != null) {
        var p = u.part, pct = Math.min(p, 10) * 10, lp = L3('Comercios participantes', 'Comerços participants', 'Participating businesses');
        return header(u, '', '').replace('<p class="label muted"></p>', '<p class="obs-tag-col">' + L3('En recogida', 'En recollida', 'Collecting') + '</p>') +
          '<div class="obs-prog"><p class="obs-lbl">' + lp + '</p>' +
          (p > 0 ? '<p class="obs-prog-n">' + p + '<span> / 10</span></p>' : '<p class="obs-prog-w">' + L3('Recogida en curso', 'Recollida en curs', 'Collection under way') + '</p>') +
          '<div class="obs-prog-bar" role="progressbar" aria-valuemin="0" aria-valuemax="10" aria-valuenow="' + Math.min(p, 10) + '" aria-label="' + lp + '"><span style="width:' + pct + '%"></span></div>' +
          '<p class="small muted">' + L3('Los resultados se publican cuando hay al menos 10 comercios por sector.', 'Els resultats es publiquen quan hi ha almenys 10 comerços per sector.', 'Results are published once at least 10 businesses per sector take part.') + '</p></div>' +
          '<div><a class="btn btn--gold obs-btn-full" href="#pedir-visita" data-go-visit>' + L3('Pedir una visita', 'Demanar una visita', 'Request a visit') + '</a></div>';
      }
      return header(u, 'En recogida', '') +
        '<p class="obs-panel-msg">Participación hasta ahora: ' + banda(u.banda) + '.</p>' +
        '<p class="muted">Los datos se publican al cerrar la oleada y solo en grupos de 10 negocios o más.</p>' +
        '<div><a class="obs-link link-arrow" href="#participar" data-go-participar>Cómo participar →</a></div>';
    }
    return header(u, 'Próximamente', S.barri[u.barris[0]] ? S.barri[u.barris[0]].dn : '') +
      '<p class="obs-panel-msg">Aún no hemos llegado a este barrio.</p><p>¿Tiene un negocio aquí? Déjeme su contacto y le aviso.</p><div data-form-slot></div>';
  }

  function render() {
    var u = S.sel && S.units[S.sel];
    var keep = document.activeElement && body.contains(document.activeElement) ? (document.activeElement.getAttribute('data-sector') ? '[data-sector="' + document.activeElement.getAttribute('data-sector') + '"]' : document.activeElement.hasAttribute('data-metric') ? '[data-metric]' : null) : null;
    body.innerHTML = tr(u ? renderUnit(u) : renderCity());
    if (!u) runCount();
    var slot = $('[data-form-slot]', body);
    if (slot && u) {
      var tp = $('#obs-aviso-tpl'), f = tp && tp.content ? tp.content.querySelector('form') : null;
      if (f) {
        var c = f.cloneNode(true);
        $$('[id]', c).forEach(function (el) { el.id = 'pp-' + el.id; });
        $$('label[for]', c).forEach(function (el) { el.htmlFor = 'pp-' + el.htmlFor; });
        var s = $('[data-barri-select]', c); if (s) s.value = S.barri[u.barris[0]].name;
        slot.appendChild(c);
      }
    }
    if (keep) { var k = $(keep, body); if (k) k.focus(); }
  }

  body.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-sector]'))) { S.sector = t.getAttribute('data-sector'); render(); }
    else if ((t = e.target.closest('.fig-i'))) { var hp = document.getElementById(t.getAttribute('aria-controls')); var o = hp.hidden; hp.hidden = !o; t.setAttribute('aria-expanded', String(o)); }
    else if (e.target.closest('[data-go-participar]') || e.target.closest('[data-go-visit]')) { panel.classList.remove('is-sheet', 'is-full'); }
  });
  body.addEventListener('change', function (e) {
    if (e.target.matches('[data-metric]')) { S.metric = e.target.value; render(); }
    if (e.target.matches('[data-edition]')) { S.edition = e.target.value; render(); }
  });
  panel.addEventListener('click', function (e) { if (e.target.closest('[data-panel-close]')) { if (S.sel) unselect(); else if (S.rep) toggleRep(false); } });

  /* sheet (mobile) */
  var handle = $('[data-sheet-toggle]'), y0 = null;
  handle.addEventListener('click', function () { panel.classList.toggle('is-full'); });
  handle.addEventListener('pointerdown', function (e) { y0 = e.clientY; });
  handle.addEventListener('pointerup', function (e) {
    if (y0 == null) return; var dy = e.clientY - y0; y0 = null;
    if (dy < -30) { panel.classList.add('is-full'); e.preventDefault(); }
    else if (dy > 30) { if (panel.classList.contains('is-full')) panel.classList.remove('is-full'); else unselect(); e.preventDefault(); }
  });
  function sheet(open) {
    if (open && MQ.matches) { if (panel.classList.contains('is-sheet') && Q.get('hoja') !== 'full') { return; } panel.classList.add('is-sheet'); if (Q.get('hoja') === 'full') panel.classList.add('is-full'); }
    else { panel.classList.remove('is-sheet', 'is-full'); if (S.rep && !S.sel) { S.rep = false; render(); } }
  }
  MQ.addEventListener && MQ.addEventListener('change', function () { sheet(!!S.sel); if (S.map) S.map.invalidateSize(); });

  /* map */
  function stateOf(b) { var u = S.units[S.barri[b].unit]; return u ? u.estado : 'proximamente'; }
  function style(st) {
    if (st === 'con_datos') return { fillColor: '#0B1220', fillOpacity: 0.85, color: '#FFFFFF', weight: 1, opacity: 1 };
    if (st === 'en_recogida') return { fillColor: 'url(#obs-hatch)', fillOpacity: 1, color: '#FFFFFF', weight: 1, opacity: 1 };
    return { fillColor: '#F0E9DC', fillOpacity: 1, color: 'rgba(11,18,32,.3)', weight: 1, opacity: 1 };
  }
  var tipShow = function () {};
  function unitLayers(id) { var u = S.units[id]; return u ? u.barris.map(function (b) { return S.layers[b]; }).filter(Boolean) : []; }
  function hover(id, on) {
    unitLayers(id).forEach(function (l) { var p = l.getElement(); if (p) p.classList.toggle('is-hov', on); if (on && !S.sel) l.bringToFront(); });
  }
  function boundsOf(id) { var b = null; unitLayers(id).forEach(function (l) { b = b ? b.extend(l.getBounds()) : L.latLngBounds(l.getBounds().getSouthWest(), l.getBounds().getNorthEast()); }); return b; }
  function pad() { return MQ.matches ? { padding: [24, 24] } : { paddingTopLeft: [24, 150], paddingBottomRight: [64, 24] }; }
  function fit(b, max, still) {
    var o = pad(); o.maxZoom = max || 15;
    if (RM || still) { o.animate = false; S.map.fitBounds(b, o); } else { o.duration = 0.35; S.map.flyToBounds(b, o); }
  }

  function select(id, from) {
    if (!S.units[id]) return;
    S.rep = false;
    S.sel = id;
    var el = $('#obs-leaflet');
    el.classList.add('has-sel');
    $$('path.is-sel', el).forEach(function (p) { p.classList.remove('is-sel'); });
    unitLayers(id).forEach(function (l) { var p = l.getElement(); if (p) p.classList.add('is-sel'); l.bringToFront(); });
    if (MQ.matches) {
      fit(boundsOf(id), 14, true);
      render();
      cancelAnimationFrame(S.raf);
      S.raf = requestAnimationFrame(function () { if (S.sel === id) sheet(true); });
    } else {
      fit(boundsOf(id), 14);
      render();
      sheet(true);
    }
    var inp = $('#obs-q'); if (inp && from !== 'combo') inp.value = S.units[id].name;
    try { history.replaceState(null, '', location.pathname + location.search + '#' + id); } catch (e) {}
    if (from === 'combo' || from === 'key') { var h = $('.obs-ph h3', body); if (h) { h.tabIndex = -1; if (!MQ.matches) h.focus({ preventScroll: true }); } }
  }
  function unselect() {
    if (!S.sel) return;
    var prev = S.sel;
    S.sel = null;
    var el = $('#obs-leaflet');
    el.classList.remove('has-sel');
    $$('path.is-sel', el).forEach(function (p) { p.classList.remove('is-sel'); });
    fit(S.cityBounds, 13);
    render();
    sheet(false);
    $('#obs-q').value = '';
    try { history.replaceState(null, '', location.pathname + location.search + '#mapa'); } catch (e) {}
    var l = unitLayers(prev)[0]; if (l && document.activeElement === document.body) { var p = l.getElement(); if (p) p.focus({ preventScroll: true }); }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !S.sel) return;
    if ($('#obs-ejemplo').open) return;
    if (!$('#obs-list').hidden) return;
    unselect();
  });

  function initMap(gj) {
    var el = $('#obs-leaflet');
    el.innerHTML = '';
    var map = S.map = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false, zoomSnap: 0.25, minZoom: 11, maxZoom: 16, renderer: L.svg({ padding: 0.5 }), keyboard: false });
    L.control.zoom({ position: 'topright', zoomInTitle: tr('Acercar'), zoomOutTitle: tr('Alejar') }).addTo(map);
    var layer = L.geoJSON(gj, { style: function (f) { return style(stateOf(f.properties.b)); } });
    S.cityBounds = layer.getBounds();
    var o0 = pad(); o0.animate = false; map.fitBounds(S.cityBounds, o0);
    layer.addTo(map);
    var svg = el.querySelector('svg');
    if (svg) {
      var ns = 'http://www.w3.org/2000/svg', defs = document.createElementNS(ns, 'defs');
      defs.innerHTML = '<pattern id="obs-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="7" height="7" fill="rgba(212,175,55,.55)"/><rect width="2.2" height="7" fill="rgba(11,18,32,.25)"/></pattern>';
      svg.insertBefore(defs, svg.firstChild);
    }
    layer.eachLayer(function (l) {
      var b = l.feature.properties.b, id = S.barri[b].unit, p = l.getElement();
      S.layers[b] = l;
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', S.barri[b].name + ', ' + tr(EST[stateOf(b)]));
      if (FINE) l.on('mouseover', function () { tipShow(b); });
      l.on('click', function () { select(id, 'map'); });
      p.addEventListener('focus', function () { if (p.matches(':focus-visible')) tipShow(b); });
      p.addEventListener('blur', function () { if (S.tipB === b) tipShow(null); });
      p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id, 'key'); } });
    });
    var col = el.closest('.obs-map-col') || el;
    var tip = document.createElement('div'); tip.className = 'minimap-tip obs-map-tip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true'); col.appendChild(tip);
    tipShow = function (b) {
      if (S.tipB != null && S.layers[S.tipB]) { var op = S.layers[S.tipB].getElement(); if (op) op.classList.remove('is-hov'); }
      S.tipB = b;
      if (b == null || !S.layers[b]) { tip.hidden = true; return; }
      var l = S.layers[b], p = l.getElement();
      p.classList.add('is-hov'); l.bringToFront();
      tip.textContent = S.barri[b].name; tip.hidden = false;
      var bb = p.getBoundingClientRect(), cb = col.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      var x = bb.left + bb.width / 2 - cb.left; x = Math.max(tw / 2 + 8, Math.min(cb.width - tw / 2 - 8, x));
      var below = bb.top - cb.top - th - 10 < 8;
      tip.classList.toggle('is-below', below);
      tip.style.left = x + 'px';
      tip.style.top = (below ? Math.min(bb.bottom - cb.top, cb.height - th - 18) : bb.top - cb.top) + 'px';
    };
    if (FINE) el.addEventListener('mouseleave', function () { tipShow(null); });
    map.on('movestart zoomstart', function () { tipShow(null); });
    S.lastW = window.innerWidth;
    window.addEventListener('resize', function () { if (window.innerWidth === S.lastW) return; clearTimeout(S.rz); S.rz = setTimeout(function () { S.lastW = window.innerWidth; map.invalidateSize({ pan: false }); if (!S.sel) { var o = pad(); o.animate = false; map.fitBounds(S.cityBounds, o); } }, 150); });
    map.setMaxBounds(S.cityBounds.pad(1.5));
    var ex = $('[data-explore]');
    if (L.Browser.mobile && ex) {
      ex.hidden = false;
      ex.addEventListener('click', function () {
        var on = !map.dragging.enabled();
        if (on) map.dragging.enable(); else map.dragging.disable();
        ex.setAttribute('aria-pressed', String(on));
        ex.firstElementChild.textContent = on ? 'Dejar de explorar' : 'Explorar el mapa';
      });
    }
    S.ready = true;
  }

  /* combobox */
  var opts = [];
  function initCombo() {
    var inp = $('#obs-q'), list = $('#obs-list'), act = -1, shown = [];
    Object.keys(S.units).forEach(function (id) {
      var u = S.units[id];
      if (u.barris.length > 1) opts.push({ id: id, name: u.name, sub: 'Agrupación · ' + EST[u.estado] });
    });
    Object.keys(S.barri).forEach(function (b) {
      var x = S.barri[b], u = S.units[x.unit];
      opts.push({ id: x.unit, name: x.name, sub: (u.barris.length > 1 ? u.name + ' · ' : '') + EST[u.estado] });
    });
    opts.sort(function (a, b) { return a.name.replace(/^(el|la|les|l')\s?/i, '').localeCompare(b.name.replace(/^(el|la|les|l')\s?/i, ''), 'ca'); });
    function draw() {
      var q = norm(inp.value.trim());
      shown = opts.filter(function (o) { return !q || norm(o.name).indexOf(q) >= 0; });
      list.innerHTML = shown.length ? shown.map(function (o, i) { return '<li role="option" id="obs-o' + i + '" aria-selected="' + (i === act) + '" data-i="' + i + '">' + esc(o.name) + '<small>' + esc(tr(o.sub)) + '</small></li>'; }).join('') : '<li class="obs-empty" role="option" aria-disabled="true">Sin resultados</li>';
      if (act >= 0) inp.setAttribute('aria-activedescendant', 'obs-o' + act); else inp.removeAttribute('aria-activedescendant');
      var a = $('#obs-o' + act); if (a) { var t = a.offsetTop, h = list.clientHeight; if (t < list.scrollTop || t > list.scrollTop + h - 44) list.scrollTop = t - h / 2; }
    }
    function open(o) { list.hidden = !o; inp.setAttribute('aria-expanded', String(o)); if (o) draw(); }
    function pick(i) { var o = shown[i]; if (!o) return; inp.value = o.name; open(false); select(o.id, 'combo'); }
    inp.addEventListener('focus', function () { if (S.sel) inp.select(); act = -1; open(true); });
    inp.addEventListener('input', function () { act = 0; open(true); });
    inp.addEventListener('blur', function () { setTimeout(function () { open(false); }, 150); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(true); act = Math.min(act + 1, shown.length - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(act - 1, 0); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(act < 0 ? 0 : act); }
      else if (e.key === 'Escape') { if (!list.hidden) { e.stopPropagation(); open(false); } }
    });
    list.addEventListener('mousedown', function (e) { var li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(+li.getAttribute('data-i')); } });
  }

  /* example report: inline in panel */
  function toggleRep(force) {
    var open = force == null ? !S.rep : force;
    S.rep = open; S.repAnim = open && !RM;
    render(); S.repAnim = false;
    var b = $('[data-ejemplo]', body); if (b) b.focus({ preventScroll: true });
    if (MQ.matches) {
      if (open) { panel.classList.add('is-sheet', 'is-full'); }
      else if (!S.sel) { panel.classList.remove('is-sheet', 'is-full'); }
    }
  }
  /* example report */
  var lastFocus = null;
  function openEjemplo() {
    var d = $('#obs-ejemplo');
    lastFocus = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-ejemplo]') ? document.activeElement : $('[data-ejemplo]');
    document.documentElement.classList.add('obs-noscroll');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    d.focus();
  }
  var dlg = $('#obs-ejemplo') || document.createElement('dialog');
  dlg.setAttribute('tabindex', '-1');
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-modal-close]')) dlg.close(); });
  dlg.addEventListener('close', function () {
    document.documentElement.classList.remove('obs-noscroll');
    var t = lastFocus && lastFocus !== document.body && document.contains(lastFocus) ? lastFocus : $('[data-ejemplo]');
    if (t) t.focus({ preventScroll: true });
  });

  /* timeline, counters, table */
  function timeline() {
    var lis = $$('[data-timeline] li'), now = -1;
    lis.forEach(function (li, i) { if (now < 0 && TODAY <= li.getAttribute('data-to')) now = i; });
    lis.forEach(function (li, i) {
      li.classList.toggle('is-past', now < 0 || i < now);
      li.classList.toggle('is-now', i === now);
      if (i === now) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }
  function counters(rows) {
    if (!rows.length) return;
    var r = rows[rows.length - 1];
    $$('[data-counters] dd').forEach(function (dd) { var v = r[dd.getAttribute('data-k')]; dd.textContent = v === '' || v == null ? '—' : v; });
    var q = $('[data-counters-q]'); q.hidden = false; q.textContent = tr('Último trimestre publicado:') + ' ' + r.trimestre;
  }
  function table() {
    $$('.obs-table tbody tr').forEach(function (row) {
      var b = row.getAttribute('data-b'), x = S.barri[b]; if (!x) return;
      var u = S.units[x.unit];
      row.children[2].textContent = u.barris.length > 1 || u.estado !== 'proximamente' ? u.name : '—';
      row.children[3].textContent = tr(EST[u.estado]);
    });
  }

  if (Q.get('sent') === '1') {
    var more = $('#participar .obs-cta');
    if (more) { var n = document.createElement('p'); n.className = 'notice'; n.setAttribute('role', 'status'); n.textContent = tr('Gracias. Le avisaré cuando la oleada llegue a su barrio.'); more.parentNode.insertBefore(n, more); }
  }


  /* example card count-up (same effect as the map's sample panel) */
  (function () {
    var nums = $$('.obs-ex-n [data-l]');
    if (!nums.length || RM) return;
    var items = nums.map(function (s) {
      var fin = s.textContent, m = fin.match(/\d+(?:[.,]\d+)?/);
      if (!m) return null;
      var sep = m[0].indexOf(',') >= 0 ? ',' : '.', dec = (m[0].split(/[.,]/)[1] || '').length, val = parseFloat(m[0].replace(',', '.'));
      s.innerHTML = '<span class="obs-sr">' + esc(fin) + '</span><span aria-hidden="true"></span>';
      var vis = s.lastChild;
      var put = function (v) { vis.textContent = fin.replace(m[0], v.toFixed(dec).replace('.', sep)); };
      put(0);
      return { put: put, val: val };
    }).filter(Boolean);
    var go = function () {
      var t0 = null;
      var step = function (t) {
        if (t0 == null) t0 = t;
        var k = Math.min(1, (t - t0) / 1000), e = 1 - Math.pow(1 - k, 3);
        items.forEach(function (it) { it.put(k < 1 ? it.val * e : it.val); });
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var box = nums[0].closest('.obs-ex-figs') || nums[0];
    if (!('IntersectionObserver' in window)) return go();
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); go(); } }, { threshold: 0.4 });
    io.observe(box);
  })();
  timeline();
  document.addEventListener('nc-lang', function () {
    if (S.ready || body.innerHTML) render();
    Object.keys(S.layers).forEach(function (b) { var p = S.layers[b].getElement(); if (p) p.setAttribute('aria-label', S.barri[b].name + ', ' + tr(EST[stateOf(b)])); });
    if (Object.keys(S.units).length) table();
  });

  Promise.all([get(SRC.geo), get(SRC.estado), get(SRC.celdas), get(SRC.transp), fetch(SRC.estj, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; })]).then(function (r) {
    var gj = r[0] ? JSON.parse(r[0]) : null;
    if (!gj) return;
    var est = csv(r[1]);
    S.cells = csv(r[2]);
    counters(csv(r[3]));
    var eds = {};
    S.cells.forEach(function (c) { if (c.publicado === 'true') eds[c.edicion] = 1; });
    S.editions = Object.keys(eds).sort();
    S.edition = S.editions[S.editions.length - 1] || null;
    gj.features.forEach(function (f) { var p = f.properties; S.barri[p.b] = { name: p.n, d: p.d, dn: p.dn, unit: null }; });
    est.forEach(function (row) {
      var bs = row.barris.split('|').map(Number);
      S.units[row.unidad_id] = { id: row.unidad_id, name: row['nombre_' + (root.lang === 'ca' ? 'ca' : root.lang === 'en' ? 'en' : 'es')] || row.nombre_es, barris: bs, districte: row.districte, estado: row.estado, banda: row.banda_participacion, ventana: row.ventana_recogida };
      bs.forEach(function (b) { if (S.barri[b]) S.barri[b].unit = row.unidad_id; });
    });
    Object.keys(S.barri).forEach(function (b) {
      var x = S.barri[b];
      if (!x.unit) { var id = slug(x.name); x.unit = id; S.units[id] = { id: id, name: x.name, barris: [+b], districte: String(x.d), estado: 'proximamente' }; }
    });
    var ej = null; try { ej = r[4] ? JSON.parse(r[4]) : null; } catch (e) { ej = null; }
    if (ej) Object.keys(ej).forEach(function (k) {
      var u = S.units[k] || S.units[Object.keys(S.units).filter(function (id) { return id.replace(/^(el|la|les|l)-/, '') === k; })[0]];
      if (!u || !ej[k]) return;
      if (ej[k].estado) u.estado = ej[k].estado;
      u.part = Math.max(0, parseInt(ej[k].participantes, 10) || 0);
    });
    table();
    render();
    initCombo();
    var hashId = decodeURIComponent(location.hash.slice(1));
    var start = function () {
      if (S.map) return;
      initMap(gj);
      if (S.units[hashId]) select(hashId, 'hash');
    };
    if (S.units[hashId]) {
      start();
      var sec = $('#mapa');
      window.scrollTo(0, sec.getBoundingClientRect().top + window.pageYOffset - 64);
    } else if (hashId === 'mapa' || !('IntersectionObserver' in window)) {
      start();
    } else {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '600px 0px' });
      io.observe($('#obs-leaflet'));
    }
  });
})();
