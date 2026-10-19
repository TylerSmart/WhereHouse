import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
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
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CreateLocationNodeRequest,
  LocationNodeDto,
  LocationNodeType,
  LocationNodeTypes,
  UpdateLocationNodeRequest,
} from '../../../core/models/location.models';

export interface LocationDialogData {
  node?: LocationNodeDto;
  parentId?: string | null;
  parentName?: string | null;
  defaultNodeType?: LocationNodeType;
}

export type LocationDialogResult =
  | { mode: 'create'; request: CreateLocationNodeRequest }
  | { mode: 'update'; request: UpdateLocationNodeRequest };

const ICON_PRESETS = [
  'home',
  'garage',
  'shelves',
  'door_sliding',
  'inventory_2',
  'handyman',
  'kitchen',
  'weekend',
  'checkroom',
  'archive',
];

const CONTAINER_STYLE_PRESETS = [
  '27-Gal Heavy Duty Tote',
  'Clear Shoebox',
  'Cardboard Box',
  'Pelican Case',
  'Fabric Cube',
  'Tool Chest Drawer',
  'Organizer Bin',
];

const COLOR_SWATCHES = [
  '#1f2937', // Black / Dark Slate
  '#eab308', // Yellow
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#9333ea', // Purple
  '#9ca3af', // Gray
  '#f3f4f6', // Translucent / White
];

