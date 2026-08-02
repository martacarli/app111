# Safe Loop Run: Mobile App Overview

Safe Loop Run is a mobile app that generates safe, efficient loop routes back to your starting point. Unlike out-and-back routes that require retracing your steps, Safe Loop Run creates genuine loops that use different streets on the return journey, minimizing backtracking and making runs more interesting and engaging.

## Core Purpose

Generate running/walking loops that are:

1. **Real loops** — different streets outbound and return, no dead-ends or retracing
2. **Safety-aware** — routed away from recent crime hotspots (UK only, using live data.police.uk data)
3. **Flexible** — offered in three variants (shorter/planned/longer with ±4 min or ±1 km spacing)
4. **Customizable** — choose between running or walking, plan by duration or distance

## Key Features

- **Three Route Options**: After entering a target time or distance, the app generates three routes and ranks them by actual closeness to your target — closest match first, furthest last — capped to no more than 10 minutes (duration mode) or 1 km (distance mode) over your target.
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

1. App detects your location via GPS and shows it on the map, with a banner over the map to set your target
2. Set target (e.g., 30 minutes) and choose Run or Walk
3. Tap "Find my route" — the banner collapses to a small summary and 3 ranked route cards appear over the map
4. Tap a card to preview it on the map; tap "Edit" on the summary banner anytime to change your target and try again
5. Tap "Start with this route" to move to run tracking — a timer and live progress indicator track your position along the planned route (with a "Cancel" option before you tap "Start Run")
6. Tap "Stop Run" when done; activity logs to run history
7. Bottom tab bar (Home / Log / Profile) is available throughout for quick navigation

## What Makes It Different

- True loops (not out-and-back)
- Safety-first routing (crime hotspot avoidance)
- Multiple options in one generation (not just one route)
- Direction-aware variants (explore North, East, South, West alternatives)
- Real-time GPS tracking during runs with visual progress
- Minimal API overhead (efficient 3-seed approach, not aggressive retries)
- Works offline for map display; syncs routes and data when connected

## Setup

This project targets Expo SDK 54, which matches the current Expo Go app on
the App Store / Play Store. Apple only allows installing the latest Expo
Go build, so an older SDK here would fail to open with an "incompatible"
error on a real iPhone — if you ever bump `expo` further, keep the
`expo`/`react`/`react-native`/`expo-*` versions in `package.json` in sync
(the exact compatible set for a given SDK ships in
`node_modules/expo/bundledNativeModules.json` once installed).

1. Install [Node.js](https://nodejs.org) if you don't have it.
2. Get a free OpenRouteService API key at
   https://openrouteservice.org/dev/#/signup (instant, no payment info).
3. Copy `.env.example` to `.env` and put your real key in it:
   ```
   EXPO_PUBLIC_ORS_API_KEY=your-real-key-here
   ```
   `.env` is gitignored — your key stays local and is never committed.
   `lib/config.js` reads it automatically (Expo loads `.env` files with
   the `EXPO_PUBLIC_` prefix built in); it falls back to a placeholder
   if `.env` is missing.
4. In this project folder, run:
   ```
   npm install
   npx expo start
   ```
5. Install the **Expo Go** app on your phone (App Store or Play Store),
   then scan the QR code that shows up in your terminal. The app will
   load directly on your phone.

## Project Structure

- `App.js` — top-level state machine switching between screens
  (disclaimer → plan → active run → run log / profile), plus the bottom
  tab bar shown on the plan/log/profile screens.
- `lib/disclaimer.js` / `screens/DisclaimerScreen.js` — first-launch
  acknowledgement of the safety/GPS/coverage disclaimer, persisted with
  AsyncStorage so it's only shown once (also reachable again from
  Profile → "Review safety disclaimer").
- `lib/ukCoverage.js` — a rough bounding-box check for England/Wales/NI,
  used to distinguish "outside crime-data coverage" from "in coverage,
  no hotspots found" instead of conflating the two.
- `lib/policeData.js` — fetches recent street-level crime reports near a
  point from data.police.uk, walking backward through months since the
  data has a natural reporting lag.
