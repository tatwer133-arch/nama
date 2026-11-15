# السيجا المصرية — نسخة v5

- Free GitHub Pages PWA at https://tatwer133-arch.github.io/nama/seega/
- Private-by-invite six-letter room codes (not cryptographically private).
- Direct peer-to-peer WebRTC dependency removed.
- Remote gameplay transports messages over 2 public anonymous MQTT WebSocket test brokers, EMQX and Eclipse Mosquitto, concurrently. Duplicate commands have idempotent request IDs.
- Automatic reconnection, move retry with acknowledgments and guest presence heartbeats.
- Room owner is the source of truth and must keep their game tab open. Public test brokers are **not** guaranteed up and are not production infrastructure, and transmissions on them are readable by other broker subscribers. Do not share sensitive information. For guaranteed online service use a dedicated backend.
- Browser-local computer opponent has easy, medium, and hard levels, and works without the online relay after the PWA is cached.

Tested locally with a mocked two-broker MQTT simulation (join, synchronized turns, duplicate protection, illegal move rejection, bot). Bot legality was simulated over 60 games (5x5 / 7x7, single/double placement, all 3 difficulties).
