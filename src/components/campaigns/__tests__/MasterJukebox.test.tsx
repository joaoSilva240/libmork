import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterJukebox } from "../MasterJukebox";
import { useJukebox } from "@/hooks/useJukebox";

// Mock do hook useJukebox
const mockAddTrack = vi.fn();
const mockRemoveTrack = vi.fn();
const mockTogglePlay = vi.fn();
const mockSeekTrack = vi.fn();
const mockToggleLoop = vi.fn();
const mockStopAll = vi.fn();
const mockCreatePlaylist = vi.fn();
const mockUngroupPlaylist = vi.fn();

vi.mock("@/hooks/useJukebox", () => ({
  useJukebox: vi.fn(),
}));

// Mock do YouTubeAudioPlayer
vi.mock("@/components/audio/YouTubeAudioPlayer", () => ({
  YouTubeAudioPlayer: ({ videoId, playing, volume, loop, seekTime, onStateChange }: any) => (
    <div
      data-testid={`youtube-player-${videoId}`}
      data-playing={playing}
      data-volume={volume}
      data-loop={loop}
      data-seek-time={seekTime}
    >
      <button
        data-testid={`simulate-end-${videoId}`}
        onClick={() => onStateChange && onStateChange("ended")}
      />
    </div>
  ),
}));

