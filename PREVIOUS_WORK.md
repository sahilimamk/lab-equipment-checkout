# Previous work — DraftShot (Game_multi)

**Link:** https://github.com/sahilimamk/Game_multi

DraftShot is a solo project — I built it alone, no team.

DraftShot is a real-time multiplayer arena game — the project I am
proudest of, and the one I wrote most of. Two players join a shared
arena; the server is authoritative at 60 ticks per second, clients send
only keyboard-state deltas over raw WebSockets, and the server owns
movement, collisions and the shared physics (AABB collision with Ghost
Box projection). First player to 5 points wins. The stack is Node.js /
Express / `ws` for the game server, plus a Java / Spring Boot service
for the lobby, auth and leaderboard.

**Parts I wrote:** the server tick loop and authoritative movement /
collision logic, the WebSocket message handling (keyboard deltas in,
game state out), the lobby flow, and the frontend game client. The
Spring Boot lobby/auth/leaderboard service is a starter implementation:
login currently accepts any username with no password check, and the
leaderboard is a hard-coded table — I am not presenting those two
pieces as finished auth or a real leaderboard.

**One thing I would change if I started again:** build the auth and
leaderboard on a real database from day one, instead of leaving them
as placeholders while the game loop got all the attention. That is the
same "server decides, screen does not" lesson this take-home tests:
the rules live in the server and are verified, not assumed.
