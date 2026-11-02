"use client";

import { useDice3DPreference } from "@/hooks/useDice3DPreference";
import { showDice3D } from "@/lib/dice3d";

export function Dice3DSettingsPanel() {
  const [enabled, setEnabled] = useDice3DPreference();

  return (
    <section
      className="rounded-lg border border-secondary-border bg-secondary-card p-5 space-y-4"
      data-testid="dice3d-settings"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <span className="text-xl" aria-hidden="true">🎲</span>
          <div>
            <h2 id="dice3d-settings-title" className="text-base font-bold text-secondary-pure">
              Dados 3D
            </h2>
            <p className="text-xs text-secondary-muted">
              Mostra os dados rolando com física na sua tela, nas cores do tema atual. Apenas você vê a
              animação; os resultados não mudam. Desligue para economizar desempenho.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="dice3d-settings-title"
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-secondary-border transition ${
            enabled ? "bg-accent" : "bg-dominant-deep"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-secondary-pure shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <button
        type="button"
        disabled={!enabled}
        onClick={() => showDice3D([{ sides: 20, value: 20 }, { sides: 6, value: 6 }])}
        className="rounded-md border border-secondary-border px-3 py-1.5 text-xs font-semibold text-secondary-pure transition hover:border-accent disabled:opacity-40"
      >
        Testar dados
      </button>
    </section>
  );
}
