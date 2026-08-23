const { createServer } = require("http");
const parse = require("url").parse;
const next = require("next");
const { Server } = require("socket.io");
const cookie = require("cookie");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Mapa em memória de presença por campanha
// campaignId -> Map<userId, { userId, userName, actorId, role, online: boolean, socketId, updatedAt }>
const campaignPresence = new Map();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  // Middleware do Socket.IO para validação basica do cookie de autenticação (D-44)
  io.use((socket, nextMiddleware) => {
    try {
      const cookieHeader = socket.request.headers.cookie;
      if (cookieHeader) {
        const cookies = cookie.parse(cookieHeader);
        socket.data.sessionToken = cookies.libmork_session;
      }
      return nextMiddleware();
    } catch (err) {
      console.error("[Socket Middleware Error]:", err);
      return nextMiddleware();
    }
  });

  io.on("connection", (socket) => {
    // Entrar na sala de uma campanha
    socket.on("join-campaign", ({ campaignId, user, actorId, role }) => {
      if (!campaignId) return;
      const room = `campaign:${campaignId}`;
      socket.join(room);
      socket.data.campaignId = campaignId;
      socket.data.user = user;
      socket.data.actorId = actorId;

      if (!campaignPresence.has(campaignId)) {
        campaignPresence.set(campaignId, new Map());
      }
      const roomPresence = campaignPresence.get(campaignId);
      
      const userId = user?.id || socket.id;
      roomPresence.set(userId, {
        userId,
        userName: user?.name || "Participante",
        actorId: actorId || null,
        role: role || "player",
        online: true,
        socketId: socket.id,
        updatedAt: new Date().toISOString(),
      });

      // Notifica todos na sala com a lista de presença atualizada (online e offline)
      const presenceList = Array.from(roomPresence.values());
      io.to(room).emit("presence-update", { campaignId, presence: presenceList });
    });

    // Atualização de status de personagem em tempo real (HP, Mana, XP, Condições) - RF-025, RF-049
    socket.on("update-actor-status", (payload) => {
      if (!payload || !payload.campaignId) return;
      // Reenvia para todos na sala da campanha (inclusive mestre e jogadores)
      io.to(`campaign:${payload.campaignId}`).emit("actor-status-updated", payload);
    });

    // Evento de rolagem de dados em tempo real - RF-041, RF-046
    socket.on("roll-dice", (rollData) => {
      if (!rollData || !rollData.campaignId) return;
      // Transmite a rolagem para todos os participantes na mesa
      io.to(`campaign:${rollData.campaignId}`).emit("dice-rolled", rollData);
    });

    // Sair explicitamente de uma campanha
    socket.on("leave-campaign", ({ campaignId }) => {
      if (!campaignId) return;
      socket.leave(`campaign:${campaignId}`);
      handleDisconnect(socket, campaignId);
    });

    // Desconexão do socket
    socket.on("disconnect", () => {
      if (socket.data.campaignId) {
        handleDisconnect(socket, socket.data.campaignId);
      }
    });
  });

  function handleDisconnect(socket, campaignId) {
    const roomPresence = campaignPresence.get(campaignId);
    if (!roomPresence) return;

    const userId = socket.data.user?.id;
    for (const [id, entry] of roomPresence.entries()) {
      if (entry.socketId === socket.id || (userId && entry.userId === userId)) {
        entry.online = false;
        entry.socketId = null;
        entry.updatedAt = new Date().toISOString();
      }
    }

    const presenceList = Array.from(roomPresence.values());
    io.to(`campaign:${campaignId}`).emit("presence-update", { campaignId, presence: presenceList });
  }

  httpServer.listen(port, () => {
    console.log(`> Libmork Server rodando com suporte WebSockets em http://${hostname}:${port}`);
  });
});
