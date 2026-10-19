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
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="title-icon">import_export</mat-icon>
      <div class="title-text">
        <span>Inventory Data Portability</span>
        <span class="subtitle">Bulk import &amp; round-trip export (CSV &amp; JSON)</span>
      </div>
    </h2>

    <mat-dialog-content class="portability-content">
      @if (isLoading()) {
        <mat-progress-bar mode="indeterminate" class="loading-bar"></mat-progress-bar>
      }

      <mat-tab-group animationDuration="150ms">
        <!-- Tab 1: Export Inventory -->
        <mat-tab label="Export Inventory">
          <div class="tab-pane">
            <p class="tab-intro">
              Export your inventory, locations, or categories for backup, offline spreadsheets, or
              migration.
            </p>

            <div class="export-cards-grid">
              <div class="export-card primary-card">
                <div class="card-header">
                  <mat-icon>folder_zip</mat-icon>
                  <div>
                    <h3 class="card-title">Full WhereHouse JSON Backup</h3>
                    <p class="card-desc">
                      Complete database snapshot (Categories, Locations, Items &amp; Attributes).
                    </p>
                  </div>
                </div>
                <button
                  mat-flat-button
                  color="primary"
                  [disabled]="isLoading()"
                  (click)="onExportJson()"
                >
                  <mat-icon>download</mat-icon>
                  Download JSON Bundle (.json)
                </button>
              </div>

              <div class="export-card">
                <div class="card-header">
                  <mat-icon>inventory_2</mat-icon>
                  <div>
                    <h3 class="card-title">Items CSV</h3>
                    <p class="card-desc">
                      All accessible inventory items with codes, locations, quantities and prices.
                    </p>
                  </div>
                </div>
                <button
                  mat-stroked-button
                  [disabled]="isLoading()"
                  (click)="onExportCsv(PortabilityEntityTypes.Items)"
                >
                  <mat-icon>table_view</mat-icon>
                  Download Items CSV (.csv)
                </button>
              </div>

              <div class="export-card">
                <div class="card-header">
                  <mat-icon>account_tree</mat-icon>
                  <div>
                    <h3 class="card-title">Locations &amp; Containers CSV</h3>
                    <p class="card-desc">
                      Topologically ordered location hierarchy, bins, and color codes.
                    </p>
                  </div>
                </div>
                <button
                  mat-stroked-button
                  [disabled]="isLoading()"
                  (click)="onExportCsv(PortabilityEntityTypes.Locations)"
                >
                  <mat-icon>table_view</mat-icon>
                  Download Locations CSV (.csv)
                </button>
              </div>

              <div class="export-card">
                <div class="card-header">
                  <mat-icon>category</mat-icon>
                  <div>
                    <h3 class="card-title">Categories &amp; Templates CSV</h3>
                    <p class="card-desc">Category taxonomy and custom attribute field schemas.</p>
                  </div>
                </div>
                <button
                  mat-stroked-button
                  [disabled]="isLoading()"
                  (click)="onExportCsv(PortabilityEntityTypes.Categories)"
                >
                  <mat-icon>table_view</mat-icon>
                  Download Categories CSV (.csv)
                </button>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 2: Bulk Import -->
        <mat-tab label="Bulk Import">
          <div class="tab-pane">
            <div class="import-config-row">
              <mat-form-field appearance="outline" class="config-field">
                <mat-label>Import Format</mat-label>
                <mat-select
                  [value]="importFormat()"
                  (selectionChange)="onFormatChange($event.value)"
                >
                  <mat-option value="csv">CSV Spreadsheet</mat-option>
                  <mat-option value="json">Full JSON Bundle (.json)</mat-option>
                </mat-select>
              </mat-form-field>

              @if (importFormat() === 'csv') {
                <mat-form-field appearance="outline" class="config-field">
                  <mat-label>Target Entity Type</mat-label>
                  <mat-select
                    [value]="selectedEntityType()"
                    (selectionChange)="onEntityTypeChange($event.value)"
                  >
                    <mat-option [value]="PortabilityEntityTypes.Items">Items</mat-option>
                    <mat-option [value]="PortabilityEntityTypes.Locations"
                      >Locations &amp; Bins</mat-option
                    >
                    <mat-option [value]="PortabilityEntityTypes.Categories">Categories</mat-option>
                  </mat-select>
                </mat-form-field>
              }

              <div class="checkbox-container">
                <mat-checkbox
                  [checked]="updateExisting()"
                  (change)="updateExisting.set($event.checked)"
                >
                  Update existing records if found
                </mat-checkbox>
              </div>
            </div>

            <!-- File Upload / Text Area -->
            <div class="upload-zone">
              <div class="file-pick-bar">
                <input
                  #fileInput
                  type="file"
                  class="hidden-file-input"
                  [accept]="importFormat() === 'csv' ? '.csv,text/csv' : '.json,application/json'"
                  (change)="onFileSelected($event)"
                />
                <button mat-stroked-button type="button" (click)="fileInput.click()">
                  <mat-icon>upload_file</mat-icon>
                  <span>Select {{ importFormat() === 'csv' ? 'CSV' : 'JSON' }} File</span>
                </button>
                @if (selectedFileName()) {
                  <span class="file-name-pill">{{ selectedFileName() }}</span>
                }
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Or Paste Raw Content Here</mat-label>
                <textarea
                  matInput
                  [rows]="importFormat() === 'csv' ? 5 : 4"
                  [value]="rawContent()"
                  (input)="onRawContentChange($event)"
                  placeholder="Paste CSV rows or JSON content here..."
                ></textarea>
              </mat-form-field>
            </div>

            <!-- CSV Column Mapper (When CSV format and headers detected) -->
            @if (importFormat() === 'csv' && detectedHeaders().length > 0) {
              <div class="mapper-section">
                <div class="mapper-header">
                  <mat-icon>tune</mat-icon>
                  <span>Map CSV Columns to WhereHouse Fields</span>
                </div>

                <div class="mapper-grid">
                  @for (field of activeTargetFields(); track field.key) {
                    <div class="mapper-row">
                      <span class="field-label" [class.required]="field.required">
                        {{ field.label }} {{ field.required ? '*' : '' }}
                      </span>
                      <mat-form-field appearance="outline" density="compact" class="mapper-select">
                        <mat-select
                          [value]="columnMapping()[field.key] ?? ''"
                          (selectionChange)="onMapColumn(field.key, $event.value)"
                        >
                          <mat-option value=""><em>(None / Skip)</em></mat-option>
                          @for (h of detectedHeaders(); track h) {
                            <mat-option [value]="h">{{ h }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Action Controls: Dry Run vs Commit -->
            <div class="import-actions-row">
              <button
                mat-stroked-button
                color="primary"
                [disabled]="!hasContent() || isLoading()"
                (click)="onRunDryRun()"
              >
                <mat-icon>fact_check</mat-icon>
                <span>Run Dry-Run Preview</span>
              </button>

              <button
                mat-flat-button
                color="primary"
                [disabled]="!hasContent() || isLoading() || !canCommit()"
                (click)="onCommitImport()"
              >
                <mat-icon>cloud_upload</mat-icon>
                <span>Commit Import</span>
              </button>
            </div>

            <!-- Dry Run / Import Preview Results -->
            @if (previewResult(); as result) {
              <div class="preview-results-box" [class.has-errors]="result.errorCount > 0">
                <div class="results-header">
                  <div class="badges-row">
                    <span class="badge badge-info">{{ result.totalRowsProcessed }} Processed</span>
                    <span class="badge badge-success">{{ result.createdCount }} To Create</span>
                    <span class="badge badge-primary">{{ result.updatedCount }} To Update</span>
                    <span class="badge badge-warn">{{ result.skippedCount }} Skipped</span>
                    <span class="badge badge-danger">{{ result.errorCount }} Errors</span>
                  </div>

                  <span class="dry-run-status">
                    {{
                      result.dryRun
                        ? 'DRY-RUN VALIDATION (No DB Changes Persisted)'
                        : 'IMPORT COMMITTED'
                    }}
                  </span>
                </div>

                @if (result.rows.length > 0) {
                  <div class="preview-table-container">
                    <table class="preview-table">
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>Action</th>
                          <th>Code / Identifier</th>
                          <th>Name</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of result.rows; track row.rowNumber) {
                          <tr [class.error-row]="row.action === ImportRowActions.Error">
                            <td>{{ row.rowNumber }}</td>
                            <td>
                              <span class="action-tag" [class]="getActionClass(row.action)">
                                {{ getActionLabel(row.action) }}
                              </span>
                            </td>
                            <td class="font-mono">{{ row.identifier || '—' }}</td>
                            <td class="font-semibold">{{ row.name || '—' }}</td>
                            <td class="msg-col">{{ row.message }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onClose()">Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-bottom: 0.5rem;
    }
    .title-icon {
      color: var(--mat-sys-primary, #386a20);
    }
    .title-text {
      display: flex;
      flex-direction: column;
    }
    .subtitle {
      font-size: 0.75rem;
      font-weight: normal;
      opacity: 0.7;
    }
    .portability-content {
      min-width: 650px;
      max-height: 80vh;
      overflow-y: auto;
    }
    .loading-bar {
      margin-bottom: 0.5rem;
    }
    .tab-pane {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0;
    }
    .tab-intro {
      font-size: 0.85rem;
      opacity: 0.8;
      margin: 0;
    }
    .export-cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .export-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
      background: var(--mat-sys-surface-container-low, rgba(0, 0, 0, 0.02));
    }
    .export-card.primary-card {
      grid-column: span 2;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.04));
      border-color: var(--mat-sys-primary-container, #dbe6cf);
    }
    .card-header {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }
    .card-title {
      margin: 0 0 0.25rem 0;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .card-desc {
      margin: 0;
      font-size: 0.8rem;
      opacity: 0.75;
    }
    .import-config-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .config-field {
      flex: 1;
      min-width: 180px;
    }
    .checkbox-container {
      display: flex;
      align-items: center;
    }
    .upload-zone {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .file-pick-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .hidden-file-input {
      display: none;
    }
    .file-name-pill {
      font-family: monospace;
      font-size: 0.85rem;
      background: var(--mat-sys-secondary-container, #e2e3d8);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .full-width {
      width: 100%;
    }
    .mapper-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-low, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
    }
    .mapper-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      opacity: 0.85;
    }
    .mapper-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .mapper-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .field-label {
      font-size: 0.85rem;
      font-weight: 500;
      min-width: 130px;
    }
    .field-label.required {
      font-weight: 700;
    }
    .mapper-select {
      flex: 1;
    }
    .import-actions-row {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }
    .preview-results-box {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.03));
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }
    .preview-results-box.has-errors {
      border-color: var(--mat-sys-error, #ba1a1a);
    }
    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .badges-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 0.75rem;
      font-weight: bold;
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
    }
    .badge-info {
      background: #e0f2fe;
      color: #0369a1;
    }
    .badge-success {
      background: #dcfce7;
      color: #15803d;
    }
    .badge-primary {
      background: #ede9fe;
      color: #6d28d9;
    }
    .badge-warn {
      background: #fef3c7;
      color: #b45309;
    }
    .badge-danger {
      background: #fee2e2;
      color: #b91c1c;
    }
    .dry-run-status {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      opacity: 0.8;
    }
    .preview-table-container {
      max-height: 240px;
      overflow-y: auto;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
      border-radius: 4px;
    }
    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    .preview-table th,
    .preview-table td {
      padding: 0.4rem 0.6rem;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.06));
    }
    .preview-table th {
      background: var(--mat-sys-surface-container-high, rgba(0, 0, 0, 0.05));
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .font-mono {
      font-family: monospace;
      font-weight: 600;
    }
    .font-semibold {
      font-weight: 600;
    }
    .action-tag {
      font-size: 0.7rem;
      font-weight: bold;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      display: inline-block;
    }
    .action-create {
      background: #dcfce7;
      color: #15803d;
    }
    .action-update {
      background: #ede9fe;
      color: #6d28d9;
    }
    .action-skip {
      background: #f1f5f9;
      color: #64748b;
    }
    .action-error {
      background: #fee2e2;
      color: #b91c1c;
    }
    .error-row {
      background: rgba(186, 26, 26, 0.05);
    }
    .msg-col {
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 600px) {
      .portability-content {
        min-width: 100%;
      }
      .export-cards-grid,
      .mapper-grid {
        grid-template-columns: 1fr;
      }
      .export-card.primary-card {
        grid-column: span 1;
      }
    }
  `,
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