describe("MasterJukebox", () => {
  function createMockJukebox(overrides: Partial<ReturnType<typeof useJukebox>> = {}) {
    return {
      tracks: [],
      playingTrackIds: new Set<string>(),
      playingTrackId: null,
      loopTrackIds: new Set<string>(),
      playingAt: null,
      trackPlayingAts: {},
      isLoading: false,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      seekTrack: mockSeekTrack,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
      createPlaylist: mockCreatePlaylist,
      ungroupPlaylist: mockUngroupPlaylist,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useJukebox).mockReturnValue(createMockJukebox());
  });

  it("renderiza título '🎵 Jukebox de Áudio'", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);
    expect(screen.getByText("🎵 Jukebox de Áudio")).toBeInTheDocument();
  });

  it("mostra placeholder quando tracks = []", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);
    expect(
      screen.getByText("Nenhuma faixa de áudio adicionada. Cole uma URL do YouTube para começar."),
    ).toBeInTheDocument();
  });

  it("renderiza input + botão 'Adicionar'", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);
    const input = screen.getByPlaceholderText("Cole a URL do YouTube...");
    expect(input).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Adicionar" });
    expect(button).toBeInTheDocument();
  });

  it("addTrack com erro → mostra mensagem de erro inline", () => {
    mockAddTrack.mockReturnValue({ ok: false, error: "URL inválida do YouTube" });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const input = screen.getByPlaceholderText("Cole a URL do YouTube...");
    fireEvent.change(input, { target: { value: "https://invalid.url" } });

    const button = screen.getByRole("button", { name: "Adicionar" });
    fireEvent.click(button);

    expect(mockAddTrack).toHaveBeenCalledWith("https://invalid.url", "u1", "Mestre");
    expect(screen.getByText("URL inválida do YouTube")).toBeInTheDocument();
  });

  it("addTrack com sucesso → limpa input e erro", () => {
    mockAddTrack.mockReturnValue({ ok: true });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const input = screen.getByPlaceholderText("Cole a URL do YouTube...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://youtube.com/watch?v=dQw4w9WgXcQ" } });

    const button = screen.getByRole("button", { name: "Adicionar" });
    fireEvent.click(button);

    expect(mockAddTrack).toHaveBeenCalledWith(
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "u1",
      "Mestre",
    );
    expect(input.value).toBe("");
    expect(screen.queryByText("URL inválida do YouTube")).not.toBeInTheDocument();
  });

  it("lista de tracks renderiza cada track com thumbnail e título", () => {
    vi.mocked(useJukebox).mockReturnValue(
      createMockJukebox({
        tracks: [
          {
            id: "dQw4w9WgXcQ",
            title: "Never Gonna Give You Up",
            addedBy: "u1",
            addedAt: "2026-11-01T00:00:00Z",
          },
          {
            id: "9bZkp7q19f0",
            title: "GANGNAM STYLE",
            addedBy: "u1",
            addedAt: "2026-11-01T00:01:00Z",
          },
        ],
      }),
    );

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    expect(screen.getByText("Never Gonna Give You Up")).toBeInTheDocument();
    expect(screen.getByText("GANGNAM STYLE")).toBeInTheDocument();

    const card1 = screen.getByTestId("jukebox-track-card-dQw4w9WgXcQ");
    expect(card1).toBeInTheDocument();

    expect(screen.getAllByRole("button", { name: "Reproduzir" })).toHaveLength(2);
  });

  it("togglePlay alterna entre Play e Pause", () => {
    vi.mocked(useJukebox).mockReturnValue(
      createMockJukebox({
        tracks: [
          {
            id: "dQw4w9WgXcQ",
            title: "Never Gonna Give You Up",
            addedBy: "u1",
            addedAt: "2026-11-01T00:00:00Z",
          },
        ],
        playingTrackIds: new Set(["dQw4w9WgXcQ"]),
        playingTrackId: "dQw4w9WgXcQ",
        playingAt: 1234567890,
        trackPlayingAts: { dQw4w9WgXcQ: 1234567890 },
      }),
    );

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const pauseButton = screen.getByRole("button", { name: "Pausar" });
    expect(pauseButton).toBeInTheDocument();

    fireEvent.click(pauseButton);
    expect(mockTogglePlay).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("suporta linha de reprodução e seeking interativo", () => {
    vi.mocked(useJukebox).mockReturnValue(
      createMockJukebox({
        tracks: [
          {
            id: "track-1",
            title: "Chuva e Trovões",
            addedBy: "u1",
            addedAt: "2026-11-01T00:00:00Z",
          },
        ],
        playingTrackIds: new Set(["track-1"]),
        playingTrackId: "track-1",
        playingAt: Date.now(),
        trackPlayingAts: { "track-1": Date.now() },
      }),
    );

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const seekSlider = screen.getByRole("slider", {
      name: "Linha de reprodução",
    }) as HTMLInputElement;
    expect(seekSlider).toBeInTheDocument();

    // Simula interação de busca (seek) para segundo 45
    fireEvent.change(seekSlider, { target: { value: "45" } });
    expect(mockSeekTrack).toHaveBeenCalledWith("track-1", 45);
  });

  it("suporta múltiplas faixas tocando simultaneamente", () => {
    vi.mocked(useJukebox).mockReturnValue(
      createMockJukebox({
        tracks: [
          {
            id: "track-1",
            title: "Chuva e Trovões",
            addedBy: "u1",
            addedAt: "2026-11-01T00:00:00Z",
          },
          {
            id: "track-2",
            title: "Música de Batalha",
            addedBy: "u1",
            addedAt: "2026-11-01T00:01:00Z",
          },
        ],
        playingTrackIds: new Set(["track-1", "track-2"]),
        playingTrackId: "track-1",
        playingAt: Date.now(),
      }),
    );

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    // Ambos os botões devem estar em estado "Pausar"
    const pauseButtons = screen.getAllByRole("button", { name: "Pausar" });
    expect(pauseButtons).toHaveLength(2);

    // Ambos os players devem estar com playing=true
    const player1 = screen.getByTestId("youtube-player-track-1");
    const player2 = screen.getByTestId("youtube-player-track-2");
    expect(player1).toHaveAttribute("data-playing", "true");
    expect(player2).toHaveAttribute("data-playing", "true");

    // Botão Parar Todos visível
    const stopAllBtn = screen.getByRole("button", { name: "Parar Todos" });
    expect(stopAllBtn).toBeInTheDocument();
    fireEvent.click(stopAllBtn);
    expect(mockStopAll).toHaveBeenCalledTimes(1);
  });

  it("botão loop → chama toggleLoop(trackId)", () => {
    vi.mocked(useJukebox).mockReturnValue(
      createMockJukebox({
        tracks: [
          {
            id: "dQw4w9WgXcQ",
            title: "Never Gonna Give You Up",
            addedBy: "u1",
            addedAt: "2026-11-01T00:00:00Z",
          },
        ],
        loopTrackIds: new Set(["dQw4w9WgXcQ"]),
      }),
    );

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const loopButton = screen.getByRole("button", { name: "Loop" });
    fireEvent.click(loopButton);

    expect(mockToggleLoop).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("botão remover → chama removeTrack(trackId)", () => {
    vi.mocked(useJukebox).mockReturnValue(
      createMockJukebox({
        tracks: [
          {
            id: "dQw4w9WgXcQ",
            title: "Never Gonna Give You Up",
            addedBy: "u1",
            addedAt: "2026-11-01T00:00:00Z",
          },
        ],
      }),
    );

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const removeButton = screen.getByRole("button", { name: "Remover" });
    fireEvent.click(removeButton);

    expect(mockRemoveTrack).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("volume slider onChange atualiza estado local (não chama hook)", () => {
    vi.mocked(useJukebox).mockReturnValue(
      createMockJukebox({
        tracks: [
          {
            id: "dQw4w9WgXcQ",
            title: "Never Gonna Give You Up",
            addedBy: "u1",
            addedAt: "2026-11-01T00:00:00Z",
          },
        ],
      }),
    );

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const volumeSlider = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
    expect(volumeSlider.value).toBe("50"); // valor padrão

    fireEvent.change(volumeSlider, { target: { value: "75" } });
    expect(volumeSlider.value).toBe("75");

    // Verifica que nenhum método do hook foi chamado
    expect(mockTogglePlay).not.toHaveBeenCalled();
    expect(mockToggleLoop).not.toHaveBeenCalled();
    expect(mockRemoveTrack).not.toHaveBeenCalled();
  });

  describe("Playlists e seleção múltipla", () => {
    it("permite selecionar duas ou mais faixas e criar uma playlist", () => {
      vi.mocked(useJukebox).mockReturnValue(
        createMockJukebox({
          tracks: [
            { id: "track-1", title: "Tema A", addedBy: "u1", addedAt: "2026-11-01T00:00:00Z" },
            { id: "track-2", title: "Tema B", addedBy: "u1", addedAt: "2026-11-01T00:01:00Z" },
          ],
        }),
      );

      render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

      const checkboxes = screen.getAllByRole("checkbox", { name: "Selecionar faixa" });
      expect(checkboxes).toHaveLength(2);

      // Seleciona a primeira faixa (ainda não mostra barra de criação porque precisa de 2+)
      fireEvent.click(checkboxes[0]);
      expect(screen.queryByRole("button", { name: "Criar Playlist" })).not.toBeInTheDocument();

      // Seleciona a segunda faixa -> barra de criação deve aparecer
      fireEvent.click(checkboxes[1]);
      const createBtn = screen.getByRole("button", { name: "Criar Playlist" });
      expect(createBtn).toBeInTheDocument();
      expect(screen.getByText("2 faixas")).toBeInTheDocument();

      // Digita o nome da playlist e clica em Criar Playlist
      const nameInput = screen.getByPlaceholderText("Nome da Playlist...");
      fireEvent.change(nameInput, { target: { value: "Trilha Épica" } });
      fireEvent.click(createBtn);

      expect(mockCreatePlaylist).toHaveBeenCalledWith(["track-1", "track-2"], "Trilha Épica");
    });

    it("unifica faixas com mesmo playlistId em um card só com botões Anterior e Próximo", () => {
      vi.mocked(useJukebox).mockReturnValue(
        createMockJukebox({
          tracks: [
            {
              id: "track-1",
              title: "Música Um",
              addedBy: "u1",
              addedAt: "2026-11-01T00:00:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
            {
              id: "track-2",
              title: "Música Dois",
              addedBy: "u1",
              addedAt: "2026-11-01T00:01:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
          ],
        }),
      );

      render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

      // Deve renderizar apenas 1 card unificado de playlist
      const playlistCard = screen.getByTestId("jukebox-playlist-card-pl-1");
      expect(playlistCard).toBeInTheDocument();
      expect(screen.getByText("Batalha Épica")).toBeInTheDocument();
      expect(screen.getByText("1/2")).toBeInTheDocument();
      expect(screen.getByText("Música Um")).toBeInTheDocument();

      // Botões Anterior e Próximo
      const prevBtn = screen.getByRole("button", { name: "Anterior" });
      const nextBtn = screen.getByRole("button", { name: "Próximo" });
      expect(prevBtn).toBeInTheDocument();
      expect(nextBtn).toBeInTheDocument();

      // Clica em Próximo -> avança para a faixa 2
      fireEvent.click(nextBtn);
      expect(screen.getByText("2/2")).toBeInTheDocument();
      expect(screen.getByText("Música Dois")).toBeInTheDocument();

      // Clica em Anterior -> volta para a faixa 1
      fireEvent.click(prevBtn);
      expect(screen.getByText("1/2")).toBeInTheDocument();
      expect(screen.getByText("Música Um")).toBeInTheDocument();

      // Botão Desfazer Playlist chama ungroupPlaylist
      const ungroupBtn = screen.getByRole("button", { name: "Desfazer Playlist" });
      fireEvent.click(ungroupBtn);
      expect(mockUngroupPlaylist).toHaveBeenCalledWith("pl-1");
    });

    it("quando playlist está tocando, navegar com Próximo pausa a anterior e toca a próxima", () => {
      vi.mocked(useJukebox).mockReturnValue(
        createMockJukebox({
          tracks: [
            {
              id: "track-1",
              title: "Música Um",
              addedBy: "u1",
              addedAt: "2026-11-01T00:00:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
            {
              id: "track-2",
              title: "Música Dois",
              addedBy: "u1",
              addedAt: "2026-11-01T00:01:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
          ],
          playingTrackIds: new Set(["track-1"]),
          playingTrackId: "track-1",
          playingAt: Date.now(),
        }),
      );

      render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

      const nextBtn = screen.getByRole("button", { name: "Próximo" });
      fireEvent.click(nextBtn);

      // Deve ter pausado track-1 e iniciado track-2
      expect(mockTogglePlay).toHaveBeenCalledWith("track-1");
      expect(mockTogglePlay).toHaveBeenCalledWith("track-2");
    });

    it("reprodução sequencial em playlist avança para próxima faixa quando a atual termina", () => {
      vi.mocked(useJukebox).mockReturnValue(
        createMockJukebox({
          tracks: [
            {
              id: "track-1",
              title: "Música Um",
              addedBy: "u1",
              addedAt: "2026-11-01T00:00:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
            {
              id: "track-2",
              title: "Música Dois",
              addedBy: "u1",
              addedAt: "2026-11-01T00:01:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
          ],
          playingTrackIds: new Set(["track-1"]),
          playingTrackId: "track-1",
        }),
      );

      render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

      // Simula o término de track-1
      const endBtn1 = screen.getByTestId("simulate-end-track-1");
      fireEvent.click(endBtn1);

      // Deve ter pausado track-1 e iniciado track-2
      expect(mockTogglePlay).toHaveBeenCalledWith("track-1");
      expect(mockTogglePlay).toHaveBeenCalledWith("track-2");
    });

    it("quando a última faixa termina sem loop, a playlist encerra sem reiniciar", () => {
      vi.mocked(useJukebox).mockReturnValue(
        createMockJukebox({
          tracks: [
            {
              id: "track-1",
              title: "Música Um",
              addedBy: "u1",
              addedAt: "2026-11-01T00:00:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
            {
              id: "track-2",
              title: "Música Dois",
              addedBy: "u1",
              addedAt: "2026-11-01T00:01:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
          ],
          playingTrackIds: new Set(["track-2"]),
          playingTrackId: "track-2",
        }),
      );

      render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

      // Simula o término da última faixa (track-2) sem loop ativado
      const endBtn2 = screen.getByTestId("simulate-end-track-2");
      fireEvent.click(endBtn2);

      // Pausa track-2 e NÃO toca track-1
      expect(mockTogglePlay).toHaveBeenCalledWith("track-2");
      expect(mockTogglePlay).not.toHaveBeenCalledWith("track-1");
    });

    it("quando o botão de loop é ativado na playlist, volta para a primeira faixa ao terminar a última", () => {
      vi.mocked(useJukebox).mockReturnValue(
        createMockJukebox({
          tracks: [
            {
              id: "track-1",
              title: "Música Um",
              addedBy: "u1",
              addedAt: "2026-11-01T00:00:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
            {
              id: "track-2",
              title: "Música Dois",
              addedBy: "u1",
              addedAt: "2026-11-01T00:01:00Z",
              playlistId: "pl-1",
              playlistName: "Batalha Épica",
            },
          ],
          playingTrackIds: new Set(["track-2"]),
          playingTrackId: "track-2",
        }),
      );

      render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

      // Clica no botão Loop da playlist para ativar o loop
      const loopBtn = screen.getByRole("button", { name: "Loop" });
      fireEvent.click(loopBtn);

      // Verifica o título indicando que a repetição de playlist está ativa
      expect(loopBtn).toHaveAttribute(
        "title",
        "Repetição de playlist ativada (volta à primeira faixa ao terminar)",
      );

      // Simula o término da última faixa (track-2) com o loop ativado
      const endBtn2 = screen.getByTestId("simulate-end-track-2");
      fireEvent.click(endBtn2);

      // Pausa track-2 e inicia track-1 (volta ao início da playlist!)
      expect(mockTogglePlay).toHaveBeenCalledWith("track-2");
      expect(mockTogglePlay).toHaveBeenCalledWith("track-1");
    });
  });
});
