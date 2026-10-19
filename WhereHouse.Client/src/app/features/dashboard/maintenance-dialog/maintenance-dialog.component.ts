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
  template: `
    <div class="maintenance-dialog-container">
      <div class="dialog-header">
        <div class="title-row">
          <mat-icon class="header-icon">build_circle</mat-icon>
          <div class="header-titles">
            <h2 mat-dialog-title>
              @if (data.item) {
                Maintenance: {{ data.item.name }} ({{ data.item.shortCode }})
              } @else {
                Household Maintenance & Recurring Tasks
              }
            </h2>
            <span class="subtitle">
              Track periodic maintenance, battery maintenance, filter changes, and service history
            </span>
          </div>
        </div>

        <button mat-icon-button (click)="close()" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Summary Metrics Bar -->
      <div class="summary-bar">
        <div class="metric-chip total">
          <span class="metric-val">{{ summary()?.totalActiveSchedules ?? 0 }}</span>
          <span class="metric-lbl">Active Schedules</span>
        </div>
        <div class="metric-chip overdue" [class.highlight]="(summary()?.overdueCount ?? 0) > 0">
          <mat-icon>warning</mat-icon>
          <span class="metric-val">{{ summary()?.overdueCount ?? 0 }}</span>
          <span class="metric-lbl">Overdue</span>
        </div>
        <div class="metric-chip due-soon" [class.highlight]="(summary()?.dueSoonCount ?? 0) > 0">
          <mat-icon>schedule</mat-icon>
          <span class="metric-val">{{ summary()?.dueSoonCount ?? 0 }}</span>
          <span class="metric-lbl">Due Soon</span>
        </div>
        <div class="metric-chip up-to-date">
          <mat-icon>check_circle</mat-icon>
          <span class="metric-val">{{ summary()?.upToDateCount ?? 0 }}</span>
          <span class="metric-lbl">Up to Date</span>
        </div>
      </div>

      <!-- Tab Buttons -->
      <div class="tabs-nav">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'schedules'"
          (click)="activeTab.set('schedules')"
        >
          <mat-icon>checklist</mat-icon>
          <span>Schedules ({{ summary()?.schedules?.length ?? 0 }})</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'history'"
          (click)="activeTab.set('history')"
        >
          <mat-icon>history</mat-icon>
          <span>Completion History ({{ summary()?.recentLogs?.length ?? 0 }})</span>
        </button>
      </div>

      <mat-dialog-content class="dialog-content">
        @if (loading()) {
          <div class="loading-state">
            <mat-progress-spinner diameter="32" mode="indeterminate" />
            <span>Loading maintenance tasks...</span>
          </div>
        } @else {
          @if (activeTab() === 'schedules') {
            <!-- Add New Schedule Form (Collapsible) -->
            <div class="add-schedule-card">
              <button type="button" class="add-header-btn" (click)="toggleAddForm()">
                <div class="add-header-left">
                  <mat-icon>{{ showAddForm() ? 'expand_less' : 'add_circle' }}</mat-icon>
                  <strong>Add New Maintenance Schedule</strong>
                </div>
                <span class="hint-text">
                  {{ showAddForm() ? 'Hide form' : 'Click to schedule a recurring task' }}
                </span>
              </button>

              @if (showAddForm()) {
                <div class="add-body">
                  <!-- Preset Chips -->
                  <div class="preset-row">
                    <span class="preset-label">Quick Presets:</span>
                    <div class="chips-wrap">
                      @for (p of presets; track p.label) {
                        <button type="button" class="preset-chip" (click)="applyPreset(p)">
                          {{ p.label }}
                        </button>
                      }
                    </div>
                  </div>

                  <div class="form-grid">
                    @if (!data.item) {
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Target Inventory Item</mat-label>
                        <mat-select [(ngModel)]="newScheduleItemId">
                          @for (itm of availableItemsList; track itm.id) {
                            <mat-option [value]="itm.id">
                              {{ itm.shortCode }} — {{ itm.name }}
                            </mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    }

                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                      class="title-field"
                    >
                      <mat-label>Task Title</mat-label>
                      <input
                        matInput
                        [(ngModel)]="newScheduleTitle"
                        placeholder="e.g. Inspect Air Filter, Charge 18V Battery to 80%"
                        maxlength="200"
                      />
                    </mat-form-field>

                    <div class="interval-fields">
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="num-field"
                      >
                        <mat-label>Interval</mat-label>
                        <input
                          matInput
                          type="number"
                          min="1"
                          max="3650"
                          [(ngModel)]="newScheduleIntervalValue"
                        />
                      </mat-form-field>

                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="unit-field"
                      >
                        <mat-label>Unit</mat-label>
                        <mat-select [(ngModel)]="newScheduleIntervalUnit">
                          <mat-option [value]="0">Days</mat-option>
                          <mat-option [value]="1">Weeks</mat-option>
                          <mat-option [value]="2">Months</mat-option>
                          <mat-option [value]="3">Years</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                      class="desc-field"
                    >
                      <mat-label>Procedure Notes / Description (optional)</mat-label>
                      <input
                        matInput
                        [(ngModel)]="newScheduleDescription"
                        placeholder="Instructions, torque specs, OEM part numbers..."
                        maxlength="1000"
                      />
                    </mat-form-field>
                  </div>

                  <div class="add-actions">
                    <button
                      mat-flat-button
                      color="primary"
                      (click)="saveNewSchedule()"
                      [disabled]="!newScheduleTitle.trim() || creatingSchedule()"
                    >
                      @if (creatingSchedule()) {
                        <mat-progress-spinner diameter="18" mode="indeterminate" />
                        <span>Saving...</span>
                      } @else {
                        <ng-container>
                          <mat-icon>add</mat-icon>
                          <span>Save Schedule</span>
                        </ng-container>
                      }
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- Schedules Filter Toolbar -->
            <div class="filter-toolbar">
              <mat-chip-set>
                <mat-chip-option [selected]="dueOnlyFilter()" (click)="toggleDueOnlyFilter()">
                  <mat-icon matChipAvatar>filter_alt</mat-icon>
                  Due & Overdue Only
                </mat-chip-option>
              </mat-chip-set>
            </div>

            <!-- Schedules List -->
            @if (!summary()?.schedules || summary()!.schedules.length === 0) {
              <div class="empty-list">
                <mat-icon>event_available</mat-icon>
                <p>No maintenance schedules found.</p>
                <span class="empty-sub">
                  Create a schedule above to stay ahead of equipment upkeep, lubrication, and
                  battery charging.
                </span>
              </div>
            } @else {
              <div class="schedules-list">
                @for (s of summary()!.schedules; track s.id) {
                  <div class="schedule-card" [class]="getDueClass(s.dueStatus)">
                    <div class="card-status-strip"></div>
                    <div class="card-content">
                      <div class="card-header-row">
                        <div class="task-title-group">
                          <span class="task-title">{{ s.title }}</span>
                          <span class="due-pill" [class]="getDueClass(s.dueStatus)">
                            {{ getDueStatusLabel(s.dueStatus) }}
                          </span>
                        </div>

                        <div class="card-actions">
                          <button
                            mat-stroked-button
                            color="primary"
                            (click)="toggleCompleteBox(s.id)"
                            matTooltip="Log task completion"
                          >
                            <mat-icon>task_alt</mat-icon>
                            <span>Complete</span>
                          </button>

                          <button
                            mat-icon-button
                            color="warn"
                            (click)="deleteSchedule(s)"
                            matTooltip="Delete schedule"
                          >
                            <mat-icon>delete</mat-icon>
                          </button>
                        </div>
                      </div>

                      <div class="item-meta-row">
                        <span class="item-tag">
                          <mat-icon>inventory_2</mat-icon>
                          <strong>{{ s.itemShortCode }}</strong> — {{ s.itemName }}
                        </span>
                        @if (s.itemLocationFullPath) {
                          <span class="loc-tag">
                            <mat-icon>location_on</mat-icon>
                            {{ s.itemLocationFullPath }}
                          </span>
                        }
                      </div>

                      <div class="schedule-timing-row">
                        <span class="timing-badge">
                          <mat-icon>repeat</mat-icon>
                          Every {{ s.intervalValue }} {{ getIntervalUnitLabel(s.intervalUnit) }}
                        </span>

                        <span class="timing-badge next-due">
                          <mat-icon>event</mat-icon>
                          Next: <strong>{{ s.nextDueAt | date: 'mediumDate' }}</strong>
                          <span class="days-remaining"
                            >({{ formatDaysRemaining(s.daysUntilDue) }})</span
                          >
                        </span>

                        <span class="timing-badge">
                          <mat-icon>history</mat-icon>
                          Last Done:
                          {{
                            s.lastCompletedAt ? (s.lastCompletedAt | date: 'mediumDate') : 'Never'
                          }}
                        </span>
                      </div>

                      @if (s.description) {
                        <p class="task-desc">{{ s.description }}</p>
                      }

                      <!-- Inline Complete Task Box -->
                      @if (completingScheduleId() === s.id) {
                        <div class="complete-box">
                          <h4>Record Task Completion</h4>
                          <div class="complete-form">
                            <mat-form-field
                              appearance="outline"
                              subscriptSizing="dynamic"
                              class="complete-notes"
                            >
                              <mat-label>Notes (optional)</mat-label>
                              <input
                                matInput
                                [(ngModel)]="completeNotes"
                                placeholder="What was done, parts used, condition..."
                                maxlength="1000"
                              />
                            </mat-form-field>

                            <mat-form-field
                              appearance="outline"
                              subscriptSizing="dynamic"
                              class="complete-cost"
                            >
                              <mat-label>Cost ($)</mat-label>
                              <input
                                matInput
                                type="number"
                                step="0.01"
                                min="0"
                                [(ngModel)]="completeCost"
                                placeholder="0.00"
                              />
                            </mat-form-field>

                            <div class="complete-actions">
                              <button
                                mat-flat-button
                                color="primary"
                                (click)="submitCompleteTask(s.id)"
                                [disabled]="completingInProgress()"
                              >
                                <mat-icon>check</mat-icon>
                                <span>Confirm Done</span>
                              </button>
                              <button mat-button (click)="completingScheduleId.set(null)">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          } @else {
            <!-- Completion History Tab -->
            @if (!summary()?.recentLogs || summary()!.recentLogs.length === 0) {
              <div class="empty-list">
                <mat-icon>history</mat-icon>
                <p>No completion logs recorded yet.</p>
                <span class="empty-sub">
                  Completed maintenance tasks will appear here with timestamps, technician names,
                  and parts cost.
                </span>
              </div>
            } @else {
              <div class="logs-list">
                @for (log of summary()!.recentLogs; track log.id) {
                  <div class="log-card">
                    <div class="log-header">
                      <div class="log-title-group">
                        <span class="log-task-title">{{ log.scheduleTitle }}</span>
                        <span class="log-item">
                          <mat-icon>inventory_2</mat-icon>
                          {{ log.itemShortCode }} — {{ log.itemName }}
                        </span>
                      </div>
                      <span class="log-date">{{ log.completedAt | date: 'medium' }}</span>
                    </div>

                    <div class="log-meta">
                      <span class="user-badge">
                        <mat-icon>person</mat-icon>
                        {{ log.completedByUsername || 'User' }}
                      </span>

                      @if (log.cost !== null && log.cost !== undefined && log.cost > 0) {
                        <span class="cost-badge">
                          <mat-icon>attach_money</mat-icon>
                          {{ log.cost | currency }}
                        </span>
                      }
                    </div>

                    @if (log.notes) {
                      <p class="log-notes">{{ log.notes }}</p>
                    }
                  </div>
                }
              </div>
            }
          }
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button (click)="close()">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    .maintenance-dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 88vh;
      min-width: 320px;
      max-width: 820px;
      width: 100%;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.25rem 0.5rem;
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .header-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--mat-sys-primary);
      margin-top: 2px;
    }
    .header-titles h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .subtitle {
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .summary-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      background: var(--mat-sys-surface-container-low);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .metric-chip {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
      background: var(--mat-sys-surface-container);
      border: 1px solid var(--mat-sys-outline-variant);
      font-size: 0.8rem;
    }
    .metric-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .metric-val {
      font-weight: 700;
    }
    .metric-chip.overdue.highlight {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      border-color: var(--mat-sys-error);
    }
    .metric-chip.due-soon.highlight {
      background: #fff3e0;
      color: #e65100;
      border-color: #ffb74d;
    }
    .metric-chip.up-to-date {
      color: #2e7d32;
    }
    .tabs-nav {
      display: flex;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      padding: 0 1.25rem;
      gap: 0.5rem;
      background: var(--mat-sys-surface-container-lowest);
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.65rem 0.9rem;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.9rem;
    }
    .tab-btn.active {
      color: var(--mat-sys-primary);
      border-bottom-color: var(--mat-sys-primary);
      font-weight: 600;
    }
    .tab-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .dialog-content {
      padding: 1rem 1.25rem;
      overflow-y: auto;
      max-height: calc(88vh - 240px);
    }
    .loading-state,
    .empty-list {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1rem;
      text-align: center;
      gap: 0.5rem;
      color: var(--mat-sys-outline);
    }
    .empty-list mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.5;
    }
    .empty-sub {
      font-size: 0.82rem;
      max-width: 440px;
    }
    .add-schedule-card {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: var(--mat-sys-surface-container);
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .add-header-btn {
      width: 100%;
      border: none;
      font-family: inherit;
      color: inherit;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      cursor: pointer;
      background: var(--mat-sys-surface-container-high);
    }
    .add-header-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .hint-text {
      font-size: 0.78rem;
      color: var(--mat-sys-outline);
    }
    .add-body {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .preset-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.8rem;
    }
    .preset-label {
      color: var(--mat-sys-outline);
      font-weight: 500;
    }
    .chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .preset-chip {
      background: var(--mat-sys-surface-container-lowest);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 0.2rem 0.55rem;
      font-size: 0.75rem;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .preset-chip:hover {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .interval-fields {
      display: flex;
      gap: 0.5rem;
    }
    .num-field {
      flex: 1;
    }
    .unit-field {
      flex: 1;
    }
    .add-actions {
      display: flex;
      justify-content: flex-end;
    }
    .filter-toolbar {
      margin-bottom: 0.75rem;
    }
    .schedules-list,
    .logs-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .schedule-card {
      display: flex;
      position: relative;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: var(--mat-sys-surface-container-low);
      overflow: hidden;
    }
    .card-status-strip {
      width: 5px;
      flex-shrink: 0;
      background: #81c784;
    }
    .schedule-card.overdue .card-status-strip {
      background: #e53935;
    }
    .schedule-card.due-soon .card-status-strip {
      background: #fb8c00;
    }
    .schedule-card.paused .card-status-strip {
      background: #9e9e9e;
    }
    .card-content {
      flex: 1;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .card-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .task-title-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .task-title {
      font-size: 1rem;
      font-weight: 600;
    }
    .due-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #e8f5e9;
      color: #2e7d32;
    }
    .due-pill.overdue {
      background: #ffebee;
      color: #c62828;
    }
    .due-pill.due-soon {
      background: #fff3e0;
      color: #ef6c00;
    }
    .due-pill.paused {
      background: #eeeeee;
      color: #616161;
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .item-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .item-tag,
    .loc-tag {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .item-tag mat-icon,
    .loc-tag mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: var(--mat-sys-outline);
    }
    .schedule-timing-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.2rem;
    }
    .timing-badge {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.78rem;
      background: var(--mat-sys-surface-container);
      padding: 0.2rem 0.45rem;
      border-radius: 4px;
    }
    .timing-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--mat-sys-outline);
    }
    .timing-badge.next-due strong {
      color: var(--mat-sys-primary);
    }
    .days-remaining {
      font-size: 0.72rem;
      color: var(--mat-sys-outline);
      margin-left: 2px;
    }
    .task-desc {
      margin: 0.2rem 0 0;
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
      background: var(--mat-sys-surface-container-high);
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
    }
    .complete-box {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: var(--mat-sys-surface-container-high);
      border-radius: 6px;
      border: 1px dashed var(--mat-sys-primary);
    }
    .complete-box h4 {
      margin: 0 0 0.5rem;
      font-size: 0.85rem;
    }
    .complete-form {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .complete-notes {
      flex: 2;
      min-width: 180px;
    }
    .complete-cost {
      flex: 1;
      min-width: 100px;
    }
    .complete-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      justify-content: flex-end;
    }
    .log-card {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      background: var(--mat-sys-surface-container-low);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .log-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .log-title-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .log-task-title {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .log-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .log-item mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .log-date {
      font-size: 0.78rem;
      color: var(--mat-sys-outline);
    }
    .log-meta {
      display: flex;
      gap: 0.6rem;
      font-size: 0.78rem;
    }
    .user-badge,
    .cost-badge {
      display: flex;
      align-items: center;
      gap: 0.2rem;
    }
    .user-badge mat-icon,
    .cost-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--mat-sys-outline);
    }
    .cost-badge {
      color: #2e7d32;
      font-weight: 600;
    }
    .log-notes {
      margin: 0;
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .dialog-actions {
      padding: 0.5rem 1.25rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
  `,
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
