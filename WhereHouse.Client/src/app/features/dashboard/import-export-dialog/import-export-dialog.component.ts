import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CsvImportRequest,
  ImportResultDto,
  ImportRowAction,
  ImportRowActions,
  JsonImportRequest,
  PortabilityEntityType,
  PortabilityEntityTypes,
} from '../../../core/models/intake-portability.models';
import { IntakePortabilityService } from '../../../core/services/intake-portability/intake-portability.service';

export interface ImportExportDialogResult {
  imported: boolean;
}

interface TargetFieldDef {
  key: string;
  label: string;
  required?: boolean;
}

const ITEM_TARGET_FIELDS: TargetFieldDef[] = [
  { key: 'Name', label: 'Item Name', required: true },
  { key: 'ShortCode', label: 'Item Short Code' },
  { key: 'HomeLocationShortCode', label: 'Home Location Code' },
  { key: 'CategoryName', label: 'Category' },
  { key: 'ItemType', label: 'Item Archetype' },
  { key: 'CurrentQuantity', label: 'Quantity' },
  { key: 'Unit', label: 'Unit' },
  { key: 'Brand', label: 'Brand' },
  { key: 'ModelNumber', label: 'Model #' },
  { key: 'SerialNumber', label: 'Serial #' },
  { key: 'BarcodeNumber', label: 'Retail Barcode (UPC)' },
  { key: 'PurchasePrice', label: 'Purchase Price' },
  { key: 'Tags', label: 'Tags' },
  { key: 'Description', label: 'Description / Notes' },
];

const LOCATION_TARGET_FIELDS: TargetFieldDef[] = [
  { key: 'Name', label: 'Location Name', required: true },
  { key: 'ShortCode', label: 'Short Code' },
  { key: 'ParentShortCode', label: 'Parent Short Code' },
  { key: 'NodeType', label: 'Node Type' },
  { key: 'ContainerStyle', label: 'Container Style' },
  { key: 'ColorLabel', label: 'Color Label' },
  { key: 'Description', label: 'Description' },
];

const CATEGORY_TARGET_FIELDS: TargetFieldDef[] = [
  { key: 'Name', label: 'Category Name', required: true },
  { key: 'Description', label: 'Description' },
  { key: 'Icon', label: 'Icon' },
];

