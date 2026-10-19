import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { ThemeCustomizerDialogComponent } from './theme-customizer-dialog.component';
import { DEFAULT_THEME_CONFIG, ThemeService } from '../../core/services/theme/theme.service';

describe('ThemeCustomizerDialogComponent', () => {
  let component: ThemeCustomizerDialogComponent;
  let fixture: ComponentFixture<ThemeCustomizerDialogComponent>;
  let themeService: ThemeService;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ThemeCustomizerDialogComponent],
      providers: [ThemeService, { provide: MatDialogRef, useValue: dialogRefSpy }],
    }).compileComponents();

    themeService = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(ThemeCustomizerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the dialog component', () => {
    expect(component).toBeTruthy();
    expect(component.palettes.length).toBeGreaterThan(0);
    expect(component.fonts.length).toBe(5);
  });

  it('should switch mode when setMode is called', () => {
    component.setMode('dark');
    expect(themeService.mode()).toBe('dark');

    component.setMode('light');
    expect(themeService.mode()).toBe('light');

    component.setMode('system');
    expect(themeService.mode()).toBe('system');
  });

  it('should update primary, secondary, and tertiary palettes', () => {
    component.setPrimary('azure');
    expect(themeService.primaryPalette()).toBe('azure');

    component.setSecondary('rose');
    expect(themeService.secondaryPalette()).toBe('rose');

    component.setTertiary('spring-green');
    expect(themeService.tertiaryPalette()).toBe('spring-green');
  });

  it('should update font family', () => {
    component.setFont('caveat');
    expect(themeService.fontFamily()).toBe('caveat');

    component.setFont('roboto-mono');
    expect(themeService.fontFamily()).toBe('roboto-mono');
  });

  it('should reset to defaults when resetDefaults is called', () => {
    component.setMode('dark');
    component.setPrimary('cyan');
    component.setFont('pacifico');

    component.resetDefaults();

    expect(themeService.mode()).toBe(DEFAULT_THEME_CONFIG.mode);
    expect(themeService.primaryPalette()).toBe(DEFAULT_THEME_CONFIG.primaryPalette);
    expect(themeService.secondaryPalette()).toBe(DEFAULT_THEME_CONFIG.secondaryPalette);
    expect(themeService.tertiaryPalette()).toBe(DEFAULT_THEME_CONFIG.tertiaryPalette);
    expect(themeService.fontFamily()).toBe(DEFAULT_THEME_CONFIG.fontFamily);
  });

  it('should close dialog when close is called', () => {
    component.close();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });
});
