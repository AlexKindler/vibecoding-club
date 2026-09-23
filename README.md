# VibeCoding Club website

The website for VibeCoding Club at Menlo School. We build it together, all year, and every member is a collaborator. It is plain HTML, CSS and JavaScript: no frameworks, no build step, nothing to install.

Live site: https://alexkindler.github.io/vibecoding-club/

Every merged pull request to this site is worth **50 points** on the scoreboard.

---

## 1. Preview the site on your computer

Pick whichever of these you like. Any one of them works.

**Option A: Terminal (Mac)**

1. Get the code: on the green **Code** button above, choose **Open with GitHub Desktop**, or run `git clone https://github.com/AlexKindler/vibecoding-club.git`.
2. Open Terminal, go into the folder, and start a tiny web server:

   ```bash
   cd vibecoding-club
   python3 -m http.server 8000
   ```

3. Open http://localhost:8000 in your browser. Press `Ctrl-C` in Terminal when you are done.

   The first time you run `python3` on a new Mac it may ask to install "command line developer tools". Click **Install** once and try again.

**Option B: VS Code, no terminal**

Install the **Live Server** extension, open the `vibecoding-club` folder, and click **Go Live** in the bottom bar.

**Option C: GitHub Codespaces, nothing on your laptop**

On the repo page click the green **Code** button, then **Codespaces**, then **Create codespace on main**. In its terminal run `python3 -m http.server 8000` and click the link it offers.

**Why can't I just double-click index.html?**

You can, and the page will mostly work, but the calendar and scoreboard sections will show a card saying they "need a tiny web server". Browsers refuse to read data files from a folder for safety reasons. The card shows the exact command to run.

---

## 2. Where things are

```
index.html, info.html, scoreboard.html, hackathon.html, calendar.html   one file per page
css/style.css        the ONE shared stylesheet (page-only styles sit inside each page)
js/shared.js         draws the header, menu and footer on every page, loads the data files
js/home.js ...       one small script per page
data/site.json       time, room, links, leader names, hackathon facts  <- fill-in-the-blanks
data/events.json     the calendar
data/scoreboard.json points, badges, and the "how to earn points" rules
data/resources.json  links on the Info page
scripts/check-data.js  the robot that checks the data files (runs on every pull request)
```

Most changes only touch one file in `data/`. You do not need to read any JavaScript to update the calendar or the scoreboard.

---

## 3. Add or change a meeting

Open `data/events.json`. It looks like this:

```json
{ "date": "2026-10-20", "type": "TALK", "title": "Talk Day", "description": "A speaker, a demo or a short lesson." }
```

1. **Copy the line above the spot you want**, paste it below, and change the words. Copying a whole line keeps the commas and quotes right.
2. `date` is `YYYY-MM-DD`. `type` is `TALK`, `WORK`, `SPECIAL`, or `BREAK` (a week with no meeting).
3. Keep the list **in date order**. The checker will tell you if a line is out of place.
4. Optional extras: `"time": "12:30"` or `"room": "Library"` if a meeting is somewhere unusual.

The hackathon is **not** in this file. Its date lives in `data/site.json` and shows up on the calendar automatically.

---

## 4. Update the scoreboard

Open `data/scoreboard.json`. A member looks like this:

```json
{ "name": "Ada L.",   "points": 85, "badges": ["builder", "demo"] }
```

- **Names are first name + last initial** (`Ava K.`) or a handle (`pixelwiz`). Never full names, never emails. This site is public.
- Change `points` to the new total. Never type a rank: the site sorts by points and ties share a rank.
- Keep members **alphabetical** so two people's edits land on different lines.
- `badges` must use ids from the `badges` section of the same file.
- The rules under `howToEarn` are what the "How to earn points" box shows. Change the words or points there, no code needed.

A club leader has to approve every change to this file (GitHub enforces it). That is on purpose: points are the fun part, so one person double-checks them.

---

## 5. Change the time, room, links, or hackathon details

