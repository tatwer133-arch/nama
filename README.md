# سيجا رويال V5 — ثلاثي الأبعاد والتحكم في الصوت وتسجيل الدخول

Public website: https://seega-royale-eg.vercel.app

## V5 changes

- New original procedural WebGL 3D board (`public/scene3d.js`), walnut tabletop and brass trim, geometry-based checkers/seega stones, hit detection and animations. No imported proprietary Checkers graphics. The game uses the 3D perspective only; if WebGL isn't supported, CSS 3D fallback is used (no 2D toggle).
- Board colors do not change on placement/movement. Legal move hints use an independent marker or outline and do not repaint the wood tiles.
- Each opponent must use a distinct stone color, including on a shared device or P2P rooms; the opposing color is disabled visually and rejected by the rules adapter.
- Original synthesized music and event audio using Web Audio (`public/soundscape.js`), with higher volume, audio resume on first interaction, and a **Test audio** button. Mobile autoplay rules mean sound cannot play *before* the user's first gesture. Music and effects can be muted separately.
- Restored Guest and Email registration/login screens. Email accounts on this **device only** have randomly salted PBKDF2-SHA256 password hashes, and support switching local accounts. This is **not** internet-wide secure authentication or cloud profile synchronization.
- Real Firebase Auth integration hooks for Google and Facebook, via `public/firebase-auth.js`. **Not enabled until the project owner configures their own Firebase Authentication project, authorized domain, Google and Facebook providers, and app config**. No pretend OAuth flow.
- Existing guest player data/coin balances kept through the original `seega_royale_demo_v2` localStorage key.

## Enable Google and Facebook sign-in

1. Create or connect a Firebase project and enable Firebase Authentication in it.
2. Enable Google. To enable Facebook, create a Facebook developer application and register the OAuth redirect URL exposed by Firebase for your project. Follow official Firebase setup instructions, including authorized domains.
3. In `public/firebase-config.js`, replace `firebaseConfig = null` with the public Firebase Web SDK configuration for that app. These are public identifiers, **never place private credentials or admin API keys in this file**.
4. Redeploy, and verify on two physical devices. Firebase login authenticates identity, but the game currency, game profile and league points remain **local to the device** until a verified shared backend is connected.

## Test and deploy

```
node --test tests.mjs tests-v4.mjs tests-online.mjs tests-v5.mjs
```

This is a static Vercel site. The P2P gameplay is experimental and should not be treated as resilient production matchmaking. Audio needs a browser interaction. The WebGL rendering could not be visually verified on headless Chromium in this sandbox (WebGL disabled); manual verification on Android WebGL2-capable browser is recommended.