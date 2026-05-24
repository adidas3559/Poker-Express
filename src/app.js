require('dotenv').config();
const express = require('express');
const socket = require('socket.io');
const http = require('http');
const cors = require('cors');
const { handler: createGame, rooms } = require('./routes/createGame');
const gamePlay = require('./routes/gamePlay');

const app = express();
const port = process.env.PORT || 3010;
// normally we don't need to manually create http server,
// app.listen does it for use behind the scenes. But since we
// want to attach socket io to our server, we must do this manually
const server = http.createServer(app);

const isAllowedOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN)
    return callback(null, true);
  const port = parseInt(new URL(origin).port, 10);
  if (port >= 5173 && port <= 7180) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
};

app.use(cors({ origin: isAllowedOrigin }));

// Socket setup - cors must be configured here separately from app.use(cors())
// because socket.io handles its own HTTP layer for the handshake/polling
const io = socket(server, {
  cors: { origin: isAllowedOrigin }
});

io.on('connection', (socket) => {
  console.log('Made socket connection', socket.id);
});

createGame(io);
gamePlay(io, rooms);


// don't really need this since we're not doing normal rest api routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// note this is server.listen instead of the usual app.listen
// reason is commented above const server
server.listen(port, () => {
  console.log(`App listening on http://localhost:${port}`);
});





