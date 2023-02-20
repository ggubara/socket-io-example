import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { instrument } from "@socket.io/admin-ui";

interface SocketData {
  exchange: string;
  ticker: string;
}

const app = express();

app.use(express.static('admin'));

const httpServer = http.createServer(app);
const io = new Server<any, any, any, SocketData>(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: false
  }
});
const port = 3000;

interface IJoin {
  exchange: string;
  ticker: string; // Ticker = Room
  path?: string;
}

interface IDetails {
  exchange?: string;
  ticker?: string;
}

function roomsFilter(rooms: Map<string, Set<string>>): {[room: string]: number} {
  let roomsMap: {[room: string]: number} = {};
  rooms.forEach((users, room) => {
    roomsMap[room] = users.size;
  });
  return roomsMap;
}

// exchange validator 추가

/** Interval: Detail */
setInterval(() => {
  io.emit('detail', {
    connection: io.of('/').sockets.size,
    rooms: roomsFilter(io.sockets.adapter.rooms)
  });
}, 10 * 1000);

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/dashboard', function(req, res) {
  res.sendFile(__dirname + '/admin/index.html');
});

io.on('connection', async (socket) => {
  /** Default Room */
  socket.leave(socket.id);
  socket.join('waitingRoom');

  socket.use((event, next) => {
    next();
  })

  socket.on('join', async (data: IJoin) => {
    console.log(data);
    const exchange = data.exchange.toUpperCase();
    const ticker = data.ticker.toUpperCase();
    const roomName = `${exchange}-${ticker}`;

    /** Room Clear */
    Array.from(socket.rooms).forEach(room => socket.leave(room));

    /** Room Join */
    await socket.join(roomName);

    socket.data.exchange = exchange;
    socket.data.ticker = ticker;

    /** Response */
    socket.emit('join', {
      room: roomName,
      detail: {
        connection: io.of('/').sockets.size,
        rooms: roomsFilter(io.sockets.adapter.rooms)
      }
    });
  });

  socket.on('event', async () => {
    socket.emit('event', socket.eventNames());
  });

  socket.on('detail', async (data: IDetails) => {
    socket.emit('detail', {
      connection: io.of('/').sockets.size,
      rooms: roomsFilter(io.sockets.adapter.rooms)
    });
  });

  socket.on('forceDisconnect', () => {
    socket.disconnect();
    console.log('user disconnected:', socket.id);
  })

  socket.on('disconnecting', () => {

  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });

});

/** Admin */
instrument(io, {
  mode: "production",
  auth: {
    type: "basic",
    username: "bullsea",
    password: "$2a$12$1g6fTeKYd2VvbheAX3ZkrOsG9.GsSfrUSACR5APcdnEvirAapW2c6" // https://bcrypt-generator.com/ : bullsea123!@#
  },
});

/** Server */
httpServer.listen(port, () => {
  console.log(`Socket IO server listening on port ${port}`);
});