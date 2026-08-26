# Connection Session Audit Design

## Goal

Make the log landing view an SSH connection-session history. Each successful,
failed, manually closed, or unexpectedly closed connection is a distinct
auditable record. Selecting a record shows only logs from that session.

## Data Model

`connection_sessions` stores an immutable device snapshot (`deviceName`, IP,
username), lifecycle timestamps, state, and end reason. A UUID `sessionId` is
created for every connection attempt. `operation_logs.session_id` is nullable:
new logs carry the UUID, while historical logs remain ungrouped.

`connectedAt` records successful terminal readiness. `startedAt` records when
the connection attempt began. The detail interval is from `startedAt` to
`endedAt`; while active, the upper bound is now.

## Lifecycle

The renderer generates a UUID and sends it with `ssh-connect`. The backend
creates the session before connecting, marks it connected when the terminal is
ready, and closes it on manual disconnect, client disconnect, failure, or an
unexpected SSH close. SSH status, data, and error events include the UUID so
the renderer attaches it to persisted logs without matching text or times.

## UI

The log view begins with a 100-row paged session list showing device, IP,
username, start/end times, duration, state, and a detail command. The detail
view fetches logs by `sessionId`, displays the fixed audit interval, and retains
the command and alert filters. It has no control to broaden beyond that
session.

## Compatibility

The database migration is additive. Historical logs have null `sessionId` and
are not shown as fabricated sessions. The existing 5,000-row operation-log
limit remains the maximum detail query size.