@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  selector: 'app-location-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>{{ isContainer() ? 'inventory_2' : 'location_on' }}</mat-icon>
      <span>{{ isEditMode ? 'Edit Location / Container' : 'Add New Location or Container' }}</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="location-form">
        @if (data.parentName) {
          <div class="parent-hint">
            <mat-icon>subdirectory_arrow_right</mat-icon>
            <span
              >Inside: <strong>{{ data.parentName }}</strong></span
            >
          </div>
        }

        <!-- Node Type Selector -->
        <div class="form-section">
          <span class="section-label">Type</span>
          <mat-radio-group formControlName="nodeType" class="type-radio-group">
            <mat-radio-button [value]="LocationNodeTypes.FixedLocation">
              <div class="radio-label-content">
                <mat-icon>location_on</mat-icon>
                <div>
                  <strong>Fixed Location</strong>
                  <span class="sub-desc">Room, Closet, Rack, Shelf, Drawer</span>
                </div>
              </div>
            </mat-radio-button>

            <mat-radio-button [value]="LocationNodeTypes.MovableContainer">
              <div class="radio-label-content">
                <mat-icon>inventory_2</mat-icon>
                <div>
                  <strong>Movable Container</strong>
                  <span class="sub-desc">Tote, Bin, Toolbox, Case, Organizer</span>
                </div>
              </div>
            </mat-radio-button>
          </mat-radio-group>
        </div>

        <!-- Name & Short Code -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="e.g. Garage, Shelf 3, or Winter Camping Bin #4"
            required
            maxlength="150"
          />
          @if (form.controls['name'].hasError('required')) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>

        @if (!isEditMode) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Short Code (Optional)</mat-label>
            <input
              matInput
              formControlName="shortCode"
              [placeholder]="
                isContainer() ? 'Auto-generated (e.g. BIN-001)' : 'Auto-generated (e.g. LOC-001)'
              "
              maxlength="32"
            />
            <mat-hint>Leave blank to auto-generate sequentially</mat-hint>
          </mat-form-field>
        } @else {
          <div class="shortcode-badge-row">
            <span class="shortcode-pill">{{ data.node?.shortCode }}</span>
            <span class="shortcode-path">{{ data.node?.fullPath }}</span>
          </div>
        }

        <!-- Icon Preset Selector -->
        <div class="form-section">
          <span class="section-label">Icon</span>
          <div class="icon-presets-row">
            @for (iconName of iconPresets; track iconName) {
              <button
                type="button"
                mat-icon-button
                [class.selected-icon]="form.controls['icon'].value === iconName"
                (click)="form.controls['icon'].setValue(iconName)"
                [matTooltip]="iconName"
                [attr.aria-label]="iconName"
              >
                <mat-icon>{{ iconName }}</mat-icon>
              </button>
            }
          </div>
        </div>

        <!-- Description -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description / Notes</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="2"
            placeholder="Optional context (e.g. West wall shelving unit)"
            maxlength="1000"
          ></textarea>
        </mat-form-field>

        <!-- Container Visual Appearance Section -->
        @if (isContainer()) {
          <div class="container-appearance-section">
            <div class="section-header">
              <mat-icon>palette</mat-icon>
              <h3>Container Visual Appearance Tags</h3>
            </div>
            <p class="section-subtext">
              Helps identify physical containers at a glance without having to read small labels.
            </p>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Container Style / Form Factor</mat-label>
              <input
                matInput
                formControlName="containerStyle"
                placeholder="e.g. 27-Gal Heavy Duty Tote, Clear Shoebox"
                maxlength="100"
              />
            </mat-form-field>

            <div class="chip-suggestions">
              @for (style of stylePresets; track style) {
                <button
                  type="button"
                  class="style-preset-chip"
                  (click)="form.controls['containerStyle'].setValue(style)"
                >
                  {{ style }}
                </button>
              }
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Color Profile Description</mat-label>
              <input
                matInput
                formControlName="colorLabel"
                placeholder="e.g. Black Base / Yellow Lid, Translucent / Blue Latches"
                maxlength="100"
              />
            </mat-form-field>

            <div class="color-pickers-row">
              <div class="color-picker-item">
                <span class="picker-label">Primary Body Color</span>
                <div class="swatches-row">
                  @for (c of colorSwatches; track c) {
                    <button
                      type="button"
                      class="color-swatch-btn"
                      [style.background-color]="c"
                      [class.active-swatch]="form.controls['primaryColor'].value === c"
                      (click)="form.controls['primaryColor'].setValue(c)"
                      [attr.aria-label]="'Set primary color to ' + c"
                    >
                      <span class="visually-hidden">{{ c }}</span>
                    </button>
                  }
                </div>
                <input
                  type="text"
                  formControlName="primaryColor"
                  class="color-hex-input"
                  placeholder="#1f2937 or Black"
                  aria-label="Primary body color hex or name"
                />
              </div>

              <div class="color-picker-item">
                <span class="picker-label">Lid / Accent Color</span>
                <div class="swatches-row">
                  @for (c of colorSwatches; track c) {
                    <button
                      type="button"
                      class="color-swatch-btn"
                      [style.background-color]="c"
                      [class.active-swatch]="form.controls['accentColor'].value === c"
                      (click)="form.controls['accentColor'].setValue(c)"
                      [attr.aria-label]="'Set accent color to ' + c"
                    >
                      <span class="visually-hidden">{{ c }}</span>
                    </button>
                  }
                </div>
                <input
                  type="text"
                  formControlName="accentColor"
                  class="color-hex-input"
                  placeholder="#eab308 or Yellow"
                  aria-label="Lid or accent color hex or name"
                />
              </div>
            </div>
          </div>
        }

        <mat-divider></mat-divider>

        <!-- Secret / Gift Mode Toggle -->
        <div class="privacy-section">
          <mat-slide-toggle formControlName="isPrivate" color="primary">
            <div class="toggle-label-content">
              <mat-icon>lock</mat-icon>
              <div>
                <strong>Secret / Gift Mode</strong>
                <span class="sub-desc">
                  Omit this location and all its contents from other household members' views and
                  searches
                </span>
              </div>
            </div>
          </mat-slide-toggle>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="onSubmit()">
        {{ isEditMode ? 'Save Changes' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .location-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-top: 0.5rem;
    }
    .full-width {
      width: 100%;
    }
    .parent-hint {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      background-color: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.04));
      font-size: 0.875rem;
    }
    .form-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .section-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.8;
    }
    .type-radio-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .radio-label-content {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.25rem 0;
    }
    .sub-desc {
      display: block;
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .icon-presets-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .selected-icon {
      background-color: var(--mat-sys-primary-container, rgba(25, 118, 210, 0.15));
      color: var(--mat-sys-primary, #1976d2);
    }
    .shortcode-badge-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .shortcode-pill {
      font-family: monospace;
      font-weight: bold;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background-color: var(--mat-sys-primary-container, #e3f2fd);
      color: var(--mat-sys-on-primary-container, #0d47a1);
    }
    .shortcode-path {
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .container-appearance-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 8px;
      background-color: var(--mat-sys-surface-container-low, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .section-header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .section-subtext {
      margin: 0;
      font-size: 0.8rem;
      opacity: 0.75;
    }
    .chip-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
    }
    .style-preset-chip {
      background: none;
      border: 1px solid var(--mat-sys-outline, rgba(0, 0, 0, 0.12));
      padding: 0.25rem 0.6rem;
      border-radius: 16px;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .style-preset-chip:hover {
      background-color: var(--mat-sys-surface-container-high, rgba(0, 0, 0, 0.06));
    }
    .color-pickers-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .color-picker-item {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .color-picker-item label {
      font-size: 0.75rem;
      font-weight: 500;
    }
    .swatches-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .color-swatch-btn {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.2);
      cursor: pointer;
    }
    .active-swatch {
      outline: 2px solid var(--mat-sys-primary, #1976d2);
      outline-offset: 2px;
    }
    .color-hex-input {
      margin-top: 0.25rem;
      padding: 0.3rem 0.5rem;
      font-size: 0.8rem;
      border: 1px solid var(--mat-sys-outline, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
    }
    .privacy-section {
      padding: 0.5rem 0;
    }
    .toggle-label-content {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }

    @media (max-width: 600px) {
      .type-radio-group {
        grid-template-columns: 1fr;
      }
      .color-pickers-row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class LocationDialogComponent implements OnInit {
  protected readonly data = inject<LocationDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<LocationDialogComponent, LocationDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly LocationNodeTypes = LocationNodeTypes;
  protected readonly iconPresets = ICON_PRESETS;
  protected readonly stylePresets = CONTAINER_STYLE_PRESETS;
  protected readonly colorSwatches = COLOR_SWATCHES;

  protected readonly isEditMode = !!this.data.node;
  protected readonly isContainer = signal<boolean>(false);

  protected form!: FormGroup;

  ngOnInit(): void {
    const node = this.data.node;
    const defaultType =
      node?.nodeType ?? this.data.defaultNodeType ?? LocationNodeTypes.FixedLocation;

    this.isContainer.set(defaultType === LocationNodeTypes.MovableContainer);

    this.form = this.fb.group({
      name: [node?.name ?? '', [Validators.required, Validators.maxLength(150)]],
      nodeType: [defaultType, [Validators.required]],
      shortCode: [node?.shortCode ?? '', [Validators.maxLength(32)]],
      icon: [
        node?.icon ??
          (defaultType === LocationNodeTypes.MovableContainer ? 'inventory_2' : 'location_on'),
      ],
      description: [node?.description ?? '', [Validators.maxLength(1000)]],
      containerStyle: [node?.containerStyle ?? '', [Validators.maxLength(100)]],
      primaryColor: [node?.primaryColor ?? '', [Validators.maxLength(32)]],
      accentColor: [node?.accentColor ?? '', [Validators.maxLength(32)]],
      colorLabel: [node?.colorLabel ?? '', [Validators.maxLength(100)]],
      isPrivate: [node?.isPrivate ?? false],
    });

    this.form.controls['nodeType'].valueChanges.subscribe((type: LocationNodeType) => {
      this.isContainer.set(type === LocationNodeTypes.MovableContainer);
      if (type === LocationNodeTypes.MovableContainer && !this.form.controls['icon'].dirty) {
        this.form.controls['icon'].setValue('inventory_2');
      } else if (type === LocationNodeTypes.FixedLocation && !this.form.controls['icon'].dirty) {
        this.form.controls['icon'].setValue('location_on');
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    const val = this.form.value;

    if (this.isEditMode) {
      const updateReq: UpdateLocationNodeRequest = {
        name: val.name.trim(),
        nodeType: val.nodeType,
        description: val.description?.trim() || null,
        icon: val.icon?.trim() || null,
        containerStyle: val.containerStyle?.trim() || null,
        primaryColor: val.primaryColor?.trim() || null,
        accentColor: val.accentColor?.trim() || null,
        colorLabel: val.colorLabel?.trim() || null,
        isPrivate: val.isPrivate,
      };
      this.dialogRef.close({ mode: 'update', request: updateReq });
    } else {
      const createReq: CreateLocationNodeRequest = {
        name: val.name.trim(),
        nodeType: val.nodeType,
        parentId: this.data.parentId ?? null,
        shortCode: val.shortCode?.trim() || null,
        description: val.description?.trim() || null,
        icon: val.icon?.trim() || null,
        containerStyle: val.containerStyle?.trim() || null,
        primaryColor: val.primaryColor?.trim() || null,
        accentColor: val.accentColor?.trim() || null,
        colorLabel: val.colorLabel?.trim() || null,
        isPrivate: val.isPrivate,
      };
      this.dialogRef.close({ mode: 'create', request: createReq });
    }
  }
}