@Component({
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  selector: 'app-import-export-dialog',
  templateUrl: './import-export-dialog.component.html',
  styleUrl: './import-export-dialog.component.scss',
})
export class ImportExportDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<ImportExportDialogComponent, ImportExportDialogResult>>(MatDialogRef);
  private readonly intakeService = inject(IntakePortabilityService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly PortabilityEntityTypes = PortabilityEntityTypes;
  protected readonly ImportRowActions = ImportRowActions;

  // State
  protected readonly isLoading = signal<boolean>(false);
  protected readonly hasImported = signal<boolean>(false);

  // Import configuration
  protected readonly importFormat = signal<'csv' | 'json'>('csv');
  protected readonly selectedEntityType = signal<PortabilityEntityType>(
    PortabilityEntityTypes.Items,
  );
  protected readonly updateExisting = signal<boolean>(true);
  protected readonly selectedFileName = signal<string | null>(null);
  protected readonly rawContent = signal<string>('');
  protected readonly detectedHeaders = signal<string[]>([]);
  protected readonly columnMapping = signal<Record<string, string>>({});

  // Preview Result
  protected readonly previewResult = signal<ImportResultDto | null>(null);

  protected readonly activeTargetFields = computed(() => {
    switch (this.selectedEntityType()) {
      case PortabilityEntityTypes.Locations:
        return LOCATION_TARGET_FIELDS;
      case PortabilityEntityTypes.Categories:
        return CATEGORY_TARGET_FIELDS;
      default:
        return ITEM_TARGET_FIELDS;
    }
  });

  protected readonly hasContent = computed(() => this.rawContent().trim().length > 0);

  protected readonly canCommit = computed(() => {
    const res = this.previewResult();
    return res !== null && res.dryRun && res.errorCount === 0 && res.totalRowsProcessed > 0;
  });

  onFormatChange(format: 'csv' | 'json'): void {
    this.importFormat.set(format);
    this.previewResult.set(null);
  }

  onEntityTypeChange(entityType: PortabilityEntityType): void {
    this.selectedEntityType.set(entityType);
    this.previewResult.set(null);
    this.autoMatchColumns(this.detectedHeaders());
  }

  onRawContentChange(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.rawContent.set(text);
    this.previewResult.set(null);
    if (this.importFormat() === 'csv') {
      this.parseCsvHeaders(text);
    }
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    this.selectedFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      this.rawContent.set(text);
      this.previewResult.set(null);
      if (this.importFormat() === 'csv') {
        this.parseCsvHeaders(text);
      }
    };
    reader.readAsText(file);
  }

  private parseCsvHeaders(csv: string): void {
    const firstLine = csv.split(/\r\n|\n|\r/)[0];
    if (!firstLine) {
      this.detectedHeaders.set([]);
      return;
    }

    // Split headers on comma handling quotes
    const headers = firstLine
      .split(',')
      .map((h) => h.replace(/^["']|["']$/g, '').trim())
      .filter((h) => h.length > 0);

    this.detectedHeaders.set(headers);
    this.autoMatchColumns(headers);
  }

  private autoMatchColumns(headers: string[]): void {
    const mapping: Record<string, string> = {};
    const targets = this.activeTargetFields();

    for (const target of targets) {
      const normalizedTarget = target.key.toLowerCase().replace(/[^a-z]/g, '');
      const match = headers.find((h) => {
        const normHeader = h.toLowerCase().replace(/[^a-z]/g, '');
        return normHeader === normalizedTarget;
      });
      if (match) {
        mapping[target.key] = match;
      }
    }

    this.columnMapping.set(mapping);
  }

  onMapColumn(targetKey: string, csvHeader: string): void {
    this.columnMapping.update((current) => {
      const updated = { ...current };
      if (!csvHeader) {
        delete updated[targetKey];
      } else {
        updated[targetKey] = csvHeader;
      }
      return updated;
    });
  }

  onExportJson(): void {
    this.isLoading.set(true);
    this.intakeService.exportJsonBundle().subscribe({
      next: (bundle) => {
        this.isLoading.set(false);
        const json = JSON.stringify(bundle, null, 2);
        this.downloadFile(
          json,
          `wherehouse-backup-${new Date().toISOString().slice(0, 10)}.json`,
          'application/json',
        );
        this.snackBar.open('JSON backup exported successfully.', 'OK', { duration: 3000 });
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to export JSON bundle.', 'Dismiss', { duration: 3000 });
      },
    });
  }

  onExportCsv(entityType: PortabilityEntityType): void {
    this.isLoading.set(true);
    const entityName =
      entityType === PortabilityEntityTypes.Items
        ? 'items'
        : entityType === PortabilityEntityTypes.Locations
          ? 'locations'
          : 'categories';

    this.intakeService.exportCsv(entityType).subscribe({
      next: (csv) => {
        this.isLoading.set(false);
        this.downloadFile(
          csv,
          `wherehouse-${entityName}-${new Date().toISOString().slice(0, 10)}.csv`,
          'text/csv;charset=utf-8;',
        );
        this.snackBar.open(`Exported ${entityName} CSV successfully.`, 'OK', { duration: 3000 });
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open(`Failed to export ${entityName} CSV.`, 'Dismiss', { duration: 3000 });
      },
    });
  }

  onRunDryRun(): void {
    this.executeImport(true);
  }

  onCommitImport(): void {
    this.executeImport(false);
  }

  private executeImport(dryRun: boolean): void {
    const content = this.rawContent().trim();
    if (!content) {
      return;
    }

    this.isLoading.set(true);

    if (this.importFormat() === 'json') {
      const req: JsonImportRequest = {
        jsonContent: content,
        dryRun,
        updateExisting: this.updateExisting(),
      };

      this.intakeService.importJsonBundle(req).subscribe({
        next: (res) => this.handleImportResult(res, dryRun),
        error: (err) => this.handleImportError(err),
      });
    } else {
      const req: CsvImportRequest = {
        entityType: this.selectedEntityType(),
        csvContent: content,
        dryRun,
        updateExisting: this.updateExisting(),
        columnMapping: Object.keys(this.columnMapping()).length > 0 ? this.columnMapping() : null,
      };

      this.intakeService.importCsv(req).subscribe({
        next: (res) => this.handleImportResult(res, dryRun),
        error: (err) => this.handleImportError(err),
      });
    }
  }

  private handleImportResult(res: ImportResultDto, dryRun: boolean): void {
    this.isLoading.set(false);
    this.previewResult.set(res);

    if (!dryRun) {
      this.hasImported.set(true);
      this.snackBar.open(
        `Import committed: ${res.createdCount} created, ${res.updatedCount} updated.`,
        'OK',
        { duration: 4000 },
      );
    } else {
      if (res.errorCount > 0) {
        this.snackBar.open(
          `Dry run completed with ${res.errorCount} error(s). Review table below.`,
          'Dismiss',
          { duration: 4000 },
        );
      } else {
        this.snackBar.open(
          `Dry run valid: ${res.createdCount} to create, ${res.updatedCount} to update.`,
          'Ready to Commit',
          { duration: 3000 },
        );
      }
    }
  }

  private handleImportError(err: { error?: { detail?: string; title?: string } }): void {
    this.isLoading.set(false);
    const msg = err?.error?.detail || err?.error?.title || 'Import request failed.';
    this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
  }

  private downloadFile(data: string, fileName: string, mimeType: string): void {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  getActionLabel(action: ImportRowAction): string {
    switch (action) {
      case ImportRowActions.Create:
        return 'Create';
      case ImportRowActions.Update:
        return 'Update';
      case ImportRowActions.Skip:
        return 'Skip';
      case ImportRowActions.Error:
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  getActionClass(action: ImportRowAction): string {
    switch (action) {
      case ImportRowActions.Create:
        return 'action-create';
      case ImportRowActions.Update:
        return 'action-update';
      case ImportRowActions.Skip:
        return 'action-skip';
      case ImportRowActions.Error:
        return 'action-error';
      default:
        return '';
    }
  }

  onClose(): void {
    this.dialogRef.close({ imported: this.hasImported() });
  }
}
