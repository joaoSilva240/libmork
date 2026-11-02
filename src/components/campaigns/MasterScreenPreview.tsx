type MasterScreenPreviewProps = {
  showRoster: boolean;
  showSessionLog: boolean;
  showCanvas: boolean;
  showMap: boolean;
  showJukebox?: boolean;
  showDiceRolls?: boolean;
  showCharactersNpcs?: boolean;
  showPlayers?: boolean;
};

/** A decorative, live representation of the Master's Screen layout. */
export function MasterScreenPreview({
  showRoster,
  showSessionLog,
  showCanvas,
  showMap,
  showJukebox = true,
  showDiceRolls = true,
  showCharactersNpcs = true,
  showPlayers = true,
}: MasterScreenPreviewProps) {
  return (
    <div
      role="img"
      aria-label="Preview do layout do Escudo do Mestre"
      className="rounded-lg border border-secondary-border bg-dominant-deep p-3"
    >
      <div
        className={`grid min-h-64 gap-2 transition-all duration-300 ${
          showSessionLog
            ? "grid-cols-[minmax(80px,1fr)_minmax(0,3fr)_minmax(72px,1.2fr)]"
            : "grid-cols-[minmax(80px,1fr)_minmax(0,4fr)]"
        }`}
      >
        {/* Coluna 1: Gestão & Áudio */}
        <div
          aria-hidden="true"
          className="flex flex-col gap-1.5 rounded-md border border-secondary-border bg-secondary-card p-1.5 text-center text-[10px] text-secondary-muted transition-all duration-300"
        >
          <span className="font-bold text-accent-hover block border-b border-secondary-border/50 pb-1">
            Gestão
          </span>
          {showJukebox && (
            <div className="flex h-7 items-center justify-center rounded border border-accent/30 bg-accent/10 text-[9px] text-accent-hover font-medium">
              🎵 Jukebox
            </div>
          )}
          {showCharactersNpcs && (
            <div className="flex h-7 items-center justify-center rounded border border-secondary-border bg-dominant-deep text-[9px] text-secondary-offwhite font-medium">
              👥 Personagens
            </div>
          )}
          {showPlayers && (
            <div className="flex h-7 items-center justify-center rounded border border-secondary-border bg-dominant-deep text-[9px] text-secondary-offwhite font-medium">
              🎲 Jogadores
            </div>
          )}
          {!showJukebox && !showCharactersNpcs && !showPlayers && (
            <div className="flex flex-1 items-center justify-center text-[9px] text-gray-500 italic">
              Vazio
            </div>
          )}
        </div>

        {/* Coluna 2: Mesa & Tático */}
        <div
          aria-hidden="true"
          className="flex min-w-0 flex-col gap-2 rounded-md border border-secondary-border bg-secondary-card p-2 transition-all duration-300"
        >
          <div className="flex items-center justify-between border-b border-secondary-border/50 pb-1 text-[10px]">
            <span className="font-bold text-secondary-pure">Mesa</span>
            {showDiceRolls && (
              <span className="rounded bg-accent/20 px-1 text-[9px] font-bold text-accent-hover">
                🎲 Rolagens
              </span>
            )}
          </div>

          <div
            className={`flex min-h-0 flex-1 items-center justify-center rounded border border-secondary-border px-1 text-center text-[10px] text-secondary-offwhite transition-all duration-300 ${
              showCanvas || showMap ? "bg-dominant-deep" : "bg-dominant-container text-secondary-muted"
            }`}
          >
            {showCanvas || showMap ? "Canvas/Mapa" : "Vazio"}
          </div>

          {showRoster && (
            <div className="flex h-10 items-center justify-center rounded border border-secondary-border bg-dominant-deep text-[10px] text-secondary-offwhite transition-all duration-300 font-medium">
              Roster
            </div>
          )}
        </div>

        {/* Coluna 3: Logs */}
        {showSessionLog && (
          <div
            aria-hidden="true"
            className="flex flex-col items-center justify-center rounded-md border border-secondary-border bg-secondary-card px-1 text-center text-[10px] text-secondary-muted transition-all duration-300"
          >
            <span className="font-bold text-accent-hover mb-1">Logs</span>
          </div>
        )}
      </div>
    </div>
  );
}
