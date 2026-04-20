# Oscar Movies

Oscar Movies is an Expo-based mobile application for exploring Oscar-nominated films and the people connected to them. It combines a bundled SQLite database with rich artwork and a focused browsing experience, making it easy to review winners, nominations, and award history across years.

## Overview

Oscar Movies is designed as a lightweight, offline-friendly reference app for Academy Awards exploration. Users can browse nominees by ceremony year or genre, explore year and genre posterwalls for visual discovery, search across films and people with an elegant collapsing header interface, and open detailed profile screens with easy navigation controls. All core app functionality works offline with a locally bundled SQLite database, with TMDB artwork used to enrich film and person detail views.

## Core Features

- Browse Oscar nomination categories by year with visual year posterwall
- Explore films by genre with visual genre browsing
- Search films by title and people by name with collapsing header effect
- Open detailed film pages with artwork, credits, nomination summaries, and Oscar trophy badges
- Open person pages with biography details, related films, and nomination totals
- Review nomination history for both films and people
- Improved navigation with close buttons on all detail views for seamless multi-view exploration
- Use a bundled local SQLite database for a fast, offline-friendly experience

## Technology Stack

- Expo SDK 55
- React Native 0.83
- React 19
- TypeScript
- Expo Router for file-based navigation
- Expo SQLite for the bundled local database
- Expo Image and TMDB artwork for rich visuals

## Screenshots

<p>
  <img src="assets/images/app/Oscars%20Landing.jpeg" width="24%" alt="Oscars Landing — nomination categories by year" />
  <img src="assets/images/app/Search%20Landing.jpeg" width="24%" alt="Search Landing — film and people search modes" />
  <img src="assets/images/app/Movie%20Search.jpeg" width="24%" alt="Movie Search — search results with artwork and stats" />
  <img src="assets/images/app/Film%20Detail.jpeg" width="24%" alt="Film Detail — poster, credits, and nomination info" />
  <img src="assets/images/app/Person%20Detail.jpeg" width="24%" alt="Person Detail — biography, films, and awards summary" />
  <img src="assets/images/app/Film%20Detail%202.jpeg" width="24%" alt="Ballerina Detail — biography, films, and awards summary" />
  <img src="assets/images/app/Person%20Search.jpeg" width="24%" alt="Person Search — biography, films, and awards summary" />
  <img src="assets/images/app/Poster Wall.jpeg" width="24%" alt="Movies by Genre - poster wall of films" />
</p>

## Getting Started

### Prerequisites

- Node.js and npm
- Xcode for iOS development on macOS
- Android Studio for Android development

### Install Dependencies

```bash
npm install
```

### Start the Development Server

```bash
npx expo start
```

### Run on Specific Platforms

```bash
npm run ios
npm run android
npm run web
```

### Lint the Project

```bash
npm run lint
```

## Available Scripts

- `npm run start` starts the Expo development server
- `npm run ios` runs the app on iOS
- `npm run android` runs the app on Android
- `npm run web` runs the app on the web
- `npm run lint` runs the Expo lint configuration
- `npm run test` runs the Jest test suite
- `npm run seed` seeds the local Oscar movie database
- `npm run enrich` runs the main data enrichment workflow
- `npm run enrich-people` enriches person records
- `npm run enrich-person-by-id` enriches a single person record
- `npm run enrich-cast-people` enriches cast-related people data
- `npm run import-popular-movies` imports additional movie popularity data
- `npm run import-popular-people` imports additional people popularity data
- `npm run import-movie-cast` imports movie cast relationships
- `npm run prune-people` deletes low-value people rows not linked in `nomination_people` and vacuums the database
- `npm run dedup-people` runs a dry-run person deduplication pass (no writes)
- `npm run dedup-people:apply` applies dedupe merges and rewires person references

## People Dedup Workflow

The dataset can contain duplicate person rows when Oscar nominee names differ from TMDB names (for example, a nominee row with no `tmdb_id` and a TMDB-enriched row for the same person). Use the dedupe script to merge those records safely.

Default behavior is dry-run.

```bash
npm run dedup-people
```

Apply mode rewires references from source people rows (`tmdb_id IS NULL`) to target rows (`tmdb_id IS NOT NULL`) and then deletes merged source rows.

```bash
npm run dedup-people:apply
```

### Script Options

```bash
node ./assets/data/dedup-people.js [options]

--apply                      Apply database changes. Omit for dry-run.
--db <path>                  Override database path.
--alias-file <path>          Alias map JSON file (sourceName -> targetName).
--limit <n>                  Limit number of source people considered.
--person-id <id>             Process one source person id.
--report-dir <path>          Report output directory.
--allow-awarded-targets      Allow targets with existing wins/nominations.
```

### Matching and Safety Rules

- Only alias map entries are used for matching, via `assets/data/people-aliases.json`.
- No automatic exact-name or fuzzy-name merges are performed.
- If multiple targets qualify, the source row is skipped and reported as ambiguous.
- Dry-run is the default mode and performs no writes.
- In apply mode, all updates run in a transaction, references are rewired to the target `person_id`, source wins/nominations are added to the target row, and the source row is deleted only after successful rewiring.

### Recommended Order

1. Run import/enrichment scripts first.
2. Run `npm run dedup-people` and review the report in `assets/data/reports`.
3. Back up the DB file.
4. Run `npm run dedup-people:apply`.
5. Re-run `npm run dedup-people` to confirm there are no remaining merge candidates for the processed set.

## Data and Content Notes

Oscar Movies uses a bundled local SQLite database to power browsing and search. This keeps the app responsive and usable without depending on a live backend for its primary experience.

Film and person artwork are sourced from TMDB image paths where available. Repository scripts in `assets/data` are used to seed and enrich the Oscar-related dataset used by the app.

## Future Improvements

- Expanded filtering and sorting options
- More detailed ceremony and category context
- Additional test coverage for data-loading and navigation flows
- Further enrichment of people, cast, and nomination relationships
