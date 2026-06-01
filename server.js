const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

let waitingSocket = null;
const socketRoom = new Map();

function createRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  if (!waitingSocket) {
    waitingSocket = socket.id;
    socket.emit('status', 'Aguardando outra pessoa...');
  } else {
    const roomId = createRoomId();
    const first = waitingSocket;
    const second = socket.id;
    waitingSocket = null;

    socket.join(roomId);
    io.sockets.sockets.get(first)?.join(roomId);

    socketRoom.set(first, roomId);
    socketRoom.set(second, roomId);

    io.to(first).emit('matched', { roomId, initiator: false });
    socket.emit('matched', { roomId, initiator: true });
  }

  socket.on('signal', ({ roomId, data }) => {
    socket.to(roomId).emit('signal', data);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    const roomId = socketRoom.get(socket.id);

    if (waitingSocket === socket.id) {
      waitingSocket = null;
    }

    if (roomId) {
      socket.to(roomId).emit('partner-disconnected');
      socketRoom.delete(socket.id);
      for (const [id, room] of socketRoom.entries()) {
        if (room === roomId && id !== socket.id) {
          socketRoom.delete(id);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
