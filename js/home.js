/* js/home.js — fills the home page: hackathon banner, Next up card, top-3 preview.
 * Everything here reads from data/*.json. To change words on the page, edit index.html. */
(function () {
  'use strict';

  // Hackathon banner: reads site.json only (the countdown is shown in days on the home page).
  Site.section('#hackathon-banner', 'data/site.json', function (site) {
    var h = site.hackathon || {};
    var line = document.querySelector('#hackathon-banner .banner-line');
    var eyebrow = document.querySelector('#hackathon-banner .eyebrow');
    var prize = document.querySelector('#hackathon-banner strong');
    if (eyebrow) eyebrow.textContent = '🎮 ' + (h.name || 'Hackathon');
    if (prize) prize.textContent = (h.prize || '') + ' prize';
    if (!line) return;

    Site.countdown(site, function (status) {
      if (status.state === 'tbd') {
        line.textContent = 'November 2026 · exact date coming soon';
      } else if (status.state === 'counting') {
        line.textContent = 'Kickoff in ' + status.days + 'd ' + status.hours + 'h ' + status.minutes + 'm →';
      } else if (status.state === 'live') {
        line.textContent = 'Happening now! →';
      } else {
        line.textContent = 'See the results on the scoreboard →';
      }
    }, 30000);
    // return nothing: we edited the banner in place instead of replacing it
  });

  // Next up: the next real meeting from events.json (skips BREAK weeks and TBD dates).
  Site.section('#next-up-body', 'data/events.json', function (data, site) {
    var next = Site.nextMeeting(data, site);
    if (!next) {
      return '<p>No meetings on the calendar yet. Check the <a href="calendar.html">calendar</a> soon.</p>';
    }
    var rel = Site.relativeDay(next.date);
    var time = next.time || Site.get(site, 'meeting.time', 'Lunch');
    var room = next.room || Site.get(site, 'meeting.room', 'Room TBD');
    return '' +
      '<div class="chips">' + Site.chip(next.type) +
        (rel ? '<span class="chip chip-mint">' + Site.esc(rel) + '</span>' : '') +
      '</div>' +
      '<h3>' + Site.esc(next.title) + '</h3>' +
      '<p class="when">' + Site.esc(Site.formatDate(next.date, 'long')) + ' · ' + Site.esc(time) + ' · ' + Site.esc(room) + '</p>' +
      (next.description ? '<p>' + Site.esc(next.description) + '</p>' : '') +
      '<a href="' + Site.esc(next.href || 'calendar.html') + '">See the whole calendar</a>';
  });

  // Top 3: ranked from scoreboard.json. Ties share a rank.
  Site.section('#top3-body', 'data/scoreboard.json', function (data) {
    var top = Site.rankMembers(data.members).slice(0, 3);
    if (!top.length) return '<p>No points yet. Come to a meeting to get on the board!</p>';
    var medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return '<ol class="top3">' + top.map(function (m, i) {
      return '<li class="rank-' + m.rank + ' reveal reveal-delay-' + (i + 1) + '">' +
        '<span class="medal" aria-hidden="true">' + (medals[m.rank] || '') + '</span>' +
        '<span class="visually-hidden">Rank ' + m.rank + ':</span>' +
        '<span class="name">' + Site.esc(m.name) + '</span>' +
        '<span class="pts">' + m.points + ' pts</span>' +
      '</li>';
    }).join('') + '</ol>';
  });
})();
