/* Memory Universe — motion layer.
   Rules held to: text is in the DOM before it is revealed (clip, never inject);
   triggers fire once at 60% entry and never reverse; reduced motion resolves
   everything to its after-state and this file returns early. */
(function () {
  var doc = document.documentElement;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  doc.classList.add('mu-motion');

  var STEP = { 'rec-r': 140, overlay: 140, station: 110, 'line-item': 90, term: 0, panel: 0 };
  var SEL = '.rec-r, .overlay, .station, .line-item, .term, .stations, .scene-head, .panel:not(.scn-panel)';

  function kind(el) {
    if (el.classList.contains('rec-r')) return 'rec-r';
    if (el.classList.contains('overlay')) return 'overlay';
    if (el.classList.contains('station')) return 'station';
    if (el.classList.contains('line-item')) return 'line-item';
    if (el.classList.contains('term')) return 'term';
    return 'panel';
  }

  // Prepare every scene: tag targets, assign per-type stagger, drop the initial state in.
  var scenes = [].slice.call(document.querySelectorAll('.scene, .waitlist'));
  scenes.forEach(function (scene) {
    var found = [].slice.call(scene.querySelectorAll(SEL));
    // never animate a target that sits inside another target — the parent carries it
    var targets = found.filter(function (el) {
      return !found.some(function (other) { return other !== el && other.contains(el); });
    });
    var counts = {};
    targets.forEach(function (el) {
      var k = kind(el);
      var i = counts[k] = (counts[k] || 0);
      counts[k] = i + 1;
      var d = (STEP[k] || 0) * i;

      if (k === 'term') {
        // clip reveal in discrete line steps, so it prints line by line instead of wiping
        var body = el.querySelector('.term-body') || el;
        var lines = body.textContent.replace(/\n+$/, '').split('\n').length;
        var dur = Math.min(4.5, Math.max(0.9, lines * 0.09));
        el.classList.add('mu-clip');
        el.style.setProperty('--dur', dur + 's');
        // one step per printed line — the reveal front lands on line boundaries
        el.style.transitionTimingFunction = 'steps(' + lines + ', end)';

        // the "after" terminal waits for the "before" one, then runs fast
        if (i > 0 && scene.id === 'revocation') { d = 1000; el.classList.add('mu-fast'); }
        else if (i > 0) { d = 260; }

        // a caret that starts blinking once this session has finished printing
        if (!body.querySelector('.term-caret')) {
          var caret = document.createElement('span');
          caret.className = 'term-caret';
          caret.setAttribute('aria-hidden', 'true');
          body.appendChild(caret);
        }
        el.style.setProperty('--caret', (d + dur * 1000) + 'ms');
      } else {
        el.classList.add('mu-a');
      }
      el.style.setProperty('--d', d + 'ms');
      el.style.setProperty('--d2', d + 180 + 'ms');
    });
    scene._muTargets = targets;
  });

  // .stations draws its own rule rather than fading
  [].slice.call(document.querySelectorAll('.stations')).forEach(function (el) {
    el.classList.remove('mu-a');
  });

  var reveal = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var scene = e.target;
      reveal.unobserve(scene);
      (scene._muTargets || []).forEach(function (el) { el.classList.add('mu-in'); });
      [].slice.call(scene.querySelectorAll('.stations')).forEach(function (el) {
        el.classList.add('mu-in');
      });
    });
  }, { threshold: 0, rootMargin: '0px 0px -40% 0px' });
  scenes.forEach(function (s) { reveal.observe(s); });

  // Hero and rail paint immediately — they are above the fold.
  requestAnimationFrame(function () {
    doc.classList.add('mu-ready');
    var hero = document.querySelector('header.scene');
    if (hero) (hero._muTargets || []).forEach(function (el) { el.classList.add('mu-in'); });
  });

  // M15 — the rail's active node tracks the scene in view. The only ambient motion on the page.
  var links = {};
  [].slice.call(document.querySelectorAll('.rail a')).forEach(function (a) {
    links[a.getAttribute('href').slice(1)] = a;
  });
  var track = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var a = links[e.target.id];
      if (!a) return;
      if (e.isIntersecting) {
        for (var k in links) links[k].classList.remove('is-active');
        a.classList.add('is-active');
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  Object.keys(links).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) track.observe(el);
  });

  // M16 — error state on the waitlist inputs, held for 900ms.
  document.addEventListener('mu:formerror', function (e) {
    var input = e.detail;
    if (!input) return;
    input.classList.add('mu-err');
    setTimeout(function () { input.classList.remove('mu-err'); }, 900);
  });
})();

/* Scenario deck. The track slides DOWN one slide per beat. Auto-advances,
   pauses while the reader is on it, clickable and arrow-key navigable. Under
   reduced motion the slide still changes, it just does not animate. */
(function () {
  var root = document.getElementById('scn');
  var track = document.getElementById('deck-track');
  if (!root || !track) return;

  var steps = [].slice.call(root.querySelectorAll('.scn-step'));
  if (!steps.length) return;

  var DUR = 7000, i = 0, timer = null, held = false, started = false;

  function show(n) {
    i = (n + steps.length) % steps.length;
    track.style.transform = 'translateY(-' + (i * 100) + '%)';
    steps.forEach(function (s, k) {
      s.classList.toggle('is-on', k === i);
      s.setAttribute('aria-selected', k === i ? 'true' : 'false');
      if (k === i) {
        var bar = s.querySelector('.bar');
        if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
      }
    });
  }
  function tick() { clearTimeout(timer); if (!held) timer = setTimeout(function () { show(i + 1); tick(); }, DUR); }
  function stop() { clearTimeout(timer); }

  root.style.setProperty('--scn-dur', DUR + 'ms');

  steps.forEach(function (s) {
    s.addEventListener('click', function () { show(+s.dataset.i); tick(); });
    s.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); tick(); steps[i].focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); tick(); steps[i].focus(); }
    });
  });

  root.addEventListener('mouseenter', function () { held = true; stop(); });
  root.addEventListener('mouseleave', function () { held = false; tick(); });
  root.addEventListener('focusin', function () { held = true; stop(); });
  root.addEventListener('focusout', function () { held = false; tick(); });

  if (!('IntersectionObserver' in window)) { show(0); return; }
  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { if (!started) { started = true; show(0); } tick(); } else stop();
    });
  }, { threshold: 0.25 }).observe(root);
})();
