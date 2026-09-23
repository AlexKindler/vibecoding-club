/* js/hackathon.js — fills the hackathon page from data/site.json (the hackathon
 * object: name, date, time, dateConfirmed, where, prize, teamSize, rules, judging)
 * and the placing points from data/scoreboard.json. The Register button is
 * handled by shared.js through the data-register attribute. */
(function () {
  'use strict';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // 'November 2026' from the date in site.json, even while it is unconfirmed.
  function monthText(site) {
    var date = Site.get(site, 'hackathon.date', '');
    return date ? Site.formatDate(date, 'month') : 'Date coming soon';
  }

  function whenText(site) {
    var h = site.hackathon || {};
    if (!h.dateConfirmed || !h.date) return monthText(site) + ' · exact date coming soon';
    var text = Site.formatDate(h.date, 'full');
    if (h.time) text += ' · ' + Site.formatTime(h.time);
    return text;
  }

  function statusCard(emoji, html) {
    return '<div class="card status-card"><p class="big" aria-hidden="true">' + emoji + '</p><p>' + html + '</p></div>';
  }

  // The "When" fact card.
  Site.section('#when-fact', 'data/site.json', function (site) {
    return Site.esc(whenText(site));
  });

  // The countdown. Tiles tick every second; the screen-reader text changes once a minute.
  Site.section('#countdown', 'data/site.json', function (site) {
    var box = document.getElementById('countdown');
    var live = document.getElementById('countdown-live');
    var lastAnnounced = null;
    // With reduced motion on, skip the seconds tile and tick once a minute instead of every second.
    var calm = !Site.motionOK();
    var units = calm ? ['days', 'hours', 'minutes'] : ['days', 'hours', 'minutes', 'seconds'];

    Site.countdown(site, function (status) {
      if (status.state === 'tbd') {
        box.innerHTML = statusCard('📅', '<strong>Exact date coming soon.</strong> It is in ' + Site.esc(monthText(site).split(' ')[0]) + '. Watch this space!');
        return;
      }
      if (status.state === 'live') {
        box.innerHTML = statusCard('🎮', '<strong>Happening now!</strong> Find us at ' + Site.esc(Site.get(site, 'hackathon.where', 'the room')) + '.');
        live.textContent = 'The hackathon is happening now.';
        return;
      }
      if (status.state === 'past') {
        box.innerHTML = statusCard('🏁', '<strong>It happened!</strong> See who won on the <a href="scoreboard.html">scoreboard</a>.');
        return;
      }
      // counting
      var tiles = box.querySelector('.countdown');
      if (!tiles) {
        box.innerHTML = '<div class="countdown' + (calm ? ' no-seconds' : '') + '" aria-hidden="true">' +
          units.map(function (unit) {
            return '<div class="tile"><span class="num" data-unit="' + unit + '">0</span><span class="lbl">' + unit + '</span></div>';
          }).join('') + '</div>';
        tiles = box.querySelector('.countdown');
      }
      tiles.querySelector('[data-unit="days"]').textContent = status.days;
      tiles.querySelector('[data-unit="hours"]').textContent = pad2(status.hours);
      tiles.querySelector('[data-unit="minutes"]').textContent = pad2(status.minutes);
      if (!calm) tiles.querySelector('[data-unit="seconds"]').textContent = pad2(status.seconds);
      // Screen readers hear this once, then only when the hour changes (not every minute).
      var hourKey = status.days + ':' + status.hours;
      if (hourKey !== lastAnnounced) {
        lastAnnounced = hourKey;
        live.textContent = 'Kickoff in ' + status.days + ' days and ' + status.hours + ' hours.';
      }
    }, calm ? 60000 : 1000);
    // Nothing returned on purpose: the countdown draws into the box itself.
  });

  // Rules and judging, straight from site.json.
  Site.section('#rules', 'data/site.json', function (site) {
    var rules = Site.get(site, 'hackathon.rules', []);
    if (!rules.length) return '<p>Rules coming soon.</p>';
    return '<ol>' + rules.map(function (r) { return '<li>' + Site.esc(r) + '</li>'; }).join('') + '</ol>';
  });

  Site.section('#judging', 'data/site.json', function (site) {
    var judging = Site.get(site, 'hackathon.judging', []);
    if (!judging.length) return '<p>Judging details coming soon.</p>';
    return '<ul>' + judging.map(function (j) { return '<li>' + Site.esc(j) + '</li>'; }).join('') + '</ul>';
  });

  // Points for placing: the hackathon rows of howToEarn in scoreboard.json.
  Site.section('#placing', 'data/scoreboard.json', function (data) {
    var rows = (data.howToEarn || []).filter(function (r) { return r.category === 'hackathon'; });
    if (!rows.length) return '<p>Placing points coming soon.</p>';
    return '<ul class="earn-list" role="list">' + rows.map(function (r) {
      return '<li><span class="what">' + Site.esc(r.what) + '</span>' +
        '<span class="chip chip-sun">+' + Site.esc(r.points) + '</span></li>';
    }).join('') + '</ul>';
  });
})();
