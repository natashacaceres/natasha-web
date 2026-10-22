(function () {
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="description"]');
  var en = { title: document.title, desc: meta ? meta.content : '' };
  var es = { title: root.getAttribute('data-title-es') || en.title, desc: root.getAttribute('data-desc-es') || en.desc };

  document.querySelectorAll('img[data-alt-es]').forEach(function (img) { img.setAttribute('data-alt-en', img.alt); });
  document.querySelectorAll('option[data-es]').forEach(function (o) { o.setAttribute('data-en', o.textContent); });

  function apply(l) {
    root.lang = l;
    document.title = l === 'es' ? es.title : en.title;
    if (meta) meta.content = l === 'es' ? es.desc : en.desc;
    document.querySelectorAll('img[data-alt-es]').forEach(function (img) { img.alt = img.getAttribute('data-alt-' + l); });
    document.querySelectorAll('option[data-es]').forEach(function (o) { o.textContent = o.getAttribute('data-' + l); });
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l)); });
  }
  apply(root.lang === 'es' ? 'es' : 'en');

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set-lang]');
    if (b) {
      var l = b.getAttribute('data-set-lang');
      try { localStorage.setItem('nc-lang', l); } catch (err) {}
      apply(l);
    }
    var t = e.target.closest('[data-nav-toggle]');
    if (t) {
      var open = !document.body.classList.contains('nav-open');
      document.body.classList.toggle('nav-open', open);
      document.querySelectorAll('[data-nav-toggle]').forEach(function (x) { x.setAttribute('aria-expanded', String(open)); });
    }
    if (e.target.closest('.mnav a')) document.body.classList.remove('nav-open');
  });

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
