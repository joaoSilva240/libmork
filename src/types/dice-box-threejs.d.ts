declare module "@3d-dice/dice-box-threejs" {
  export interface DiceBoxColorset {
    name: string;
    foreground: string;
    background: string;
    outline?: string;
    texture?: string;
    material?: "none" | "metal" | "wood" | "glass" | "plastic";
  }

  export interface DiceBoxConfig {
    assetPath?: string;
    framerate?: number;
    sounds?: boolean;
    volume?: number;
    color_spotlight?: number;
    shadows?: boolean;
    theme_surface?: string;
    sound_dieMaterial?: string;
    theme_customColorset?: DiceBoxColorset | null;
    theme_colorset?: string;
    theme_texture?: string;
    theme_material?: string;
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    strength?: number;
    iterationLimit?: number;
    onRollComplete?: (results: unknown) => void;
  }

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig);
    initialize(): Promise<void>;
    roll(notation: string): Promise<unknown>;
    clearDice(): void;
    updateConfig(config: DiceBoxConfig): Promise<void>;
  }
}
