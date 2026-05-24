const { randomUUID } = require('crypto');

const rooms = {};

const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const existing = room.players.find(p => p.nickname === nickname);
      if (existing) {
        existing.socketId = socket.id;
        socket.join(roomCode);
        socket.emit('lobbyUpdated', { room, playerId: existing.id, nickname });
        socket.broadcast.to(roomCode).emit('lobbyUpdated', { room });
        return;
      }

      const playerId = randomUUID();
      room.players.push({ id: playerId, socketId: socket.id, nickname });
      socket.join(roomCode);
      socket.emit('lobbyUpdated', { room, playerId, nickname });
      socket.broadcast.to(roomCode).emit('lobbyUpdated', { room });
    });

    socket.on('rejoinRoom', ({ roomCode, playerId }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      const player = room.players.find(p => p.id === playerId);
      if (!player) { socket.emit('error', { message: 'Player not found' }); return; }

      player.socketId = socket.id;
      socket.join(roomCode);
      socket.emit('rejoined', { room, playerId, gameState: room.gameState ?? null });
    });

    socket.on('startGame', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      const requestingPlayer = room.players.find(p => p.socketId === socket.id);
      if (!requestingPlayer || requestingPlayer.nickname !== room.host) {
        socket.emit('error', { message: 'Only the host can start the game' });
        return;
      }

      room.players.forEach(({ socketId, id }) => {
        io.to(socketId).emit('gameStarted', { roomCode, playerId: id });
      });
    });

    socket.on('rejoinLobby', ({ roomCode, playerId }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      const player = room.players.find(p => p.id === playerId);
      if (!player) { socket.emit('error', { message: 'Player not found' }); return; }

      player.socketId = socket.id;
      socket.join(roomCode);

      room.gameState = null;
      socket.emit('lobbyUpdated', { room, playerId: player.id, nickname: player.nickname });
      socket.broadcast.to(roomCode).emit('lobbyUpdated', { room });
    });

    socket.on('leaveRoom', ({ roomCode, playerId }) => {
      const room = rooms[roomCode];

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      room.players = room.players.filter((p) => p.id !== playerId);

      // emit before socket.leave so the departing player also receives the updated list
      io.to(roomCode).emit('lobbyUpdated', { room });
      socket.leave(roomCode);
    });
  });
};

module.exports = { handler, rooms };
