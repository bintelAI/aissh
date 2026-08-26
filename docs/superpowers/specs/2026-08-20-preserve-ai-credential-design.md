# Preserve AI Credential Design

## Problem

Configuration snapshots replace ordinary local state, but the replacement currently deletes every `app_preferences` row. The AI API credential is stored separately as `aiApiKey`, so a later configuration save removes it.

## Decision

`ConfigurationService.replace` will retain the existing `aiApiKey` value across replacement. The credential remains excluded from configuration API responses, exports, and frontend snapshots.

## Scope

- Preserve `aiApiKey` only.
- Add a service-level regression test using the real SQLite-backed services.
- Do not alter the credential API, frontend data model, or export format.

## Verification

The test saves a credential, replaces the configuration, and asserts that `CredentialService.getApiKey()` returns the original value.
