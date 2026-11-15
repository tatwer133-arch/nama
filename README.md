# السيجا الفلاحي المصرية — Seega

A mobile-first Arabic RTL, installable Progressive Web App featuring long-polling live private-room multiplayer for Egyptian Seega (5×5, 12 stones each; or 7×7, 24 stones each). Includes placement options of one or two stones per turn to accommodate local variants.

## Local development

```bash
npm test
npm start
```

Visit http://localhost:3000. Open it from two browsers or phones, create a room and share its URL. Only two players may join. Reconnecting from the same browser keeps each seat through a locally saved player token.

## Deploy on Render

Create a **Web Service** (not Static Site): Node runtime, `echo ready` build command, `npm start` start command, instance plan Free if desired, health check `/healthz`. The server binds to Render's `PORT` environment variable. Use a single instance because active matches are stored in that instance's memory.

**Limitations:** Rooms are stored in memory and are lost on service restart or sleep. The game requires an internet connection for multiplayer. 100 non-capture moves end a deadlocked match according to the remaining-stone count; this is an explicit house rule, not a universal rule. No personal data or account is required beyond optional display names.

## Rules

Each side places either one or two stones per turn, leaving the middle cell empty. Once all stones have been placed, the player who placed second makes the first movement. Move one square horizontally or vertically to an empty square. Trap an opposing stone between your moved stone and another friendly stone to capture it; the center cell cannot be captured. You may continue a capture chain with the same moved stone, or end your turn. A blocked player is skipped until a move becomes possible. Capture all enemy stones to win.

The Egyptian folklore archive documents local variations, including single-stone placement, and other sources document double-stone placement.

The backend uses Node built-in HTTP long polling; no npm packages need to be installed.
