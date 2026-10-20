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
  templateUrl: './action-center-dialog.component.html',
  styleUrl: './action-center-dialog.component.scss',
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
