import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ActionCenterOverviewDto,
  CreateNotificationChannelRequest,
  NOTIFICATION_CHANNEL_LABELS,
  NotificationChannelDto,
  NotificationChannelType,
  NotificationChannelTypes,
  NotificationDeliveryLogDto,
  WarrantyOrReturnAlertTypes,
} from '../../../core/models/action-center.models';
import { ActionCenterService } from '../../../core/services/action-center/action-center.service';
import { CheckoutLoadoutService } from '../../../core/services/checkout-loadout/checkout-loadout.service';
import { ItemService } from '../../../core/services/item/item.service';
import { MaintenanceService } from '../../../core/services/maintenance/maintenance.service';

export interface ActionCenterDialogData {
  initialTab?: 'alerts' | 'channels' | 'history';
  initialFilter?: 'all' | 'out-of-place' | 'loans' | 'maintenance' | 'warranties' | 'low-stock';
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
    MatCheckboxModule,
    MatSlideToggleModule,
    MatCardModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="action-center-dialog-container">
      <div class="dialog-header">
        <div class="title-row">
          <mat-icon class="header-icon">notifications_active</mat-icon>
          <div class="header-titles">
            <h2 mat-dialog-title>Household Action Center</h2>
            <span class="subtitle">
              Live status on out-of-place items, overdue loans, maintenance tasks, expiring
              coverages, and low stock
            </span>
          </div>
        </div>

