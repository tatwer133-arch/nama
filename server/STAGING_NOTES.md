# Seega Royale — Gameflow development branch (NOT deployed)

This branch is **inside the existing** `tatwer133-arch/nama` repository and is deliberately not connected to the public Vercel production deployment.

## Verified code

- `server/match-protocol.mjs`: quick queue matching policy, private invitations (first accepted invite claims seat), two-player Ready, host kick before start, free pre-start exit, disconnect grace, moves, timeouts, escrow and settlement intentions.
- `server/ledger-service.mjs`: authenticated transaction boundary, all-or-nothing debit of both wallets, unique escrow/settlement references, payout and house commission accounting.
- `server/game-rules-adapter.mjs`: reuses original Egyptian, American, Russian, 3×3 and Chinese engines without rewriting their rules.
- `tests/*.test.mjs`: 29 tests. Command: `npm run test:match-protocol`.

### Example

Two players stake 50.00 non-redeemable game coins each (minor units: 5,000 + 5,000). At 5% commission (500 basis points), the winner's credit is 95.00 and the house fee is 5.00. A draw returns 47.50 to each, with a 5.00 total fee.

## Hard blockers before enabling these features in the actual game

1. Implement a real, persistent, serializable datastore transaction adapter with a unique constraint on ledger keys. **Never use localStorage, client-side Firebase updates, or in-process memory as the source of truth for balances.**
2. Verify Firebase ID tokens on the trusted server and authorize match commands, friend relationships, one account per seat, and the authenticated actor identity.
3. Migrate existing integer coin balances safely to hundredth-coin minor units, or adopt an alternative explicitly approved rounding policy. Do not silently mutate existing wallets.
4. Implement a persistent, atomically claimed quick-match queue with presence, expiration, cancellation and matchmaking by identical mode and stake.
5. Add real-time subscriptions, reconnection/resume with authoritative room version, deduplicated commands, room readiness, kick, friend invites, voice (WebRTC + reliable signaling/TURN), and compact in-game chat.
6. Wire the production UI to the new API only after verifying it retains the current styling and existing player data. The GitHub source branch predates some manually deployed Vercel files; **do not overwrite production from this branch.**
7. Test 390×844 and other mobile viewport sizes, two independent real accounts on separate devices, microphone permissions, network disconnects, wager refunds, draw commission and all variants.
8. Remove stand-alone public voice rooms and other UI controls **only after** all required in-game alternatives work.

## Production safety

Do not deploy this branch as production. Vercel production was not changed by this staging work. Backend tests use mock transactional storage and do **not** establish availability or security of any live Firebase/Render server.

## Intended order of integration

Homepage/navigation → game/mode selection → stake list → quick queue → invitations/Ready/kick → durable escrow/settlement → game voice/chat → server timer → remove redundant menus → full mobile/two-account QA → release.
