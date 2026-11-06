# XLSX export conventions

Employee, Leave, Stock and Routine generate buffered ExcelJS workbooks through their existing export endpoints. Queries, authorization, audit events, limits and business transformations remain module-owned.

## Server workbook presentation

`lib/server/xlsx-style.ts` owns worksheet presentation only. Call `styleWorksheet` after setting columns and adding rows. It applies Arial 11, a dark header with white bold text, a 30-point header height, thin borders, vertical alignment, wrapping, native AutoFilter across all header columns and a frozen first row. Column widths remain with each builder. Options allow disabling AutoFilter or wrapping and choosing frozen columns.

| Worksheet | Frozen columns |
| --- | ---: |
| Employee directory | 0 |
| Leave summary / detail | 3 / 5 |
| Stock request summary / detail | 4 / 4 |
| Stock balance | 3 |
| Routine tasks | 2 |

Keep date/number formats, totals and row transformations in each module. Employee Buddhist Era hire dates and phones stay text; Leave dates and Stock Bangkok DateTime cells stay native dates; quantities and fractional leave days stay numbers. Free text is assigned as plain strings, never formula or hyperlink objects. Workbook tests serialize and reload XLSX to verify values and cell types.

## Browser download lifecycle

`lib/client/xlsx-download.ts` provides `downloadXlsx(url, fallbackFilename?)`. Like the existing shared API client, it uses the Auth public browser entrypoint for refresh-aware requests. It sends authenticated GET requests without caching, checks status and XLSX MIME, receives the entire Blob, validates the RFC 5987 UTF-8 filename, and starts the browser download with `triggerDownload`.

Missing, malformed, unsafe or unexpected-extension filenames use a validated `.xlsx` fallback. JSON application errors propagate as bounded text; malformed responses and transport errors use a safe Thai message. UI notifications stay in each module.

Concurrent calls for the same URL share one pending promise. Module locks also cover metadata preflight and prevent repeated clicks. Stock request and balance controls remain independent. Loading ends when the browser download starts; it cannot confirm that a user saved the file to disk. Object URLs are released immediately on initiation failure or after a short grace period on success, independent of loading state.

Each download has a two-minute deadline covering the HTTP request, auth-refresh wait and response body (including JSON errors). On timeout the downloader aborts its request and rejects with a Thai retry message, releasing the shared lock and caller loading state. A promise deadline also handles transport waits that ignore cancellation. Late responses cannot initiate a download or remove a replacement request's lock. The existing shared auth-refresh operation is not cancelled or changed by this downloader.

Existing limits: Employee 2,000 employees, Leave 3,000 requests, Stock 5,000 rows and Routine 2,000 tasks. CSV import is unchanged. The yearly export panel is used exclusively by XLSX controls and defaults to the Excel label while preserving explicit caller labels.
