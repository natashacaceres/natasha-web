/* Calculadora del datáfono. Todo se calcula en el navegador: no se envía ni se guarda nada. Las tarifas se leen de /data/tarifas-datafono.json. */
let PLANS = [];
// Motor de la calculadora: misma lógica que el Excel (Motor rápido / Motor preciso).
function calcular(PLANS, I) {
  const MARG = { Alta: 0.05, Media: 0.15, Baja: 0.30, Contrato: 0.05 };
  const N = v => (typeof v === "number" && isFinite(v) ? v : 0);
  const sectorOK = s => s === "Todos" || (s === "Restauración" && I.sector === "Bar o restaurante") || (s === "Belleza" && I.sector === "Peluquería o estética");
  let plans = PLANS.slice();
  if (I.contrato) {
    const c = I.contrato, d = v => (v === null || v === undefined || v === "" ? null : v);
    plans.push({ id: "CONTRATO", prov: "Su contrato", plan: "Su contrato actual", tipo: "Contrato", modelo: "Porcentaje", sim: "Contrato", fiab: "Contrato",
      rp: d(c.rp), fp: N(c.f), re: d(c.re), fe: N(c.f), rn: d(c.rn), fn: N(c.f), ra: d(c.ra), fa: N(c.f), rb: d(c.rb), fb: N(c.f), bz: 1, minop: 0,
      inc: [0, 0, 0, 0], incb: 0, exc: null, excmin: null, cuota: N(c.cuota), cuenta: 0, alq: N(c.alq), adic: null, compra: 0, dias: null,
      pm: 0, pv: null, pn: null, sector: "Todos", aviso: "Precios de su propio contrato.", tramos: [] });
  }
  const cur = plans.find(p => p.id === I.cur);
  const iva = 1 + I.IVA;
  const rows = plans.map(p => {
    const r = {};
    r.p = p;
    r.rp = p.rp == null ? I.NP : p.rp; r.fp = N(p.fp);
    r.re = p.re == null ? I.NP : p.re; r.fe = N(p.fe);
    r.rn = p.rn == null ? I.NP : p.rn; r.fn = N(p.fn);
    r.ra = p.ra == null ? I.NP : p.ra; r.fa = N(p.fa);
    r.rb = p.bz === 1 ? (p.rb == null ? I.BZ : p.rb) : r.rp;
    r.fb = p.bz === 1 ? N(p.fb) : r.fp;
    r.incb = p.bz === 1 ? N(p.incb) : p.inc[0];
    const minop = N(p.minop);
    const NE = V => {
      if (!(I.T > 0)) return 0;
      const pz = [[p.inc[0], I.wP, r.rp, r.fp], [p.inc[1], I.wE, r.re, r.fe], [p.inc[2], I.wN, r.rn, r.fn], [p.inc[3], I.wA, r.ra, r.fa], [r.incb, I.wB, r.rb, r.fb]];
      return V / I.T * pz.reduce((s, [inc, w, rr, ff]) => s + (1 - inc) * w * Math.max(I.T * rr + ff, minop), 0);
    };
    const ELIG = V => V * (I.wP * p.inc[0] + I.wE * p.inc[1] + I.wN * p.inc[2] + I.wA * p.inc[3] + I.wB * r.incb);
    const tr = p.tramos || [], nT = tr.length, maxlim = nT ? tr[nT - 1][0] : 0;
    const K = E => (p.modelo === "Tramos" ? tr.filter(t => t[0] < E).length + 1 : 0);
    const CUO = k => (p.modelo === "Tramos" && nT ? tr[Math.min(k, nT) - 1][1] : 0) * (I.IVAQ ? iva : 1);
    const EXC = E => (p.modelo === "Tramos" && E > maxlim ? Math.max((E - maxlim) * N(p.exc), I.T > 0 ? (E - maxlim) / I.T * N(p.excmin) : 0) : 0);
    r.es_actual = p.id === I.cur ? 1 : 0;
    r.mismo = cur && p.prov === cur.prov ? 1 : 0;
    let fijos = N(p.cuota) + (I.CTA ? N(p.cuenta) : 0) + (N(p.alq) + Math.max(0, I.ND - 1) * N(p.adic)) * iva;
    if (I.swLock && !r.mismo) fijos += N(I.swNew) - N(I.swF);
    const V = I.V, E = ELIG(V), Vf = V * I.pF, Ef = ELIG(Vf);
    r.cuota = CUO(K(E)); r.cuotaf = CUO(K(Ef));
    r.Cn = NE(V) + r.cuota + EXC(E) + fijos;
    r.Cf = NE(Vf) + r.cuotaf + EXC(Ef) + fijos;
    r.cubierto = V > 0 ? E / V : 0;
    r.anual = (12 - I.nF) * r.Cn + I.nF * r.Cf;
    r.cuota_anual = (12 - I.nF) * r.cuota + I.nF * r.cuotaf;
    r.promo = I.PROMO && !r.mismo && N(p.pm) > 0 && I.V >= N(p.pv) && (p.pn == null || I.wN <= p.pn) ? 1 : 0;
    r.ahorro_promo = r.promo * Math.min(N(p.pm), 12) / 12 * r.cuota_anual;
    r.coste_cambio = r.mismo ? 0 : N(p.compra) * I.ND * iva + N(I.PEN) + N(I.CAJA);
    r.m = MARG[p.fiab] ?? 0.15;
    r.tasa = V > 0 ? r.Cn / V : 0;
    const formaOK = !I.forma || !p.forma || p.forma === "Todos" || p.forma === I.forma;
    const sim = I.cons
      ? p.sim === "Sí" && sectorOK(p.sector) && p.fiab !== "Baja" && formaOK
      : (p.sim === "Sí" || (p.id === "CONTRATO" && I.cur === "CONTRATO")) && sectorOK(p.sector) && (I.incBaja || p.fiab !== "Baja")
        && (I.maxDias == null || p.dias == null || p.dias <= I.maxDias) && formaOK;
    r.sim = sim;
    return r;
  });
  const c = rows.find(r => r.es_actual);
  if (!c) return null;
  const CURANN = N(I.curCost) > 0 ? N(I.curCost) * (c.Cn > 0 ? c.anual / c.Cn : 12) : c.anual * (1 - I.cons * c.m);
  rows.forEach(r => {
    r.anual_adj = r.es_actual ? CURANN : r.anual * (1 + I.cons * r.m);
    r.ano1 = r.anual_adj - r.ahorro_promo + r.coste_cambio;
    r.ano2 = r.anual_adj;
    r.ahorro1 = r.es_actual ? 0 : CURANN - r.ano1;
    r.ahorro2 = r.es_actual ? 0 : CURANN - r.ano2;
    r.ahorro_m = r.es_actual ? 0 : (CURANN - r.ano2) / 12;
    r.ahorro_lo = r.es_actual ? 0 : (CURANN - r.anual * (1 + r.m)) / 12;
    r.ahorro_hi = r.es_actual ? 0 : (CURANN - r.anual * (1 - r.m)) / 12;
    r.meses_promo = r.promo * Math.min(N(r.p.pm), 12);
    r.promo_m = r.meses_promo > 0 ? r.ahorro_promo / r.meses_promo : 0;
    const a = r.ahorro_m, pm = r.promo_m, mp = r.meses_promo, cc = r.coste_cambio;
    if (r.es_actual) r.payback = "Es su plan";
    else if (cc <= 0) r.payback = a + pm > 0 ? 0 : "Nunca";
    else if (mp > 0 && (a + pm) * mp >= cc) r.payback = cc / (a + pm);
    else if (a <= 0) r.payback = "Nunca";
    else r.payback = mp + (cc - (a + pm) * mp) / a;
    r.neto24 = r.ahorro1 + r.ahorro2;
    const espera = r.mismo ? 0 : Math.max(0, r.coste_cambio - N(I.PEN));
    r.neto24_espera = r.mismo ? r.neto24 : Math.max(0, 24 - N(I.MREM)) * r.ahorro_m + r.ahorro_promo - espera;
    r.total2 = r.ano1 + r.ano2;
    const pct = x => (x * 100).toFixed(x < 0.01 ? 2 : 1).replace(".", ",") + " %";
    r.razon = (r.p.modelo === "Tramos"
      ? "una cuota fija cubre el " + Math.round(r.cubierto * 100) + " % de sus ventas con tarjeta"
      : "cobra " + pct(r.rp) + " en tarjetas europeas de particular" + (r.fp > 0 ? " + " + r.fp.toFixed(2).replace(".", ",") + " € por cobro" : " sin fijo por cobro"))
      + (I.wN >= 0.15 ? "; tarjetas de turistas: " + (r.p.modelo === "Tramos" && r.p.inc[2] === 1 ? "incluidas en la cuota" : pct(r.rn)) : "");
  });
  const ranked = rows.filter(r => r.sim).sort((x, y) => x.total2 - y.total2);
  const out = rows.filter(r => !r.sim);
  const best = ranked[0] || c;
  const eur = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  const minimo = I.cons ? " como mínimo" : "";
  let verdict, tono;
  if (best.es_actual) { verdict = "Ya está en la opción más barata. No le compensa cambiar."; tono = "igual"; }
  else if (best.ahorro_m <= 0) {
    if (best.neto24 > 0) { verdict = "Solo compensa por la promoción de bienvenida de " + best.p.plan + ". Al acabar, pagaría unos " + eur(-best.ahorro_m) + "\u00a0€/mes más que hoy."; tono = "dudoso"; }
    else { verdict = "No compensa cambiar: ninguna opción le cuesta menos al mes que lo que paga hoy."; tono = "no"; }
  } else if (Math.max(best.neto24, best.neto24_espera) <= 0) { verdict = "No compensa: " + best.p.plan + " le ahorra " + best.ahorro_m.toFixed(2).replace(".", ",") + "\u00a0€/mes, pero en 2 años no recupera lo que cuesta cambiar."; tono = "no"; }
  else if (best.neto24_espera > best.neto24) { verdict = "Compensa, pero espere: cambie a " + best.p.plan + " cuando acabe su permanencia, en " + I.MREM + " meses, y se ahorra la penalización."; tono = "si"; }
  else { verdict = "Compensa cambiar a " + best.p.plan + ": ahorra unos " + eur(best.ahorro_m) + "\u00a0€/mes" + minimo + "."; tono = "si"; }
  return { CURANN, cur: c, best, ranked, out, verdict, tono };
}
if (typeof module !== "undefined") module.exports = { calcular };

