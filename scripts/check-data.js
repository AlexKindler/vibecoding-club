#!/usr/bin/env node
/*
  check-data.js: the club's data checker.

  What it does: reads the four files in data/ (site.json, events.json,
  scoreboard.json, resources.json), checks that each is valid JSON and that
  every value makes sense (real dates, links that start with https://, badge
  ids that exist, names written like "Ava K." or "pixelwiz"). Then it does a
  quick hygiene pass over the HTML, JS and CSS so the site keeps working on
  GitHub Pages: no absolute paths, no module scripts, every local link points
  at a file that really exists with the same capitalization, no file over 500 KB.

  How to run: node scripts/check-data.js, from the vibecoding-club folder (the one with index.html).
  The GitHub Action runs the same command on every pull request. ERROR lines
  fail the run; WARN lines are reminders (placeholders, empty links, a meeting
  on the wrong weekday) and never fail it, so each run doubles as a to-do list.

  How to add a rule: find the function for the file you care about (checkSite,
  checkEvents, checkScoreboard, checkResources or checkRepoHygiene), then call
  error(file, line, message) or warn(file, line, message). Get the line with
  lineOf(loc, value), where value is something unique in the entry (its date,
  name or url). Write the message so a 14-year-old knows what is wrong and
  what to do, in one sentence. Run the script again and make sure the real
  data still passes. Only Node built-ins are used; there is nothing to install.
*/
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ON_GITHUB = process.env.GITHUB_ACTIONS === 'true';
const EVENT_TYPES = ['TALK', 'WORK', 'SPECIAL', 'BREAK'];
const POINT_CATEGORIES = ['attend', 'demo', 'site', 'hackathon'];
const BADGE_COLORS = ['sun', 'tangerine', 'mint', 'coral', 'sky', 'grape'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HANDLE = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{1,23}$/u;
const FIRST_NAME_LAST_INITIAL = /^[\p{Lu}][\p{L}'-]{0,20}(?: [\p{Lu}][\p{L}'-]{0,20})? [\p{Lu}]\.$/u; // Ava K. or Mary Jane K.
const MAX_FILE_BYTES = 500 * 1024;
const SKIP_FOLDERS = ['.git', 'node_modules'];

let errorCount = 0;
let warningCount = 0;

// ---------- reporting ----------

