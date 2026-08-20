# Dayton Sports

Family sports dashboard for schedules, scores, standings, broadcasts and live-game links.

## Structure

- `index.html` — lightweight app shell
- `assets/styles.css` — responsive sports-app presentation
- `assets/app.js` — client-side rendering and navigation
- `data/sports-data.json` — normalized family/public sports data
- `scripts/update_data.py` — public sports data refresh
- `.github/workflows/update.yml` — scheduled GitHub Actions updater

## Migration

The original implementation is preserved in `mmhpdayton/FaveSports` as the source archive. The new `Dayton-Sports` repo intentionally separates presentation, data and updater logic instead of restoring the old monolithic `index.html`.

Current migration priorities:

1. Core shell and mobile navigation
2. Full public-team schedules, live/final scores and broadcast metadata
3. CFB Top 25 / All FBS / conference views
4. Premier League and Champions League weekly views
5. NFL and college volleyball views
6. Standings/rankings
7. SiriusXM one-tap links
8. Odds integration only after the core site is stable