- `lib/safety.js` — buckets crime reports into a coarse grid, weights them
  by severity (`CRIME_WEIGHTS`), merges adjacent hotspot cells into a
  single region (`groupIntoConnectedComponents`), and turns each region
  into an avoid-polygon for the routing engine.
- `lib/directions.js` — bearing math used to tag generated routes with a
  compass direction (N/E/S/W), since OpenRouteService's `round_trip` mode
  has no native direction parameter — this is what powers "Change Route."
- `lib/routing.js` — calls OpenRouteService for round-trip loops, tries
  multiple seeds per target length, and picks the 3 candidates closest to
  your true target (`selectClosestOptions`) — labeled by actual proximity
  (`RANK_LABELS`/`relabelByProximity`), not by which anchor length they
  were requested under — while enforcing the max-overage bound.
- `lib/pace.js` — converts between duration and distance using your
  chosen Run/Walk pace, independent of ORS's own duration estimate.
- `lib/progress.js` — projects a live GPS fix onto the planned route to
  drive the progress bar and the colored progress line during a run.
- `lib/mapRegion.js` — computes a MapView region that fits a set of
  points (used to fit the whole loop on screen, instead of a fixed zoom
  that can crop a bigger route).
- `lib/geocode.js` — reverse geocodes your coordinates to a readable
  place name.
- `lib/runLog.js` / `lib/runLogCore.js` — local run history, persisted
  with AsyncStorage, plus `computeRunLogSummary` for the Profile screen's
  totals.
- `components/BottomTabBar.js` — persistent Home/Log/Profile tab bar.
- `screens/PlanScreen.js` — the map-first plan screen: GPS, a
  collapsible banner over the map for target entry (distance/duration,
  Run/Walk), and once generated, the 3 ranked route cards with "Change
  Route." Tapping the collapsed summary reopens the banner to edit your
  target — no separate "back" screen needed.
- `screens/ActiveRunScreen.js` — live map (fit to the full route),
  timer, progress tracking, Start/Stop Run, and a "Cancel" option before
  starting.
- `screens/RunLogScreen.js` — history of past runs.
- `screens/ProfileScreen.js` — aggregate run stats and a link back to
  the disclaimer.

## Known Limitations

- **Only works well in England, Wales, and Northern Ireland.** Outside
  that, `lib/ukCoverage.js` (a rough lat/lng bounding-box check, not a
  real border) detects you're out of coverage and the app skips the
  crime-data fetch entirely, showing a clear "outside coverage" note
  instead of silently returning zero hotspots.
- **No time-of-day adjustment.** The hotspot model treats a Tuesday
  afternoon and a Saturday 1am the same way.
- **The severity weights in `CRIME_WEIGHTS`** are a first guess, not
  validated against anything.
- **The grid-based hotspot model merges adjacent flagged cells**
  (`groupIntoConnectedComponents`) into one bounding-box region so
  clusters don't show up as several disjoint rectangles — but it's still
  an axis-aligned box per region, not a true polygon union, so an
  L-shaped cluster's avoid-zone includes some non-hotspot area within its
  bounding box. `threshold` (in `buildAvoidPolygons`) is the main tuning
  knob.
- **"Change Route" direction-awareness is a best-effort heuristic**, not
  a native ORS feature — it tags generated routes by which way they
  happen to bulge, so a requested direction can occasionally fall back to
  the closest match (e.g. near a coastline).
- **Up to 9 OpenRouteService calls per "Find my route" tap** in the worst
  case (3 variants × up to 3 seeds each), though `generateSeedVariants`
  now stops early once a candidate is "good enough" (clean loop, close to
  target distance), so most taps use fewer. Still worth tuning down
  further if you're on a rate-limited key.
- **Reverse geocoding uses the public Nominatim API**, which has a strict
  rate limit (~1 request/second) — fine for this app's one-lookup-per-
  open pattern, but don't call it more often.
- **Live progress tracking is only as good as GPS accuracy** — indoor or
  urban-canyon GPS drift can make the progress bar jump.
- **The disclaimer gate is a one-time acknowledgement**, not reviewed
  legal terms of service — treat it as a starting point, not a substitute
  for a real ToS/privacy review before shipping to real users.
