# Seega Royale V7 — smoother 3D performance

Website: https://seega-royale-eg.vercel.app

## Optimizations over V6
- Original wood, metallic trim, perspective and glossy 3D stones are retained. No forced 2D mode.
- Static table meshes cached per game type and board size. Table geometry is no longer recreated/uploaded on each input or animation frame.
- GPU context, shaders and the wooden texture survive ordinary turn-by-turn screen rerenders.
- Detailed stone templates (ringed, bevelled 3D shapes) calculated once per size / color / king type; pieces are translated cheaply instead of lathed afresh.
- A `piecesKey` avoids rebuilding or re-uploading stones when only the highlighted/selected cell changes. Hints live in a separate small overlay buffer.
- During a capture animation, only the moving/captured piece buffer changes; the board and stationary stones stay in GPU memory.
- Reduced 9x9 geometry from 22 lathe segments to 12 (7x7=16, 5x5=22), without losing material/shape layering, keeping WebGL1 indices within 16-bit bounds.
- WebGL render pixel density adapts to CPU/memory capability and board size (9x9: cap 1.0x on lower-end phones, 1.12x on higher-end phones vs V6's fixed 1.7x). Thus the 9x9 frame has ~2.9x fewer shaded pixels on low-end devices.
- Frame pacing applies to active animation only, 30 FPS on lower-end 9x9 and up to 45 FPS on capable devices, while the idle board doesn't redraw continuously.
- Expensive fragment-shader noise is replaced by sampling the same original wood-grain texture with a much cheaper fallback.
- Placement turns don't waste 690ms of repeated drawing when no stone actually moves.
- `reset3D()` cleans up event listeners and animation frames when leaving a room.
- Cache version v7 for scene3d.js, app.js, CSS, wood texture and offline adapter; localStorage player data is untouched.

## Test
`node --test tests.mjs tests-v4.mjs tests-online.mjs tests-v5.mjs tests-v6.mjs tests-v7.mjs`

38 tests pass, including a deterministic WebGL1 mock with a nearly full 9x9 board, all game modes and two-player P2P message logic. This validates JavaScript correctness and avoids the previous 16-bit-vertex overflow. **It does not establish measured FPS on a real Android GPU.** Chromium in this environment prevents local web access (`ERR_BLOCKED_BY_ADMINISTRATOR`), so the user still needs to confirm the on-device experience.

## Existing product limitations
- Google/Facebook require Firebase configuration, not activated here.
- Email, currencies and friend IDs remain local to the device.
- PeerJS-based online rooms are experimental and may not connect on restrictive networks.
- Browser audio needs a user gesture.