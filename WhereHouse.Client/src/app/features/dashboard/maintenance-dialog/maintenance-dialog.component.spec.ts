import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import {
  MaintenanceDueStatuses,
  MaintenanceIntervalUnits,
  MaintenanceScheduleDto,
  MaintenanceSummaryDto,
} from '../../../core/models/maintenance.models';
import { MaintenanceService } from '../../../core/services/maintenance/maintenance.service';
import { MaintenanceDialogComponent, MaintenanceDialogData } from './maintenance-dialog.component';

describe('MaintenanceDialogComponent', () => {
  let component: MaintenanceDialogComponent;
  let fixture: ComponentFixture<MaintenanceDialogComponent>;
  let mockMaintenanceService: {
    getSummary: ReturnType<typeof vi.fn>;
    createSchedule: ReturnType<typeof vi.fn>;
    completeTask: ReturnType<typeof vi.fn>;
    deleteSchedule: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: {
    close: ReturnType<typeof vi.fn>;
  };

  const mockSchedule: MaintenanceScheduleDto = {
    id: 'sch-1',
    itemId: 'itm-1',
    itemShortCode: 'ITM-001',
    itemName: 'Table Saw',
    itemLocationFullPath: 'Workshop',
    title: 'Lubricate Trunnion Gears',
    description: 'Use dry PTFE lube',
    intervalValue: 90,
    intervalUnit: MaintenanceIntervalUnits.Days,
    lastCompletedAt: null,
    nextDueAt: '2026-11-01T00:00:00Z',
    isActive: true,
    dueStatus: MaintenanceDueStatuses.DueSoon,
    daysUntilDue: 12,
    createdAt: '2026-10-18T00:00:00Z',
    modifiedAt: '2026-10-18T00:00:00Z',
  };

  const mockSummary: MaintenanceSummaryDto = {
    totalActiveSchedules: 1,
    overdueCount: 0,
    dueSoonCount: 1,
    upToDateCount: 0,
    schedules: [mockSchedule],
    recentLogs: [],
  };

  const dialogData: MaintenanceDialogData = {
    item: {
      id: 'itm-1',
      shortCode: 'ITM-001',
      name: 'Table Saw',
      description: null,
      aliases: [],
      tags: [],
      itemType: 0,
      status: 0,
      condition: 0,
      homeLocationId: null,
      homeLocationName: null,
      homeLocationShortCode: null,
      homeLocationFullPath: null,
      categoryId: null,
      categoryName: null,
      parentItemId: null,
      parentItemName: null,
      brand: null,
      modelNumber: null,
      serialNumber: null,
      currentQuantity: 1,
      unit: null,
      minQuantity: null,
      isLowStock: false,
      isIncompleteKit: false,
      incompleteKitWarnings: [],
      purchaseDate: null,
      retailer: null,
      purchasePrice: null,
      estimatedReplacementValue: null,
      returnWindowEndDate: null,
      warrantyExpirationDate: null,
      warrantyNotes: null,
      isPrivate: false,
      ownerId: 'u-1',
      attributeValues: [],
      childItems: [],
      lastTouchedAt: '2026-10-18T00:00:00Z',
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    },
  };

  beforeEach(async () => {
    mockMaintenanceService = {
      getSummary: vi.fn().mockReturnValue(of(mockSummary)),
      createSchedule: vi.fn().mockReturnValue(of(mockSchedule)),
      completeTask: vi.fn().mockReturnValue(of(mockSchedule)),
      deleteSchedule: vi.fn().mockReturnValue(of(undefined)),
    };
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MaintenanceDialogComponent],
      providers: [
        { provide: MaintenanceService, useValue: mockMaintenanceService },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MaintenanceDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and renders maintenance summary', () => {
    expect(component).toBeTruthy();
    expect(mockMaintenanceService.getSummary).toHaveBeenCalledWith('itm-1', false);
    expect(component['summary']()?.totalActiveSchedules).toBe(1);
    expect(component['summary']()?.dueSoonCount).toBe(1);
  });

  it('toggles add form and applies preset', () => {
    expect(component['showAddForm']()).toBe(false);
    component.toggleAddForm();
    expect(component['showAddForm']()).toBe(true);

    component.applyPreset(component['presets'][0]);
    expect(component['newScheduleTitle']).toBe('Top-off Battery to 80%');
    expect(component['newScheduleIntervalValue']).toBe(90);
    expect(component['newScheduleIntervalUnit']).toBe(0);
  });

  it('creates a new schedule and reloads summary', () => {
    component['newScheduleTitle'] = 'Check Blade Alignment';
    component['newScheduleIntervalValue'] = 60;
    component['newScheduleIntervalUnit'] = 0;

    component.saveNewSchedule();

    expect(mockMaintenanceService.createSchedule).toHaveBeenCalled();
  });

  it('closes dialog on close()', () => {
    component.close();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});