function report(kind, file, line, message) {
  console.log(`${kind === 'error' ? 'ERROR' : 'WARN '} ${file}:${line}  ${message}`);
  if (ON_GITHUB) {
    const safe = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::${kind} file=${file},line=${line}::${safe}`);
  }
}

function error(file, line, message) { errorCount += 1; report('error', file, line, message); }
function warn(file, line, message) { warningCount += 1; report('warning', file, line, message); }

// ---------- finding line numbers in the raw file text ----------

function lineOfIndex(text, index) { return text.slice(0, index).split('\n').length; }

// A locator remembers where the last match was, so repeated values (four "Work Day"
// titles, two "Room TBD"s) resolve to the entry being checked, as long as entries
// are checked in file order.
function makeLocator(text) { return { text, from: 0 }; }

function lineOf(loc, value) {
  const needle = JSON.stringify(String(value)); // adds quotes, so "2026-10-06" matches a whole value
  let index = loc.text.indexOf(needle, loc.from);
  if (index >= 0) loc.from = index + needle.length;
  else index = loc.text.indexOf(needle); // not ahead of the cursor: look from the top instead
  return index < 0 ? 1 : lineOfIndex(loc.text, index);
}

function shorten(text) { return text.length > 50 ? `${text.slice(0, 47)}...` : text; }

// ---------- reading and parsing ----------

function readJson(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { error(file, 1, 'this file is missing; restore it from the main branch on GitHub'); return null; }
  const text = fs.readFileSync(full, 'utf8');
  let data;
  try { data = JSON.parse(text); } catch (e) { reportParseError(file, text, e.message); return null; }
  if (!isObject(data)) { error(file, 1, 'the whole file should be one object that starts with { and ends with }'); return null; }
  return { data, text };
}

function reportParseError(file, text, nodeMessage) {
  let line = null;
  let m = nodeMessage.match(/\(line (\d+) column (\d+)\)/);
  if (m) line = Number(m[1]);
  else if ((m = nodeMessage.match(/at position (\d+)/))) line = lineOfIndex(text, Number(m[1]));
  const hints = jsonHints(text);
  if (line === null) line = hints.length ? hints[0].line : 1;
  const reason = nodeMessage.replace(/ in JSON at position.*$/, '').replace(/\s+/g, ' ');
  let message = `this file is not valid JSON, so the site cannot read it (Node says: ${reason})`;
  if (hints.length) message += `. Hint: ${hints.map((h) => `${h.message} (line ${h.line})`).join('; ')}`;
  error(file, line, message);
}

function jsonHints(text) {
  const hints = [];
  const lines = text.split('\n');
  let m = text.match(/[‘’“”]/);
  if (m) hints.push({ line: lineOfIndex(text, m.index), message: 'curly quotes pasted from a doc; retype them as straight quotes' });
  m = text.match(/,\s*[\]}]/);
  if (m) hints.push({ line: lineOfIndex(text, m.index), message: 'extra comma before the closing bracket' });
  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (/[}"]\s*$/.test(lines[i]) && /^\s*[{"]/.test(lines[i + 1])) {
      hints.push({ line: i + 1, message: `missing comma at the end of line ${i + 1}` });
      break;
    }
  }
  return hints;
}

// ---------- small value checks ----------

function isText(value) { return typeof value === 'string'; }
function isFilledText(value) { return typeof value === 'string' && value.trim() !== ''; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

// Returns a Date for a real calendar date written YYYY-MM-DD, otherwise null.
function parseDate(value) {
  const m = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? date : null;
}

// Line of a key inside obj; if the key is missing, the line of the section it belongs in.
function fieldLine(loc, obj, key, sectionName) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? lineOf(loc, key) : lineOf(loc, sectionName);
}

function section(file, loc, data, key) {
  if (isObject(data[key])) return data[key];
  error(file, lineOf(loc, key), `the "${key}" section is missing or is not an object between { and }; copy it back from the main branch`);
  return null;
}

// Every key in `keys` must be non-empty text. List keys in file order so the line numbers stay right.
function requireTexts(file, loc, obj, keys, sectionName) {
  for (const key of keys) {
    const line = fieldLine(loc, obj, key, sectionName);
    if (!isFilledText(obj[key])) error(file, line, `${sectionName}.${key} should be some text inside quotes, and not blank`);
  }
}

// ---------- data/site.json ----------

function checkSite(file, data, loc) {
  const club = section(file, loc, data, 'club');
  if (club) {
    requireTexts(file, loc, club, ['name', 'school', 'pitch', 'repo'], 'club');
    if (isText(club.repo) && !club.repo.startsWith('https://github.com/')) {
      error(file, lineOf(loc, club.repo), 'club.repo should be the address of this repo on GitHub, starting with https://github.com/');
    }
  }
  const meeting = section(file, loc, data, 'meeting');
  if (meeting) requireTexts(file, loc, meeting, ['day', 'time', 'room'], 'meeting');

  if (!Array.isArray(data.leaders) || data.leaders.length === 0) {
    error(file, lineOf(loc, 'leaders'), 'leaders should be a list with at least one entry, like [{ "name": "Ava K.", "role": "Club lead" }]');
  } else {
    data.leaders.forEach((leader, i) => {
      const hasName = isObject(leader) && isFilledText(leader.name);
      const line = lineOf(loc, hasName ? leader.name : 'leaders');
      if (!hasName || !isFilledText(leader.role)) error(file, line, `leaders entry #${i + 1} needs both a name and a role in quotes, like { "name": "Ava K.", "role": "Club lead" }`);
      else if (!HANDLE.test(leader.name) && !FIRST_NAME_LAST_INITIAL.test(leader.name)) error(file, line, `leader "${leader.name}": use first name + last initial (Ava K.) or a handle; never a full name or email, this site is public`);
    });
  }

  const links = section(file, loc, data, 'links');
  if (links) {
    for (const key of ['joinForm', 'hackathonForm', 'schoolClubsCalendar']) {
      const line = fieldLine(loc, links, key, 'links');
      const value = links[key];
      if (!isText(value)) error(file, line, `links.${key} should be a web address in quotes, or "" if you do not have it yet`);
      else if (value === '' && key !== 'schoolClubsCalendar') warn(file, line, `links.${key} is empty, so the ${key === "joinForm" ? "Join" : "Register"} button will say coming soon until you paste the form link`);
      else if (key === 'schoolClubsCalendar' && !/club/i.test(value)) warn(file, line, `links.schoolClubsCalendar looks like a placeholder (${value || 'empty'}); paste the Menlo Clubs calendar address`);
      else if (value !== '' && !value.startsWith('https://')) error(file, line, `links.${key} should start with https:// (copy the full address from your browser)`);
    }
  }

  const hack = section(file, loc, data, 'hackathon');
  if (!hack) return;
  requireTexts(file, loc, hack, ['name', 'description'], 'hackathon');
  if (!parseDate(hack.date)) error(file, fieldLine(loc, hack, 'date', 'hackathon'), 'hackathon.date should be a real date written YYYY-MM-DD, like "2026-11-14"');
  if (!isTime(hack.time)) error(file, fieldLine(loc, hack, 'time', 'hackathon'), 'hackathon.time should be 24-hour HH:MM in quotes, like "09:00"');
  if (typeof hack.dateConfirmed !== 'boolean') error(file, fieldLine(loc, hack, 'dateConfirmed', 'hackathon'), 'hackathon.dateConfirmed should be true or false, with no quotes');
  requireTexts(file, loc, hack, ['where', 'prize', 'teamSize'], 'hackathon');
  for (const key of ['rules', 'judging']) {
    const list = hack[key];
    if (!Array.isArray(list) || list.length === 0 || !list.every(isFilledText)) {
      error(file, fieldLine(loc, hack, key, 'hackathon'), `hackathon.${key} should be a list of at least one sentence in quotes, separated by commas`);
    }
  }
}

