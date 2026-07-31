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
