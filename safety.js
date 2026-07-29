# Safe Loop Run (v1 prototype)

A mobile app that generates a walking or running loop back to your starting
point, sized to a chosen distance or duration, routed away from recently
reported crime hotspots near you.

This is a working v1 skeleton, not a finished product. It proves the core
mechanic end to end: get location, pull crime data, compute hotspots,
generate a loop route that avoids them, display it. Read the "known
limitations" section before you show this to anyone else.

## What this uses

- **Expo / React Native** — so you can run it on your own phone via the
  Expo Go app without setting up native build tooling first.
- **data.police.uk** — free, official crime data for England, Wales, and
  Northern Ireland. This is why London works well and other cities won't,
  for now.
- **OpenRouteService** — free routing API. It has a built-in "round trip"
  mode (loop routes by target length) and an "avoid polygons" option,
  which is what the crime hotspots get converted into.

## Setup

1. Install [Node.js](https://nodejs.org) if you don't have it.
2. Get a free OpenRouteService API key at
   https://openrouteservice.org/dev/#/signup (instant, no payment info).
3. Open `screens/HomeScreen.js` and replace:
   ```
   const ORS_API_KEY = 'YOUR_OPENROUTESERVICE_API_KEY';
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

## How it works, file by file

- `lib/policeData.js` — fetches recent street-level crime reports near a
  point from data.police.uk, walking backward through months since the
  data has a natural reporting lag.
- `lib/safety.js` — buckets those crime reports into a coarse grid,
  weights them by severity, and turns the highest-risk cells into
  polygons.
- `lib/routing.js` — calls OpenRouteService, asking for a round-trip loop
  of your target length that avoids those polygons.
- `screens/HomeScreen.js` — lets you choose distance or duration, gets
  your location, runs the pipeline above.
- `screens/RouteScreen.js` — shows the resulting route on a map.

## Known limitations, read this before showing anyone

- **Only works well in England, Wales, and Northern Ireland.** Outside
  that, the crime API returns nothing, and the app silently falls back to
  a route with no safety weighting. It won't work for Milan yet.
- **No time-of-day adjustment yet.** The hotspot model treats a Tuesday
  afternoon and a Saturday 1am the same way. This was the main gap we
  identified earlier and it still needs a real design, likely a second
  weighting layer once you have a data source for foot traffic or
  time-tagged incidents.
- **The severity weights in `CRIME_WEIGHTS`** are a first guess, not
  validated against anything. Worth revisiting once you have real usage
  or expert input.
- **The grid-based hotspot model is intentionally simple.** It will
  create some odd-shaped avoid zones at cell boundaries. Fine for
  proving the concept, worth revisiting for production.
- **No disclaimer flow or terms of service yet**, beyond the text shown
  on the home screen. Don't treat that placeholder text as sufficient,
  it was written for the prototype, not reviewed by anyone.

## Reasonable next steps, roughly in order

1. Test it on real London routes you know well, see if the avoided areas
   make sense.
2. Tune the `threshold` value in `buildAvoidPolygons` (currently 8),
   it directly controls how aggressive the avoidance is.
3. Add a settings screen so the API key isn't hardcoded.
4. Design the time-of-day layer.
5. Get the disclaimer and terms of service properly reviewed before any
   real users touch it.
