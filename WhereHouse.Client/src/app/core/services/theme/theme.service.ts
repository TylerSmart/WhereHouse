import { Service, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import type { ThemeCustomizerDialogComponent } from '../../../features/theme-customizer-dialog/theme-customizer-dialog.component';
import {
  COLOR_PALETTES,
  COLOR_PALETTES_MAP,
  ColorPalette,
  DEFAULT_THEME_CONFIG,
  FONT_OPTIONS,
  FONT_OPTIONS_MAP,
  FontOption,
  ResolvedTheme,
  ThemeConfig,
  ThemeMode,
} from './theme.models';

export type { ThemeMode, ResolvedTheme, ColorPalette, FontOption, ThemeConfig };
export { DEFAULT_THEME_CONFIG, COLOR_PALETTES, COLOR_PALETTES_MAP, FONT_OPTIONS, FONT_OPTIONS_MAP };

const STORAGE_KEY = 'where-house-theme';
const STORAGE_CONFIG_KEY = 'where-house-theme-config';

@Service()
export class ThemeService {
  private readonly mediaQuery: MediaQueryList | null =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  private readonly dialog = inject(MatDialog, { optional: true });

  private readonly systemDarkState = signal<boolean>(this.mediaQuery?.matches ?? false);
  private readonly configState = signal<ThemeConfig>(this.readStoredConfig());

  readonly mode = computed<ThemeMode>(() => this.configState().mode);
  readonly primaryPalette = computed<string>(() => this.configState().primaryPalette);
  readonly secondaryPalette = computed<string>(() => this.configState().secondaryPalette);
  readonly tertiaryPalette = computed<string>(() => this.configState().tertiaryPalette);
  readonly fontFamily = computed<string>(() => this.configState().fontFamily);

  readonly primaryPaletteDef = computed<ColorPalette>(
    () =>
      COLOR_PALETTES_MAP[this.primaryPalette()] ??
      COLOR_PALETTES_MAP[DEFAULT_THEME_CONFIG.primaryPalette],
  );
  readonly secondaryPaletteDef = computed<ColorPalette>(
    () =>
      COLOR_PALETTES_MAP[this.secondaryPalette()] ??
      COLOR_PALETTES_MAP[DEFAULT_THEME_CONFIG.secondaryPalette],
  );
  readonly tertiaryPaletteDef = computed<ColorPalette>(
    () =>
      COLOR_PALETTES_MAP[this.tertiaryPalette()] ??
      COLOR_PALETTES_MAP[DEFAULT_THEME_CONFIG.tertiaryPalette],
  );
  readonly fontFamilyDef = computed<FontOption>(
    () => FONT_OPTIONS_MAP[this.fontFamily()] ?? FONT_OPTIONS_MAP[DEFAULT_THEME_CONFIG.fontFamily],
  );

  readonly systemDark = this.systemDarkState.asReadonly();

  readonly effectiveTheme = computed<ResolvedTheme>(() => {
    const currentMode = this.configState().mode;
    if (currentMode === 'system') {
      return this.systemDarkState() ? 'dark' : 'light';
    }
    return currentMode;
  });

  readonly isDark = computed<boolean>(() => this.effectiveTheme() === 'dark');

  constructor() {
    if (this.mediaQuery) {
      this.mediaQuery.addEventListener('change', (event: MediaQueryListEvent) => {
        this.systemDarkState.set(event.matches);
        if (this.configState().mode === 'system') {
          this.applyTheme(this.effectiveTheme());
        }
      });
    }

    this.applyMode(this.configState().mode);
    this.applyTheme(this.effectiveTheme());
  }

  setMode(mode: ThemeMode): void {
    this.updateConfig({ mode });
  }

  setPrimaryPalette(primaryPalette: string): void {
    if (COLOR_PALETTES_MAP[primaryPalette]) {
      this.updateConfig({ primaryPalette });
    }
  }

  setSecondaryPalette(secondaryPalette: string): void {
    if (COLOR_PALETTES_MAP[secondaryPalette]) {
      this.updateConfig({ secondaryPalette });
    }
  }

  setTertiaryPalette(tertiaryPalette: string): void {
    if (COLOR_PALETTES_MAP[tertiaryPalette]) {
      this.updateConfig({ tertiaryPalette });
    }
  }

  setFontFamily(fontFamily: string): void {
    if (FONT_OPTIONS_MAP[fontFamily]) {
      this.updateConfig({ fontFamily });
    }
  }

  resetDefaults(): void {
    this.setConfig(DEFAULT_THEME_CONFIG);
  }

  async openThemeSettingsDialog(): Promise<
    MatDialogRef<ThemeCustomizerDialogComponent> | undefined
  > {
    if (!this.dialog) {
      return undefined;
    }
    const { ThemeCustomizerDialogComponent } =
      await import('../../../features/theme-customizer-dialog/theme-customizer-dialog.component');
    return this.dialog.open(ThemeCustomizerDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      panelClass: 'theme-customizer-dialog-panel',
      autoFocus: false,
    });
  }

  private updateConfig(partial: Partial<ThemeConfig>): void {
    const current = this.configState();
    const next: ThemeConfig = { ...current, ...partial };
    this.setConfig(next);
  }

  private setConfig(next: ThemeConfig): void {
    this.configState.set(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(next));
      localStorage.setItem(STORAGE_KEY, next.mode);
    }
    this.applyMode(next.mode);
    this.applyTheme(this.effectiveTheme());
  }

  private readStoredConfig(): ThemeConfig {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_THEME_CONFIG };
    }

    const configRaw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (configRaw) {
      try {
        const parsed = JSON.parse(configRaw) as Partial<ThemeConfig>;
        return {
          mode:
            parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'system'
              ? parsed.mode
              : DEFAULT_THEME_CONFIG.mode,
          primaryPalette:
            parsed.primaryPalette && COLOR_PALETTES_MAP[parsed.primaryPalette]
              ? parsed.primaryPalette
              : DEFAULT_THEME_CONFIG.primaryPalette,
          secondaryPalette:
            parsed.secondaryPalette && COLOR_PALETTES_MAP[parsed.secondaryPalette]
              ? parsed.secondaryPalette
              : DEFAULT_THEME_CONFIG.secondaryPalette,
          tertiaryPalette:
            parsed.tertiaryPalette && COLOR_PALETTES_MAP[parsed.tertiaryPalette]
              ? parsed.tertiaryPalette
              : DEFAULT_THEME_CONFIG.tertiaryPalette,
          fontFamily:
            parsed.fontFamily && FONT_OPTIONS_MAP[parsed.fontFamily]
              ? parsed.fontFamily
              : DEFAULT_THEME_CONFIG.fontFamily,
        };
      } catch {
        // Fall back to legacy if json parse fails
      }
    }

    const legacy = localStorage.getItem(STORAGE_KEY);
    const mode: ThemeMode =
      legacy === 'light' || legacy === 'dark' ? legacy : DEFAULT_THEME_CONFIG.mode;
    return {
      ...DEFAULT_THEME_CONFIG,
      mode,
    };
  }

  private applyMode(mode: ThemeMode): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', mode);
    }
  }

  private applyTheme(theme: ResolvedTheme): void {
    if (typeof document === 'undefined') {
      return;
    }

    const rootStyle = document.documentElement.style;
    rootStyle.colorScheme = theme;

    const primaryTones = this.primaryPaletteDef().tones;
    const secondaryTones = this.secondaryPaletteDef().tones;
    const tertiaryTones = this.tertiaryPaletteDef().tones;
    const font = this.fontFamilyDef();

    if (theme === 'light') {
      // Primary
      rootStyle.setProperty('--mat-sys-primary', primaryTones[40]);
      rootStyle.setProperty('--mat-sys-on-primary', primaryTones[100]);
      rootStyle.setProperty('--mat-sys-primary-container', primaryTones[90]);
      rootStyle.setProperty('--mat-sys-on-primary-container', primaryTones[10]);
      rootStyle.setProperty('--mat-sys-inverse-primary', primaryTones[80]);
      rootStyle.setProperty('--mat-sys-surface-tint', primaryTones[40]);
      rootStyle.setProperty('--mat-sys-primary-fixed', primaryTones[90]);
      rootStyle.setProperty('--mat-sys-primary-fixed-dim', primaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-primary-fixed', primaryTones[10]);
      rootStyle.setProperty('--mat-sys-on-primary-fixed-variant', primaryTones[30]);

      // Secondary
      rootStyle.setProperty('--mat-sys-secondary', secondaryTones[40]);
      rootStyle.setProperty('--mat-sys-on-secondary', secondaryTones[100]);
      rootStyle.setProperty('--mat-sys-secondary-container', secondaryTones[90]);
      rootStyle.setProperty('--mat-sys-on-secondary-container', secondaryTones[10]);
      rootStyle.setProperty('--mat-sys-secondary-fixed', secondaryTones[90]);
      rootStyle.setProperty('--mat-sys-secondary-fixed-dim', secondaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-secondary-fixed', secondaryTones[10]);
      rootStyle.setProperty('--mat-sys-on-secondary-fixed-variant', secondaryTones[30]);

      // Tertiary
      rootStyle.setProperty('--mat-sys-tertiary', tertiaryTones[40]);
      rootStyle.setProperty('--mat-sys-on-tertiary', tertiaryTones[100]);
      rootStyle.setProperty('--mat-sys-tertiary-container', tertiaryTones[90]);
      rootStyle.setProperty('--mat-sys-on-tertiary-container', tertiaryTones[10]);
      rootStyle.setProperty('--mat-sys-tertiary-fixed', tertiaryTones[90]);
      rootStyle.setProperty('--mat-sys-tertiary-fixed-dim', tertiaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-tertiary-fixed', tertiaryTones[10]);
      rootStyle.setProperty('--mat-sys-on-tertiary-fixed-variant', tertiaryTones[30]);
    } else {
      // Dark theme
      // Primary
      rootStyle.setProperty('--mat-sys-primary', primaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-primary', primaryTones[20]);
      rootStyle.setProperty('--mat-sys-primary-container', primaryTones[30]);
      rootStyle.setProperty('--mat-sys-on-primary-container', primaryTones[90]);
      rootStyle.setProperty('--mat-sys-inverse-primary', primaryTones[40]);
      rootStyle.setProperty('--mat-sys-surface-tint', primaryTones[80]);
      rootStyle.setProperty('--mat-sys-primary-fixed', primaryTones[90]);
      rootStyle.setProperty('--mat-sys-primary-fixed-dim', primaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-primary-fixed', primaryTones[10]);
      rootStyle.setProperty('--mat-sys-on-primary-fixed-variant', primaryTones[30]);

      // Secondary
      rootStyle.setProperty('--mat-sys-secondary', secondaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-secondary', secondaryTones[20]);
      rootStyle.setProperty('--mat-sys-secondary-container', secondaryTones[30]);
      rootStyle.setProperty('--mat-sys-on-secondary-container', secondaryTones[90]);
      rootStyle.setProperty('--mat-sys-secondary-fixed', secondaryTones[90]);
      rootStyle.setProperty('--mat-sys-secondary-fixed-dim', secondaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-secondary-fixed', secondaryTones[10]);
      rootStyle.setProperty('--mat-sys-on-secondary-fixed-variant', secondaryTones[30]);

      // Tertiary
      rootStyle.setProperty('--mat-sys-tertiary', tertiaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-tertiary', tertiaryTones[20]);
      rootStyle.setProperty('--mat-sys-tertiary-container', tertiaryTones[30]);
      rootStyle.setProperty('--mat-sys-on-tertiary-container', tertiaryTones[90]);
      rootStyle.setProperty('--mat-sys-tertiary-fixed', tertiaryTones[90]);
      rootStyle.setProperty('--mat-sys-tertiary-fixed-dim', tertiaryTones[80]);
      rootStyle.setProperty('--mat-sys-on-tertiary-fixed', tertiaryTones[10]);
      rootStyle.setProperty('--mat-sys-on-tertiary-fixed-variant', tertiaryTones[30]);
    }

    // Typography & Font
    rootStyle.setProperty('--app-font-family', font.fontFamily);
    rootStyle.setProperty('--mat-sys-body-large-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-body-medium-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-body-small-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-display-large-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-display-medium-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-display-small-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-headline-large-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-headline-medium-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-headline-small-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-title-large-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-title-medium-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-title-small-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-label-large-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-label-medium-font', font.fontFamily);
    rootStyle.setProperty('--mat-sys-label-small-font', font.fontFamily);
  }
}
