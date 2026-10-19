import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import {
  COLOR_PALETTES,
  FONT_OPTIONS,
  ThemeMode,
  ThemeService,
} from '../../core/services/theme/theme.service';

@Component({
  selector: 'app-theme-customizer-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTabsModule,
  ],
  templateUrl: './theme-customizer-dialog.component.html',
  styleUrls: ['./theme-customizer-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeCustomizerDialogComponent {
  readonly themeService = inject(ThemeService);
  private readonly dialogRef = inject(MatDialogRef<ThemeCustomizerDialogComponent>);

  readonly palettes = COLOR_PALETTES;
  readonly fonts = FONT_OPTIONS;

  setMode(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }

  setPrimary(id: string): void {
    this.themeService.setPrimaryPalette(id);
  }

  setSecondary(id: string): void {
    this.themeService.setSecondaryPalette(id);
  }

  setTertiary(id: string): void {
    this.themeService.setTertiaryPalette(id);
  }

  setFont(id: string): void {
    this.themeService.setFontFamily(id);
  }

  resetDefaults(): void {
    this.themeService.resetDefaults();
  }

  close(): void {
    this.dialogRef.close();
  }
}
