(function(){
  var mods=[].slice.call(document.querySelectorAll('.module'));
  var KEY='nc-of101-done', done;
  try{done=JSON.parse(localStorage.getItem(KEY))||[];}catch(e){done=[];}
  if(done.indexOf(1)<0)done.push(1);
  function render(cur){
    var mins=0;mods.forEach(function(m,i){if(done.indexOf(i+1)>=0)mins+=+m.getAttribute('data-min');});
    document.querySelectorAll('.pm').forEach(function(e){e.textContent=done.length;});
    document.querySelectorAll('.pt').forEach(function(e){e.textContent=mins;});
    var f=document.querySelector('.bar-fill');if(f)f.style.width=(done.length/8*100)+'%';
    document.querySelectorAll('[data-mod]').forEach(function(a){var n=+a.getAttribute('data-mod');a.classList.toggle('is-done',done.indexOf(n)>=0);a.classList.toggle('is-current',n===cur);if(n===cur)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});
  }
  render(1);
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){var n=mods.indexOf(en.target)+1;if(done.indexOf(n)<0){done.push(n);try{localStorage.setItem(KEY,JSON.stringify(done));}catch(e){}}render(n);}});},{rootMargin:'-20% 0px -70% 0px'});
    mods.forEach(function(m){io.observe(m);});
  }
  var d=document.querySelector('.side-box');
  if(d&&window.matchMedia('(max-width:1000px)').matches)d.removeAttribute('open');
  document.querySelectorAll('.side-box a[href^="#"]').forEach(function(a){a.addEventListener('click',function(){if(window.matchMedia('(max-width:1000px)').matches)d.removeAttribute('open');});});
})();