Everything with a blank in it lives in `data/site.json`: meeting time and room, the Join form link, the hackathon registration link, the school calendar link, leader names, and the hackathon date, prize, rules and judging.

- A link set to `""` shows a "coming soon" button instead of a broken one.
- To start the hackathon countdown, set the real `date` and `time` and flip `"dateConfirmed": false` to `true`.
- The checker warns about anything still marked `TBD`, so it doubles as the to-do list.

---

## 6. Add a resource

Open `data/resources.json`, copy a line, change the title, url, blurb and tag. This is the easiest first pull request.

---

## 7. Check your work

Run this from the `vibecoding-club` folder:

```bash
node scripts/check-data.js
```

It says `All 4 data files look good` or tells you the file, the line and what to fix ("extra comma before the closing bracket", "keep meetings in date order", "use first name + last initial"). The same check runs on GitHub for every pull request, so a red X means "read the message", not "you broke it".

---

## 8. Open a pull request

Nobody edits `main` directly. Every change goes through a pull request (PR), which is just "here is my change, can someone look?"

**On GitHub.com (no tools needed)**

1. Open the file, click the pencil icon, make your change.
2. Click **Commit changes**. Choose **Create a new branch for this commit and start a pull request**. Give the branch a short name like `add-oct-20-speaker`.
3. Click **Propose changes**, then **Create pull request**. Fill in the two lines the template asks for.

**In VS Code or Terminal**

```bash
git checkout -b add-oct-20-speaker
# edit files, then:
node scripts/check-data.js
git add -A
git commit -m "Add Oct 20 speaker to the calendar"
git push -u origin add-oct-20-speaker
```

Then click the **Compare & pull request** button GitHub shows you.

**What happens next**

- The `check-data` check runs in about 30 seconds. Green means the data is valid.
- One other member (or a leader, for the scoreboard and site.json) clicks **Approve**.
- Whoever approves clicks **Merge**. The live site updates within a minute or two. If it looks stale, wait a minute and hard-refresh (`Cmd-Shift-R`).

**If GitHub says "This branch has conflicts"**

Someone else changed the same lines. Click **Resolve conflicts**, keep both people's lines, delete the `<<<<<<<`, `=======` and `>>>>>>>` marker lines, then **Mark as resolved** and **Commit merge**. Run the checker again to make sure the commas survived.

---

## 9. For club leaders: one-time setup

Do these once, in order, on GitHub.com under **Settings**:

1. **Pages**: Build and deployment, Source: **Deploy from a branch**, Branch: **main**, Folder: **/ (root)**, Save. Then tick **Enforce HTTPS**. The site appears at the URL shown within a couple of minutes.
2. **Collaborators**: add every member with **Write** access.
3. Open one small pull request (any change) so the `check-data` check exists, then:
4. **Branches**: Add classic branch protection rule for `main`:
   - **Require a pull request before merging**
   - **Require approvals**: 1
   - **Dismiss stale pull request approvals when new commits are pushed**
   - **Require review from Code Owners** (this is what makes a leader approve every scoreboard change, via `.github/CODEOWNERS`)
   - **Require approval of the most recent reviewable push**
   - **Require status checks to pass before merging**, and pick `check-data`
   - Leave "Do not allow bypassing the above settings" **unchecked**. A PR author can never approve their own PR, so with only one code owner your own points PRs could never merge without the admin bypass. The real fix is the next step.
5. Add a second leader's GitHub handle after `@AlexKindler` on each line of `.github/CODEOWNERS`. Any one listed owner can approve.
6. Fill in `data/site.json`: meeting time and room, the Join form link, the hackathon form link, the Menlo Clubs calendar link, and leader names. Delete the four sample members in `data/scoreboard.json`.

**Approving a points change**: open the PR, click **Files changed**, read the one-line diff, **Review changes**, **Approve**, then **Merge pull request**.

---

## Credits

Fredoka font by the Fredoka Project Authors, SIL Open Font License (see `fonts/OFL.txt`). Logo and all art are original work by club members. This site is not affiliated with Blooket.
