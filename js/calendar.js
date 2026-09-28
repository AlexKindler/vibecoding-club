/* js/calendar.js — fills the Calendar page. It reads data/events.json (one line per
 * meeting), grouped by month, with past meetings folded away.
 * Meetings from today onward are grouped under one heading per month; earlier ones
 * fold away under "Earlier this year". To change the words at the top of the page
 * or the legend, edit calendar.html. To change a meeting, edit data/events.json. */
(function () {
  'use strict';

  // The class that colors a row's left edge (see the <style> block in calendar.html).
  var ROW_CLASS = { TALK: 'ev-talk', WORK: 'ev-work', SPECIAL: 'ev-special', BREAK: 'ev-break' };


  // 'Tue' and 22 for the compact date block.
  function datePieces(iso) {
    var d = Site.parseLocalDate(iso);
    return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), day: d.getDate() };
  }

  // One <li> for one meeting. extraClass carries the reveal stagger for the first rows.
  function rowHTML(e, site, extraClass) {
    var type = String(e.type || '').toUpperCase();
    var pieces = datePieces(e.date);
    // A TBD date is a guess, so we do not count down to it.
    var rel = e.tbd ? '' : Site.relativeDay(e.date);

    var classes = 'ev ' + (ROW_CLASS[type] || '');
    if (rel === 'Today') classes += ' ev-today';
    if (extraClass) classes += ' ' + extraClass;

    var title = Site.esc(e.title);
    if (e.tbd) title += ' <span class="muted">(date TBD)</span>';

    // BREAK weeks have no meeting, so no time or room line.
    var where = '';
    if (type !== 'BREAK') {
      var time = Site.formatTime(e.time || Site.get(site, 'meeting.time', 'Lunch'));
      var room = e.room || Site.get(site, 'meeting.room', 'A218');
      where = '<p class="ev-where muted">' + Site.esc(time) + ' · ' + Site.esc(room) + '</p>';
    }

    return '<li class="' + classes + '">' +
      '<time class="ev-date" datetime="' + Site.esc(e.date) + '">' +
        '<span class="ev-wd" aria-hidden="true">' + Site.esc(pieces.weekday) + '</span>' +
        '<span class="ev-day" aria-hidden="true">' + Site.esc(pieces.day) + '</span>' +
        '<span class="visually-hidden">' + Site.esc(Site.formatDate(e.date, 'long')) + '</span>' +
      '</time>' +
      '<div class="ev-main">' +
        '<p class="ev-chips">' + Site.chip(type) +
          (rel ? '<span class="chip chip-neon">' + Site.esc(rel) + '</span>' : '') +
        '</p>' +
        '<p class="ev-title">' + title + '</p>' +
        (e.description ? '<p class="ev-desc">' + Site.esc(e.description) + '</p>' : '') +
        where +
      '</div>' +
    '</li>';
  }

  // Splits a date-sorted list into [{ label: 'September 2026', events: [...] }, ...].
  function groupByMonth(list) {
    var groups = [];
    list.forEach(function (e) {
      var key = String(e.date).slice(0, 7); // '2026-09'
      var last = groups[groups.length - 1];
      if (!last || last.key !== key) {
        last = { key: key, label: Site.formatDate(e.date, 'month'), events: [] };
        groups.push(last);
      }
      last.events.push(e);
    });
    return groups;
  }

  // The whole calendar: upcoming months first, then past meetings folded away.
  Site.section('#calendar-body', 'data/events.json', function (data, site) {
    var today = Site.todayISO();
    var all = Site.allEvents(data);
    var upcoming = all.filter(function (e) { return e.date >= today; });
    var past = all.filter(function (e) { return e.date < today; });
    var html = '';

    if (!upcoming.length) {
      html += '<div class="card cal-empty">' +
        '<p><span aria-hidden="true">🌱</span> No meetings coming up right now. Once a club leader adds the next ones to ' +
        '<code>data/events.json</code>, they show up right here.</p></div>';
    }

    groupByMonth(upcoming).forEach(function (group, monthIndex) {
      var first = monthIndex === 0;
      html += '<h2 class="cal-month' + (first ? ' reveal' : '') + '">' + Site.esc(group.label) + '</h2>';
      html += '<ol class="cal-list" role="list">' + group.events.map(function (e, i) {
        // Only the first month staggers in; delays are capped at reveal-delay-6.
        var stagger = first ? 'reveal reveal-delay-' + Math.min(i + 1, 6) : '';
        return rowHTML(e, site, stagger);
      }).join('') + '</ol>';
    });

    if (past.length) {
      html += '<details class="past"><summary><h2>' +
        '<span class="past-arrow" aria-hidden="true">▶</span> ' +
        'Earlier this year (' + past.length + ')</h2></summary>';
      groupByMonth(past).forEach(function (group) {
        html += '<h3 class="cal-month">' + Site.esc(group.label) + '</h3>' +
          '<ol class="cal-list" role="list">' + group.events.map(function (e) {
            return rowHTML(e, site, '');
          }).join('') + '</ol>';
      });
      html += '</details>';
    }

    return html;
  });
})();
