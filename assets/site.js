(function () {
  var root = document.documentElement;
  var langs = (root.getAttribute('data-langs') || 'en es').split(' ');
  var meta = document.querySelector('meta[name="description"]');
  var ogT = document.querySelector('meta[property="og:title"]');
  var ogD = document.querySelector('meta[property="og:description"]');
  var ogL = document.querySelector('meta[property="og:locale"]');
  var base = { title: document.title, desc: meta ? meta.content : '' };
  var locales = { es: 'es_ES', ca: 'ca_ES', en: 'en_GB' };
  function txt(kind, l) {
    return root.getAttribute('data-' + kind + '-' + l) || (l === 'ca' && root.getAttribute('data-' + kind + '-es')) || base[kind];
  }

  document.querySelectorAll('img[data-alt-es]').forEach(function (img) { if (!img.hasAttribute('data-alt-en')) img.setAttribute('data-alt-en', img.alt); });
  document.querySelectorAll('option[data-es]').forEach(function (o) { if (!o.hasAttribute('data-en')) o.setAttribute('data-en', o.textContent); });

  var NAMES = { es: 'Español', ca: 'Català', en: 'English' };
  var chosen = root.lang;
  try { var pq = location.search.match(/[?&]lang=(en|es|ca)/); var pv = pq ? pq[1] : localStorage.getItem('nc-lang'); if (pv === 'ca' && root.lang === 'es') chosen = 'ca'; } catch (e) {}
  function apply(l) {
    chosen = l;
    if (langs.indexOf(l) < 0) l = l === 'ca' ? 'es' : langs[0];
    root.lang = l;
    document.title = txt('title', l);
    if (meta) meta.content = txt('desc', l);
    if (ogT) ogT.content = txt('title', l);
    if (ogD) ogD.content = txt('desc', l);
    if (ogL) ogL.content = locales[l];
    document.querySelectorAll('img[data-alt-es]').forEach(function (img) { img.alt = img.getAttribute('data-alt-' + l) || img.getAttribute('data-alt-es'); });
    document.querySelectorAll('option[data-es]').forEach(function (o) { o.textContent = o.getAttribute('data-' + l) || o.getAttribute('data-es'); });
    var shown = langs.indexOf(chosen) >= 0 || chosen === 'ca' ? chosen : l;
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === shown)); });
    document.querySelectorAll('[data-lang-label]').forEach(function (s) { s.textContent = NAMES[shown]; });
    document.dispatchEvent(new CustomEvent('nc-lang', { detail: l }));
  }
  apply(chosen);

  /* Resources dropdown */
  var dds = document.querySelectorAll('[data-dd]');
  function setDD(dd, open) {
    dd.classList.toggle('is-open', open);
    dd.querySelector('.dd-btn').setAttribute('aria-expanded', String(open));
  }
  dds.forEach(function (dd) {
    var btn = dd.querySelector('.dd-btn');
    var hoverT;
    dd.addEventListener('mouseenter', function () { clearTimeout(hoverT); setDD(dd, true); });
    dd.addEventListener('mouseleave', function () { hoverT = setTimeout(function () { setDD(dd, false); }, 120); });
    btn.addEventListener('click', function () { setDD(dd, !dd.classList.contains('is-open')); });
    btn.addEventListener('focus', function () { if (dd._noOpen) { dd._noOpen = false; return; } if (btn.matches(':focus-visible')) setDD(dd, true); });
    dd.addEventListener('focusout', function (e) { if (!dd.contains(e.relatedTarget)) setDD(dd, false); });
    dd.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dd.classList.contains('is-open')) { setDD(dd, false); dd._noOpen = true; btn.focus(); dd._noOpen = false; e.stopPropagation(); }
    });
  });
  document.addEventListener('click', function (e) {
    dds.forEach(function (dd) { if (!dd.contains(e.target)) setDD(dd, false); });
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set-lang]');
    if (b) {
      var l = b.getAttribute('data-set-lang');
      try { localStorage.setItem('nc-lang', l); } catch (err) {}
      apply(l);
      dds.forEach(function (dd) { setDD(dd, false); });
      var pd = b.closest('.dd'); if (pd) { pd._noOpen = true; pd.querySelector('.dd-btn').focus({ preventScroll: true }); pd._noOpen = false; }
    }
    var t = e.target.closest('[data-nav-toggle]');
    if (t) {
      var open = !document.body.classList.contains('nav-open');
      document.body.classList.toggle('nav-open', open);
      document.querySelectorAll('[data-nav-toggle]').forEach(function (x) { x.setAttribute('aria-expanded', String(open)); });
    }
    if (e.target.closest('.mnav a')) document.body.classList.remove('nav-open');
  });

  /* mini map */
  document.querySelectorAll('[data-minimap]').forEach(function (box) {
    var tip = box.querySelector('.minimap-tip');
    fetch(box.getAttribute('data-minimap')).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      if (!t) return;
      box.insertAdjacentHTML('afterbegin', t);
      var svg = box.querySelector('svg'), cur = null;
      function show(p) {
        if (cur) cur.classList.remove('is-hov');
        cur = p;
        if (!p) { tip.hidden = true; return; }
        p.classList.add('is-hov');
        p.parentNode.appendChild(p);
        var bb = p.getBoundingClientRect(), bx = box.getBoundingClientRect();
        tip.textContent = p.getAttribute('data-n');
        tip.style.left = (bb.left + bb.width / 2 - bx.left) + 'px';
        tip.style.top = (bb.top - bx.top) + 'px';
        tip.hidden = false;
      }
      svg.addEventListener('mouseover', function (e) { var p = e.target.closest('path'); if (p && p !== cur) show(p); });
      svg.addEventListener('mouseleave', function () { show(null); });
      var demo = box.getAttribute('data-demo');
      if (demo) { var p = svg.querySelector('path[data-n="' + demo + '"]'); if (p) show(p); }
    });
  });

  /* Blog category filter */
  var bf = document.querySelector('[data-blog-filter]');
  if (bf) {
    var rows = document.querySelectorAll('.rows li[data-cat]');
    var empty = document.querySelector('[data-blog-empty]');
    var list = document.querySelector('.rows');
    bf.addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      var cat = c.getAttribute('data-cat');
      bf.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      var shown = 0;
      rows.forEach(function (r) { var on = cat === 'all' || r.getAttribute('data-cat') === cat; r.hidden = !on; if (on) shown++; });
      empty.hidden = shown > 0;
      list.hidden = shown === 0;
    });
  }

  if (/[?&]sent=1(&|$)/.test(location.search)) {
    document.querySelectorAll('[data-sent]').forEach(function (el) { el.hidden = false; });
    document.querySelectorAll('[data-sent-hide]').forEach(function (el) { el.hidden = true; });
    var target = document.querySelector('[data-sent]');
    if (target) {
      var sec = target.closest('section') || target;
      window.scrollTo(0, sec.getBoundingClientRect().top + window.pageYOffset - 72);
    }
  }
})();
