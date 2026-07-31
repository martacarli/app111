# Safe Loop Run: Mobile App Overview

Safe Loop Run is a mobile app that generates safe, efficient loop routes back to your starting point. Unlike out-and-back routes that require retracing your steps, Safe Loop Run creates genuine loops that use different streets on the return journey, minimizing backtracking and making runs more interesting and engaging.

## Core Purpose

Generate running/walking loops that are:

1. **Real loops** — different streets outbound and return, no dead-ends or retracing
2. **Safety-aware** — routed away from recent crime hotspots (UK only, using live data.police.uk data)
3. **Flexible** — offered in three variants (shorter/planned/longer with ±4 min or ±1 km spacing)
4. **Customizable** — choose between running or walking, plan by duration or distance

## Key Features

- **Three Route Options**: After entering a target time or distance, the app generates three routes: one slightly shorter, one matching your request, and one slightly longer. This gives runners choice when exact targets aren't achievable.
- **Change Route Button**: Explore alternatives in different directions (North, East, South, West). The button cycles through directions and generates new loops, allowing you to find different route options without changing your distance/time target.
- **Dual Modes**: Select "Run" (faster pace) or "Walk" (slower pace) — the app adjusts duration estimates based on realistic paces, independent of OpenRouteService's default walking assumptions.
- **Safety Layer**: If you're in UK coverage (England, Wales, Northern Ireland), the app fetches recent crime reports and routes around high-density hotspots. Non-UK locations show standard loops with a note explaining limited coverage.
- **Run Tracking**: After selecting a route, tap "Start Run" to begin. A timer, progress bar, and visual progress indicator track your position along the planned route. Tap "Stop Run" to log the activity.
- **Live Map**: Interactive map shows your real-time location, the planned route, and (during a run) a colored progress line showing how far you've traveled.
- **Run Log**: Historical log of completed runs with distance, time, pace, location, and safety notes.
- **Geolocation**: Uses device GPS to pinpoint your location and generate routes from where you are, with automatic location refresh each time you open the app.

## Technical Foundation

- Routes are generated using OpenRouteService's `round_trip` mode with 10 waypoints for realistic street-following paths
- The app prevents overlaps and dead-ends
- Smart seed variation: tries 3 different route seeds and picks the best by retrace ratio and distance accuracy
- Crime data from UK police API used to determine safety of route — highest feasible safety route prioritised
- Reverse geocoding shows your location name (neighborhood, city, etc.) in the UI

## User Flow

1. App detects your location via GPS and shows it on the map
2. Set target (e.g., 30 minutes) and choose Run or Walk
3. Tap "Find my route" — generates 3 options
4. Pick one; map zooms to show the full loop
5. Tap "Start Run" to track progress with a timer and live progress indicator
6. Tap "Stop Run" when done; activity logs to run history
7. Want a different loop? Tap "Change Route" to explore variations, or "Try a Different Length" to adjust your target

## What Makes It Different

- True loops (not out-and-back)
- Safety-first routing (crime hotspot avoidance)
- Multiple options in one generation (not just one route)
- Direction-aware variants (explore North, East, South, West alternatives)
- Real-time GPS tracking during runs with visual progress
- Minimal API overhead (efficient 3-seed approach, not aggressive retries)
- Works offline for map display; syncs routes and data when connected

## Setup

1. Install [Node.js](https://nodejs.org) if you don't have it.
2. Get a free OpenRouteService API key at
   https://openrouteservice.org/dev/#/signup (instant, no payment info).
3. Open `lib/config.js` and replace:
   ```js
   export const ORS_API_KEY = 'YOUR_OPENROUTESERVICE_API_KEY';
   ```
   with your real key.
4. In this project folder, run:
   ```
   npm install
   npx expo start
   ```
5. Install the **Expo Go** app on your phone (App Store or Play Store),
   then scan the QR code that shows up in your terminal. The app will
   load directly on your phone.

## Project Structure

- `App.js` — top-level state machine switching between the four screens
  below (home → route options → active run → run log).
- `lib/policeData.js` — fetches recent street-level crime reports near a
  point from data.police.uk, walking backward through months since the
  data has a natural reporting lag.
- `lib/safety.js` — buckets crime reports into a coarse grid, weights them
  by severity (`CRIME_WEIGHTS`), and turns the highest-risk cells into
  avoid-polygons for the routing engine.
- `lib/directions.js` — bearing math used to tag generated routes with a
  compass direction (N/E/S/W), since OpenRouteService's `round_trip` mode
  has no native direction parameter — this is what powers "Change Route."
- `lib/routing.js` — calls OpenRouteService for round-trip loops, tries
  multiple seeds per target length, scores candidates by retrace ratio and
  distance accuracy, and generates the three shorter/planned/longer
  options.
- `lib/pace.js` — converts between duration and distance using your
  chosen Run/Walk pace, independent of ORS's own duration estimate.
- `lib/progress.js` — projects a live GPS fix onto the planned route to
  drive the progress bar and the colored progress line during a run.
- `lib/geocode.js` — reverse geocodes your coordinates to a readable
  place name.
- `lib/runLog.js` / `lib/runLogCore.js` — local run history, persisted
  with AsyncStorage.
- `screens/HomeScreen.js` — GPS + target entry (distance/duration) +
  Run/Walk toggle.
- `screens/RouteOptionsScreen.js` — the three route cards, "Change
  Route," and "Try a Different Length."
- `screens/ActiveRunScreen.js` — live map, timer, progress tracking,
  Start/Stop Run.
- `screens/RunLogScreen.js` — history of past runs.

## Known Limitations

- **Only works well in England, Wales, and Northern Ireland.** Outside
  that, the crime API returns nothing, and the app falls back to a route
  with no safety weighting.
- **No time-of-day adjustment.** The hotspot model treats a Tuesday
  afternoon and a Saturday 1am the same way.
- **The severity weights in `CRIME_WEIGHTS`** are a first guess, not
  validated against anything.
- **The grid-based hotspot model is intentionally simple** — hotspot
  cells aren't merged, so avoid zones can look blocky at cell boundaries.
  `threshold` (in `buildAvoidPolygons`) is the main tuning knob.
- **"Change Route" direction-awareness is a best-effort heuristic**, not
  a native ORS feature — it tags generated routes by which way they
  happen to bulge, so a requested direction can occasionally fall back to
  the closest match (e.g. near a coastline).
- **Up to 9 OpenRouteService calls per "Find my route" tap** (3 variants
  × up to 3 seeds each), worth tuning down if you're on a rate-limited
  key.
- **Reverse geocoding uses the public Nominatim API**, which has a strict
  rate limit (~1 request/second) — fine for this app's one-lookup-per-
  open pattern, but don't call it more often.
- **Live progress tracking is only as good as GPS accuracy** — indoor or
  urban-canyon GPS drift can make the progress bar jump.
- **No disclaimer/terms-of-service flow** beyond the text on the home
  screen.