function iniciarUI(){
  const $ = id => document.getElementById(id);
  const LANGS = ["es", "ca", "en"];
  const lang = () => LANGS.indexOf(document.documentElement.lang) >= 0 ? document.documentElement.lang : "es";
  const L = o => LANGS.map(l => `<span data-l="${l}">${o[l]}</span>`).join("");
  const same = s => ({ es: s, ca: s, en: s });

  const TX = {
    es: {
      res: "Su resultado", prud: "Su resultado · estimación prudente",
      vIgual: "Ya paga una de las opciones más baratas para su negocio.", vNo: "Hoy no le compensa cambiar de datáfono.",
      vDudoso: "Solo le compensaría por una promoción temporal.", vWait: "Le compensa cambiar cuando acabe su permanencia.", vSi: "Sí, le compensa revisar su datáfono.",
      best: "Ya está en una de las mejores opciones", between: (a, b) => "Entre " + a + " y " + b, min: "Como mínimo",
      instant: "Al instante", months: n => "≈ " + n + " meses", costs: x => "Cambiar le cuesta " + x, free: "Cambiar no le cuesta nada",
      wait24: "Si espera a que acabe su permanencia", net24: "Ya descontado lo que cuesta cambiar",
      ckOk: "El cálculo coincide con su factura: puede fiarse del resultado.",
      ckWarn: n => "El cálculo se aleja un " + n + " % de su factura. Revise los importes o busque cargos extra.",
      ckBad: n => "El cálculo no coincide con su factura (" + n + " % de diferencia). No se fíe del resultado: elija «escribir mis precios».",
      ckNone: "Sin el total de su factura no podemos comprobar el cálculo.",
      wLockR: "Antes de cambiar, confirme que su caja o programa de ventas funciona con el nuevo datáfono.",
      wBank: "Si tiene permanencia o un préstamo con su banco, use la versión precisa.",
      wLoan: "Pregunte a su banco si dejar el datáfono cambia las condiciones de su préstamo o póliza.",
      wLockP: "Su caja está conectada al datáfono: pregunte cuánto cuesta adaptarla y escríbalo en el paso 3.",
      wDunno: "Confirme que su caja o programa de ventas funciona con el nuevo datáfono.",
      ctaYesT: "¿Con quién y cómo cambiar?", ctaNoT: "¿Quiere confirmarlo con su factura?",
      ctaYesP: "Le preparo un análisis con su factura: qué plan le conviene, cuánto ahorra exactamente y cómo pedirlo.",
      ctaNoP: "Reviso su factura y su contrato y le digo si hay cargos que puede reducir sin cambiar de proveedor.",
      toP: "Probar la versión precisa →", toR: "Volver a la versión rápida →",
      e0: "Conteste las 6 preguntas.", eLeft: n => n === 1 ? "Falta 1 pregunta." : "Faltan " + n + " preguntas.", eP: "Rellene los 3 pasos y pulse «Ver resultado».",
      chooseProv: "Elija su proveedor y plan", banks: "Bancos", fin: "Fintech y otros", fin2: "Fintech",
      whoToday: "¿Con quién cobra hoy?", own: "Otro o precio negociado: escribir mis precios", nolimit: "sin límite"
    },
    ca: {
      res: "El seu resultat", prud: "El seu resultat · estimació prudent",
      vIgual: "Ja paga una de les opcions més barates per al seu negoci.", vNo: "Avui no li compensa canviar de datàfon.",
      vDudoso: "Només li compensaria per una promoció temporal.", vWait: "Li compensa canviar quan acabi la permanència.", vSi: "Sí, li compensa revisar el seu datàfon.",
      best: "Ja és en una de les millors opcions", between: (a, b) => "Entre " + a + " i " + b, min: "Com a mínim",
      instant: "A l'instant", months: n => "≈ " + n + " mesos", costs: x => "Canviar li costa " + x, free: "Canviar no li costa res",
      wait24: "Si espera que acabi la permanència", net24: "Ja descomptat el que costa canviar",
      ckOk: "El càlcul coincideix amb la seva factura: es pot refiar del resultat.",
      ckWarn: n => "El càlcul s'allunya un " + n + " % de la seva factura. Revisi els imports o busqui càrrecs addicionals.",
      ckBad: n => "El càlcul no coincideix amb la seva factura (" + n + " % de diferència). No es refiï del resultat: triï «escriure els meus preus».",
      ckNone: "Sense el total de la seva factura no podem comprovar el càlcul.",
      wLockR: "Abans de canviar, confirmi que la seva caixa o programa de vendes funciona amb el nou datàfon.",
      wBank: "Si té permanència o un préstec amb el seu banc, faci servir la versió precisa.",
      wLoan: "Pregunti al seu banc si deixar el datàfon canvia les condicions del seu préstec o pòlissa.",
      wLockP: "La seva caixa està connectada al datàfon: pregunti quant costa adaptar-la i escrigui-ho al pas 3.",
      wDunno: "Confirmi que la seva caixa o programa de vendes funciona amb el nou datàfon.",
      ctaYesT: "Amb qui i com canviar?", ctaNoT: "Vol confirmar-ho amb la seva factura?",
      ctaYesP: "Li preparo una anàlisi amb la seva factura: quin pla li convé, quant estalvia exactament i com demanar-lo.",
      ctaNoP: "Reviso la seva factura i el seu contracte i li dic si hi ha càrrecs que pot reduir sense canviar de proveïdor.",
      toP: "Provar la versió precisa →", toR: "Tornar a la versió ràpida →",
      e0: "Respongui les 6 preguntes.", eLeft: n => n === 1 ? "Falta 1 pregunta." : "Falten " + n + " preguntes.", eP: "Ompli els 3 passos i premi «Veure el resultat».",
      chooseProv: "Triï el seu proveïdor i pla", banks: "Bancs", fin: "Fintech i altres", fin2: "Fintech",
      whoToday: "Amb qui cobra avui?", own: "Un altre o preu negociat: escriure els meus preus", nolimit: "sense límit"
    },
    en: {
      res: "Your result", prud: "Your result · cautious estimate",
      vIgual: "You already pay one of the cheapest options for your business.", vNo: "Changing terminal is not worth it for you today.",
      vDudoso: "It would only pay off because of a temporary offer.", vWait: "It pays to switch when your minimum term ends.", vSi: "Yes, it is worth reviewing your card terminal.",
      best: "You are already on one of the best options", between: (a, b) => "Between " + a + " and " + b, min: "At least",
      instant: "Straight away", months: n => "≈ " + n + " months", costs: x => "Switching costs you " + x, free: "Switching costs you nothing",
      wait24: "If you wait until your minimum term ends", net24: "After the cost of switching",
      ckOk: "The calculation matches your invoice: you can rely on the result.",
      ckWarn: n => "The calculation differs from your invoice by " + n + " %. Check the amounts or look for extra charges.",
      ckBad: n => "The calculation does not match your invoice (" + n + " % difference). Do not rely on the result: choose “enter my own prices”.",
      ckNone: "Without your invoice total we cannot check the calculation.",
      wLockR: "Before switching, check that your till or sales software works with the new terminal.",
      wBank: "If you have a minimum term or a loan with your bank, use the precise version.",
      wLoan: "Ask your bank whether giving up the terminal changes the terms of your loan or credit line.",
      wLockP: "Your till is connected to the terminal: ask how much it costs to adapt it and enter it in step 3.",
      wDunno: "Check that your till or sales software works with the new terminal.",
      ctaYesT: "Who to switch to, and how?", ctaNoT: "Would you like to confirm it with your invoice?",
      ctaYesP: "I prepare an analysis using your invoice: which plan suits you, exactly how much you save and how to ask for it.",
      ctaNoP: "I review your invoice and contract and tell you whether there are charges you can reduce without changing provider.",
      toP: "Try the precise version →", toR: "Back to the quick version →",
      e0: "Answer the 6 questions.", eLeft: n => n === 1 ? "1 question to go." : n + " questions to go.", eP: "Complete the 3 steps and press “See result”.",
      chooseProv: "Choose your provider and plan", banks: "Banks", fin: "Fintech and others", fin2: "Fintech",
      whoToday: "Who do you use today?", own: "Other or negotiated price: enter my own prices", nolimit: "no limit"
    }
  };
  const T = () => TX[lang()];

  const SIM = PLANS.filter(p => p.sim === "Sí");
  const MIX = { 0:[.85,.04,.04,.03,.04], 1:[.78,.05,.09,.04,.04], 2:[.66,.05,.20,.06,.03], 3:[.55,.05,.30,.08,.02] };
  const grp = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  const eur = (x, d=0) => { const v = (Math.round(Math.abs(x) * 10**d) / 10**d).toFixed(d).split("."); return (x < 0 ? "−" : "") + grp(v[0]) + (d ? "," + v[1] : "") + "\u00a0€"; };
  const num = s => {
    if (s == null) return null; s = String(s).trim().replace(/\s|€|%/g, ""); if (s === "") return null;
    if (/^\d{1,3}(,\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, "");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(",", ".");
    const v = parseFloat(s); return isFinite(v) ? v : null; };
  const numPct = s => { if (s == null) return null; s = String(s).trim().replace(",", "."); if (s === "") return null; const v = parseFloat(s); return isFinite(v) ? v / 100 : null; };

  const narrow = () => matchMedia("(max-width:1099px)").matches;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function goTo(el, smooth){
    const h = document.querySelector(".hdr"), off = (h ? h.getBoundingClientRect().height : 0) + 12;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - off), behavior: smooth && !reduced() ? "smooth" : "auto" });
  }
  function keepTop(el){ const h = document.querySelector(".hdr"), off = (h ? h.getBoundingClientRect().height : 0) + 12; if (el.getBoundingClientRect().top < off) goTo(el, false); }

  const SECT = [
    [{es:"Bar o cafetería",ca:"Bar o cafeteria",en:"Bar or café"},"Bar o restaurante"],
    [{es:"Restaurante",ca:"Restaurant",en:"Restaurant"},"Bar o restaurante"],
    [{es:"Peluquería o barbería",ca:"Perruqueria o barberia",en:"Hair salon or barber"},"Peluquería o estética"],
    [{es:"Estética, uñas o spa",ca:"Estètica, ungles o spa",en:"Beauty, nails or spa"},"Peluquería o estética"],
    [{es:"Tienda de ropa o calzado",ca:"Botiga de roba o calçat",en:"Clothing or shoe shop"},"Comercio"],
    [{es:"Alimentación",ca:"Alimentació",en:"Food shop"},"Comercio"],
    [{es:"Farmacia u óptica",ca:"Farmàcia o òptica",en:"Pharmacy or optician"},"Comercio"],
    [{es:"Otra tienda",ca:"Una altra botiga",en:"Other shop"},"Comercio"],
    [{es:"Taller o reparaciones",ca:"Taller o reparacions",en:"Workshop or repairs"},"Otro"],
    [{es:"Clínica o consulta",ca:"Clínica o consulta",en:"Clinic or practice"},"Otro"],
    [{es:"Alojamiento",ca:"Allotjament",en:"Accommodation"},"Otro"],
    [{es:"Otro",ca:"Un altre",en:"Other"},"Otro"]
  ];
  const LOCK = [
    [{es:"Lo tecleo en el datáfono",ca:"L'escric al datàfon",en:"I type it into the terminal"},"No"],
    [{es:"Llega solo desde mi caja o programa de ventas",ca:"Arriba sol des de la meva caixa o programa de vendes",en:"It comes automatically from my till or sales software"},"Sí"],
    [{es:"No lo sé",ca:"No ho sé",en:"I don't know"},"No sé"]
  ];
  const chip = (lab, val) => `<button type="button" class="chip" aria-pressed="false" data-v="${val}">${L(lab)}</button>`;

  // ---------- rápida: una pregunta cada vez
  const QS = [
    { k:"V", t:{es:"¿Cuánto cobra con tarjeta al mes?",ca:"Quant cobra amb targeta al mes?",en:"How much do you take by card each month?"},
      o:[[{es:"Menos de 1000 €",ca:"Menys de 1000 €",en:"Under 1000 €"},700],[same("1000 – 3000 €"),2000],[same("3000 – 6000 €"),4500],[same("6000 – 10\u202F000 €"),8000],[{es:"Más de 10\u202F000 €",ca:"Més de 10\u202F000 €",en:"Over 10\u202F000 €"},13000]] },
    { k:"T", t:{es:"¿Cuánto paga de media cada cliente?",ca:"Quant paga de mitjana cada client?",en:"How much does each customer pay on average?"},
      o:[[{es:"Menos de 10 €",ca:"Menys de 10 €",en:"Under 10 €"},7],[same("10 – 25 €"),17],[same("25 – 50 €"),35],[{es:"Más de 50 €",ca:"Més de 50 €",en:"Over 50 €"},70]] },
    { k:"sector", t:{es:"¿Qué tipo de negocio tiene?",ca:"Quin tipus de negoci té?",en:"What type of business do you have?"}, o:SECT },
    { k:"mix", t:{es:"De cada 10 clientes que pagan con tarjeta, ¿cuántos son turistas o extranjeros?",ca:"De cada 10 clients que paguen amb targeta, quants són turistes o estrangers?",en:"Out of every 10 customers who pay by card, how many are tourists or from abroad?"},
      o:[[{es:"Ninguno o casi ninguno",ca:"Cap o gairebé cap",en:"None or almost none"},"0"],[same("1"),"1"],[same("2"),"2"],[{es:"3 o más",ca:"3 o més",en:"3 or more"},"3"],[{es:"No lo sé",ca:"No ho sé",en:"I don't know"},"1"]] },
    { k:"cur", t:{es:"¿Con quién cobra hoy?",ca:"Amb qui cobra avui?",en:"Who do you use today?"},
      o:[[same("SumUp"),"SUMUP_PPU"],[same("CaixaBank"),"CAIXA"],[same("BBVA"),"BBVA"],[same("Santander"),"GETNET_B"],[same("Sabadell"),"SABADELL"],[same("Square"),"SQUARE"],[same("Revolut"),"REVOLUT"],[{es:"Otro",ca:"Un altre",en:"Other"},"OTRO"]] },
    { k:"lock", t:{es:"¿Cómo llega el importe al datáfono?",ca:"Com arriba l'import al datàfon?",en:"How does the amount reach the card terminal?"}, o:LOCK },
  ];
  const KEYS = QS.map(q => q.k), NQ = QS.length;
  const A = {};
  const pr = $("pRapida");
  const answeredN = () => KEYS.filter(k => A[k] !== undefined).length;
  QS.forEach((q, i) => {
    const d = document.createElement("div"); d.className = "q"; d.hidden = i > 0;
    d.innerHTML = `<div class="prog" aria-hidden="true"><span style="width:${Math.round((i + 1) / NQ * 100)}%"></span></div>`
      + `<div class="q-head"><h3 tabindex="-1">${L(q.t)}</h3><span class="n">${L({es:(i+1)+" de "+NQ,ca:(i+1)+" de "+NQ,en:(i+1)+" of "+NQ})}</span></div>`
      + (q.h ? `<p class="hint">${L(q.h)}</p>` : "")
      + `<div class="chips" data-q="${q.k}">` + q.o.map(([lab, val]) => chip(lab, val)).join("") + `</div>`;
    if (q.k === "cur") {
      const s = document.createElement("select"); s.className = "sel"; s.id = "rOtro"; s.hidden = true;
      s.setAttribute("aria-label", "Otro proveedor"); s.setAttribute("data-aria-es", "Otro proveedor"); s.setAttribute("data-aria-ca", "Un altre proveïdor"); s.setAttribute("data-aria-en", "Other provider");
      d.appendChild(s);
      const h = document.createElement("p"); h.className = "hint";
      h.innerHTML = L({es:"Si su proveedor no aparece, use la versión precisa con su factura.",ca:"Si el seu proveïdor no hi apareix, faci servir la versió precisa amb la seva factura.",en:"If your provider is not listed, use the precise version with your invoice."});
      d.appendChild(h);
      s.addEventListener("change", () => { A.cur = s.value || undefined; if (s.value) answer(4); else runRapida(false); });
    }
    if (i > 0) d.insertAdjacentHTML("beforeend", `<div><button type="button" class="back" data-back="">${L({es:"← Anterior",ca:"← Anterior",en:"← Back"})}</button></div>`);
    pr.appendChild(d);
  });
  const cards = [...pr.querySelectorAll(":scope > .q")];
  let qi = 0, advT = 0;
  function showQ(i, focus){
    clearTimeout(advT);
    qi = Math.max(0, Math.min(NQ - 1, i));
    cards.forEach((c, j) => c.hidden = j !== qi);
    if (focus) { keepTop(pr); cards[qi].querySelector("h3").focus({ preventScroll: true }); }
  }
  function fillRapidaSelect(){
    const s = $("rOtro"), v = s.value, t = T();
    s.innerHTML = `<option value="">${t.chooseProv}</option>` + [[t.banks, SIM.filter(p => p.tipo === "Banco")], [t.fin, SIM.filter(p => p.tipo !== "Banco")]]
      .map(([g, l]) => `<optgroup label="${g}">` + l.slice().sort((a,b) => a.plan.localeCompare(b.plan, "es")).map(p => `<option value="${p.id}">${p.plan}</option>`).join("") + `</optgroup>`).join("");
    s.value = v;
  }
  let doneOnce = false;
  function answer(i){
    const complete = answeredN() === NQ;
    const scroll = complete && (!doneOnce || i === NQ - 1);
    if (complete) doneOnce = true;
    runRapida(scroll);
    if (i < NQ - 1) { clearTimeout(advT); advT = setTimeout(() => { if (qi === i) showQ(i + 1, true); }, 250); }
  }
  pr.addEventListener("click", e => {
    if (e.target.closest("[data-back]")) { showQ(qi - 1, true); return; }
    const b = e.target.closest(".chip"); if (!b) return;
    const c = b.parentElement, k = c.dataset.q, i = KEYS.indexOf(k);
    c.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b));
    const v = b.dataset.v;
    if (k === "cur") {
      $("rOtro").hidden = v !== "OTRO";
      if (v === "OTRO") { A.cur = $("rOtro").value || undefined; runRapida(false); if (!A.cur) $("rOtro").focus(); else answer(i); return; }
      A.cur = v;
    } else A[k] = (k === "V" || k === "T") ? +v : v;
    answer(i);
  });

  function runRapida(scroll){
    if (mode !== "rapida") return;
    const n = answeredN();
    $("resEmptyN").textContent = n === 0 ? T().e0 : T().eLeft(NQ - n);
    if (n < NQ) { hideRes(); return; }
    const m = MIX[A.mix];
    const I = { V:A.V, T:A.T, wP:m[0], wE:m[1], wN:m[2], wA:m[3], wB:m[4], NP:.025, BZ:.005, PROMO:false, IVAQ:true, IVA:.21, CTA:true,
                ND:1, nF:2, pF:.5, PEN:0, MREM:0, CAJA:0, cur:A.cur, curCost:0, sector:A.sector, cons:1, incBaja:false, maxDias:null, swLock:false };
    const R = calcular(PLANS, I); if (!R) return;
    const t = T(), warns = [];
    if (A.lock !== "No") warns.push(t.wLockR);
    if (R.cur.p.tipo === "Banco") warns.push(t.wBank);
    show(R, I, warns, null, scroll);
  }

  // ---------- precisa
  $("pSectorChips").innerHTML = SECT.map(([lab, val]) => chip(lab, val)).join("");
  $("pLockChips").innerHTML = LOCK.map(([lab, val]) => chip(lab, val)).join("");
  const prov = $("pProv");
  function fillPrecisaSelect(){
    const v = prov.value, t = T();
    const groups = [[t.banks, SIM.filter(p => p.tipo === "Banco")], [t.fin2, SIM.filter(p => p.tipo !== "Banco")]];
    prov.innerHTML = `<option value="">${t.whoToday}</option>` + groups.map(([g, l]) => `<optgroup label="${g}">` + l.map(p => `<option value="${p.id}">${p.plan}</option>`).join("") + `</optgroup>`).join("")
      + `<option value="CONTRATO">${t.own}</option>`;
    prov.value = v;
    $("pDias").placeholder = t.nolimit;
  }
  const P = {};
  let shownP = false;
  $("pPrecisa").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    const c = b.parentElement; c.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b));
    P[c.dataset.name] = b.dataset.v;
    if (c.dataset.name === "pLock") $("pLockMore").hidden = b.dataset.v !== "Sí";
    validate(); if (shownP) runPrecisa(false);
  });
  prov.addEventListener("change", () => { $("pContract").hidden = prov.value !== "CONTRATO"; validate(); if (shownP) runPrecisa(false); });
  $("pPrecisa").addEventListener("input", () => { validate(); if (shownP) runPrecisa(false); });
  function vals(){
    const s = ["pPart","pEmp","pNoe","pAmex","pBiz"].map(id => num($(id).value) || 0);
    return { s, V: s.reduce((a,b)=>a+b,0), ops: num($("pOps").value) || 0 };
  }
  function validate(){
    const v = vals(), ok = v.V > 0 && v.ops > 0 && prov.value && P.pSector;
    $("pGo").disabled = !ok; $("pMissing").hidden = !!ok; return ok;
  }
  $("pGo").addEventListener("click", () => { if (validate()) { shownP = true; runPrecisa(true); } });
  function runPrecisa(scroll){
    if (mode !== "precisa" || !validate()) { if (mode === "precisa") hideRes(); return; }
    const v = vals(), V = v.V, w = v.s.map(x => x / V);
    const paid = num($("pPaid").value) || 0;
    const contrato = prov.value === "CONTRATO" ? { rp:numPct($("cP").value), re:numPct($("cE").value), rn:numPct($("cN").value), ra:numPct($("cA").value), rb:numPct($("cB").value),
      f:num($("cF").value)||0, cuota:num($("cQ").value)||0, alq:num($("cL").value)||0 } : null;
    const lock = P.pLock === "Sí";
    const dias = num($("pDias").value);
    const I = { V, T: V / v.ops, wP:w[0], wE:w[1], wN:w[2], wA:w[3], wB:w[4], NP:.025, BZ:.005, PROMO:$("pPromo").value === "Sí", IVAQ:false, IVA:.21, CTA:true,
      ND: Math.max(1, num($("pND").value) || 1), nF: Math.min(12, Math.max(0, num($("pNF").value) ?? 2)), pF: (num($("pPF").value) ?? 50) / 100,
      PEN: num($("pPen").value) || 0, MREM: num($("pPerm").value) || 0, CAJA: lock ? (num($("pCaja").value) || 0) : 0,
      cur: prov.value, curCost: paid, sector: P.pSector, cons:0, forma: P.pForma || null, incBaja: $("pBaja").value === "Sí", maxDias: dias, swLock: lock,
      swF: num($("pSwF").value) || 0, swNew: num($("pSwN").value) || 0, contrato };
    if (P.pIva === "Sí") I.IVA = 0;
    const R = calcular(PLANS, I); if (!R) return;
    const t = T(), warns = [];
    if (P.pLoan === "Sí") warns.push(t.wLoan);
    if (lock && !I.CAJA) warns.push(t.wLockP);
    if (P.pLock === "No sé") warns.push(t.wDunno);
    let check = null;
    if (paid > 0) {
      const diff = (R.cur.Cn - paid) / paid, a = Math.abs(diff);
      check = a <= .10 ? ["ok", t.ckOk] : a <= .25 ? ["warn", t.ckWarn(Math.round(a*100))] : ["bad", t.ckBad(Math.round(a*100))];
    } else check = ["warn", t.ckNone];
    show(R, I, warns, check, scroll);
  }

  // ---------- resultado
  let tok = 0, shownOnce = false;
  function hideRes(){ tok++; $("about").hidden = true; $("res").hidden = true; $("resLoad").hidden = true; $("resEmpty").hidden = false; }
  function show(R, I, warns, check, scroll){
    const t = ++tok;
    $("resEmpty").hidden = true; $("res").hidden = true; $("resLoad").hidden = false;
    if (scroll && narrow()) requestAnimationFrame(() => goTo($("resLoad"), true));
    setTimeout(() => {
      if (t !== tok) return;
      fill(R, I, warns, check); shownOnce = true;
      $("resLoad").hidden = true; $("res").hidden = false; $("about").hidden = false;
    }, reduced() ? 250 : (shownOnce ? 700 : 1400));
  }
  function fill(R, I, warns, check){
    const tx = T(), b = R.best, prec = !I.cons;
    const wait = R.tono === "si" && (I.MREM || 0) > 0 && b.neto24_espera > b.neto24;
    $("rEyebrow").textContent = prec ? tx.res : tx.prud;
    $("rVerdict").textContent = R.tono === "igual" ? tx.vIgual : R.tono === "no" ? tx.vNo : R.tono === "dudoso" ? tx.vDudoso : wait ? tx.vWait : tx.vSi;
    $("sMes").textContent = eur(Math.max(0, b.ahorro_m));
    $("sMesX").textContent = b.es_actual ? tx.best : (prec ? tx.between(eur(Math.max(0,b.ahorro_lo)), eur(Math.max(0,b.ahorro_hi))) : tx.min);
    const pb = b.payback;
    $("sPay").textContent = typeof pb === "number" ? (pb < 1 ? tx.instant : tx.months(Math.ceil(pb))) : "—";
    $("sPayX").textContent = b.es_actual ? "" : (b.coste_cambio > 0 ? tx.costs(eur(b.coste_cambio)) : tx.free);
    $("s24").textContent = eur(Math.max(0, wait ? b.neto24_espera : b.neto24));
    $("s24X").textContent = wait ? tx.wait24 : tx.net24;
    const ch = $("rCheck");
    if (check) { ch.hidden = false; ch.className = "check " + check[0]; ch.textContent = check[1]; } else ch.hidden = true;
    $("rWarns").innerHTML = warns.map(w => "<li>" + w + "</li>").join("");
    $("rWarns").hidden = !warns.length;
    const yes = R.tono === "si" || R.tono === "dudoso";
    $("ctaT").textContent = yes ? tx.ctaYesT : tx.ctaNoT;
    $("ctaP").textContent = yes ? tx.ctaYesP : tx.ctaNoP;
    $("rSwitch").textContent = prec ? tx.toR : tx.toP;
  }
  $("rSwitch").addEventListener("click", e => { e.preventDefault(); setMode(mode === "rapida" ? "precisa" : "rapida", true); });
  $("ctaBtn").addEventListener("click", e => {
    e.preventDefault();
    $("contacto").hidden = false;
    requestAnimationFrame(() => { goTo($("contacto"), true); const f = $("ct-n"); if (f) f.focus({ preventScroll: true }); });
  });

  // ---------- modo
  let mode = null;
  function setMode(m, scroll){
    mode = m;
    $("mRapida").setAttribute("aria-pressed", m === "rapida"); $("mPrecisa").setAttribute("aria-pressed", m === "precisa");
    $("work").hidden = false;
    $("pRapida").hidden = m !== "rapida"; $("pPrecisa").hidden = m !== "precisa";
    $("resEmptyN").textContent = m === "rapida" ? T().e0 : T().eP;
    hideRes();
    try { if (location.hash !== "#" + m) history.replaceState(null, "", "#" + m); } catch(_) {}
    if (m === "rapida") runRapida(false); else if (shownP) runPrecisa(false);
    if (scroll) requestAnimationFrame(() => goTo($("work"), scroll !== "instant"));
  }
  function closeMode(){
    mode = null;
    $("mRapida").setAttribute("aria-pressed", "false"); $("mPrecisa").setAttribute("aria-pressed", "false");
    $("work").hidden = true; hideRes();
    try { history.replaceState(null, "", location.pathname + location.search); } catch(_) {}
  }
  $("mRapida").addEventListener("click", () => mode === "rapida" ? closeMode() : setMode("rapida", narrow()));
  $("mPrecisa").addEventListener("click", () => mode === "precisa" ? closeMode() : setMode("precisa", narrow()));

  function runQuiet(fn){ const s = show; show = (R, I, w, c) => fill(R, I, w, c); fn(false); show = s; }
  document.addEventListener("nc-lang", () => {
    fillRapidaSelect(); fillPrecisaSelect();
    if (!mode) return;
    const n = answeredN();
    $("resEmptyN").textContent = mode === "rapida" ? (n === 0 ? T().e0 : T().eLeft(NQ - n)) : T().eP;
    if (!$("res").hidden) { if (mode === "rapida") runQuiet(runRapida); else if (shownP) runQuiet(runPrecisa); }
  });
  fillRapidaSelect(); fillPrecisaSelect(); validate();

  const h = location.hash.replace("#","");
  if (h === "rapida" || h === "precisa") setMode(h, narrow() ? "instant" : false);
  window.addEventListener("hashchange", () => { const x = location.hash.replace("#",""); if ((x === "rapida" || x === "precisa") && x !== mode) setMode(x, narrow()); });
}

