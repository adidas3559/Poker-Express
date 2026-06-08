# TODO

## Possible Bugs

### Disconnected lobby player misses `gameStarted`
When a player loses their connection in the lobby (network drop, closed laptop, etc.), the `disconnect`
handler marks them `disconnected: true` but keeps them in `room.players` for the 5-minute grace period.
If the host starts the game during that window, `startGame` emits `gameStarted` to the player's now-dead
`socketId`, which silently drops. The player never navigates to the game but is still dealt in via `initGame`.

They can recover via `rejoinLobby` once they reconnect — it redirects them to the game if `room.gameState`
exists with a non-`'end'` phase. However, if they reconnect before any other player has called `initGame`
(which is what sets `room.gameState`), `rejoinLobby` finds no game state and sends them to the lobby instead.

**Location:** `createGame.js` — `startGame` handler, `io.to(roomCode).emit` vs per-socket sends.

---

### Double `joinRoom`/`createRoom` emit causes "Nickname already taken" error
The `useEffect` in `Lobby.tsx` has `[socket]` as its dependency. On first mount, `socket` is null so
`connect()` is called and `joinRoom` (or `createRoom`) is emitted. When the socket finishes connecting,
the context updates `socket`, which triggers the effect to re-run. At that point `navigate('/lobby', {
replace: true, state: null })` hasn't fired yet (it only fires after `lobbyUpdated` comes back), so
`state` still holds `{ roomCode, nickname }`. The effect sees the same state and emits `joinRoom` a
second time. The BE finds the player already in the room and not disconnected, so it returns "Nickname
already taken" and the player is redirected to the join page.

The same race applies to `createRoom` — it fires twice and creates two separate rooms on the server.

**Fix:** Add a `hasJoinedRef = useRef(false)` in `Lobby.tsx`. Wrap the emit block in
`if (!hasJoinedRef.current) { hasJoinedRef.current = true; ... }`. The handler re-registration on
socket change should stay — only the emit needs to be guarded. The ref resets on unmount so a genuine
new lobby visit still sends the emit.

```tsx
const hasJoinedRef = useRef(false);

useEffect(() => {
  const activeSocket = socket ?? connect();

  activeSocket.on('lobbyUpdated', ...);
  activeSocket.on('gameStarted', ...);
  activeSocket.on('error', ...);

  if (!hasJoinedRef.current) {
    hasJoinedRef.current = true;
    if (!state) {
      activeSocket.emit('rejoinLobby', {
        roomCode: sessionStorage.getItem('poker_roomCode') ?? '',
        playerId: sessionStorage.getItem('poker_playerId') ?? '',
      });
    } else if (initialRoomName && !initialRoomCode) {
      activeSocket.emit('createRoom', { roomName: initialRoomName, nickname: initialNickname });
    } else if (initialRoomCode && !initialRoomName) {
      activeSocket.emit('joinRoom', { roomCode: initialRoomCode, nickname: initialNickname });
    }
  }

  return () => {
    activeSocket.off('lobbyUpdated');
    activeSocket.off('gameStarted');
    activeSocket.off('error');
  };
}, [socket]);
```

**Location:** `Lobby.tsx` — the single `useEffect` with `[socket]` dependency.