// ---------- data/events.json ----------

function checkEvents(file, data, loc) {
  if (!Array.isArray(data.events)) { error(file, lineOf(loc, 'events'), 'there should be an "events" list: "events": [ ... ] with one { } entry per meeting'); return; }
  const seen = new Set();
  let latest = null; // the entry with the latest date so far
  data.events.forEach((entry, i) => {
    const label = `events entry #${i + 1}`;
    if (!isObject(entry)) { error(file, lineOf(loc, 'events'), `${label} should be an object between { and }`); return; }
    const line = lineOf(loc, isFilledText(entry.date) ? entry.date : isFilledText(entry.title) ? entry.title : 'events');
    const date = parseDate(entry.date);
    const name = date ? `the ${entry.date} entry` : label;
    if (!date) error(file, line, `${label} needs a real date written YYYY-MM-DD, like "2026-10-06"`);
    if (!EVENT_TYPES.includes(entry.type)) error(file, line, `${name} has type "${entry.type}"; it must be exactly TALK, WORK, SPECIAL or BREAK in capitals`);
    if (!isFilledText(entry.title)) error(file, line, `${name} needs a title in quotes`);
    if (!isText(entry.description)) error(file, line, `${name} needs a description in quotes (it can be "" if there is nothing to say)`);
    if (entry.time !== undefined && !isTime(entry.time)) error(file, line, `${name} has time "${entry.time}"; write it as 24-hour HH:MM in quotes, like "12:30"`);
    if (entry.room !== undefined && !isText(entry.room)) error(file, line, `${name} has a room that is not text; put it in quotes`);
    if (!date) return;

    const key = `${entry.date} ${String(entry.title).trim().toLowerCase()}`;
    if (seen.has(key)) error(file, line, `${name} "${entry.title}" is listed twice; delete one of them`);
    seen.add(key);
    if (latest && entry.date < latest.date) {
      error(file, line, `the ${entry.date} entry should come before the ${latest.date} entry; keep meetings in date order so two people's changes don't collide`);
    }
    if (!latest || entry.date > latest.date) latest = entry;
    if (['TALK', 'WORK', 'BREAK'].includes(entry.type) && date.getDay() !== 2) {
      warn(file, line, `${entry.date} is a ${WEEKDAYS[date.getDay()]}, not a Tuesday; double-check the date (only SPECIAL events may be on another day)`);
    }
    if ('tbd' in entry && typeof entry.tbd !== 'boolean') error(file, line, `${entry.date}: tbd should be true or false (no quotes)`);
    if (entry.tbd === true) warn(file, line, `"${entry.title}" on ${entry.date} is marked tbd, so the site shows "date TBD" and skips it in Next up; remove the tbd line once the date is confirmed`);
  });
}

