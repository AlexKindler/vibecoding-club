/* js/shared.js — the one script every page loads.
 *
 * It draws the header, the phone tab bar and the footer, loads data/*.json
 * with friendly error panels, and offers small helpers for dates, ranking,
 * countdowns, confetti and toasts. Everything hangs off one global: Site.
 *
 * A page script (js/home.js, js/calendar.js, ...) usually needs just this:
 *
 *   Site.section('#next-up-body', 'data/events.json', function (data, site) {
 *     return '<p>' + Site.esc(data.events[0].title) + '</p>';   // return HTML
 *   });
 *
 * To change the menu, edit PAGES below. To change the words in the header or
 * footer, edit drawHeader() / drawFooter(). Nothing else needs touching.
 */
(function () {
  'use strict';

  var Site = {};
  window.Site = Site;

  // The menu. Order here = order in the header and the tab bar.
  var PAGES = [
    { href: 'index.html',      label: 'Home',      icon: '🏠' },
    { href: 'info.html',       label: 'Info',      icon: '💡' },
    { href: 'scoreboard.html', label: 'Scores',    icon: '🏆' },
    { href: 'hackathon.html',  label: 'Hackathon', icon: '🎮' },
    { href: 'calendar.html',   label: 'Calendar',  icon: '📅' }
  ];

  var CONFETTI_COLORS = ['#FFD53D', '#FF8A00', '#34D399', '#FF6B6B', '#2A5BD7', '#6D28D9'];
  var PREVIEW_COMMAND = 'python3 -m http.server 8000';

  // Used when data/site.json cannot be loaded, so the page still makes sense.
  var DEFAULT_SITE = {
    club: { name: 'VibeCoding Club', school: 'Menlo School', pitch: 'Build real apps and games with AI coding tools. No experience needed.', repo: 'https://github.com/AlexKindler/vibecoding-club' },
    meeting: { day: 'Tuesdays', time: 'Lunch', room: 'Room TBD' },
    leaders: [],
    links: { joinForm: '', hackathonForm: '', schoolClubsCalendar: '' },
    hackathon: { name: 'Blooket Hackathon', description: '', date: '', time: '', dateConfirmed: false, where: '', prize: '$1,000', teamSize: '', rules: [], judging: [] }
  };

  /* ======================= tiny helpers ======================= */

  // Escape text before putting it inside HTML. Always use this for data.
  Site.esc = function (value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  };

  // Site.get(site, 'meeting.room', 'Room TBD')
  Site.get = function (obj, path, fallback) {
    var value = obj;
    var keys = String(path).split('.');
    for (var i = 0; i < keys.length; i++) {
      if (value === null || value === undefined) return fallback;
      value = value[keys[i]];
    }
    return (value === undefined || value === null || value === '') ? fallback : value;
  };

  // True unless the visitor asked their phone/computer for less motion.
  Site.motionOK = function () {
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  // 'index.html', 'calendar.html', ...
  Site.currentPage = function () {
    var last = location.pathname.split('/').pop();
    return last === '' ? 'index.html' : last;
  };

  /* ======================= dates ======================= */
  // Dates in the data files are 'YYYY-MM-DD' strings. Compare them AS STRINGS
  // and only turn them into Date objects with Site.parseLocalDate().
  // Never write new Date('2026-09-22'): that is UTC midnight, which is the
  // evening BEFORE in California, so the day shows up wrong.
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  Site.parseLocalDate = function (iso, time) {
    var d = String(iso || '').split('-').map(Number);
    var t = String(time || '00:00').split(':').map(Number);
    return new Date(d[0], (d[1] || 1) - 1, d[2] || 1, t[0] || 0, t[1] || 0, 0, 0);
  };
  Site.toISO = function (date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  };
  Site.todayISO = function () { return Site.toISO(new Date()); };

  // Site.formatDate('2026-09-22')          -> 'Tue, Sep 22'
  // Site.formatDate('2026-09-22', 'long')  -> 'Tuesday, September 22'
  // Site.formatDate('2026-09-22', 'month') -> 'September 2026'
  Site.formatDate = function (iso, style) {
    var date = Site.parseLocalDate(iso);
    var options = { weekday: 'short', month: 'short', day: 'numeric' };
    if (style === 'long') options = { weekday: 'long', month: 'long', day: 'numeric' };
    if (style === 'month') options = { month: 'long', year: 'numeric' };
    if (style === 'full') options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Whole days from today to the date: 0 = today, 1 = tomorrow, -1 = yesterday.
  Site.daysUntil = function (iso) {
    var today = Site.parseLocalDate(Site.todayISO());
    var then = Site.parseLocalDate(iso);
    return Math.round((then - today) / 86400000);
  };

  // 'Today', 'Tomorrow', 'In 6 days', or '' when it is further out.
  Site.relativeDay = function (iso) {
    var days = Site.daysUntil(iso);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days > 1 && days <= 13) return 'In ' + days + ' days';
    return '';
  };

  /* ======================= loading data ======================= */

  var cache = {};

  // Site.loadJSON('data/events.json') -> Promise of the parsed file.
  // Errors carry .kind: 'file' (opened by double-click), 'http', or 'parse'.
  Site.loadJSON = function (path) {
    if (location.protocol === 'file:') {
      var fileErr = new Error('opened from a folder');
      fileErr.kind = 'file'; fileErr.file = path;
      return Promise.reject(fileErr);
    }
    if (!cache[path]) {
      cache[path] = fetch(path, { cache: 'no-cache' })
        .then(function (res) {
          if (!res.ok) {
            var httpErr = new Error('HTTP ' + res.status);
            httpErr.kind = 'http'; httpErr.status = res.status; httpErr.file = path;
            throw httpErr;
          }
          return res.text();
        })
        .then(function (text) {
          try { return JSON.parse(text); }
          catch (e) {
            var parseErr = new Error(e.message);
            parseErr.kind = 'parse'; parseErr.file = path; parseErr.detail = e.message;
            throw parseErr;
          }
        });
    }
    return cache[path];
  };
  function cmdBox(command) {
    return '<div class="cmd"><code>' + Site.esc(command) + '</code>' +
      '<button type="button" data-copy="' + Site.esc(command) + '">Copy</button></div>';
  }

  // The friendly panel shown when a section cannot load. Names the file and the fix.
  Site.oopsHTML = function (err, file) {
    var kind = err && err.kind;
    var name = Site.esc(file || 'this section');
    var title, body;
    if (kind === 'file') {
      title = 'This part needs a tiny web server';
      body = '<p>You opened this page straight from a folder, so the browser refuses to load <code>' + name +
        '</code>. That is normal! In Terminal, go into the <code>vibecoding-club</code> folder, run this, ' +
        'then open <a href="http://localhost:8000">localhost:8000</a>:</p>' + cmdBox(PREVIEW_COMMAND) +
        '<p class="muted">No terminal? In VS Code, install the “Live Server” extension and click <strong>Go Live</strong>.</p>';
    } else if (kind === 'parse') {
      title = name + ' has a typo';
      body = '<p>The file is not valid JSON, so the site cannot read it. It is usually a missing or extra comma, ' +
        'or curly quotes pasted from a doc. Run <code>node scripts/check-data.js</code> to see the exact line.</p>' +
        '<p class="muted"><code>' + Site.esc(err.detail) + '</code></p>';
    } else if (kind === 'http') {
      title = 'Could not find ' + name;
      body = '<p>The server answered <strong>' + Site.esc(err.status) + '</strong>. Check the file name, ' +
        'and that it is inside the <code>data</code> folder with exactly that spelling.</p>';
    } else {
      title = 'Something went wrong in this section';
      body = '<p>' + Site.esc(err && err.message) + '</p>' +
        '<p class="muted">Open the browser console (Option-Command-J in Chrome) for the details.</p>';
    }
    return '<div class="oops" role="status"><h3>😅 ' + title + '</h3>' + body + '</div>';
  };

  // Site.section(selector, jsonPath or null, render)
  // Loads the JSON, waits for site.json, calls render(data, site), and puts the
  // returned HTML into the element. Any error becomes a friendly panel.
  Site.section = function (selector, jsonPath, render) {
    var el = document.querySelector(selector);
    if (!el) return Promise.resolve();
    var dataPromise = jsonPath ? Site.loadJSON(jsonPath) : Promise.resolve(null);
    return Promise.all([dataPromise, Site.ready])
      .then(function (results) { return render(results[0], results[1]); })
      .then(function (html) {
        if (typeof html === 'string') el.innerHTML = html;
        el.classList.add('is-ready');
      })
      .catch(function (err) {
        if (window.console) console.error('[' + selector + ']', err);
        el.innerHTML = Site.oopsHTML(err, jsonPath);
      });
  };

  /* ======================= events & scoreboard ======================= */

  // All events in date order, with the hackathon row added from site.json.
  Site.allEvents = function (eventsData, site) {
    var list = ((eventsData && eventsData.events) || []).slice();
    var h = site && site.hackathon;
    if (h && h.date) {
      list.push({
        date: h.date, type: 'HACKATHON', title: h.name || 'Hackathon',
        description: h.description || '', time: h.time, room: h.where,
        tbd: !h.dateConfirmed, href: 'hackathon.html'
      });
    }
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return list;
  };

  // Today and later.
  Site.upcomingEvents = function (eventsData, site) {
    var today = Site.todayISO();
    return Site.allEvents(eventsData, site).filter(function (e) { return e.date >= today; });
  };

  // The next real meeting: skips BREAK weeks and events whose date is still TBD.
  Site.nextMeeting = function (eventsData, site) {
    var list = Site.upcomingEvents(eventsData, site).filter(function (e) {
      return e.type !== 'BREAK' && !e.tbd;
    });
    return list[0] || null;
  };

  var TYPE_CLASS = { TALK: 'chip-talk', WORK: 'chip-work', SPECIAL: 'chip-special', HACKATHON: 'chip-hackathon', BREAK: 'chip-break' };
  var TYPE_LABEL = { TALK: 'TALK day', WORK: 'WORK day', SPECIAL: 'Special', HACKATHON: 'Hackathon', BREAK: 'No meeting' };

  // A color-coded chip for a meeting type. The word is always shown too.
  Site.chip = function (type) {
    var t = String(type || '').toUpperCase();
    return '<span class="chip ' + (TYPE_CLASS[t] || '') + '">' + Site.esc(TYPE_LABEL[t] || t) + '</span>';
  };

  // Sort by points (then name). Ties share a rank: 1, 2, 2, 4. Never stored in the data.
  Site.rankMembers = function (members) {
    var sorted = (members || []).map(function (m) {
      return { name: m.name, points: Number(m.points) || 0, badges: m.badges || [] };
    });
    sorted.sort(function (a, b) { return (b.points - a.points) || a.name.localeCompare(b.name); });
    var rank = 0;
    sorted.forEach(function (m, i) {
      if (i === 0 || m.points !== sorted[i - 1].points) rank = i + 1;
      m.rank = rank;
    });
    return sorted;
  };

  /* ======================= hackathon countdown ======================= */

  // { state: 'tbd' | 'counting' | 'live' | 'past', days, hours, minutes, seconds, target }
  Site.hackathonStatus = function (site, now) {
    var h = (site && site.hackathon) || {};
    if (!h.dateConfirmed || !h.date) return { state: 'tbd' };
    var target = Site.parseLocalDate(h.date, h.time || '09:00');
    var diff = target - (now || new Date());
    if (diff > 0) {
      var s = Math.floor(diff / 1000);
      return {
        state: 'counting', target: target,
        days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600),
        minutes: Math.floor((s % 3600) / 60), seconds: s % 60
      };
    }
    if (-diff < 10 * 3600 * 1000) return { state: 'live', target: target };
    return { state: 'past', target: target };
  };

  // Calls onTick(status) now and then every `everyMs` (default 1000). Returns a stop function.
  Site.countdown = function (site, onTick, everyMs) {
    var timer = null;
    function tick() {
      var status = Site.hackathonStatus(site);
      onTick(status);
      if (status.state !== 'counting' && timer) { clearInterval(timer); timer = null; }
    }
    tick();
    if (Site.hackathonStatus(site).state === 'counting') timer = setInterval(tick, everyMs || 1000);
    return function stop() { if (timer) clearInterval(timer); };
  };

  /* ======================= celebrations ======================= */

  Site.toast = function (message) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  };

  // A burst of confetti from an element (or the middle of the screen).
  // With reduced motion on, it becomes a toast instead.
  Site.confetti = function (fromEl) {
    if (!Site.motionOK()) { Site.toast('🎉 See you Tuesday!'); return; }
    var canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    var ox = window.innerWidth / 2, oy = window.innerHeight * 0.5;
    if (fromEl && fromEl.getBoundingClientRect) {
      var r = fromEl.getBoundingClientRect();
      ox = r.left + r.width / 2; oy = r.top + r.height / 2;
    }
    var pieces = [];
    for (var i = 0; i < 150; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      var speed = 9 + Math.random() * 9;
      pieces.push({
        x: ox, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, round: i % 4 === 0
      });
    }
    var start = null;
    function frame(t) {
      if (start === null) start = t;
      var age = t - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalAlpha = age > 1600 ? Math.max(0, 1 - (age - 1600) / 600) : 1;
      pieces.forEach(function (p) {
        p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (age < 2200) requestAnimationFrame(frame); else canvas.remove();
    }
    requestAnimationFrame(frame);
  };

  // Counts a number up inside an element (or just shows it under reduced motion).
  Site.countUp = function (el, target, ms) {
    target = Number(target) || 0;
    if (!Site.motionOK() || target === 0) { el.textContent = target; return; }
    var start = null;
    function frame(t) {
      if (start === null) start = t;
      var k = Math.min(1, (t - start) / (ms || 600));
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased);
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* ======================= header, tab bar, footer ======================= */
  function navLinks(withIcons) {
    var current = Site.currentPage();
    return PAGES.map(function (p) {
      var here = p.href === current ? ' aria-current="page"' : '';
      var icon = withIcons ? '<span class="tab-icon" aria-hidden="true">' + p.icon + '</span>' : '';
      return '<a href="' + p.href + '"' + here + '>' + icon + p.label + '</a>';
    }).join('');
  }

  function drawHeader() {
    var header = document.getElementById('site-header');
    if (!header) return;
    header.className = 'site-header';
    header.innerHTML =
      '<a class="skip-link" href="#main-content">Skip to content</a>' +
      '<div class="inner">' +
        '<a class="brand" href="index.html"><img src="img/logo.svg" alt="" width="36" height="36">VibeCoding Club</a>' +
        '<nav class="top-nav" aria-label="Pages">' + navLinks(false) + '</nav>' +
        '<a class="btn header-join" data-join href="#">Join the club</a>' +
      '</div>';
    var tabs = document.createElement('nav');
    tabs.className = 'tab-bar';
    tabs.setAttribute('aria-label', 'Pages');
    tabs.innerHTML = navLinks(true);
    document.body.appendChild(tabs);
  }
  function drawFooter() {
    var footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.className = 'site-footer';
    footer.innerHTML =
      '<div class="inner">' +
        '<div><strong>VibeCoding Club</strong> at <span data-site="club.school">Menlo School</span>' +
        '<br><span class="muted" id="footer-leaders"></span></div>' +
        '<div><a data-site-link="club.repo" href="https://github.com/AlexKindler/vibecoding-club">Edit this site on GitHub</a>' +
        '<br><span class="muted">Built by club members with AI coding tools.</span></div>' +
      '</div>';
  }

  // Pours site.json into the page: <span data-site="meeting.room">, links, Join buttons, footer.
  function applySite(site) {
    var nodes = document.querySelectorAll('[data-site]');
    Array.prototype.forEach.call(nodes, function (el) {
      var value = Site.get(site, el.getAttribute('data-site'), '');
      if (value !== '' && typeof value !== 'object') el.textContent = value;
    });
    var links = document.querySelectorAll('[data-site-link]');
    Array.prototype.forEach.call(links, function (el) {
      var url = Site.get(site, el.getAttribute('data-site-link'), '');
      if (url) el.setAttribute('href', url);
    });
    var joinUrl = Site.get(site, 'links.joinForm', '');
    Array.prototype.forEach.call(document.querySelectorAll('[data-join]'), function (btn) {
      setupLinkButton(btn, joinUrl, 'Join the club', 'Join the club (form coming soon)',
        'The sign-up form is coming soon. Ask a club leader!');
    });
    var registerUrl = Site.get(site, 'links.hackathonForm', '');
    Array.prototype.forEach.call(document.querySelectorAll('[data-register]'), function (btn) {
      setupLinkButton(btn, registerUrl, 'Register your team', 'Registration opens soon',
        'Registration is not open yet. Check back soon!');
    });
    var leaders = (site.leaders || []).map(function (l) {
      return Site.esc(l.name) + (l.role ? ' · ' + Site.esc(l.role) : '');
    }).join('  ·  ');
    var footerLeaders = document.getElementById('footer-leaders');
    if (footerLeaders) footerLeaders.innerHTML = leaders;
  }

  // A button that opens a link in a new tab and celebrates, or says "coming soon" if the link is empty.
  function setupLinkButton(btn, url, readyText, soonText, soonMessage) {
    if (btn.classList.contains('header-join')) { readyText = 'Join the club'; soonText = 'Join the club'; }
    if (url) {
      btn.textContent = readyText;
      btn.setAttribute('href', url);
      btn.setAttribute('target', '_blank');
      btn.setAttribute('rel', 'noopener');
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('role');
      btn.onclick = function () { Site.confetti(btn); };
    } else {
      btn.textContent = soonText;
      btn.removeAttribute('href');
      btn.removeAttribute('target');
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-disabled', 'true');
      var soon = function (e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        Site.confetti(btn);
        Site.toast(soonMessage);
      };
      btn.onclick = soon;
      btn.onkeydown = soon;
    }
  }
  // Copy buttons inside .cmd boxes (used by the double-click help panel).
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy');
    var done = function () { Site.toast('Copied! Paste it into Terminal.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); });
    } else {
      window.prompt('Copy this:', text);
    }
  });

  /* ======================= start ======================= */

  // Site.ready resolves with site.json (or sensible defaults if it cannot load)
  // after the header and footer are drawn. Page scripts wait on it.
  Site.ready = new Promise(function (resolve) {
    function start() {
      drawHeader();
      drawFooter();
      Site.loadJSON('data/site.json').then(
        function (site) { applySite(site); resolve(site); },
        function (err) {
          if (window.console) console.error('[site.json]', err);
          Site.siteError = err;
          applySite(DEFAULT_SITE);
          resolve(DEFAULT_SITE);
        }
      );
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  });
})();
