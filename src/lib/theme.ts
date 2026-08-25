export type ThemeName = 'default-dark';

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  colors: {
    dominant: {
      pure: string;
      deep: string;
      dark: string;
      container: string;
      border: string;
    };
    secondary: {
      pure: string;
      offwhite: string;
      muted: string;
      border: string;
      card: string;
    };
    accent: {
      primary: string;
      vibrant: string;
      hover: string;
      dark: string;
      glow: string;
    };
  };
}

export const themes: Record<ThemeName, ThemeConfig> = {
  'default-dark': {
    name: 'default-dark',
    label: 'Roxo Dark (Padrão)',
    colors: {
      dominant: {
        pure: '#000000',
        deep: '#09090b',
        dark: '#121217',
        container: '#1a1a24',
        border: '#272730',
      },
      secondary: {
        pure: '#ffffff',
        offwhite: '#f4f4f7',
        muted: '#a1a1aa',
        border: '#3f3f4e',
        card: '#1c1c26',
      },
      accent: {
        primary: '#9333ea',
        vibrant: '#a855f7',
        hover: '#c084fc',
        dark: '#7e22ce',
        glow: 'rgba(147, 51, 234, 0.15)',
      },
    },
  },
};

export const DEFAULT_THEME: ThemeName = 'default-dark';

export function setTheme(themeName: ThemeName): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', themeName);
  }
}

export function getCurrentTheme(): ThemeName {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.getAttribute('data-theme') as ThemeName;
    if (current && themes[current]) {
      return current;
    }
  }
  return DEFAULT_THEME;
}
