# Stage 1: Inspect the raw data before we write any processing code.
# Nothing here is saved except a small text summary. The point is to learn
# the real file paths, column names, types and ranges, so later stages do
# not rely on guesses.

options(width = 200, datatable.print.nrows = 20, datatable.print.class = TRUE)
set.seed(20564)

# Install any package that the Kaggle R image does not already have.
need <- c("data.table", "duckdb", "jsonlite", "httr2", "arrow")
for (p in need) {
  if (!requireNamespace(p, quietly = TRUE)) {
    install.packages(p, repos = "https://cloud.r-project.org", quiet = TRUE)
  }
}
library(data.table)
library(jsonlite)

cat("R version:", R.version.string, "\n")
for (p in need) cat(sprintf("  %-10s %s\n", p, as.character(packageVersion(p))))

# ---------------------------------------------------------------------------
# 1. Where did Kaggle mount the trending dataset?
# ---------------------------------------------------------------------------
cat("\n== Files under /kaggle/input ==\n")
all_files <- list.files("/kaggle/input", recursive = TRUE, full.names = TRUE)
finfo <- data.table(path = all_files, mb = round(file.size(all_files) / 1e6, 1))
print(finfo, nrows = 200)

us_csv  <- grep("US_youtube_trending_data\\.csv$", all_files, value = TRUE)[1]
us_json <- grep("US_category_id\\.json$", all_files, value = TRUE)[1]
cat("\nUS csv :", us_csv, "\nUS json:", us_json, "\n")
stopifnot(!is.na(us_csv), !is.na(us_json))

# ---------------------------------------------------------------------------
# 2. US trending file: columns, types, counts, ranges, examples
# ---------------------------------------------------------------------------
cat("\n== First 3 raw lines of the US csv ==\n")
cat(substr(readLines(us_csv, n = 3, encoding = "UTF-8"), 1, 400), sep = "\n")

us <- fread(us_csv, encoding = "UTF-8")
cat("\n== US trending: dimensions ==\n")
cat("rows:", nrow(us), " cols:", ncol(us), "\n")
cat("\n== Column names and classes ==\n")
print(data.table(column = names(us), class = sapply(us, function(x) class(x)[1]),
                 n_na = sapply(us, function(x) sum(is.na(x))),
                 n_empty = sapply(us, function(x) if (is.character(x)) sum(x == "", na.rm = TRUE) else NA_integer_)))

cat("\n== Example rows (long text truncated) ==\n")
ex <- copy(us[sample(.N, 5)])
for (col in names(ex)) if (is.character(ex[[col]])) set(ex, j = col, value = substr(ex[[col]], 1, 80))
print(ex)

# Summaries of every column, so we see ranges and odd values
cat("\n== Column summaries ==\n")
for (col in names(us)) {
  x <- us[[col]]
  cat("\n--", col, "--\n")
  if (is.numeric(x) || inherits(x, c("POSIXct", "IDate", "Date"))) {
    print(summary(x))
  } else {
    cat("unique values:", uniqueN(x), "\n")
    print(head(sort(table(substr(x, 1, 60)), decreasing = TRUE), 5))
  }
}

# Identify the id / date columns by name pattern and report counts
id_col   <- grep("^video_?id$", names(us), ignore.case = TRUE, value = TRUE)[1]
ch_col   <- grep("^channel_?id$", names(us), ignore.case = TRUE, value = TRUE)[1]
tr_col   <- grep("trending", names(us), ignore.case = TRUE, value = TRUE)[1]
pub_col  <- grep("publish", names(us), ignore.case = TRUE, value = TRUE)[1]
cat("\nDetected columns: video =", id_col, " channel =", ch_col,
    " trending date =", tr_col, " published =", pub_col, "\n")

if (!is.na(id_col)) cat("unique videos:", uniqueN(us[[id_col]]), "\n")
if (!is.na(ch_col)) cat("unique channels:", uniqueN(us[[ch_col]]), "\n")
if (!is.na(tr_col)) {
  td <- as.Date(substr(as.character(us[[tr_col]]), 1, 10))
  cat("trending date range:", format(min(td, na.rm = TRUE)), "to", format(max(td, na.rm = TRUE)), "\n")
  cat("distinct trending dates:", uniqueN(td), "  NA dates:", sum(is.na(td)), "\n")
  # Missing calendar days would look like someone left Trending, so list them
  all_days <- seq(min(td, na.rm = TRUE), max(td, na.rm = TRUE), by = "day")
  miss <- setdiff(as.character(all_days), as.character(unique(td)))
  cat("calendar days with NO rows:", length(miss), "\n")
  if (length(miss)) print(head(miss, 100))
  cat("\nrows per trending day (summary):\n"); print(summary(as.integer(table(td))))
  cat("\nrows per year:\n"); print(table(format(td, "%Y")))
}
if (!is.na(id_col) && !is.na(tr_col)) {
  dup <- us[, .N, by = .(v = get(id_col), d = substr(as.character(get(tr_col)), 1, 10))][N > 1]
  cat("\nvideo x trending-day pairs with more than one row:", nrow(dup), "\n")
  if (nrow(dup)) print(head(dup))
}
if (!is.na(pub_col)) {
  cat("\nexample raw published values:\n"); print(head(us[[pub_col]], 5))
}

# ---------------------------------------------------------------------------
# 3. US category JSON
# ---------------------------------------------------------------------------
cat("\n== US category JSON ==\n")
cj <- fromJSON(us_json)
str(cj, max.level = 2)
if (!is.null(cj$items)) {
  cats <- data.table(id = cj$items$id, title = cj$items$snippet$title)
  print(cats)
}

# ---------------------------------------------------------------------------
# 4. SponsorBlock: read a few rows straight from the URL, never save the file
# ---------------------------------------------------------------------------
cat("\n== SponsorBlock URL test ==\n")
sb_url <- "https://sb.ltn.fi/database/sponsorTimes.csv"
hd <- tryCatch(httr2::req_perform(httr2::req_method(httr2::request(sb_url), "HEAD")),
               error = function(e) e)
if (inherits(hd, "error")) cat("HEAD failed:", conditionMessage(hd), "\n") else {
  cat("HTTP status:", httr2::resp_status(hd), "\n")
  cat("content-length (GB):", round(as.numeric(httr2::resp_header(hd, "content-length")) / 1e9, 2), "\n")
  cat("last-modified:", httr2::resp_header(hd, "last-modified"), "\n")
  cat("accept-ranges:", httr2::resp_header(hd, "accept-ranges"), "\n")
}

library(duckdb)
con <- dbConnect(duckdb())
invisible(dbExecute(con, "INSTALL httpfs; LOAD httpfs;"))
t0 <- Sys.time()
sb5 <- tryCatch(
  dbGetQuery(con, sprintf("SELECT * FROM read_csv_auto('%s') LIMIT 5", sb_url)),
  error = function(e) { cat("DuckDB LIMIT 5 failed:", conditionMessage(e), "\n"); NULL })
cat("LIMIT 5 took", round(as.numeric(difftime(Sys.time(), t0, units = "secs")), 1), "s\n")
if (!is.null(sb5)) {
  print(sb5)
  cat("\nSponsorBlock column types as DuckDB sniffed them:\n")
  print(dbGetQuery(con, sprintf("DESCRIBE SELECT * FROM read_csv_auto('%s') LIMIT 5", sb_url)))
}
dbDisconnect(con, shutdown = TRUE)

cat("\nDisk free in /kaggle/working:\n"); print(system("df -h /kaggle/working", intern = TRUE))
cat("\nStage 1 done.\n")