// ---------- tarifas: /data/tarifas-datafono.json con copia de respaldo en la página (RESPALDO)
(function cargarTarifas(){
  if (!document.getElementById("calcApp")) return;
  const URL_T = "/data/tarifas-datafono.json", URL_T2 = "data/tarifas-datafono.json", LIMITE = 2500;
  const MESES = {
    es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
    ca: ["gener","febrer","març","abril","maig","juny","juliol","agost","setembre","octubre","novembre","desembre"],
    en: ["January","February","March","April","May","June","July","August","September","October","November","December"]
  };
  const lang = () => ["es","ca","en"].indexOf(document.documentElement.lang) >= 0 ? document.documentElement.lang : "es";
  const fecha = s => {
    const [y, m, d] = String(s).split("-").map(Number); if (!(d && m)) return s;
    const l = lang(), mm = MESES[l][m - 1];
    return l === "en" ? d + " " + mm + " " + y : l === "ca" ? d + (/^[aeiou]/.test(mm) ? " d'" : " de ") + mm + " de " + y : d + " de " + mm + " de " + y;
  };
  const RES = typeof RESPALDO !== "undefined" ? RESPALDO : null;
  const FECHA_OK = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const valido = d => !!d && FECHA_OK(d.actualizado) && Array.isArray(d.planes)
    && d.planes.filter(p => p && p.id && p.prov && Array.isArray(p.inc) && p.inc.length === 4).length >= 10
    && (!RES || d.actualizado >= RES.actualizado);
  let actualizado = null, hecho = false;
  const putDate = () => { if (actualizado) document.getElementById("fechaTarifas").textContent = fecha(actualizado); };
  document.addEventListener("nc-lang", putDate);
  const modos = [document.getElementById("mRapida"), document.getElementById("mPrecisa")];
  function usar(d){
    if (hecho) return; hecho = true;
    PLANS = d.planes; actualizado = d.actualizado; putDate();
    modos.forEach(b => b.disabled = false);
    iniciarUI();
  }
  if (!RES) { // sin respaldo: espera al archivo
    fetch(URL_T, { cache: "no-store" }).then(r => r.json()).then(d => { if (valido(d)) usar(d); }).catch(() => {});
    return;
  }
  modos.forEach(b => b.disabled = true);
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const tope = setTimeout(() => { if (ctl) ctl.abort(); usar(RES); }, LIMITE);
  const pedir = u => fetch(u, { cache: "no-store", signal: ctl ? ctl.signal : undefined }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  pedir(URL_T).catch(e => { if (e && e.name === "AbortError") throw e; return pedir(URL_T2); })
    .then(d => { clearTimeout(tope); usar(valido(d) ? d : RES); })
    .catch(() => { clearTimeout(tope); usar(RES); });
})();
