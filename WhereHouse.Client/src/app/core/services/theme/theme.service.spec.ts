import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { DEFAULT_THEME_CONFIG, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let dialogSpy: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    dialogSpy = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [ThemeService, { provide: MatDialog, useValue: dialogSpy }],
    });
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('should initialize with system mode when no preference stored', () => {
    expect(service.mode()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
    expect(service.primaryPalette()).toBe(DEFAULT_THEME_CONFIG.primaryPalette);
    expect(service.secondaryPalette()).toBe(DEFAULT_THEME_CONFIG.secondaryPalette);
    expect(service.tertiaryPalette()).toBe(DEFAULT_THEME_CONFIG.tertiaryPalette);
    expect(service.fontFamily()).toBe(DEFAULT_THEME_CONFIG.fontFamily);
  });

  it('should update mode and persist to localStorage on setMode', () => {
    service.setMode('dark');
    expect(service.mode()).toBe('dark');
    expect(localStorage.getItem('where-house-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(service.effectiveTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);

    service.setMode('light');
    expect(service.mode()).toBe('light');
    expect(localStorage.getItem('where-house-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(service.effectiveTheme()).toBe('light');
    expect(service.isDark()).toBe(false);
  });

  it('should restore stored mode from legacy localStorage key', () => {
    localStorage.setItem('where-house-theme', 'dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
    const restoredService = TestBed.inject(ThemeService);
    expect(restoredService.mode()).toBe('dark');
    expect(restoredService.effectiveTheme()).toBe('dark');
  });

  it('should update primary, secondary, and tertiary palettes and set CSS variables', () => {
    service.setPrimaryPalette('azure');
    expect(service.primaryPalette()).toBe('azure');
    expect(service.primaryPaletteDef().name).toBe('Azure');

    service.setSecondaryPalette('rose');
    expect(service.secondaryPalette()).toBe('rose');
    expect(service.secondaryPaletteDef().name).toBe('Rose');

    service.setTertiaryPalette('chartreuse');
    expect(service.tertiaryPalette()).toBe('chartreuse');
    expect(service.tertiaryPaletteDef().name).toBe('Chartreuse');

    expect(document.documentElement.style.getPropertyValue('--mat-sys-primary')).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--mat-sys-secondary')).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--mat-sys-tertiary')).toBeTruthy();
  });

  it('should ignore invalid palette ids', () => {
    const original = service.primaryPalette();
    service.setPrimaryPalette('non-existent-palette');
    expect(service.primaryPalette()).toBe(original);
  });

  it('should update font family and set font CSS variables', () => {
    service.setFontFamily('caveat');
    expect(service.fontFamily()).toBe('caveat');
    expect(service.fontFamilyDef().label).toBe('Caveat');
    expect(document.documentElement.style.getPropertyValue('--app-font-family')).toContain(
      'Caveat',
    );

    service.setFontFamily('roboto-mono');
    expect(service.fontFamily()).toBe('roboto-mono');
    expect(document.documentElement.style.getPropertyValue('--app-font-family')).toContain(
      'Roboto Mono',
    );
  });

  it('should ignore invalid font ids', () => {
    const original = service.fontFamily();
    service.setFontFamily('comic-sans');
    expect(service.fontFamily()).toBe(original);
  });

  it('should reset defaults properly', () => {
    service.setMode('dark');
    service.setPrimaryPalette('green');
    service.setSecondaryPalette('yellow');
    service.setTertiaryPalette('magenta');
    service.setFontFamily('pacifico');

    service.resetDefaults();

    expect(service.mode()).toBe(DEFAULT_THEME_CONFIG.mode);
    expect(service.primaryPalette()).toBe(DEFAULT_THEME_CONFIG.primaryPalette);
    expect(service.secondaryPalette()).toBe(DEFAULT_THEME_CONFIG.secondaryPalette);
    expect(service.tertiaryPalette()).toBe(DEFAULT_THEME_CONFIG.tertiaryPalette);
    expect(service.fontFamily()).toBe(DEFAULT_THEME_CONFIG.fontFamily);
  });

  it('should restore full config from where-house-theme-config in localStorage', () => {
    const customConfig = {
      mode: 'dark',
      primaryPalette: 'blue',
      secondaryPalette: 'orange',
      tertiaryPalette: 'red',
      fontFamily: 'share-tech',
    };
    localStorage.setItem('where-house-theme-config', JSON.stringify(customConfig));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
    const restoredService = TestBed.inject(ThemeService);

    expect(restoredService.mode()).toBe('dark');
    expect(restoredService.primaryPalette()).toBe('blue');
    expect(restoredService.secondaryPalette()).toBe('orange');
    expect(restoredService.tertiaryPalette()).toBe('red');
    expect(restoredService.fontFamily()).toBe('share-tech');
  });

  it('should open theme settings dialog when openThemeSettingsDialog is called', async () => {
    await service.openThemeSettingsDialog();
    expect(dialogSpy.open).toHaveBeenCalled();
  });
});
