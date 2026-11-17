# Seega Royale V6 — Immersive Wooden Tabletop Update

Public website (deployment target): https://seega-royale-eg.vercel.app

## What changed from V5

The V5 view suffered from a small 3D board in a large black canvas, plus an oversized opponent card. V6 fixes the underlying proportions and introduces a more faithful premium wooden tabletop presentation **without copying another game's artwork**.

- **Large tabletop**: The camera is moved close and raised; the board frame spans approximately 90–95% of the canvas width at the mobile 1.26:1 aspect ratio. The visible game canvas uses nearly the whole available mobile width and is no longer constrained by the V5 `510px` maximum.
- **Real 3D geometry**: Multi-layer bevel-cut stone geometry, inlaid concentric rings, metal rails and screw heads, patterned wood and darker contrasting board cells. Procedural walnut grain `public/wood-grain.jpg` is original and shipped locally, with a shader fallback if it cannot load.
- **Clean placement phase**: 5×5, 7×7 and 9×9 boards no longer show bright mint dots across *every* vacant square. Highlights for valid moves after selection remain.
- **Compact duel HUD**: The opponent is above, you are below, both in single-line compact strips. The board is the visual focus. Tap the opponent avatar for animated gifts; use the floating chat button. Existing purchases, IDs and game systems are retained.
- **Improved stability**: Reuse a single WebGL context across sequential game turns instead of repeatedly invoking `WEBGL_lose_context`; better for mobile GPU stability. Gracefully fall back to an angled CSS board if WebGL is unavailable.
- **Asset cache bump** to V6. No localStorage schema migration; existing player progress remains on the device.

## Verification

`node --test tests.mjs tests-v4.mjs tests-online.mjs tests-v5.mjs tests-v6.mjs`

31 tests pass. The V5 mock WebGL renderer test also runs for 5×5, 7×7 and 9×9 (WebGL geometry sanity check). A real WebGL screenshot is unavailable under the current headless Chromium policy, so **physical device testing is still necessary** to verify full 3D visual quality.

## Scope and known limits

- Google and Facebook buttons require the project owner's Firebase and provider setup; the configuration is intentionally not fabricated.
- Email accounts and currencies remain **local**; they are not shared across devices.
- Realtime multiplayer in this static hosting version is P2P-based and experimental; it needs two live browsers and is not equivalent to a reliable server-side matchmaking service.
- WebAudio music requires a tap from the user before playing on many mobile browsers.