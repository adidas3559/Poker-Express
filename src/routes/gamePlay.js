const {
  initGame,
  startNewRound,
  testStartNewRound,
  raiseHandler,
  callHandler,
  checkHandler,
  foldHandler,
  allInHandler,
} = require('../controllers/gameService');
const { autoFoldDisconnected, disconnectTimers } = require('./createGame');

module.exports = (io, rooms) => {
  io.on('connection', (socket) => {

    socket.on('initGame', ({ roomCode, playerId }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      socket.join(roomCode);

      if (playerId) {
        const player = room.players.find(p => p.id === playerId);
        if (player && player.disconnected) {
          clearTimeout(disconnectTimers[playerId]);
          delete disconnectTimers[playerId];
          player.socketId = socket.id;
          player.disconnected = false;
          io.to(roomCode).emit('lobbyUpdated', { room });
        }
      }

      if (!room.gameState) {
        room.gameState = initGame(room);
        io.to(roomCode).emit('gameInitialized', { gameState: room.gameState });
      } else {
        socket.emit('gameInitialized', { gameState: room.gameState });
      }
    });

    socket.on('startRound', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
      room.gameState = startNewRound(room.gameState);
      io.to(roomCode).emit('roundStarted', { gameState: room.gameState });
    });

    socket.on('testStartRound', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
      room.gameState = testStartNewRound(room.gameState);
      io.to(roomCode).emit('roundStarted', { gameState: room.gameState });
    });

    socket.on('raise', ({ roomCode, betAmount }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
      room.gameState = raiseHandler(room.gameState, betAmount);
      io.to(roomCode).emit('gameUpdated', { gameState: room.gameState });
      autoFoldDisconnected(io, roomCode);
    });

    socket.on('call', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
      room.gameState = callHandler(room.gameState);
      io.to(roomCode).emit('gameUpdated', { gameState: room.gameState });
      autoFoldDisconnected(io, roomCode);
    });

    socket.on('check', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
      room.gameState = checkHandler(room.gameState);
      io.to(roomCode).emit('gameUpdated', { gameState: room.gameState });
      autoFoldDisconnected(io, roomCode);
    });

    socket.on('fold', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
      room.gameState = foldHandler(room.gameState);
      io.to(roomCode).emit('gameUpdated', { gameState: room.gameState });
      autoFoldDisconnected(io, roomCode);
    });

    socket.on('allIn', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
      room.gameState = allInHandler(room.gameState);
      io.to(roomCode).emit('gameUpdated', { gameState: room.gameState });
      autoFoldDisconnected(io, roomCode);
    });

  });
};
