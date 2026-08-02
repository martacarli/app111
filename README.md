# Circl'd: Mobile App Overview

Circl'd is a mobile app that generates safe, efficient loop routes back to your starting point. Unlike out-and-back routes that require retracing your steps, Circl'd creates genuine loops that use different streets on the return journey, minimizing backtracking and making runs more interesting and engaging.

## Core Purpose

Generate running/walking loops that are:

1. **Real loops** — different streets outbound and return; avoiding retraced steps is the primary goal of route selection, only giving way to a retracing route as an extreme exception when no clean loop can be found at all
2. **Safety-aware** — routed away from recent crime hotspots (UK only, using live data.police.uk data)
3. **Flexible** — several ranked variants, closest to your target first, capped to no more than 10 min (duration mode) or 1 km (distance mode) over target
4. **Customizable** — choose between running or walking, plan by duration or distance using simple +/- stepper buttons

## Key Features

- **Multiple Ranked Route Options**: After setting a target time or distance, the app generates several routes and ranks them by actual closeness to your target — closest match first, furthest last — capped to no more than 10 minutes (duration mode) or 1 km (distance mode) over your target. Avoiding retraced streets takes priority over hitting that window exactly; retracing is only ever shown as a last resort.
- **Change Route Button**: Explore alternatives in different directions (North, East, South, West). The button cycles through directions and generates new loops, allowing you to find different route options without changing your distance/time target. It quietly picks the best available match — no internal routing details are surfaced to you.
- **Dual Modes**: Select "Run" or "Walk" — the app uses a fixed default pace per activity (9.5 km/h run, 4.7 km/h walk) to estimate duration, independent of OpenRouteService's own assumptions.
- **Stepper Target Entry**: Set your distance or duration with simple +/- buttons instead of typing a number.
- **Safety Layer**: If you're in UK coverage (England, Wales, Northern Ireland), the app fetches recent crime reports and routes around high-density hotspots. Non-UK locations show standard loops with a note explaining limited coverage.
- **Run Tracking**: After selecting a route, tap "Start Run" to begin. A timer, progress bar, and visual progress indicator track your position along the planned route. Tap "Stop Run" to log the activity.
- **Live Map**: Interactive map shows your real-time location, the planned route, and (during a run) a colored progress line showing how far you've traveled.
- **Run Log**: Historical log of completed runs with distance, time, pace, location, and safety notes.
- **Geolocation**: Uses device GPS to pinpoint your location and generate routes from where you are, with automatic location refresh each time you open the app.

## Technical Foundation

- Routes are generated using OpenRouteService's `round_trip` mode with 10 waypoints for realistic street-following paths
- Selection is tiered: clean (non-retracing) loops are considered before anything else, then staying within the preferred length window, then closeness to target — a retracing route is only shown if no clean loop was found among everything attempted
- Wider seed variation: tries up to 5 seeds across up to 5 anchor lengths per search, picking the best by that tiered criteria (more attempts than a "minimal API" search would use, in exchange for stronger retrace-avoidance and more ranked options)
- Crime data from UK police API used to determine safety of route — highest feasible safety route prioritised
- Reverse geocoding shows your location name (neighborhood, city, etc.) in the UI

## User Flow

1. App detects your location via GPS and shows it on the map, with a banner over the map to set your target
2. Set target (e.g., 30 minutes) with +/- stepper buttons and choose Run or Walk
3. Tap "Find my route" — the banner collapses to a small summary and several ranked route cards appear over the map
4. Tap a card to preview it on the map; tap "Edit" on the summary banner anytime to change your target and try again
5. Tap "Start with this route" to move to run tracking — a timer and live progress indicator track your position along the planned route (with a "Cancel" option before you tap "Start Run")
6. Tap "Stop Run" when done; activity logs to run history
7. Bottom tab bar (Home / Log / Profile) is available throughout for quick navigation

## What Makes It Different

- True loops (not out-and-back), with retrace-avoidance as the primary selection criterion
- Safety-first routing (crime hotspot avoidance)
- Multiple ranked options in one generation (not just one route)
- Direction-aware variants (explore North, East, South, West alternatives)
- Real-time GPS tracking during runs with visual progress
- No inner-workings surfaced to the user — route generation quietly does its best and shows only the result
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
  multiple seeds across multiple anchor lengths, and picks the closest
  candidates to your true target (`selectClosestOptions`) using a tiered
  priority: clean (non-retracing) loop first, then within the max-overage
  bound, then closeness to target (`selectionTier`) — only falling back to
  a retracing route when nothing clean was found at all. Labeled by actual
  proximity (`buildRankLabels`/`relabelByProximity`), not by which anchor
  length a candidate was requested under.
- `lib/stepper.js` / `components/Stepper.js` — the +/- stepper control
  used for distance/duration entry (`clampStep` is the pure clamping
  logic, `Stepper` the UI).
- `lib/pace.js` — fixed default speeds per activity (9.5 km/h run,
  4.7 km/h walk — no manual input, no health-app integration yet) and the
  duration/distance conversions built on them, independent of ORS's own
  duration estimate.
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
  the closest available match (e.g. near a coastline). This is never
  surfaced to the user as a message; the button just quietly returns the
  best match it found.
- **Up to 25 OpenRouteService calls per "Find my route" tap** in the
  worst case (5 anchor lengths × up to 5 seeds each), though
  `generateSeedVariants` stops early once a candidate is both a clean
  loop and an accurate length match, so most taps use far fewer. This
  trades away most of what used to be a "minimal API overhead" design in
  exchange for stronger retrace-avoidance and more ranked options — worth
  tuning down (fewer anchors/seeds) if you're on a rate-limited key. A
  "Find my route" tap followed quickly by a few "Change Route" taps can
  add up to 30+ calls within a minute, which is enough to trip a free-tier
  key's rate limit. When ORS returns a 429, the app degrades gracefully
  (uses whatever candidates it already has, or shows a clear "rate
  limited, try again" message on "Find my route") rather than crashing —
  but it still means fewer or no options that round. If you hit this
  often, reduce `seeds`/`anchorCount` in `generateRouteOptions`.
- **Routes can go through places that aren't reliably open to the
  public** (a university campus, a gated park, etc.) — ORS's
  `foot-walking` profile routes over OpenStreetMap paths, and OSM doesn't
  consistently encode "this path is only open certain hours" or
  private-access restrictions. There's no ORS parameter that guarantees a
  route only uses always-public paths, so this isn't fixable from the
  app's side without maintaining a manual list of known-problematic
  areas (not implemented). Treat generated routes the same way you'd
  treat any turn-by-turn app in an unfamiliar area — verify locally
  before relying on it.
- **Pace is a fixed default per activity (9.5 km/h run, 4.7 km/h walk)**,
  not personalized — there's no in-app run history or health-app
  integration feeding it yet, so duration/distance conversions won't
  reflect your actual pace.
- **Reverse geocoding uses the public Nominatim API**, which has a strict
  rate limit (~1 request/second) — fine for this app's one-lookup-per-
  open pattern, but don't call it more often.
- **Live progress tracking is only as good as GPS accuracy** — indoor or
  urban-canyon GPS drift can make the progress bar jump.
- **The disclaimer gate is a one-time acknowledgement**, not reviewed
  legal terms of service — treat it as a starting point, not a substitute
  for a real ToS/privacy review before shipping to real users.
