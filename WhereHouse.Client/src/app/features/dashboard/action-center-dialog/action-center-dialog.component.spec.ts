import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ActionCenterOverviewDto } from '../../../core/models/action-center.models';
import { ActionCenterService } from '../../../core/services/action-center/action-center.service';
import { CheckoutLoadoutService } from '../../../core/services/checkout-loadout/checkout-loadout.service';
import { ItemService } from '../../../core/services/item/item.service';
import { MaintenanceService } from '../../../core/services/maintenance/maintenance.service';
import {
  ActionCenterDialogComponent,
  ActionCenterDialogData,
} from './action-center-dialog.component';

describe('ActionCenterDialogComponent', () => {
  let component: ActionCenterDialogComponent;
  let fixture: ComponentFixture<ActionCenterDialogComponent>;

  let mockActionCenterService: {
    getOverview: ReturnType<typeof vi.fn>;
    getChannels: ReturnType<typeof vi.fn>;
    createChannel: ReturnType<typeof vi.fn>;
    updateChannel: ReturnType<typeof vi.fn>;
    deleteChannel: ReturnType<typeof vi.fn>;
    sendTestNotification: ReturnType<typeof vi.fn>;
    sendDigest: ReturnType<typeof vi.fn>;
    getRecentDeliveries: ReturnType<typeof vi.fn>;
  };

  let mockCheckoutLoadoutService: {
    returnItem: ReturnType<typeof vi.fn>;
  };

  let mockMaintenanceService: {
    completeTask: ReturnType<typeof vi.fn>;
  };

  let mockItemService: {
    adjustQuantity: ReturnType<typeof vi.fn>;
  };

  let mockDialogRef: {
    close: ReturnType<typeof vi.fn>;
  };

  const mockOverview: ActionCenterOverviewDto = {
    totalAlertsCount: 4,
    outOfPlaceCount: 1,
    activeLoansCount: 1,
    overdueLoansCount: 1,
    maintenanceDueCount: 1,
    maintenanceOverdueCount: 0,
    expiringCoverageCount: 1,
    lowStockCount: 0,
    outOfPlaceItems: [
      {
        itemId: 'i-1',
        shortCode: 'ITM-001',
        name: 'Impact Driver',
        homeLocationFullPath: 'Garage > Tool Chest',
        daysOut: 3,
        checkedOutByUsername: 'Tyler',
        checkoutNote: 'Deck build',
      },
    ],
    externalLoans: [
      {
        itemId: 'i-2',
        shortCode: 'ITM-002',
        name: 'Tile Saw',
        homeLocationFullPath: 'Shed',
        borrowerName: 'Sarah',
        borrowerContact: 'sarah@example.com',
        isOverdue: true,
        daysUntilDue: -1,
      },
    ],
    dueMaintenanceSchedules: [
      {
        id: 'sch-1',
        itemId: 'i-3',
        itemShortCode: 'ITM-003',
        itemName: 'Lawn Tractor',
        itemLocationFullPath: 'Garage',
        title: 'Check Tire Pressure',
        description: null,
        intervalValue: 30,
        intervalUnit: 0,
        lastCompletedAt: null,
        nextDueAt: '2026-11-01T00:00:00Z',
        isActive: true,
        dueStatus: 1,
        daysUntilDue: 12,
        createdAt: '2026-10-18T00:00:00Z',
        modifiedAt: '2026-10-18T00:00:00Z',
      },
    ],
    expiringCoverages: [
      {
        itemId: 'i-4',
        shortCode: 'ITM-004',
        name: 'Soundbar',
        brand: 'Sonos',
        modelNumber: 'Beam',
        retailer: 'Best Buy',
        purchasePrice: 449,
        homeLocationFullPath: 'Living Room',
        alertType: 0,
        expirationDate: '2026-10-25T00:00:00Z',
        daysRemaining: 6,
        isExpired: false,
      },
    ],
    lowStockItems: [],
  };

  const dialogData: ActionCenterDialogData = {
    initialTab: 'alerts',
    initialFilter: 'all',
  };

  beforeEach(async () => {
    mockActionCenterService = {
      getOverview: vi.fn().mockReturnValue(of(mockOverview)),
      getChannels: vi.fn().mockReturnValue(of([])),
      createChannel: vi.fn(),
      updateChannel: vi.fn(),
      deleteChannel: vi.fn(),
      sendTestNotification: vi.fn(),
      sendDigest: vi.fn().mockReturnValue(
        of({
          channelsTargeted: 1,
          successCount: 1,
          failureCount: 0,
          digestSubject: 'Subject',
          digestBodyPreview: 'Preview',
          deliveries: [],
        }),
      ),
      getRecentDeliveries: vi.fn().mockReturnValue(of([])),
    };

    mockCheckoutLoadoutService = {
      returnItem: vi.fn().mockReturnValue(of({})),
    };

    mockMaintenanceService = {
      completeTask: vi.fn().mockReturnValue(of({})),
    };

    mockItemService = {
      adjustQuantity: vi.fn().mockReturnValue(of({})),
    };

    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ActionCenterDialogComponent],
      providers: [
        { provide: ActionCenterService, useValue: mockActionCenterService },
        { provide: CheckoutLoadoutService, useValue: mockCheckoutLoadoutService },
        { provide: MaintenanceService, useValue: mockMaintenanceService },
        { provide: ItemService, useValue: mockItemService },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionCenterDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and renders action center overview metrics', () => {
    expect(component).toBeTruthy();
    expect(mockActionCenterService.getOverview).toHaveBeenCalledWith(30);
    expect(component.overview()?.totalAlertsCount).toBe(4);
    expect(component.overview()?.outOfPlaceCount).toBe(1);
    expect(component.overview()?.activeLoansCount).toBe(1);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Impact Driver');
    expect(el.textContent).toContain('Tile Saw');
    expect(el.textContent).toContain('Check Tire Pressure');
    expect(el.textContent).toContain('Soundbar');
  });

  it('triggers quick return item when action button tapped', () => {
    component.quickReturnItem('i-1');
    expect(mockCheckoutLoadoutService.returnItem).toHaveBeenCalledWith('i-1', {});
    expect(mockActionCenterService.getOverview).toHaveBeenCalledTimes(2);
  });

  it('triggers quick complete task when action button tapped', () => {
    component.quickCompleteTask('sch-1');
    expect(mockMaintenanceService.completeTask).toHaveBeenCalledWith('sch-1', {});
    expect(mockActionCenterService.getOverview).toHaveBeenCalledTimes(2);
  });

  it('dispatches digest on demand', () => {
    component.sendDigestNow();
    expect(mockActionCenterService.sendDigest).toHaveBeenCalled();
  });
});
