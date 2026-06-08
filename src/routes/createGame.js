const { randomUUID } = require('crypto');
const { foldHandler } = require('../controllers/gameService');

const CHARACTER_IDS = [
  'char_arthur', 'char_dutch', 'char_hosea', 'char_javier', 'char_john-marston',
  'char_lenny', 'char_micah', 'char_sadie', 'char_sean',
];

// 5 minutes
const GRACE_PERIOD_MS = 5 * 60 * 1000;
const disconnectTimers = {};
const rooms = {};

const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const assignMissingCharacters = (players) => {
  const taken = new Set(players.map(p => p.characterId).filter(Boolean));
  const available = CHARACTER_IDS.filter(id => !taken.has(id));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  let pickIndex = 0;
  players.forEach(p => { if (!p.characterId) p.characterId = available[pickIndex++]; });
};

// Folds the current player if they are disconnected, then recurses to the next player.
// Stops when the current player is connected, or the phase is over.
const autoFoldDisconnected = (io, roomCode) => {
  const room = rooms[roomCode];
  if (!room?.gameState) return;
  const { phase, currentPlayerIndex, players: gamePlayers } = room.gameState;
  if (phase === 'waiting' || phase === 'end') return;

  const currentGamePlayer = gamePlayers[currentPlayerIndex];
  const roomPlayer = room.players.find(p => p.id === currentGamePlayer.id);

  if (roomPlayer?.disconnected) {
    room.gameState = foldHandler(room.gameState);
    io.to(roomCode).emit('gameUpdated', { gameState: room.gameState });
    autoFoldDisconnected(io, roomCode);
  }
};

