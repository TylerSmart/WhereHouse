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
  { hex: '#1f2937', name: 'Black / Dark Slate' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#2563eb', name: 'Blue' },
  { hex: '#dc2626', name: 'Red' },
  { hex: '#16a34a', name: 'Green' },
  { hex: '#9333ea', name: 'Purple' },
  { hex: '#9ca3af', name: 'Gray' },
  { hex: '#ffffff', name: 'White / Clear' },
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
  templateUrl: './location-dialog.component.html',
  styleUrl: './location-dialog.component.scss',
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
