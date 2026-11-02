require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createServer } = require("http");
const parse = require("url").parse;
const next = require("next");
const { Server } = require("socket.io");
const { parseCookie } = require("cookie");
const net = require("net");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const initialPort = parseInt(process.env.PORT || "3000", 10);

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
    server.once("listening", () => {
      server.close(() => {
        resolve(startPort);
      });
    });
    server.listen(startPort);
  });
}

findAvailablePort(initialPort)
  .then((port) => {
    const app = next({ dev, hostname, port });
    const handle = app.getRequestHandler();

    // Mapa em memória de presença por campanha
    // campaignId -> Map<userId, { userId, userName, actorId, role, online: boolean, socketId, updatedAt }>
    const campaignPresence = new Map();
    const campaignCombatRevisions = new Map();

    // Jukebox de Áudio — Estado em memória por campanha (Issue #60)
    // campaignId -> { tracks: Map<trackId, AudioTrack>, playingTrackIds: Set<string>, loopTrackIds: Set<string>, playingAts: Map<trackId, number> }
    const campaignAudioStates = new Map();

    function getOrCreateAudioState(campaignId) {
      if (!campaignAudioStates.has(campaignId)) {
        campaignAudioStates.set(campaignId, {
          tracks: new Map(),
          playingTrackIds: new Set(),
          loopTrackIds: new Set(),
          playingAts: new Map(),
        });
      }
      return campaignAudioStates.get(campaignId);
    }

    app.prepare().then(() => {
      const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      });

      const io = new Server(httpServer, {
        path: "/api/socket/io",
        // Use the exact configured path for both polling and WebSocket upgrades.
        // This avoids relying on a redirect for WebSocket requests.
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
            const cookies = parseCookie(cookieHeader);
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

          // Envia estado de áudio para late-joiners se houver faixas ou reprodução ativa (Issue #60)
          if (campaignAudioStates.has(campaignId)) {
            const audioState = campaignAudioStates.get(campaignId);
            socket.emit("audio:track-state", {
              campaignId,
              tracks: Array.from(audioState.tracks.values()),
              playingTrackIds: Array.from(audioState.playingTrackIds),
              playingTrackId: Array.from(audioState.playingTrackIds)[0] || null,
              playingAt:
                audioState.playingAts.size > 0
                  ? Array.from(audioState.playingAts.values())[0]
                  : null,
              loopTrackIds: Array.from(audioState.loopTrackIds),
            });
          }
        });

        // Atualização de status de personagem em tempo real (HP, Mana, XP, Condições) - RF-025, RF-049
        socket.on("update-actor-status", (payload) => {
          if (!payload) return;
          if (payload.campaignId && socket.rooms.has(`campaign:${payload.campaignId}`)) {
            io.to(`campaign:${payload.campaignId}`).emit("actor-status-updated", payload);
          }
        });

        // Evento de rolagem de dados em tempo real - RF-041, RF-046
        socket.on("roll-dice", (rollData) => {
          if (!rollData) return;
          if (rollData.campaignId)
            io.to(`campaign:${rollData.campaignId}`).emit("dice-rolled", rollData);
        });

        // Eventos do Motor de Combate (Fase 4 - RF-039, RF-040, RF-041, RF-047, RF-066)
        socket.on("update-combat-state", (combatState) => {
          if (!combatState) return;
          if (combatState.campaignId && socket.rooms.has(`campaign:${combatState.campaignId}`)) {
            const revision =
              Math.max(
                campaignCombatRevisions.get(combatState.campaignId) || 0,
                Number(combatState.revision) || 0,
              ) + 1;
            campaignCombatRevisions.set(combatState.campaignId, revision);
            io.to(`campaign:${combatState.campaignId}`).emit("combat-state-updated", {
              ...combatState,
              revision,
              updatedAt: Date.now(),
            });
          }
        });

        socket.on("request-initiative-roll", (payload) => {
          if (!payload) return;
          if (payload.campaignId)
            io.to(`campaign:${payload.campaignId}`).emit("initiative-roll-requested", payload);
        });

        socket.on("request-defense-reaction", (reactionPrompt) => {
          if (!reactionPrompt) return;
          if (reactionPrompt.campaignId)
            io.to(`campaign:${reactionPrompt.campaignId}`).emit(
              "defense-reaction-requested",
              reactionPrompt,
            );
        });

        socket.on("respond-defense-reaction", (responsePayload) => {
          if (!responsePayload) return;
          if (responsePayload.campaignId)
            io.to(`campaign:${responsePayload.campaignId}`).emit(
              "defense-reaction-responded",
              responsePayload,
            );
        });

        // Eventos de Duelo P2P (Fase 5 - RF-069, D-45)
        socket.on("request-duel-invite", (invitePayload) => {
          if (!invitePayload) return;
          if (invitePayload.campaignId)
            io.to(`campaign:${invitePayload.campaignId}`).emit(
              "duel-invite-requested",
              invitePayload,
            );
        });

        socket.on("respond-duel-invite", (responsePayload) => {
          if (!responsePayload) return;
          if (responsePayload.campaignId)
            io.to(`campaign:${responsePayload.campaignId}`).emit(
              "duel-invite-responded",
              responsePayload,
            );
        });

        socket.on("update-duel-state", (duelState) => {
          if (!duelState) return;
          if (duelState.campaignId)
            io.to(`campaign:${duelState.campaignId}`).emit("duel-state-updated", duelState);
        });

        socket.on("finish-duel", (finishPayload) => {
          if (!finishPayload) return;
          if (finishPayload.campaignId)
            io.to(`campaign:${finishPayload.campaignId}`).emit("duel-finished", finishPayload);
        });

        // Logs da Campanha (Issue #13 - Alta Prioridade 1)
        socket.on("toggle-establishment", (payload) => {
          if (!payload || !payload.campaignId) return;
          io.to(`campaign:${payload.campaignId}`).emit("establishment-status-updated", payload);
        });

        socket.on("create-campaign-log", (payload) => {
          if (!payload || !payload.campaignId || !payload.log) return;
          io.to(`campaign:${payload.campaignId}`).emit("campaign-log-created", payload);
        });

        socket.on("update-campaign-log", (payload) => {
          if (!payload || !payload.campaignId || !payload.log) return;
          io.to(`campaign:${payload.campaignId}`).emit("campaign-log-updated", payload);
        });

        // Inventário de Personagem (Issue #13 - Alta Prioridade 2)
        socket.on("notify-character-inventory-change", (payload) => {
          if (!payload || !payload.campaignId || !payload.characterId) return;
          io.to(`campaign:${payload.campaignId}`).emit("character-inventory-changed", payload);
        });

        // Convites de Campanha (Issue #13 - Alta Prioridade 3)
        socket.on("notify-campaign-invite-created", (payload) => {
          if (!payload || !payload.campaignId || !payload.invite) return;
          io.to(`campaign:${payload.campaignId}`).emit("campaign-invite-created", payload);
        });

        socket.on("notify-campaign-invite-revoked", (payload) => {
          if (!payload || !payload.campaignId || !payload.inviteId) return;
          io.to(`campaign:${payload.campaignId}`).emit("campaign-invite-revoked", payload);
        });

        socket.on("join-qr-session", ({ qrSessionId }) => {
          if (!qrSessionId) return;
          socket.join(`qr:${qrSessionId}`);
        });

        socket.on("leave-qr-session", ({ qrSessionId }) => {
          if (!qrSessionId) return;
          socket.leave(`qr:${qrSessionId}`);
        });

        socket.on("qr-authorize-success", ({ qrSessionId, sessionToken, user }) => {
          if (!qrSessionId) return;
          io.to(`qr:${qrSessionId}`).emit("qr-authenticated", { sessionToken, user });
        });

        // Jukebox de Áudio — Issue #60
        socket.on("audio:track-add", (payload) => {
          if (!payload || !payload.campaignId || !payload.track) return;
          const state = getOrCreateAudioState(payload.campaignId);
          state.tracks.set(payload.track.id, payload.track);
          io.to(`campaign:${payload.campaignId}`).emit("audio:track-add", payload);
        });

        socket.on("audio:track-play", (payload) => {
          if (!payload || !payload.campaignId || !payload.trackId) return;
          const state = getOrCreateAudioState(payload.campaignId);
          state.playingTrackIds.add(payload.trackId);
          state.playingAts.set(payload.trackId, payload.playingAt || Date.now());
          io.to(`campaign:${payload.campaignId}`).emit("audio:track-play", payload);
        });

        socket.on("audio:track-pause", (payload) => {
          if (!payload || !payload.campaignId || !payload.trackId) return;
          const state = getOrCreateAudioState(payload.campaignId);
          state.playingTrackIds.delete(payload.trackId);
          state.playingAts.delete(payload.trackId);
          io.to(`campaign:${payload.campaignId}`).emit("audio:track-pause", payload);
        });

        socket.on("audio:track-loop", (payload) => {
          if (!payload || !payload.campaignId || !payload.trackId) return;
          const state = getOrCreateAudioState(payload.campaignId);
          if (payload.loop) {
            state.loopTrackIds.add(payload.trackId);
          } else {
            state.loopTrackIds.delete(payload.trackId);
          }
          io.to(`campaign:${payload.campaignId}`).emit("audio:track-loop", payload);
        });

        socket.on("audio:track-remove", (payload) => {
          if (!payload || !payload.campaignId || !payload.trackId) return;
          const state = getOrCreateAudioState(payload.campaignId);
          state.tracks.delete(payload.trackId);
          state.playingTrackIds.delete(payload.trackId);
          state.loopTrackIds.delete(payload.trackId);
          state.playingAts.delete(payload.trackId);
          io.to(`campaign:${payload.campaignId}`).emit("audio:track-remove", payload);
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
        io.to(`campaign:${campaignId}`).emit("presence-update", {
          campaignId,
          presence: presenceList,
        });
      }

      httpServer.listen(port, () => {
        console.log(
          `> Libmork Server rodando com suporte WebSockets em http://${hostname}:${port}`,
        );
      });
    });
  })
  .catch((err) => {
    console.error("Erro ao inicializar o servidor:", err);
    process.exit(1);
  });
