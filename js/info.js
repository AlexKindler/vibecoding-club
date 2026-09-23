/* js/info.js — fills the two live spots on the Info page. "Who runs it" comes
 * from data/site.json (the leaders list) and the Resources list comes from
 * data/resources.json. Everything else on the page is plain words in info.html;
 * the meeting day, time, room and school name are poured in by js/shared.js
 * through the data-site="..." spans. To change words, edit info.html. */
(function () {
  'use strict';

  // Who runs it: site.json has "leaders": [ { "name": "Alex K.", "role": "Club lead" } ].
  Site.section('#leaders', 'data/site.json', function (site) {
    var leaders = site.leaders || [];
    if (!leaders.length) return '<p>Ask anyone in the room. We are all friendly.</p>';
    return '<ul class="leader-list" role="list">' + leaders.map(function (person) {
      var role = person.role ? ' <span class="muted">· ' + Site.esc(person.role) + '</span>' : '';
      return '<li>' + Site.esc(person.name) + role + '</li>';
    }).join('') + '</ul>';
  });

  // Which chip color a resource tag gets. Any other tag gets a plain chip.
  function tagClass(tag) {
    if (tag === 'Learn') return 'chip-mint';
    if (tag === 'AI tool') return 'chip-sky';
    if (tag === 'This site') return 'chip-sun';
    return '';
  }

  function tagChip(tag) {
    if (!tag) return '';
    var extra = tagClass(tag);
    return '<span class="chip' + (extra ? ' ' + extra : '') + '">' + Site.esc(tag) + '</span>';
  }

  // One resource card. Only https:// links become real links; anything else shows as plain text.
  function resourceHTML(item, index) {
    var url = String(item.url || '');
    var title;
    if (url.indexOf('https://') === 0) {
      title = '<a href="' + Site.esc(url) + '" target="_blank" rel="noopener">' + Site.esc(item.title) +
        '<span class="visually-hidden"> (opens in a new tab)</span></a>';
    } else {
      title = '<strong>' + Site.esc(item.title) + '</strong>';
    }
    var delay = Math.min(index + 1, 6);
    return '<li class="resource reveal reveal-delay-' + delay + '">' +
      '<div class="top">' + title + tagChip(item.tag) + '</div>' +
      (item.blurb ? '<p>' + Site.esc(item.blurb) + '</p>' : '') +
    '</li>';
  }

  // Resources: resources.json has "resources": [ { title, url, blurb, tag } ], shown in file order.
  Site.section('#resources', 'data/resources.json', function (data) {
    var list = (data && data.resources) || [];
    if (!list.length) return '<p>No links yet. Add the first one to <code>data/resources.json</code>!</p>';
    return '<ul class="resource-list" role="list">' + list.map(resourceHTML).join('') + '</ul>';
  });
})();