// ---------- data/scoreboard.json ----------

function checkScoreboard(file, data, loc) {
  if (!parseDate(data.updated)) error(file, lineOf(loc, 'updated'), '"updated" should be the date you last edited this file, written YYYY-MM-DD');

  if (!Array.isArray(data.howToEarn) || data.howToEarn.length === 0) {
    error(file, lineOf(loc, 'howToEarn'), '"howToEarn" should be a list with at least one { "category", "what", "points" } entry');
  } else {
    data.howToEarn.forEach((row, i) => {
      const label = `howToEarn entry #${i + 1}`;
      const line = lineOf(loc, isObject(row) && isFilledText(row.what) ? row.what : 'howToEarn');
      if (!isObject(row)) { error(file, line, `${label} should be an object between { and }`); return; }
      if (!POINT_CATEGORIES.includes(row.category)) error(file, line, `${label} has category "${row.category}"; use attend, demo, site or hackathon`);
      if (!isFilledText(row.what)) error(file, line, `${label} needs a "what" in quotes that says how to earn the points`);
      if (!Number.isInteger(row.points) || row.points < 0) error(file, line, `${label} needs "points" as a whole number with no quotes, 0 or more`);
    });
  }

  const badges = section(file, loc, data, 'badges');
  const badgeIds = badges ? Object.keys(badges) : [];
  for (const id of badgeIds) {
    const badge = badges[id];
    const line = lineOf(loc, id);
    if (!isObject(badge)) { error(file, line, `badge "${id}" should be an object like { "label": "Demo Star", "color": "sun", "how": "Demoed on a Work Day" }`); continue; }
    if (!isFilledText(badge.label)) error(file, line, `badge "${id}" needs a label in quotes`);
    if (!BADGE_COLORS.includes(badge.color)) error(file, line, `badge "${id}" has color "${badge.color}"; pick one of ${BADGE_COLORS.join(', ')}`);
    if (!isText(badge.how)) error(file, line, `badge "${id}" needs a "how" in quotes explaining how to earn it`);
  }

  if (!Array.isArray(data.members)) { error(file, lineOf(loc, 'members'), '"members" should be a list: "members": [ ... ] with one { } entry per person'); return; }
  const seenNames = new Set();
  let latestName = null; // the alphabetically latest name so far
  data.members.forEach((member, i) => {
    const name = isObject(member) && isText(member.name) ? member.name : '';
    const line = lineOf(loc, name || 'members');
    const label = name ? `member "${name}"` : `members entry #${i + 1}`;
    if (!isObject(member)) { error(file, line, `${label} should be an object between { and }`); return; }
    if (!name) error(file, line, `${label} needs a "name" in quotes`);
    else if (!HANDLE.test(name) && !FIRST_NAME_LAST_INITIAL.test(name)) {
      error(file, line, `${label}: use first name + last initial (Ava K.) or a handle (pixelwiz); never a full name or email`);
    }
    if (seenNames.has(name.toLowerCase())) error(file, line, `${label} is listed twice; keep one entry and add the points together`);
    seenNames.add(name.toLowerCase());
    if (!Number.isInteger(member.points) || member.points < 0 || member.points > 100000) {
      error(file, line, `${label} needs "points" as a whole number with no quotes, between 0 and 100000`);
    }
    if (!Array.isArray(member.badges)) error(file, line, `${label} needs "badges" as a list, even an empty one: "badges": []`);
    else for (const id of member.badges) {
      if (!badgeIds.includes(id)) error(file, line, `${label} has a badge "${id}" that is not in the badges section; valid ids are: ${badgeIds.join(', ')}`);
    }
    const order = latestName === null ? 1 : name.localeCompare(latestName, undefined, { sensitivity: 'base' });
    if (order < 0) warn(file, line, `members are not in alphabetical order: move "${name}" up so it comes before "${latestName}"`);
    if (order > 0) latestName = name;
  });
}

