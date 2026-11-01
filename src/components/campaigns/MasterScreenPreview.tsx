type MasterScreenPreviewProps = {
  showRoster: boolean;
  showSessionLog: boolean;
  showCanvas: boolean;
  showMap: boolean;
};

/** A decorative, live representation of the Master's Screen layout. */
export function MasterScreenPreview({
  showRoster,
  showSessionLog,
  showCanvas,
  showMap,
}: MasterScreenPreviewProps) {
  return (
    <div
      role="img"
      aria-label="Preview do layout do Escudo do Mestre"
      className="rounded-lg border border-gray-800 bg-gray-950 p-3"
    >
      <div
        className={`grid min-h-64 gap-2 transition-all duration-300 ${
          showSessionLog
            ? "grid-cols-[minmax(56px,0.7fr)_minmax(0,3fr)_minmax(72px,1.2fr)]"
            : "grid-cols-[minmax(56px,0.7fr)_minmax(0,4fr)]"
        }`}
      >
        <div
          aria-hidden="true"
          className="flex items-center justify-center rounded-md border border-gray-700 bg-gray-900 px-1 text-center text-[10px] text-gray-400 transition-all duration-300"
        >
          Gestão
        </div>

        <div
          aria-hidden="true"
          className="flex min-w-0 flex-col gap-2 rounded-md border border-gray-700 bg-gray-900 p-2 transition-all duration-300"
        >
          <div
            className={`flex min-h-0 flex-1 items-center justify-center rounded border border-gray-800 px-1 text-center text-[10px] text-gray-300 transition-all duration-300 ${
              showCanvas || showMap ? "bg-gray-800" : "bg-gray-950 text-gray-600"
            }`}
          >
            {showCanvas || showMap ? "Canvas/Mapa" : "Vazio"}
          </div>
          {showRoster && (
            <div className="flex h-12 items-center justify-center rounded border border-gray-800 bg-gray-800/80 text-[10px] text-gray-300 transition-all duration-300">
              Roster
            </div>
          )}
        </div>

        {showSessionLog && (
          <div
            aria-hidden="true"
            className="flex items-center justify-center rounded-md border border-gray-700 bg-gray-900 px-1 text-center text-[10px] text-gray-400 transition-all duration-300"
          >
            Logs
          </div>
        )}
      </div>
    </div>
  );
}
