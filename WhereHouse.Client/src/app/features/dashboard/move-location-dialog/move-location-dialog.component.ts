import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { LocationNodeDto, MoveLocationNodeRequest } from '../../../core/models/location.models';

export interface MoveLocationDialogData {
  node: LocationNodeDto;
  availableTargets: LocationNodeDto[];
}

@Component({
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  selector: 'app-move-location-dialog',
  templateUrl: './move-location-dialog.component.html',
  styleUrl: './move-location-dialog.component.scss',
})
export class MoveLocationDialogComponent {
  protected readonly data = inject<MoveLocationDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<MoveLocationDialogComponent, MoveLocationNodeRequest>>(MatDialogRef);

  protected selectedParentId: string | null = this.data.node.parentId;

  onConfirm(): void {
    this.dialogRef.close({ newParentId: this.selectedParentId });
  }
}
