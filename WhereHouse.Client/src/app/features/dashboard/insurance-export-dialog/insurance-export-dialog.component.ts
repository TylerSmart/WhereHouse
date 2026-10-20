import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryDto } from '../../../core/models/category.models';
import {
  InsuranceClaimFilterParams,
  InsuranceClaimPreviewDto,
} from '../../../core/models/insurance.models';
import { LocationNodeDto } from '../../../core/models/location.models';
import { InsuranceService } from '../../../core/services/insurance/insurance.service';

export interface InsuranceExportDialogData {
  availableLocations: LocationNodeDto[];
  availableCategories: CategoryDto[];
}

@Component({
  imports: [
    FormsModule,
    CurrencyPipe,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './insurance-export-dialog.component.html',
  styleUrl: './insurance-export-dialog.component.scss',
})
export class InsuranceExportDialogComponent implements OnInit {
  protected readonly data = inject<InsuranceExportDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<InsuranceExportDialogComponent>);
  private readonly insuranceService = inject(InsuranceService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly loading = signal<boolean>(false);
  protected readonly exporting = signal<boolean>(false);
  protected readonly preview = signal<InsuranceClaimPreviewDto | null>(null);

  protected selectedLocationId: string | null = null;
  protected selectedCategoryId: string | null = null;
  protected minValue: number | null = null;
  protected includeSubtree = true;
  protected includeArchived = false;
  protected includeAttachments = true;

  ngOnInit(): void {
    this.loadPreview();
  }

  loadPreview(): void {
    this.loading.set(true);

    const params: InsuranceClaimFilterParams = {
      locationId: this.selectedLocationId,
      includeSubtree: this.includeSubtree,
      categoryId: this.selectedCategoryId,
      minValue: this.minValue,
      includeArchived: this.includeArchived,
      includeAttachments: this.includeAttachments,
    };

    this.insuranceService.getPreview(params).subscribe({
      next: (res) => {
        this.preview.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to load claim preview.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  downloadZip(): void {
    this.exporting.set(true);

    const params: InsuranceClaimFilterParams = {
      locationId: this.selectedLocationId,
      includeSubtree: this.includeSubtree,
      categoryId: this.selectedCategoryId,
      minValue: this.minValue,
      includeArchived: this.includeArchived,
      includeAttachments: this.includeAttachments,
    };

    this.insuranceService.exportZip(params).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `WhereHouse_Insurance_Claim_${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
        this.snackBar.open('Insurance claim ZIP downloaded successfully!', 'Close', {
          duration: 3500,
        });
      },
      error: (err) => {
        this.exporting.set(false);
        this.snackBar.open(
          err?.error?.detail || 'Failed to export insurance claim package.',
          'Close',
          {
            duration: 4000,
          },
        );
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
