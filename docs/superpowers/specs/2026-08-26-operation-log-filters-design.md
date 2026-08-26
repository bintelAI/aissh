# Operation Log Filters Design

## Goal

Extend the operation log view with command search, a single alert filter, and
client-side pagination of 100 records per page.

## Behavior

- Command search matches `command` log content case-insensitively. An empty
  query leaves command logs unfiltered.
- The alert filter is one select control with "all logs" and "alert" options.
  The alert option retains `error`, `warning`, and `info` logs.
- Existing IP and date range filters continue to apply together with the new
  filters.
- Results remain sorted newest first. The visible page contains at most 100
  entries. Changing any filter returns to page 1.
- Pagination changes only the displayed slice; the existing 5,000-record
  history load remains unchanged.

## Design

`logHistory.ts` owns pure filtering and pagination helpers so their behavior is
covered without rendering React. `OperationLogView.tsx` owns form state and
renders the compact controls and navigation buttons. Live logs flow through the
existing store and are included by the same derived data path.

## Error Handling

No backend request is added. When no records match, the existing empty state is
shown. Pagination controls are disabled at the first or last page.