        <div class="header-actions">
          <button
            mat-flat-button
            color="primary"
            class="send-digest-btn"
            (click)="sendDigestNow()"
            [disabled]="isSendingDigest()"
            matTooltip="Dispatch on-demand household digest to configured notification channels"
          >
            @if (isSendingDigest()) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <mat-icon>send</mat-icon>
            }
            <span>{{ isSendingDigest() ? 'Sending...' : 'Send Digest Now' }}</span>
          </button>

          <button mat-icon-button (click)="close()" aria-label="Close dialog">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Metric KPI Cards Bar -->
      <div class="kpi-bar">
        <button
          type="button"
          class="kpi-chip"
          [class.active]="activeTab() === 'alerts' && activeFilter() === 'all'"
          (click)="setAlertFilter('all')"
        >
          <span class="kpi-val">{{ overview()?.totalAlertsCount ?? 0 }}</span>
          <span class="kpi-lbl">Total Alerts</span>
        </button>

        <button
          type="button"
          class="kpi-chip out-of-place"
          [class.active]="activeTab() === 'alerts' && activeFilter() === 'out-of-place'"
          (click)="setAlertFilter('out-of-place')"
        >
          <mat-icon>assignment_return</mat-icon>
          <span class="kpi-val">{{ overview()?.outOfPlaceCount ?? 0 }}</span>
          <span class="kpi-lbl">Out of Place</span>
        </button>

        <button
          type="button"
          class="kpi-chip loans"
          [class.highlight]="(overview()?.overdueLoansCount ?? 0) > 0"
          [class.active]="activeTab() === 'alerts' && activeFilter() === 'loans'"
          (click)="setAlertFilter('loans')"
        >
          <mat-icon>person_search</mat-icon>
          <span class="kpi-val">{{ overview()?.activeLoansCount ?? 0 }}</span>
          <span class="kpi-lbl">
            Loans
            @if ((overview()?.overdueLoansCount ?? 0) > 0) {
              ({{ overview()?.overdueLoansCount }} overdue)
            }
          </span>
        </button>

        <button
          type="button"
          class="kpi-chip maintenance"
          [class.highlight]="(overview()?.maintenanceOverdueCount ?? 0) > 0"
          [class.active]="activeTab() === 'alerts' && activeFilter() === 'maintenance'"
          (click)="setAlertFilter('maintenance')"
        >
          <mat-icon>build_circle</mat-icon>
          <span class="kpi-val">{{ overview()?.maintenanceDueCount ?? 0 }}</span>
          <span class="kpi-lbl">
            Maintenance
            @if ((overview()?.maintenanceOverdueCount ?? 0) > 0) {
              ({{ overview()?.maintenanceOverdueCount }} overdue)
            }
          </span>
        </button>

        <button
          type="button"
          class="kpi-chip warranties"
          [class.active]="activeTab() === 'alerts' && activeFilter() === 'warranties'"
          (click)="setAlertFilter('warranties')"
        >
          <mat-icon>verified</mat-icon>
          <span class="kpi-val">{{ overview()?.expiringCoverageCount ?? 0 }}</span>
          <span class="kpi-lbl">Coverages</span>
        </button>

        <button
          type="button"
          class="kpi-chip low-stock"
          [class.active]="activeTab() === 'alerts' && activeFilter() === 'low-stock'"
          (click)="setAlertFilter('low-stock')"
        >
          <mat-icon>production_quantity_limits</mat-icon>
          <span class="kpi-val">{{ overview()?.lowStockCount ?? 0 }}</span>
          <span class="kpi-lbl">Low Stock</span>
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav">
        <button
          class="tab-btn"
          [class.active]="activeTab() === 'alerts'"
          (click)="activeTab.set('alerts')"
        >
          <mat-icon>warning_amber</mat-icon>
          <span>Alerts &amp; Actions ({{ overview()?.totalAlertsCount ?? 0 }})</span>
        </button>

        <button
          class="tab-btn"
          [class.active]="activeTab() === 'channels'"
          (click)="activeTab.set('channels'); loadChannels()"
        >
          <mat-icon>cell_tower</mat-icon>
          <span>Notification Channels ({{ channels().length }})</span>
        </button>

        <button
          class="tab-btn"
          [class.active]="activeTab() === 'history'"
          (click)="activeTab.set('history'); loadDeliveries()"
        >
          <mat-icon>history</mat-icon>
          <span>Delivery Log</span>
        </button>
      </div>

      <mat-dialog-content class="dialog-body">
        <!-- TAB 1: ALERTS & ACTIONS -->
        @if (activeTab() === 'alerts') {
          <div class="alerts-controls">
            <div class="filter-chips-row">
              <button
                type="button"
                class="filter-pill"
                [class.selected]="activeFilter() === 'all'"
                (click)="activeFilter.set('all')"
              >
                All Alerts
              </button>
              <button
                type="button"
                class="filter-pill"
                [class.selected]="activeFilter() === 'out-of-place'"
                (click)="activeFilter.set('out-of-place')"
              >
                Out of Place ({{ overview()?.outOfPlaceCount ?? 0 }})
              </button>
              <button
                type="button"
                class="filter-pill"
                [class.selected]="activeFilter() === 'loans'"
                (click)="activeFilter.set('loans')"
              >
                External Loans ({{ overview()?.activeLoansCount ?? 0 }})
              </button>
              <button
                type="button"
                class="filter-pill"
                [class.selected]="activeFilter() === 'maintenance'"
                (click)="activeFilter.set('maintenance')"
              >
                Maintenance ({{ overview()?.maintenanceDueCount ?? 0 }})
              </button>
              <button
                type="button"
                class="filter-pill"
                [class.selected]="activeFilter() === 'warranties'"
                (click)="activeFilter.set('warranties')"
              >
                Warranties &amp; Returns ({{ overview()?.expiringCoverageCount ?? 0 }})
              </button>
              <button
                type="button"
                class="filter-pill"
                [class.selected]="activeFilter() === 'low-stock'"
                (click)="activeFilter.set('low-stock')"
              >
                Low Stock ({{ overview()?.lowStockCount ?? 0 }})
              </button>
            </div>

            <div class="coverage-window-select">
              <span class="window-lbl">Lookahead:</span>
              <button
                type="button"
                class="window-chip"
                [class.active]="coverageWindowDays() === 14"
                (click)="setCoverageWindow(14)"
              >
                14d
              </button>
              <button
                type="button"
                class="window-chip"
                [class.active]="coverageWindowDays() === 30"
                (click)="setCoverageWindow(30)"
              >
                30d
              </button>
              <button
                type="button"
                class="window-chip"
                [class.active]="coverageWindowDays() === 60"
                (click)="setCoverageWindow(60)"
              >
                60d
              </button>
              <button
                type="button"
                class="window-chip"
                [class.active]="coverageWindowDays() === 90"
                (click)="setCoverageWindow(90)"
              >
                90d
              </button>
            </div>
          </div>

          @if (isLoading()) {
            <div class="loading-state">
              <mat-spinner diameter="36"></mat-spinner>
              <span>Loading Action Center alerts...</span>
            </div>
          } @else if ((overview()?.totalAlertsCount ?? 0) === 0) {
            <div class="empty-state">
              <mat-icon>task_alt</mat-icon>
              <h3>All clear! Everything is in place.</h3>
              <p>
                No items are out of place, no loans are overdue, all maintenance is up to date, and
                stock levels are optimal.
              </p>
            </div>
          } @else {
            <div class="alerts-feed">
              <!-- Out of Place Section -->
              @if (
                (activeFilter() === 'all' || activeFilter() === 'out-of-place') &&
                (overview()?.outOfPlaceItems?.length ?? 0) > 0
              ) {
                <div class="alert-section">
                  <div class="section-heading">
                    <mat-icon>assignment_return</mat-icon>
                    <h3>Out of Place Items ({{ overview()?.outOfPlaceCount }})</h3>
                  </div>

                  <div class="card-grid">
                    @for (item of overview()?.outOfPlaceItems; track item.itemId) {
                      <div class="alert-card out-of-place-card">
                        <div class="card-top">
                          <span class="short-code">{{ item.shortCode }}</span>
                          <span class="days-pill">{{ item.daysOut }}d out</span>
                        </div>
                        <h4 class="item-title">{{ item.name }}</h4>
                        <div class="meta-row">
                          <mat-icon>home</mat-icon>
                          <span>{{ item.homeLocationFullPath || 'Home Location' }}</span>
                        </div>
                        @if (item.checkedOutByUsername || item.checkoutNote) {
                          <div class="meta-row note">
                            <mat-icon>person</mat-icon>
                            <span>
                              {{ item.checkedOutByUsername }}
                              @if (item.checkoutNote) {
                                &mdash; "{{ item.checkoutNote }}"
                              }
                            </span>
                          </div>
                        }
                        <div class="card-action">
                          <button
                            mat-stroked-button
                            color="primary"
                            (click)="quickReturnItem(item.itemId)"
                          >
                            <mat-icon>assignment_return</mat-icon>
                            <span>Quick Return to Home</span>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- External Loans Section -->
              @if (
                (activeFilter() === 'all' || activeFilter() === 'loans') &&
                (overview()?.externalLoans?.length ?? 0) > 0
              ) {
                <div class="alert-section">
                  <div class="section-heading">
                    <mat-icon>person_search</mat-icon>
                    <h3>External Loans ({{ overview()?.activeLoansCount }})</h3>
                  </div>

                  <div class="card-grid">
                    @for (loan of overview()?.externalLoans; track loan.itemId) {
                      <div class="alert-card loan-card" [class.overdue-border]="loan.isOverdue">
                        <div class="card-top">
                          <span class="short-code">{{ loan.shortCode }}</span>
                          @if (loan.isOverdue) {
                            <span class="status-badge overdue">OVERDUE</span>
                          } @else if (
                            loan.daysUntilDue !== null && loan.daysUntilDue !== undefined
                          ) {
                            <span class="status-badge due-soon"
                              >Due in {{ loan.daysUntilDue }}d</span
                            >
                          }
                        </div>
                        <h4 class="item-title">{{ loan.name }}</h4>
                        <div class="meta-row borrower">
                          <mat-icon>contacts</mat-icon>
                          <span>
                            Lent to: <strong>{{ loan.borrowerName || 'Unknown Borrower' }}</strong>
                            @if (loan.borrowerContact) {
                              ({{ loan.borrowerContact }})
                            }
                          </span>
                        </div>
                        <div class="meta-row">
                          <mat-icon>event</mat-icon>
                          <span>
                            Due:
                            {{ loan.dueAt ? (loan.dueAt | date: 'mediumDate') : 'No due date set' }}
                          </span>
                        </div>
                        <div class="card-action">
                          <button
                            mat-stroked-button
                            color="primary"
                            (click)="quickReturnItem(loan.itemId)"
                          >
                            <mat-icon>assignment_return</mat-icon>
                            <span>Mark Returned</span>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Maintenance Due Section -->
              @if (
                (activeFilter() === 'all' || activeFilter() === 'maintenance') &&
                (overview()?.dueMaintenanceSchedules?.length ?? 0) > 0
              ) {
                <div class="alert-section">
                  <div class="section-heading">
                    <mat-icon>build_circle</mat-icon>
                    <h3>Maintenance Due ({{ overview()?.maintenanceDueCount }})</h3>
                  </div>

                  <div class="card-grid">
                    @for (task of overview()?.dueMaintenanceSchedules; track task.id) {
                      <div
                        class="alert-card maintenance-card"
                        [class.overdue-border]="task.dueStatus === 2"
                      >
                        <div class="card-top">
                          <span class="short-code">{{ task.itemShortCode }}</span>
                          @if (task.dueStatus === 2) {
                            <span class="status-badge overdue">OVERDUE</span>
                          } @else {
                            <span class="status-badge due-soon">DUE SOON</span>
                          }
                        </div>
                        <h4 class="item-title">{{ task.title }}</h4>
                        <div class="meta-row">
                          <mat-icon>inventory_2</mat-icon>
                          <span
                            >{{ task.itemName }} ({{ task.itemLocationFullPath || 'Home' }})</span
                          >
                        </div>
                        <div class="meta-row">
                          <mat-icon>calendar_today</mat-icon>
                          <span>Next Due: {{ task.nextDueAt | date: 'mediumDate' }}</span>
                        </div>
                        <div class="card-action">
                          <button
                            mat-stroked-button
                            color="accent"
                            (click)="quickCompleteTask(task.id)"
                          >
                            <mat-icon>task_alt</mat-icon>
                            <span>Complete Task</span>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Warranties & Returns Section -->
              @if (
                (activeFilter() === 'all' || activeFilter() === 'warranties') &&
                (overview()?.expiringCoverages?.length ?? 0) > 0
              ) {
                <div class="alert-section">
                  <div class="section-heading">
                    <mat-icon>verified</mat-icon>
                    <h3>
                      Expiring Warranties &amp; Return Deadlines ({{
                        overview()?.expiringCoverageCount
                      }})
                    </h3>
                  </div>

                  <div class="card-grid">
                    @for (
                      cov of overview()?.expiringCoverages;
                      track cov.itemId + '-' + cov.alertType
                    ) {
                      <div class="alert-card coverage-card">
                        <div class="card-top">
                          <span class="short-code">{{ cov.shortCode }}</span>
                          @if (cov.alertType === 0) {
                            <span class="status-badge return-window">RETURN WINDOW</span>
                          } @else {
                            <span class="status-badge warranty">WARRANTY</span>
                          }
                        </div>
                        <h4 class="item-title">{{ cov.name }}</h4>
                        <div class="meta-row">
                          <mat-icon>event</mat-icon>
                          <span>
                            Expires:
                            <strong>{{ cov.expirationDate | date: 'mediumDate' }}</strong> ({{
                              cov.daysRemaining >= 0
                                ? cov.daysRemaining + ' days left'
                                : 'Expired ' + -cov.daysRemaining + ' days ago'
                            }})
                          </span>
                        </div>
                        @if (cov.brand || cov.modelNumber) {
                          <div class="meta-row">
                            <mat-icon>label</mat-icon>
                            <span>{{ cov.brand }} {{ cov.modelNumber }}</span>
                          </div>
                        }
                        @if (cov.purchasePrice) {
                          <div class="meta-row">
                            <mat-icon>payments</mat-icon>
                            <span
                              >{{ cov.purchasePrice | currency }}
                              @if (cov.retailer) {
                                from {{ cov.retailer }}
                              }
                            </span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Low Stock Section -->
              @if (
                (activeFilter() === 'all' || activeFilter() === 'low-stock') &&
                (overview()?.lowStockItems?.length ?? 0) > 0
              ) {
                <div class="alert-section">
                  <div class="section-heading">
                    <mat-icon>production_quantity_limits</mat-icon>
                    <h3>Low Stock Consumables ({{ overview()?.lowStockCount }})</h3>
                  </div>

                  <div class="card-grid">
                    @for (item of overview()?.lowStockItems; track item.itemId) {
                      <div class="alert-card low-stock-card">
                        <div class="card-top">
                          <span class="short-code">{{ item.shortCode }}</span>
                          <span class="status-badge low-stock">LOW STOCK</span>
                        </div>
                        <h4 class="item-title">{{ item.name }}</h4>
                        <div class="meta-row stock-highlight">
                          <mat-icon>inventory</mat-icon>
                          <span>
                            Current: <strong>{{ item.currentQuantity }}</strong> / Threshold:
                            {{ item.minQuantity }} {{ item.unit || 'units' }}
                          </span>
                        </div>
                        <div class="meta-row">
                          <mat-icon>location_on</mat-icon>
                          <span>{{ item.homeLocationFullPath || 'Home Location' }}</span>
                        </div>
                        <div class="card-action">
                          <button
                            mat-stroked-button
                            color="primary"
                            (click)="quickRestock(item.itemId)"
                          >
                            <mat-icon>add_circle</mat-icon>
                            <span>Restock (+1)</span>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- TAB 2: CHANNELS -->
        @if (activeTab() === 'channels') {
          <div class="channels-tab">
            <div class="channels-header">
              <div class="desc-text">
                Configure webhook and push notification providers (<strong>ntfy</strong>,
                <strong>Slack</strong>, <strong>Pushover</strong>, and <strong>SMTP Email</strong>)
                to receive weekly household digests and real-time alerts.
              </div>
              <button
                mat-flat-button
                color="primary"
                (click)="channelFormOpen.set(!channelFormOpen())"
              >
                <mat-icon>{{ channelFormOpen() ? 'remove' : 'add' }}</mat-icon>
                <span>{{ channelFormOpen() ? 'Cancel' : 'Add Notification Channel' }}</span>
              </button>
            </div>

            <!-- Add Channel Form -->
            @if (channelFormOpen()) {
              <div class="channel-form-card">
                <h3>New Notification Channel</h3>

                <div class="form-grid">
                  <mat-form-field appearance="outline" class="col-span-2">
                    <mat-label>Channel Name</mat-label>
                    <input
                      matInput
                      [(ngModel)]="newChannelName"
                      placeholder="e.g. Household ntfy, Garage Slack, Admin Email"
                    />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Channel Provider</mat-label>
                    <mat-select [(ngModel)]="newChannelType">
                      <mat-option [value]="NotificationChannelTypes.Ntfy">ntfy (HTTP)</mat-option>
                      <mat-option [value]="NotificationChannelTypes.SlackWebhook"
                        >Slack Webhook</mat-option
                      >
                      <mat-option [value]="NotificationChannelTypes.Pushover">Pushover</mat-option>
                      <mat-option [value]="NotificationChannelTypes.SmtpEmail"
                        >Email (SMTP)</mat-option
                      >
                    </mat-select>
                  </mat-form-field>

                  <div class="checkbox-col">
                    <mat-checkbox [(ngModel)]="newIsSharedHouseholdChannel">
                      Shared Household Channel (Strips secret gift mode items)
                    </mat-checkbox>
                  </div>

                  @if (
                    newChannelType === NotificationChannelTypes.Ntfy ||
                    newChannelType === NotificationChannelTypes.SlackWebhook
                  ) {
                    <mat-form-field appearance="outline" class="col-span-2">
                      <mat-label>Webhook / Endpoint URL</mat-label>
                      <input
                        matInput
                        [(ngModel)]="newEndpointUrl"
                        placeholder="e.g. https://ntfy.sh/wherehouse-alerts or https://hooks.slack.com/services/..."
                      />
                    </mat-form-field>
                  }

                  @if (newChannelType === NotificationChannelTypes.Ntfy) {
                    <mat-form-field appearance="outline" class="col-span-2">
                      <mat-label>Bearer Access Token (Optional)</mat-label>
                      <input
                        matInput
                        type="password"
                        [(ngModel)]="newAccessTokenOrKey"
                        placeholder="Bearer token for protected ntfy topics"
                      />
                    </mat-form-field>
                  }

                  @if (newChannelType === NotificationChannelTypes.Pushover) {
                    <mat-form-field appearance="outline">
                      <mat-label>Pushover Application Token</mat-label>
                      <input
                        matInput
                        type="password"
                        [(ngModel)]="newAccessTokenOrKey"
                        placeholder="App API Token"
                      />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Pushover User/Group Key</mat-label>
                      <input
                        matInput
                        [(ngModel)]="newRecipientOrUserKey"
                        placeholder="User or Delivery Group Key"
                      />
                    </mat-form-field>
                  }

                  @if (newChannelType === NotificationChannelTypes.SmtpEmail) {
                    <mat-form-field appearance="outline">
                      <mat-label>Recipient Email</mat-label>
                      <input
                        matInput
                        type="email"
                        [(ngModel)]="newRecipientOrUserKey"
                        placeholder="user@example.com"
                      />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>SMTP Host</mat-label>
                      <input
                        matInput
                        [(ngModel)]="newSmtpHost"
                        placeholder="smtp.gmail.com or mail.local"
                      />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>SMTP Port</mat-label>
                      <input matInput type="number" [(ngModel)]="newSmtpPort" />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>SMTP Username (Optional)</mat-label>
                      <input matInput [(ngModel)]="newSmtpUsername" />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>SMTP Password / App Key</mat-label>
                      <input matInput type="password" [(ngModel)]="newAccessTokenOrKey" />
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>From Address</mat-label>
                      <input
                        matInput
                        [(ngModel)]="newSmtpFromAddress"
                        placeholder="wherehouse@example.com"
                      />
                    </mat-form-field>
                  }
                </div>

                <div class="subscriptions-heading">Trigger Subscriptions</div>
                <div class="subscriptions-row">
                  <mat-checkbox [(ngModel)]="newNotifyOnOverdueLoans">Overdue Loans</mat-checkbox>
                  <mat-checkbox [(ngModel)]="newNotifyOnMaintenanceDue"
                    >Maintenance Due</mat-checkbox
                  >
                  <mat-checkbox [(ngModel)]="newNotifyOnExpiringWarranties"
                    >Expiring Warranties</mat-checkbox
                  >
                  <mat-checkbox [(ngModel)]="newNotifyOnLowStock">Low Stock</mat-checkbox>
                  <mat-checkbox [(ngModel)]="newEnableWeeklyDigest">Weekly Digest</mat-checkbox>
                </div>

                <div class="form-actions">
                  <button mat-button (click)="channelFormOpen.set(false)">Cancel</button>
                  <button mat-flat-button color="primary" (click)="saveNewChannel()">
                    Save Channel
                  </button>
                </div>
              </div>
            }

            <!-- Channels List -->
            <div class="channels-list">
              @if (channels().length === 0) {
                <div class="empty-state">
                  <mat-icon>cell_tower</mat-icon>
                  <p>No notification channels configured yet.</p>
                </div>
              } @else {
                @for (c of channels(); track c.id) {
                  <div class="channel-card">
                    <div class="chan-main">
                      <div class="chan-icon-wrapper">
                        <mat-icon>
                          @switch (c.channelType) {
                            @case (0) {
                              send_to_mobile
                            }
                            @case (1) {
                              tag
                            }
                            @case (2) {
                              notifications_active
                            }
                            @case (3) {
                              mail
                            }
                          }
                        </mat-icon>
                      </div>
                      <div class="chan-info">
                        <div class="chan-title-row">
                          <span class="chan-name">{{ c.name }}</span>
                          <span class="chan-type-badge">{{
                            NOTIFICATION_CHANNEL_LABELS[c.channelType]
                          }}</span>
                          @if (c.isSharedHouseholdChannel) {
                            <span class="shared-badge">Shared Household</span>
                          }
                        </div>
                        <div class="chan-details">
                          @if (c.endpointUrl) {
                            <span>{{ c.endpointUrl }}</span>
                          } @else if (c.smtpHost) {
                            <span
                              >{{ c.smtpHost }}:{{ c.smtpPort }} &rarr;
                              {{ c.recipientOrUserKey }}</span
                            >
                          } @else if (c.recipientOrUserKey) {
                            <span>User Key: {{ c.recipientOrUserKey }}</span>
                          }
                        </div>
                        @if (c.lastDeliveryStatus) {
                          <div class="last-status">
                            <span class="status-lbl">Last status:</span>
                            <span class="status-text">{{ c.lastDeliveryStatus }}</span>
                            @if (c.lastTriggeredAt) {
                              <span class="status-time"
                                >({{ c.lastTriggeredAt | date: 'short' }})</span
                              >
                            }
                          </div>
                        }
                      </div>
                    </div>

                    <div class="chan-controls">
                      <button
                        mat-stroked-button
                        (click)="testChannel(c.id)"
                        [disabled]="isTestingChannel()[c.id]"
                        matTooltip="Send test message to this channel"
                      >
                        @if (isTestingChannel()[c.id]) {
                          <mat-spinner diameter="16"></mat-spinner>
                        } @else {
                          <mat-icon>bolt</mat-icon>
                        }
                        <span>Test</span>
                      </button>

                      <mat-slide-toggle
                        [checked]="c.isEnabled"
                        (change)="toggleChannelEnabled(c)"
                        matTooltip="Enable/Disable channel"
                      ></mat-slide-toggle>

                      <button
                        mat-icon-button
                        color="warn"
                        (click)="deleteChannel(c.id)"
                        aria-label="Delete channel"
                        matTooltip="Delete channel"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        }

        <!-- TAB 3: HISTORY LOG -->
        @if (activeTab() === 'history') {
          <div class="history-tab">
            @if (deliveries().length === 0) {
              <div class="empty-state">
                <mat-icon>history</mat-icon>
                <p>No outbound notifications recorded yet.</p>
              </div>
            } @else {
              <div class="deliveries-list">
                @for (d of deliveries(); track d.id) {
                  <div class="delivery-row" [class.failed]="!d.success">
                    <div class="delivery-badge-col">
                      @if (d.success) {
                        <span class="badge success">SENT</span>
                      } @else {
                        <span class="badge failure">FAILED</span>
                      }
                    </div>
                    <div class="delivery-content">
                      <div class="delivery-title-row">
                        <span class="subj">{{ d.subject }}</span>
                        <span class="chan-tag"
                          >{{ d.channelName }} ({{
                            NOTIFICATION_CHANNEL_LABELS[d.channelType]
                          }})</span
                        >
                        <span class="date">{{ d.deliveredAt | date: 'medium' }}</span>
                      </div>
                      <div class="delivery-summary">
                        {{ d.responseSummary || 'Delivered' }}
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-footer">
        <button mat-button (click)="close()">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .action-center-dialog-container {
        display: flex;
        flex-direction: column;
        max-width: 960px;
        width: 95vw;
        max-height: 90vh;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        border-bottom: 1px solid var(--mat-sys-outline-variant, #e0e0e0);

        .title-row {
          display: flex;
          align-items: center;
          gap: 12px;

          .header-icon {
            font-size: 32px;
            width: 32px;
            height: 32px;
            color: var(--mat-sys-primary, #1976d2);
          }

          .header-titles {
            h2 {
              margin: 0;
              font-size: 1.25rem;
              font-weight: 600;
            }
            .subtitle {
              font-size: 0.85rem;
              color: var(--mat-sys-on-surface-variant, #666);
            }
          }
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      .kpi-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px 24px;
        background: var(--mat-sys-surface-container-low, #f5f5f5);
        border-bottom: 1px solid var(--mat-sys-outline-variant, #e0e0e0);

        .kpi-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid var(--mat-sys-outline-variant, #ccc);
          background: var(--mat-sys-surface, #fff);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.85rem;
          color: var(--mat-sys-on-surface, #333);
          transition: all 0.15s ease;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          .kpi-val {
            font-weight: 700;
          }

          &:hover {
            background: var(--mat-sys-surface-container, #eee);
          }

          &.active {
            border-color: var(--mat-sys-primary, #1976d2);
            background: var(--mat-sys-primary-container, #e3f2fd);
            color: var(--mat-sys-on-primary-container, #0d47a1);
          }

          &.highlight {
            border-color: #d32f2f;
            color: #d32f2f;
            background: #ffebee;
          }
        }
      }

      .tabs-nav {
        display: flex;
        padding: 0 24px;
        border-bottom: 1px solid var(--mat-sys-outline-variant, #e0e0e0);

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 18px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--mat-sys-on-surface-variant, #666);

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }

          &.active {
            border-bottom-color: var(--mat-sys-primary, #1976d2);
            color: var(--mat-sys-primary, #1976d2);
            font-weight: 600;
          }
        }
      }

      .dialog-body {
        padding: 16px 24px;
        min-height: 380px;
        overflow-y: auto;
      }

      .alerts-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;

        .filter-chips-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;

          .filter-pill {
            padding: 4px 10px;
            border-radius: 12px;
            border: 1px solid var(--mat-sys-outline-variant, #ccc);
            background: var(--mat-sys-surface, #fff);
            font-size: 0.8rem;
            cursor: pointer;

            &.selected {
              background: var(--mat-sys-secondary-container, #e8def8);
              color: var(--mat-sys-on-secondary-container, #1d192b);
              border-color: transparent;
              font-weight: 600;
            }
          }
        }

        .coverage-window-select {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;

          .window-lbl {
            color: var(--mat-sys-on-surface-variant, #666);
            margin-right: 4px;
          }

          .window-chip {
            padding: 3px 8px;
            border-radius: 8px;
            border: 1px solid var(--mat-sys-outline-variant, #ccc);
            background: none;
            cursor: pointer;
            font-size: 0.75rem;

            &.active {
              background: var(--mat-sys-primary, #1976d2);
              color: #fff;
              border-color: var(--mat-sys-primary, #1976d2);
            }
          }
        }
      }

      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }

      .alert-card {
        padding: 12px;
        border-radius: 10px;
        border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
        background: var(--mat-sys-surface, #fff);
        display: flex;
        flex-direction: column;
        gap: 6px;

        &.overdue-border {
          border-color: #d32f2f;
          border-left-width: 4px;
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .short-code {
            font-family: monospace;
            font-size: 0.75rem;
            color: var(--mat-sys-on-surface-variant, #666);
          }

          .days-pill {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            background: #fff3e0;
            color: #e65100;
            font-weight: 600;
          }

          .status-badge {
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;

            &.overdue {
              background: #ffebee;
              color: #c62828;
            }
            &.due-soon {
              background: #fff8e1;
              color: #f57f17;
            }
            &.return-window {
              background: #e3f2fd;
              color: #1565c0;
            }
            &.warranty {
              background: #e8f5e9;
              color: #2e7d32;
            }
            &.low-stock {
              background: #fce4ec;
              color: #c2185b;
            }
          }
        }

        .item-title {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--mat-sys-on-surface-variant, #666);

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }

          &.stock-highlight {
            color: #c2185b;
          }
        }

        .card-action {
          margin-top: 6px;
          display: flex;
          justify-content: flex-end;

          button {
            font-size: 0.75rem;
            height: 32px;
            padding: 0 10px;
          }
        }
      }

      .alert-section {
        margin-bottom: 24px;

        .section-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: var(--mat-sys-primary, #1976d2);
          }

          h3 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
          }
        }
      }

      /* Channels Tab */
      .channels-tab {
        .channels-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;

          .desc-text {
            font-size: 0.85rem;
            color: var(--mat-sys-on-surface-variant, #666);
            max-width: 600px;
          }
        }

        .channel-form-card {
          padding: 16px;
          border-radius: 8px;
          background: var(--mat-sys-surface-container-low, #f9f9f9);
          border: 1px solid var(--mat-sys-outline-variant, #ddd);
          margin-bottom: 20px;

          h3 {
            margin-top: 0;
            margin-bottom: 16px;
          }

          .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;

            .col-span-2 {
              grid-column: span 2;
            }

            .checkbox-col {
              display: flex;
              align-items: center;
            }
          }

          .subscriptions-heading {
            font-size: 0.85rem;
            font-weight: 600;
            margin-top: 12px;
            margin-bottom: 8px;
          }

          .subscriptions-row {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 16px;
          }

          .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }
        }

        .channel-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
          border-radius: 8px;
          margin-bottom: 10px;

          .chan-main {
            display: flex;
            align-items: center;
            gap: 14px;

            .chan-icon-wrapper {
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background: var(--mat-sys-primary-container, #e3f2fd);
              color: var(--mat-sys-primary, #1976d2);
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .chan-title-row {
              display: flex;
              align-items: center;
              gap: 8px;

              .chan-name {
                font-weight: 600;
                font-size: 0.95rem;
              }

              .chan-type-badge {
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 4px;
                background: #eee;
              }

              .shared-badge {
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 4px;
                background: #e8f5e9;
                color: #2e7d32;
              }
            }

            .chan-details {
              font-size: 0.8rem;
              color: var(--mat-sys-on-surface-variant, #666);
              margin-top: 2px;
            }

            .last-status {
              font-size: 0.75rem;
              color: #555;
              margin-top: 2px;

              .status-text {
                font-weight: 500;
              }
              .status-time {
                color: #888;
                margin-left: 4px;
              }
            }
          }

          .chan-controls {
            display: flex;
            align-items: center;
            gap: 10px;
          }
        }
      }

      /* History Tab */
      .deliveries-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .delivery-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);

          &.failed {
            border-left: 4px solid #d32f2f;
          }

          .badge {
            font-size: 0.65rem;
            font-weight: 700;
            padding: 3px 6px;
            border-radius: 4px;

            &.success {
              background: #e8f5e9;
              color: #2e7d32;
            }
            &.failure {
              background: #ffebee;
              color: #c62828;
            }
          }

          .delivery-content {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;

            .delivery-title-row {
              display: flex;
              align-items: center;
              gap: 8px;

              .subj {
                font-weight: 600;
                font-size: 0.85rem;
              }
              .chan-tag {
                font-size: 0.75rem;
                color: #666;
              }
              .date {
                font-size: 0.75rem;
                color: #888;
                margin-left: auto;
              }
            }

            .delivery-summary {
              font-size: 0.8rem;
              color: var(--mat-sys-on-surface-variant, #555);
            }
          }
        }
      }

      .loading-state,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 16px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant, #666);

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 12px;
          color: var(--mat-sys-outline, #aaa);
        }

        h3 {
          margin: 0 0 8px 0;
        }

        p {
          margin: 0;
          font-size: 0.85rem;
          max-width: 450px;
        }
      }

      .dialog-footer {
        padding: 12px 24px;
        border-top: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      }
    `,
  ],
})
export class ActionCenterDialogComponent implements OnInit {
  protected readonly data =
    inject<ActionCenterDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly dialogRef = inject(MatDialogRef<ActionCenterDialogComponent>);
  private readonly actionCenterService = inject(ActionCenterService);
  private readonly checkoutLoadoutService = inject(CheckoutLoadoutService);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly itemService = inject(ItemService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly NotificationChannelTypes = NotificationChannelTypes;
  protected readonly NOTIFICATION_CHANNEL_LABELS = NOTIFICATION_CHANNEL_LABELS;
  protected readonly WarrantyOrReturnAlertTypes = WarrantyOrReturnAlertTypes;

  readonly activeTab = signal<'alerts' | 'channels' | 'history'>('alerts');
  readonly activeFilter = signal<
    'all' | 'out-of-place' | 'loans' | 'maintenance' | 'warranties' | 'low-stock'
  >('all');
  readonly coverageWindowDays = signal<number>(30);

  readonly overview = signal<ActionCenterOverviewDto | null>(null);
  readonly channels = signal<NotificationChannelDto[]>([]);
  readonly deliveries = signal<NotificationDeliveryLogDto[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSendingDigest = signal<boolean>(false);
  readonly isTestingChannel = signal<Record<string, boolean>>({});

  readonly channelFormOpen = signal<boolean>(false);

  // New Channel Form model
  newChannelName = '';
  newChannelType: NotificationChannelType = NotificationChannelTypes.Ntfy;
  newEndpointUrl = '';
  newAccessTokenOrKey = '';
  newRecipientOrUserKey = '';
  newSmtpHost = '';
  newSmtpPort = 587;
  newSmtpUsername = '';
  newSmtpFromAddress = '';
  newSmtpUseSsl = true;
  newIsSharedHouseholdChannel = false;
  newNotifyOnOverdueLoans = true;
  newNotifyOnMaintenanceDue = true;
  newNotifyOnExpiringWarranties = true;
  newNotifyOnLowStock = true;
  newEnableWeeklyDigest = true;

  ngOnInit(): void {
    if (this.data.initialTab) {
      this.activeTab.set(this.data.initialTab);
    }
    if (this.data.initialFilter) {
      this.activeFilter.set(this.data.initialFilter);
    }

    this.loadOverview();
    if (this.activeTab() === 'channels') {
      this.loadChannels();
    } else if (this.activeTab() === 'history') {
      this.loadDeliveries();
    }
  }

  loadOverview(): void {
    this.isLoading.set(true);
    this.actionCenterService.getOverview(this.coverageWindowDays()).subscribe({
      next: (dto) => {
        this.overview.set(dto);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to load Action Center alerts.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  loadChannels(): void {
    this.actionCenterService.getChannels().subscribe({
      next: (list) => this.channels.set(list),
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to load channels.', 'Close', {
          duration: 4000,
        }),
    });
  }

  loadDeliveries(): void {
    this.actionCenterService.getRecentDeliveries(40).subscribe({
      next: (list) => this.deliveries.set(list),
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to load delivery log.', 'Close', {
          duration: 4000,
        }),
    });
  }

  setAlertFilter(
    filter: 'all' | 'out-of-place' | 'loans' | 'maintenance' | 'warranties' | 'low-stock',
  ): void {
    this.activeTab.set('alerts');
    this.activeFilter.set(filter);
  }

  setCoverageWindow(days: number): void {
    this.coverageWindowDays.set(days);
    this.loadOverview();
  }

  quickReturnItem(itemId: string): void {
    this.checkoutLoadoutService.returnItem(itemId, {}).subscribe({
      next: () => {
        this.snackBar.open('Item returned to home bin successfully.', 'Close', { duration: 3000 });
        this.loadOverview();
      },
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to return item.', 'Close', {
          duration: 4000,
        }),
    });
  }

  quickCompleteTask(scheduleId: string): void {
    this.maintenanceService.completeTask(scheduleId, {}).subscribe({
      next: () => {
        this.snackBar.open('Maintenance task completed.', 'Close', { duration: 3000 });
        this.loadOverview();
      },
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to complete task.', 'Close', {
          duration: 4000,
        }),
    });
  }

  quickRestock(itemId: string): void {
    this.itemService.adjustQuantity(itemId, { delta: 1 }).subscribe({
      next: () => {
        this.snackBar.open('Stock incremented by +1.', 'Close', { duration: 3000 });
        this.loadOverview();
      },
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to adjust stock.', 'Close', {
          duration: 4000,
        }),
    });
  }

  sendDigestNow(): void {
    this.isSendingDigest.set(true);
    this.actionCenterService
      .sendDigest({ coverageWindowDays: this.coverageWindowDays() })
      .subscribe({
        next: (res) => {
          this.isSendingDigest.set(false);
          this.snackBar.open(
            `Digest sent! Targeted ${res.channelsTargeted} channels (${res.successCount} succeeded, ${res.failureCount} failed).`,
            'Close',
            { duration: 5000 },
          );
          if (this.activeTab() === 'history') {
            this.loadDeliveries();
          }
        },
        error: (err) => {
          this.isSendingDigest.set(false);
          this.snackBar.open(err?.error?.detail || 'Failed to dispatch digest.', 'Close', {
            duration: 4000,
          });
        },
      });
  }

  testChannel(channelId: string): void {
    this.isTestingChannel.update((m) => ({ ...m, [channelId]: true }));
    this.actionCenterService.sendTestNotification(channelId).subscribe({
      next: (log) => {
        this.isTestingChannel.update((m) => ({ ...m, [channelId]: false }));
        this.snackBar.open(
          `Test ${log.success ? 'succeeded' : 'failed'}: ${log.responseSummary}`,
          'Close',
          { duration: 5000 },
        );
        this.loadChannels();
      },
      error: (err) => {
        this.isTestingChannel.update((m) => ({ ...m, [channelId]: false }));
        this.snackBar.open(err?.error?.detail || 'Failed to test channel.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  deleteChannel(channelId: string): void {
    this.actionCenterService.deleteChannel(channelId).subscribe({
      next: () => {
        this.snackBar.open('Channel deleted.', 'Close', { duration: 3000 });
        this.loadChannels();
      },
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to delete channel.', 'Close', {
          duration: 4000,
        }),
    });
  }

  toggleChannelEnabled(channel: NotificationChannelDto): void {
    this.actionCenterService
      .updateChannel(channel.id, {
        name: channel.name,
        channelType: channel.channelType,
        isEnabled: !channel.isEnabled,
        isSharedHouseholdChannel: channel.isSharedHouseholdChannel,
        endpointUrl: channel.endpointUrl,
        recipientOrUserKey: channel.recipientOrUserKey,
        smtpHost: channel.smtpHost,
        smtpPort: channel.smtpPort,
        smtpUsername: channel.smtpUsername,
        smtpFromAddress: channel.smtpFromAddress,
        smtpUseSsl: channel.smtpUseSsl,
        notifyOnOverdueLoans: channel.notifyOnOverdueLoans,
        notifyOnMaintenanceDue: channel.notifyOnMaintenanceDue,
        notifyOnExpiringWarranties: channel.notifyOnExpiringWarranties,
        notifyOnLowStock: channel.notifyOnLowStock,
        enableWeeklyDigest: channel.enableWeeklyDigest,
        digestDayOfWeek: channel.digestDayOfWeek,
        digestHourUtc: channel.digestHourUtc,
      })
      .subscribe({
        next: () => this.loadChannels(),
        error: (err) =>
          this.snackBar.open(err?.error?.detail || 'Failed to update channel.', 'Close', {
            duration: 4000,
          }),
      });
  }

  saveNewChannel(): void {
    if (!this.newChannelName.trim()) {
      this.snackBar.open('Please enter a channel name.', 'Close', { duration: 3000 });
      return;
    }

    const req: CreateNotificationChannelRequest = {
      name: this.newChannelName.trim(),
      channelType: this.newChannelType,
      isEnabled: true,
      isSharedHouseholdChannel: this.newIsSharedHouseholdChannel,
      endpointUrl: this.newEndpointUrl.trim() || null,
      accessTokenOrKey: this.newAccessTokenOrKey.trim() || null,
      recipientOrUserKey: this.newRecipientOrUserKey.trim() || null,
      smtpHost: this.newSmtpHost.trim() || null,
      smtpPort: this.newSmtpPort,
      smtpUsername: this.newSmtpUsername.trim() || null,
      smtpFromAddress: this.newSmtpFromAddress.trim() || null,
      smtpUseSsl: this.newSmtpUseSsl,
      notifyOnOverdueLoans: this.newNotifyOnOverdueLoans,
      notifyOnMaintenanceDue: this.newNotifyOnMaintenanceDue,
      notifyOnExpiringWarranties: this.newNotifyOnExpiringWarranties,
      notifyOnLowStock: this.newNotifyOnLowStock,
      enableWeeklyDigest: this.newEnableWeeklyDigest,
    };

    this.actionCenterService.createChannel(req).subscribe({
      next: () => {
        this.snackBar.open('Notification channel created.', 'Close', { duration: 3000 });
        this.channelFormOpen.set(false);
        this.resetChannelForm();
        this.loadChannels();
      },
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to create channel.', 'Close', {
          duration: 4000,
        }),
    });
  }

  private resetChannelForm(): void {
    this.newChannelName = '';
    this.newChannelType = NotificationChannelTypes.Ntfy;
    this.newEndpointUrl = '';
    this.newAccessTokenOrKey = '';
    this.newRecipientOrUserKey = '';
    this.newSmtpHost = '';
    this.newSmtpPort = 587;
    this.newSmtpUsername = '';
    this.newSmtpFromAddress = '';
    this.newSmtpUseSsl = true;
    this.newIsSharedHouseholdChannel = false;
  }

  close(): void {
    this.dialogRef.close();
  }
}
