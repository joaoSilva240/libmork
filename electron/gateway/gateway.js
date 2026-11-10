// =============================================================================
// Libmork Desktop — Script do Gateway de Instâncias (Issue #80)
// =============================================================================

(function () {
  const serverListEl = document.getElementById("server-list");
  const addServerForm = document.getElementById("add-server-form");
  const nameInput = document.getElementById("server-name");
  const urlInput = document.getElementById("server-url");
  const formError = document.getElementById("form-error");
  const btnTestAll = document.getElementById("btn-test-all");

  const api = window.desktopClient;

  let servers = [];
  const healthMap = new Map();

  function showError(msg) {
    if (!formError) return;
    formError.textContent = msg;
    formError.style.display = msg ? "block" : "none";
  }

  async function loadServers() {
    if (!api) {
      showError("API desktopClient não encontrada no contexto.");
      return;
    }
    try {
      servers = await api.getServerList();
      renderServers();
      checkAllServers();
    } catch {
      showError("Falha ao carregar lista de servidores.");
    }
  }

  async function checkSingleServer(server) {
    if (!api) return;
    healthMap.set(server.id, { checking: true });
    renderServers();

    try {
      const result = await api.checkServerHealth(server.url);
      healthMap.set(server.id, {
        checking: false,
        ok: result.ok,
        latencyMs: result.latencyMs,
        error: result.error,
        status: result.status,
      });
    } catch {
      healthMap.set(server.id, {
        checking: false,
        ok: false,
        error: "Inalcançável",
      });
    }
    renderServers();
  }

  async function checkAllServers() {
    await Promise.all(servers.map((s) => checkSingleServer(s)));
  }

  async function connectTo(server) {
    if (!api) return;
    try {
      await api.saveServer({
        ...server,
        lastConnected: new Date().toISOString(),
      });
      await api.setActiveServer(server.url);
    } catch {
      showError("Não foi possível conectar ao servidor selecionado.");
    }
  }

  async function removeServer(server, event) {
    event.stopPropagation();
    if (!api || server.preset) return;
    await api.removeServer(server.id);
    await loadServers();
  }

  function renderServers() {
    if (!serverListEl) return;
    serverListEl.innerHTML = "";

    servers.forEach((server) => {
      const card = document.createElement("div");
      card.className = "server-card";
      card.setAttribute("role", "listitem");

      const health = healthMap.get(server.id);
      let statusDotClass = "status-dot";
      let statusText = "Não verificado";

      if (health) {
        if (health.checking) {
          statusDotClass += " checking";
          statusText = "Verificando...";
        } else if (health.ok) {
          statusDotClass += " online";
          statusText = `Online (${health.latencyMs ?? 0}ms)`;
        } else {
          statusDotClass += " offline";
          statusText = `Indisponível${health.error ? ` — ${health.error}` : ""}`;
        }
      }

      const infoDiv = document.createElement("div");
      infoDiv.className = "server-info";

      const nameRow = document.createElement("div");
      nameRow.className = "server-name-row";

      const nameSpan = document.createElement("span");
      nameSpan.className = "server-name";
      nameSpan.textContent = server.name;
      nameRow.appendChild(nameSpan);

      if (server.preset) {
        const tag = document.createElement("span");
        tag.className = "preset-tag";
        tag.textContent = "Padrão";
        nameRow.appendChild(tag);
      }

      const urlSpan = document.createElement("span");
      urlSpan.className = "server-url";
      urlSpan.textContent = server.url;

      const statusDiv = document.createElement("div");
      statusDiv.className = "server-status";
      const dot = document.createElement("span");
      dot.className = statusDotClass;
      const statusLabel = document.createElement("span");
      statusLabel.textContent = statusText;
      statusDiv.appendChild(dot);
      statusDiv.appendChild(statusLabel);

      infoDiv.appendChild(nameRow);
      infoDiv.appendChild(urlSpan);
      infoDiv.appendChild(statusDiv);

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "server-actions";

      const testBtn = document.createElement("button");
      testBtn.type = "button";
      testBtn.className = "btn btn-secondary";
      testBtn.textContent = "Ping";
      testBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        checkSingleServer(server);
      });

      const connectBtn = document.createElement("button");
      connectBtn.type = "button";
      connectBtn.className = "btn btn-primary";
      connectBtn.textContent = "Conectar";
      connectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        connectTo(server);
      });

      actionsDiv.appendChild(testBtn);
      actionsDiv.appendChild(connectBtn);

      if (!server.preset) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-danger";
        delBtn.title = "Remover servidor";
        delBtn.textContent = "✕";
        delBtn.addEventListener("click", (e) => removeServer(server, e));
        actionsDiv.appendChild(delBtn);
      }

      card.appendChild(infoDiv);
      card.appendChild(actionsDiv);
      card.addEventListener("click", () => connectTo(server));

      serverListEl.appendChild(card);
    });
  }

  if (addServerForm) {
    addServerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const name = (nameInput.value || "").trim();
      const rawUrl = (urlInput.value || "").trim().replace(/\/$/, "");

      if (!name || !rawUrl) {
        showError("Preencha o nome e a URL do servidor.");
        return;
      }

      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          showError("Use protocolo http:// ou https://");
          return;
        }
      } catch {
        showError("URL inválida. Exemplo: http://localhost:3000");
        return;
      }

      const newServer = {
        id: `custom-${Date.now()}`,
        name,
        url: rawUrl,
        preset: false,
        lastConnected: new Date().toISOString(),
      };

      await api.saveServer(newServer);
      nameInput.value = "";
      urlInput.value = "";
      await connectTo(newServer);
    });
  }

  if (btnTestAll) {
    btnTestAll.addEventListener("click", () => {
      checkAllServers();
    });
  }

  loadServers();
})();
