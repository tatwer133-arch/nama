# Seega Royale — existing repository, isolated matchflow STAGING

Last edited: 2026-11-19. **NOT DEPLOYED. NEVER DEPLOY TO PRODUCTION WITHOUT THE GATES BELOW.**

This branch is `seega-royale-matchflow-staging-20261119` in `tatwer133-arch/nama`, not a new game and not the public production release. GitHub's checked-out source predates some manually deployed files on Vercel. **Do not replace the live production bundle from this branch.**

## Implemented in this branch (code, NOT live claims)

- Authoritative Seega state machine; all seven existing game engines reused.
- Firebase Admin / Firestore transaction adapter (`server/firestore-backend.mjs`).
- Atomic quick matching and private rooms with one active match per account and queue lease (`server/queue-service.mjs`).
- Verified Firebase callable entry points for open/resume/commands, wallet read, room chat, voice signals (`server/functions-entry.mjs`).
- Unique escrow and settlement ledger keys, 5% default commission and balanced draws. Zero-stake games do **not** need a migrated wallet. Paid matches fail closed until an audited server-side wallet exists.
- Server turn scheduling via Cloud Tasks and scheduled sweeper; server-only auto actions.
- Invitation expiry, refusal, host kick, first accepted invite wins, player Ready.
- Firestore client read rules limited to authorized room members; client changes to balance, ledger, match and queue are denied.
- New `public/live-match.js` client + a staged live room path in `public/app.js`, reusing the existing UI/board without disabling bot/local/P2P.
- Consent-based `public/live-voice.js` WebRTC audio handshake using authenticated room signaling, **STUN-only**; TURN must be configured for dependable connectivity across networks.
- GitHub Actions isolated unit, Firestore Rules emulator, and mobile Chromium QA in `.github/workflows/seega-matchflow-staging.yml`. See each run's exact SHA and job conclusions; never extrapolate an older successful run to later commits.

## NOT complete or verified on live infrastructure

1. Cloud Functions, task queues and updated rules are **not deployed** to `seega-royal` or a separate staging Firebase project. Cloud Tasks and Cloud Scheduler require appropriate project billing/IAM.
2. No audited migration of existing **device-local** virtual balances into `gameWallets`. The browser must not decide opening balances; this must be reconciled server-side and recorded idempotently. No live users' wallets were changed.
3. Match voice has no production TURN service or cross-network QA. STUN-only is experimental; signaling code alone is not end-to-end media verification.
4. Reconnection can restore a match after refresh, but reliable disconnect/presence-forfeit policy needs server-managed heartbeat or RTDB presence, plus extensive offline tests.
5. Production/manual deployment files must be reconciled with GitHub before changing shared menus. Do not remove standalone voice rooms until their in-match alternatives pass cross-device tests.
6. Final home/navigation five-tab redesign is deferred pending production-source reconciliation and visual/mobile QA. The existing visual theme was retained on staging.
7. Two independently authenticated real Firebase users, two mobile devices, microphone permissions, TURN, wager/draw/forfeit and all seven modes have NOT been verified against a deployed backend.

## Safe test/deploy sequence

1. First, compare current **public Vercel assets** with the GitHub branch. Protect production by never force-overwriting those manually deployed files.
2. Use a **separate staging Firebase project**, with staging Authentication providers, Firestore and Functions, including verified authorization domain and appropriate IAM. Never assume the production `.firebaserc` default is safe for a staging deploy.
3. Install dependencies from the source; run `npm run test:match-protocol` and `npm run test:rules`; run `npm run test:browser` to check 320/390/1280 px. These tests are not a substitute for real cloud QA.
4. Deploy only the separate staging project's cloud functions and rules. Connect a staging web preview to those functions; keep all production DNS/Vercel targets unchanged.
5. Try zero-stake quick with two distinct Firebase identities. Test same-stake matching, different-stake separation, duplicate join, Ready, invite/decline/accept, kick, move validation, timer, automatic actions, text chat and refresh/resume.
6. Audit and execute a **server-authorized** wallet migration only after reconstructing trusted balances; test insufficient funds, transaction race conditions, double settlement, draw rounding, forfeit and fee conservation. Do not trust coins sent from browsers.
7. Add authenticated ephemeral TURN credentials and validate microphone consent/mute/hangup on two independently networked devices; test poor network and disconnects.
8. Once alternatives demonstrably work, unify the five-tab home design, remove redundant public voice rooms and other controls, then finish visual regression against the production reference.
9. Require green staging CI, real two-account / two-device QA, data-preservation check, and explicit production release decision before merging/deploying.

### Important file references

- `server/match-protocol.mjs` — authorized match transitions.
- `server/ledger-service.mjs` — escrow/commission/settlement.
- `server/queue-service.mjs` — server quick/private room claims.
- `server/firestore-backend.mjs` — Admin Firestore transaction adapter.
- `server/functions-entry.mjs` — callable/clock/chat/voice server.
- `public/live-match.js`, `public/live-voice.js`, `public/app.js` — staging UI path.
- `firestore.rules`, `qa/firestore-rules.mjs` — permission checks.
- `tests/*`, `.github/workflows/seega-matchflow-staging.yml` — unit/emulator/browser QA.

**Do not confuse a GitHub Actions success against emulator data with a running production backend.**
