# Decisions log

Every filter, threshold and dropped-rows count, stage by stage.
Counts are copied from the Kaggle logs in `logs/`.

## Environment
- The "local" side of this project runs in a Claude Code cloud container, not on
  a group member's laptop. Nothing is downloaded to anyone's computer. The
  container itself only holds code, metadata and text logs.
- Kaggle credentials are read from environment variables (KAGGLE_USERNAME,
  KAGGLE_API_TOKEN) set in the cloud environment settings, not from a file in the repo.
- The YouTube API key lives only in Kaggle Secrets (label YT_API_KEY).

## Stage 1: Inspect
TODO after first run.
