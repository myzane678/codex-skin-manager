# Runtime Injection Stability Design

## Goal

Keep an enabled theme applied through Codex slow startup, page reloads, early-script registration failures, and replacement CDP page targets without adding a second injector architecture.

## Design

- The existing `ThemeRuntimeCoordinator` remains the only owner of the CDP page session and injection lifecycle.
- Failure to register an early script is non-fatal. The coordinator still applies the live plan and registers a load-event fallback that reapplies it after the next page load.
- Each coordinator refresh verifies the active run through a lightweight injector audit. A missing renderer runtime or matching style node is treated as a target-local loss and is reapplied on the existing session.
- When a session or target disconnects, the coordinator keeps its configured port, browser identity, theme, and heartbeat. The next refresh selects a verified replacement page target under the same browser identity and applies the existing theme there.
- Compatibility and adapter checks remain fail-closed. Unknown Codex versions and adapter mismatches are not retried as compatible pages.

## Error Handling

- A failed early-script registration uses the load fallback; it does not report a terminal runtime failure.
- A transient CDP list, probe, or audit failure leaves the watcher active for the next heartbeat.
- Browser identity changes, an unsupported adapter, or a verified incompatible page retain their existing safety behavior.

## Testing

- Prove an early-script failure still reaches live apply and installs the load fallback.
- Prove a missing run audit reapplies the existing plan.
- Prove a disconnected target is replaced using the same configured port and browser identity.
- Keep existing route-switch, rollback, and adapter-mismatch tests green.