const handler = (io) => {
  io.on('connection', (socket) => {
    socket.on('createRoom', ({ roomName, nickname }) => {
      const roomCode = generateRoomCode();
      const playerId = randomUUID();

      rooms[roomCode] = {
        roomName,
        roomCode,
        host: nickname,
        players: [{ id: playerId, socketId: socket.id, nickname }],
      };

      socket.join(roomCode);
      socket.emit('lobbyUpdated', { room: rooms[roomCode], playerId, nickname });
    });

    socket.on('joinRoom', ({ roomCode, nickname }) => {
      
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      const existing = room.players.find(p => p.nickname === nickname);
      if (existing) {
        if (!existing.disconnected) {
          socket.emit('error', { message: 'Nickname already taken in this room' });
          return;
        }

        // Reconnecting a disconnected player — cancel their removal timer
        clearTimeout(disconnectTimers[existing.id]);
        delete disconnectTimers[existing.id];
        existing.socketId = socket.id;
        existing.disconnected = false;
        socket.join(roomCode);

        if (room.gameState) {
          // Send them back into the active game
          socket.emit('gameStarted', { roomCode, playerId: existing.id });
          socket.emit('gameUpdated', { gameState: room.gameState });
        } else {
          socket.emit('lobbyUpdated', { room, playerId: existing.id, nickname: existing.nickname });
        }
        socket.broadcast.to(roomCode).emit('lobbyUpdated', { room });
        return;
      }

      const playerId = randomUUID();
      room.players.push({ id: playerId, socketId: socket.id, nickname });
      socket.join(roomCode);
      socket.emit('lobbyUpdated', { room, playerId, nickname });
      socket.broadcast.to(roomCode).emit('lobbyUpdated', { room });
    });

    socket.on('selectCharacter', ({ roomCode, playerId, characterId }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      const player = room.players.find(p => p.id === playerId);
      if (!player) { socket.emit('error', { message: 'Player not found' }); return; }

      player.characterId = characterId;
      io.to(roomCode).emit('lobbyUpdated', { room });
    });

    socket.on('startGame', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      const requestingPlayer = room.players.find(p => p.socketId === socket.id);
      if (!requestingPlayer || requestingPlayer.nickname !== room.host) {
        socket.emit('error', { message: 'Only the host can start the game' });
        return;
      }

      assignMissingCharacters(room.players);

      room.players.forEach(({ socketId, id }) => {
        io.to(socketId).emit('gameStarted', { roomCode, playerId: id, players: room.players });
      });
    });

    socket.on('rejoinLobby', ({ roomCode, playerId }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      const player = room.players.find(p => p.id === playerId);
      if (!player) { socket.emit('error', { message: 'Player not found' }); return; }

      player.socketId = socket.id;
      player.disconnected = false;
      socket.join(roomCode);

      if (room.gameState && room.gameState.phase !== 'end') {
        // Active mid-game: redirect back in
        socket.emit('gameStarted', { roomCode, playerId: player.id });
        socket.emit('gameUpdated', { gameState: room.gameState });
        socket.broadcast.to(roomCode).emit('lobbyUpdated', { room });
        return;
      }

      // No game or game just finished: reset for next game
      if (room.gameState) {
        room.gameState = null;
        room.players.forEach(p => { delete p.characterId; }); // might delete, I want players to keep characters between matches but not in new lobbies
      }
      socket.emit('lobbyUpdated', { room, playerId: player.id, nickname: player.nickname });
      socket.broadcast.to(roomCode).emit('lobbyUpdated', { room });
    });

    socket.on('leaveRoom', ({ roomCode, playerId }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      clearTimeout(disconnectTimers[playerId]);
      delete disconnectTimers[playerId];

      if (room.gameState) {
        // During an active game, keep them in room.players (marked disconnected) so
        // autoFoldDisconnected can find them, and so they can rejoin within the grace period
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          player.disconnected = true;
          autoFoldDisconnected(io, roomCode);
          disconnectTimers[playerId] = setTimeout(() => {
            const currentRoom = rooms[roomCode];
            if (!currentRoom) { delete disconnectTimers[playerId]; return; }
            const gamePlayer = currentRoom.gameState?.players.find(p => p.id === playerId);
            if (gamePlayer) {
              if (currentRoom.gameState.players[currentRoom.gameState.currentPlayerIndex]?.id === playerId) {
                currentRoom.gameState = foldHandler(currentRoom.gameState);
              }
              gamePlayer.status = 'busted';
              autoFoldDisconnected(io, roomCode);
              io.to(roomCode).emit('gameUpdated', { gameState: currentRoom.gameState });
            }
            currentRoom.players = currentRoom.players.filter(p => p.id !== playerId);
            if (currentRoom.players.length === 0) {
              delete rooms[roomCode];
            } else {
              io.to(roomCode).emit('lobbyUpdated', { room: currentRoom });
            }
            delete disconnectTimers[playerId];
          }, GRACE_PERIOD_MS);
        }
        io.to(roomCode).emit('lobbyUpdated', { room });
        socket.leave(roomCode);
        return;
      }

      room.players = room.players.filter((p) => p.id !== playerId);

      if (room.players.length === 0) {
        delete rooms[roomCode];
        socket.leave(roomCode);
        return;
      }

      // emit before socket.leave so the departing player also receives the updated lobby
      io.to(roomCode).emit('lobbyUpdated', { room });
      socket.leave(roomCode);
    });

    socket.on('disconnect', () => {
      for (const roomCode of Object.keys(rooms)) {
        const room = rooms[roomCode];
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) continue;

        player.disconnected = true;
        io.to(roomCode).emit('lobbyUpdated', { room });

        // If it's their turn in an active game, fold them now so the game doesn't stall
        autoFoldDisconnected(io, roomCode);

        disconnectTimers[player.id] = setTimeout(() => {
          const currentRoom = rooms[roomCode];
          if (!currentRoom) { delete disconnectTimers[player.id]; return; }

          if (currentRoom.gameState) {
            const gamePlayer = currentRoom.gameState.players.find(p => p.id === player.id);
            if (gamePlayer) {
              // Fold if it's still their turn, then permanently bust them
              if (currentRoom.gameState.players[currentRoom.gameState.currentPlayerIndex]?.id === player.id) {
                currentRoom.gameState = foldHandler(currentRoom.gameState);
              }
              gamePlayer.status = 'busted';
              autoFoldDisconnected(io, roomCode);
              io.to(roomCode).emit('gameUpdated', { gameState: currentRoom.gameState });
            }
          }

          currentRoom.players = currentRoom.players.filter(p => p.id !== player.id);

          if (currentRoom.players.length === 0) {
            delete rooms[roomCode];
          } else {
            io.to(roomCode).emit('lobbyUpdated', { room: currentRoom });
          }

          delete disconnectTimers[player.id];
        }, GRACE_PERIOD_MS);

        break; // a player can only be in one room
      }
    });
  });
};

module.exports = { handler, rooms, autoFoldDisconnected, disconnectTimers };
