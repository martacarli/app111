# YouTube sponsorships: reach, reception and renewal (US trending creators, 2020 to 2024)

Group project for Big Data for Business Decisions. This folder holds only code,
Kaggle metadata and short logs. All data is downloaded and processed on Kaggle.

Status: in progress. Sections marked TODO get filled in as each stage runs.

## Run order
| Stage | Kaggle kernel | What it does |
|---|---|---|
| 1 | ytsp-01-inspect | Lists files, columns, types, ranges; 5-row SponsorBlock test |
| 2 | ytsp-02-trending | TODO |
| 3 | ytsp-03-sponsorblock | TODO |
| 4 | ytsp-04-brands | TODO |
| 5 | ytsp-05-uploads | TODO |
| 6 | ytsp-06-panel | TODO |
| 7 | ytsp-07-report | TODO |

Run a stage from this folder with `tools/run_stage.sh kernels/<stage-folder>`.
It pushes the kernel, waits, and fetches only the log into `logs/`.

## Sources and licenses
- YouTube Trending Video Dataset, Rishav Sharma, Kaggle
  (rsrishav/youtube-trending-video-dataset). US file and US category JSON. TODO license.
- SponsorBlock database, https://sb.ltn.fi/database/ (mirror of sponsor.ajay.app),
  CC BY-NC-SA 4.0. Attribution: SponsorBlock contributors. Non-commercial use only,
  and derived tables must be shared under the same license.
- YouTube Data API v3 (Google). Subject to the YouTube API Services Terms.

## Packages
R: data.table, duckdb (with httpfs), arrow, httr2, jsonlite, reticulate.

## Not in the submission zip
TODO
