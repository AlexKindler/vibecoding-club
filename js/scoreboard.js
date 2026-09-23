/* js/scoreboard.js — fills the scoreboard page from data/scoreboard.json:
 * the podium (top three), the full ranking table with badges and rank-change
 * arrows, and the "How to earn points" box. Rank is never stored in the data;
 * Site.rankMembers() sorts by points and lets ties share a rank. */
(function () {
  'use strict';

  var MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
  var STORAGE_KEY = 'vibecoding-ranks'; // where this browser remembers last visit's ranks

  // Badge chips for one member. Unknown ids get a grey "?" so a typo is visible, not invisible.
  function badgeChips(ids, badges) {
    return (ids || []).map(function (id) {
      var badge = badges && badges[id];
      if (!badge) return '<span class="chip">? ' + Site.esc(id) + '</span>';
      return '<span class="chip chip-' + Site.esc(badge.color) + '" title="' + Site.esc(badge.how || '') + '">' +
        Site.esc(badge.label || id) +
        (badge.how ? '<span class="visually-hidden">: ' + Site.esc(badge.how) + '</span>' : '') + '</span>';
    }).join('');
  }

  function loadOldRanks() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }

  function saveRanks(ranked) {
    try {
      var map = {};
      ranked.forEach(function (m) { map[m.name] = m.rank; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) { /* private browsing: no arrows next time, and that is fine */ }
  }

  // "▲ up 2", "▼ down 1", "new", or nothing.
  function deltaChip(member, oldRanks) {
    if (!Object.keys(oldRanks).length) return '';
    var old = oldRanks[member.name];
    if (old === undefined) return ' <span class="chip delta delta-new">new</span>';
    if (old > member.rank) return ' <span class="chip delta delta-up">▲ up ' + (old - member.rank) + '</span>';
    if (old < member.rank) return ' <span class="chip delta delta-down">▼ down ' + (member.rank - old) + '</span>';
    return '';
  }

  // Animate every [data-count] number inside a container (instant under reduced motion).
  function countUpAll(selector) {
    var nodes = document.querySelectorAll(selector + ' [data-count]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (Site.countUp) Site.countUp(el, el.getAttribute('data-count'), 700);
    });
  }

  // "Last updated" line.
  Site.section('#updated', 'data/scoreboard.json', function (data) {
    if (!data.updated) return;
    return 'Last updated ' + Site.esc(Site.formatDate(data.updated, 'full')) +
      '. Points for showing up, demoing, and building this site.';
  });

  // Podium: first three of the ranked list. Visual order is 2nd, 1st, 3rd; 1st lands last.
  Site.section('#podium', 'data/scoreboard.json', function (data) {
    var top = Site.rankMembers(data.members).slice(0, 3);
    if (!top.length) return '<p class="card podium-empty">No points yet. Come to a meeting to get on the board!</p>';
    var position = ['pos-center', 'pos-left', 'pos-right'];
    var delay = [3, 2, 1];
    return top.map(function (m, i) {
      return '<div class="podium-card rank-' + m.rank + ' ' + position[i] + ' reveal-pop reveal-delay-' + delay[i] + '">' +
        '<span class="medal" aria-hidden="true">' + (MEDALS[m.rank] || '🏅') + '</span>' +
        '<span class="visually-hidden">Rank ' + m.rank + ':</span>' +
        '<span class="name">' + Site.esc(m.name) + '</span>' +
        '<span class="pts" data-count="' + m.points + '">' + m.points + '</span>' +
        '<span class="pts-label">points</span>' +
        '<div class="badges">' + badgeChips(m.badges, data.badges) + '</div>' +
      '</div>';
    }).join('');
  }).then(function () { countUpAll('#podium'); });

  // Everyone, as a table.
  Site.section('#ranking', 'data/scoreboard.json', function (data) {
    var ranked = Site.rankMembers(data.members);
    if (!ranked.length) return '<p>No members yet.</p>';
    var oldRanks = loadOldRanks();
    var rows = ranked.map(function (m, i) {
      var topClass = m.rank <= 3 ? ' top-' + m.rank : '';
      return '<tr class="reveal reveal-delay-' + Math.min(i + 1, 6) + topClass + '">' +
        '<td class="rank">' + m.rank + '</td>' +
        '<td class="member">' + Site.esc(m.name) + deltaChip(m, oldRanks) + '</td>' +
        '<td class="points"><span data-count="' + m.points + '">' + m.points + '</span></td>' +
        '<td><div class="badges">' + badgeChips(m.badges, data.badges) + '</div></td>' +
      '</tr>';
    }).join('');
    saveRanks(ranked);
    return '<table class="ranking">' +
      '<caption class="visually-hidden">All members ranked by points</caption>' +
      '<thead><tr><th scope="col" class="rank">#</th><th scope="col">Member</th>' +
      '<th scope="col" class="points">Points</th><th scope="col">Badges</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }).then(function () { countUpAll('#ranking'); });

  // How to earn points, straight from howToEarn in the same file.
  Site.section('#how-to-earn', 'data/scoreboard.json', function (data) {
    var rules = data.howToEarn || [];
    if (!rules.length) return '<p>Rules coming soon.</p>';
    var html = '<ul class="earn-list" role="list">' + rules.map(function (r) {
      return '<li><span class="what">' + Site.esc(r.what) + '</span>' +
        '<span class="chip chip-gold">+' + Site.esc(r.points) + '</span></li>';
    }).join('') + '</ul>';
    // Badge legend: what each chip on the board means (phones cannot show tooltips).
    var ids = Object.keys(data.badges || {});
    if (ids.length) {
      html += '<div class="badge-legend"><h3>Badges</h3><ul class="earn-list" role="list">' + ids.map(function (id) {
        var b = data.badges[id];
        return '<li><span class="chip chip-' + Site.esc(b.color) + '">' + Site.esc(b.label || id) + '</span>' +
          '<span class="what">' + Site.esc(b.how || '') + '</span></li>';
      }).join('') + '</ul></div>';
    }
    return html;
  });
})();