// ---------- data/resources.json ----------

function checkResources(file, data, loc) {
  if (!Array.isArray(data.resources)) { error(file, lineOf(loc, 'resources'), 'there should be a "resources" list: "resources": [ ... ] with one { } entry per link'); return; }
  data.resources.forEach((res, i) => {
    const ok = isObject(res);
    const line = lineOf(loc, ok && isFilledText(res.url) ? res.url : ok && isFilledText(res.title) ? res.title : 'resources');
    const label = ok && isFilledText(res.title) ? `resource "${shorten(res.title)}"` : `resources entry #${i + 1}`;
    if (!ok) { error(file, line, `${label} should be an object between { and }`); return; }
    if (!isFilledText(res.title)) error(file, line, `${label} needs a title in quotes`);
    if (!isFilledText(res.url) || !res.url.startsWith('https://')) error(file, line, `${label} needs a url that starts with https:// (copy the full address from your browser)`);
    if (!isFilledText(res.blurb)) error(file, line, `${label} needs a one-sentence blurb in quotes`);
    if (!isFilledText(res.tag)) error(file, line, `${label} needs a short tag in quotes, like "Learn"`);
  });
}

// ---------- placeholders in any file ----------

function checkPlaceholders(file, value, loc) {
  if (typeof value === 'string') {
    if (value.includes('TBD') || value.includes('TODO')) warn(file, lineOf(loc, value), `"${shorten(value)}" is still a placeholder; replace it when you know the real answer`);
  } else if (value && typeof value === 'object') {
    // _help strings explain the rules (and may mention TBD), so they are not placeholders themselves
    for (const [key, child] of Object.entries(value)) if (key !== '_help') checkPlaceholders(file, child, loc);
  }
}

// ---------- repo hygiene: HTML, JS, CSS and file sizes ----------

