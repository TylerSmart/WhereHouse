import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ItemDto } from '../../../core/models/item.models';
import {
  CompleteMaintenanceTaskRequest,
  CreateMaintenanceScheduleRequest,
  MAINTENANCE_DUE_STATUS_LABELS,
  MAINTENANCE_INTERVAL_LABELS,
  MaintenanceDueStatus,
  MaintenanceDueStatuses,
  MaintenanceIntervalUnit,
  MaintenanceIntervalUnits,
  MaintenanceScheduleDto,
  MaintenanceSummaryDto,
} from '../../../core/models/maintenance.models';
import { MaintenanceService } from '../../../core/services/maintenance/maintenance.service';

export interface MaintenanceDialogData {
  item?: ItemDto | null;
  availableItems?: ItemDto[];
}

interface MaintenancePreset {
  label: string;
  title: string;
  intervalValue: number;
  intervalUnit: MaintenanceIntervalUnit;
}

@Component({
  imports: [
    FormsModule,
    DatePipe,
    CurrencyPipe,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './maintenance-dialog.component.html',
  styleUrl: './maintenance-dialog.component.scss',
})
export class MaintenanceDialogComponent implements OnInit {
  protected readonly data = inject<MaintenanceDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<MaintenanceDialogComponent>);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly activeTab = signal<'schedules' | 'history'>('schedules');
  protected readonly dueOnlyFilter = signal<boolean>(false);
  protected readonly loading = signal<boolean>(false);
  protected readonly summary = signal<MaintenanceSummaryDto | null>(null);

  protected readonly showAddForm = signal<boolean>(false);
  protected readonly creatingSchedule = signal<boolean>(false);

  // New Schedule form
  protected newScheduleItemId = '';
  protected newScheduleTitle = '';
  protected newScheduleDescription = '';
  protected newScheduleIntervalValue = 90;
  protected newScheduleIntervalUnit: MaintenanceIntervalUnit = MaintenanceIntervalUnits.Days;

  // Inline Complete Task box
  protected readonly completingScheduleId = signal<string | null>(null);
  protected readonly completingInProgress = signal<boolean>(false);
  protected completeNotes = '';
  protected completeCost: number | null = null;

  protected readonly presets: MaintenancePreset[] = [
    {
      label: 'Top-off Battery to 80% (90d)',
      title: 'Top-off Battery to 80%',
      intervalValue: 90,
      intervalUnit: MaintenanceIntervalUnits.Days,
    },
    {
      label: 'Replace Filter (6mo)',
      title: 'Replace Filter',
      intervalValue: 6,
      intervalUnit: MaintenanceIntervalUnits.Months,
    },
    {
      label: 'Descale / Clean (3mo)',
      title: 'Descale & Deep Clean',
      intervalValue: 3,
      intervalUnit: MaintenanceIntervalUnits.Months,
    },
    {
      label: 'Safety Inspection (1yr)',
      title: 'Annual Safety & Wear Inspection',
      intervalValue: 1,
      intervalUnit: MaintenanceIntervalUnits.Years,
    },
  ];

  get availableItemsList(): ItemDto[] {
    return this.data.availableItems ?? [];
  }

  ngOnInit(): void {
    if (this.data.item) {
      this.newScheduleItemId = this.data.item.id;
    } else if (this.availableItemsList.length > 0) {
      this.newScheduleItemId = this.availableItemsList[0].id;
    }
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const targetItemId = this.data.item ? this.data.item.id : null;
    this.maintenanceService.getSummary(targetItemId, this.dueOnlyFilter()).subscribe({
      next: (sum) => {
        this.summary.set(sum);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  toggleDueOnlyFilter(): void {
    this.dueOnlyFilter.update((v) => !v);
    this.loadData();
  }

  toggleAddForm(): void {
    this.showAddForm.set(!this.showAddForm());
  }

  applyPreset(preset: MaintenancePreset): void {
    this.newScheduleTitle = preset.title;
    this.newScheduleIntervalValue = preset.intervalValue;
    this.newScheduleIntervalUnit = preset.intervalUnit;
  }

  saveNewSchedule(): void {
    const targetItemId = this.data.item?.id || this.newScheduleItemId;
    if (!targetItemId) {
      this.snackBar.open('Please select an item.', 'Close', { duration: 3000 });
      return;
    }

    if (!this.newScheduleTitle.trim()) {
      return;
    }

    this.creatingSchedule.set(true);
    const req: CreateMaintenanceScheduleRequest = {
      title: this.newScheduleTitle.trim(),
      description: this.newScheduleDescription.trim() || null,
      intervalValue: this.newScheduleIntervalValue,
      intervalUnit: this.newScheduleIntervalUnit,
    };

    this.maintenanceService.createSchedule(targetItemId, req).subscribe({
      next: () => {
        this.snackBar.open('Schedule created successfully!', 'Close', { duration: 3000 });
        this.creatingSchedule.set(false);
        this.showAddForm.set(false);
        this.newScheduleTitle = '';
        this.newScheduleDescription = '';
        this.loadData();
      },
      error: (err) => {
        this.creatingSchedule.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to create schedule.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  toggleCompleteBox(scheduleId: string): void {
    if (this.completingScheduleId() === scheduleId) {
      this.completingScheduleId.set(null);
    } else {
      this.completingScheduleId.set(scheduleId);
      this.completeNotes = '';
      this.completeCost = null;
    }
  }

  submitCompleteTask(scheduleId: string): void {
    this.completingInProgress.set(true);
    const req: CompleteMaintenanceTaskRequest = {
      notes: this.completeNotes.trim() || null,
      cost: this.completeCost,
    };

    this.maintenanceService.completeTask(scheduleId, req).subscribe({
      next: () => {
        this.snackBar.open('Task completion logged!', 'Close', { duration: 3000 });
        this.completingInProgress.set(false);
        this.completingScheduleId.set(null);
        this.loadData();
      },
      error: (err) => {
        this.completingInProgress.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to log completion.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  deleteSchedule(schedule: MaintenanceScheduleDto): void {
    if (!confirm(`Delete schedule "${schedule.title}"?`)) {
      return;
    }

    this.maintenanceService.deleteSchedule(schedule.id).subscribe({
      next: () => {
        this.snackBar.open('Schedule deleted.', 'Close', { duration: 3000 });
        this.loadData();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.detail || 'Failed to delete schedule.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  getDueClass(status: MaintenanceDueStatus): string {
    switch (status) {
      case MaintenanceDueStatuses.Overdue:
        return 'overdue';
      case MaintenanceDueStatuses.DueSoon:
        return 'due-soon';
      case MaintenanceDueStatuses.Paused:
        return 'paused';
      default:
        return 'up-to-date';
    }
  }

  getDueStatusLabel(status: MaintenanceDueStatus): string {
    return MAINTENANCE_DUE_STATUS_LABELS[status] ?? 'Up to Date';
  }

  getIntervalUnitLabel(unit: MaintenanceIntervalUnit): string {
    return MAINTENANCE_INTERVAL_LABELS[unit] ?? 'Days';
  }

  formatDaysRemaining(days: number): string {
    if (days < 0) {
      return `${Math.abs(days)}d overdue`;
    }
    if (days === 0) {
      return 'due today';
    }
    return `in ${days}d`;
  }
}