// href="x" and src="x" in HTML, href: 'x' in JS objects, fetch('x'), url(x) in CSS.
const ABSOLUTE_PATH = /\b(?:href|src)\s*[=:]\s*["']\/(?!\/)|\bfetch\(\s*["'`]\/(?!\/)|\burl\(\s*["']?\/(?!\/)/g;
const MODULE_SCRIPT = /<script[^>]*\btype\s*=\s*["']module["']/gi;
const LOCAL_REFS = [/\b(?:href|src)\s*[=:]\s*["']([^"']*)["']/g, /\bfetch\(\s*["'`]([^"'`]*)["'`]/g, /\burl\(\s*["']?([^"')]*)["']?\s*\)/g];
const NOT_A_LOCAL_FILE = /^(?:https?:|mailto:|tel:|#|data:|javascript:|\/)/i; // "/" is reported by ABSOLUTE_PATH instead

function listFiles(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_FOLDERS.includes(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) listFiles(full, out);
    else out.push({ rel: path.relative(ROOT, full).split(path.sep).join('/'), size: stat.size });
  }
  return out;
}

function checkRepoHygiene() {
  for (const f of listFiles(ROOT, [])) {
    if (f.size > MAX_FILE_BYTES) error(f.rel, 1, `this file is ${Math.round(f.size / 1024)} KB, over the 500 KB limit; shrink the image or video, or link to it instead of uploading it`);
    if (/^[^/]+\.html$/.test(f.rel) || /^js\/[^/]+\.js$/.test(f.rel)) checkSourceFile(f.rel, ROOT);
    if (f.rel === 'css/style.css') checkSourceFile(f.rel, path.join(ROOT, 'css'));
  }
}

// baseDir is the folder relative links are measured from: the repo root for pages and
// for js/ (a script's links are relative to the page that loads it), the css folder for style.css.
function checkSourceFile(file, baseDir) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  // Blank out comments (keeping line breaks) so a comment that EXPLAINS the rules does not trip them.
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  const text = file.endsWith('.html')
    ? raw.replace(/<!--[\s\S]*?-->/g, blank)
    : raw.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank);
  let m;
  ABSOLUTE_PATH.lastIndex = 0;
  while ((m = ABSOLUTE_PATH.exec(text))) {
    error(file, lineOfIndex(text, m.index), `${m[0]}... is an absolute path; use css/style.css not /css/style.css: absolute paths break on GitHub Pages under /vibecoding-club/`);
  }
  MODULE_SCRIPT.lastIndex = 0;
  while ((m = MODULE_SCRIPT.exec(text))) {
    error(file, lineOfIndex(text, m.index), 'module scripts do not work when the file is double-clicked; use a plain <script src="js/app.js"></script>');
  }
  for (const pattern of LOCAL_REFS) {
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text))) {
      const ref = m[1].trim();
      let target = ref.split(/[?#]/)[0];
      if (!target || NOT_A_LOCAL_FILE.test(ref) || ref.includes('${')) continue;
      try { target = decodeURIComponent(target); } catch (e) { /* leave it as typed */ }
      const problem = missingFileProblem(baseDir, target);
      if (problem) error(file, lineOfIndex(text, m.index), `"${ref}" ${problem}`);
    }
  }
}

// Walks the path one folder at a time and compares against the real folder listing,
// because the GitHub Pages server is case-sensitive even though a Mac is not.
function missingFileProblem(baseDir, target) {
  let dir = baseDir;
  for (const part of target.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { dir = path.dirname(dir); continue; }
    const names = fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? fs.readdirSync(dir) : [];
    if (!names.includes(part)) {
      const near = names.find((n) => n.toLowerCase() === part.toLowerCase());
      if (near) return `points to "${part}" but the file is really named "${near}"; match the capitalization exactly, because GitHub Pages is case-sensitive`;
      return 'points to a file that does not exist; check the spelling and the folder';
    }
    dir = path.join(dir, part);
  }
  return null;
}

// ---------- main ----------

function main() {
  const checkers = {
    'data/site.json': checkSite,
    'data/events.json': checkEvents,
    'data/scoreboard.json': checkScoreboard,
    'data/resources.json': checkResources,
  };
  for (const file of Object.keys(checkers)) {
    const loaded = readJson(file);
    if (!loaded) continue;
    checkers[file](file, loaded.data, makeLocator(loaded.text));
    checkPlaceholders(file, loaded.data, makeLocator(loaded.text));
  }
  checkRepoHygiene();
}

try {
  main();
} catch (e) {
  error('scripts/check-data.js', 1, `the checker itself crashed (${e.message}); tell a club leader`);
}
if (errorCount > 0) console.log(`Found ${errorCount} errors and ${warningCount} warnings`);
else console.log(`All 4 data files look good (${warningCount} warnings)`);
process.exitCode = errorCount > 0 ? 1 : 0;
