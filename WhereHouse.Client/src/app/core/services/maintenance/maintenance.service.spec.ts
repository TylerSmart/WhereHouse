import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  CompleteMaintenanceTaskRequest,
  CreateMaintenanceScheduleRequest,
  MaintenanceDueStatuses,
  MaintenanceIntervalUnits,
  MaintenanceLogDto,
  MaintenanceScheduleDto,
  MaintenanceSummaryDto,
  UpdateMaintenanceScheduleRequest,
} from '../../models/maintenance.models';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let httpTesting: HttpTestingController;

  const mockSchedule: MaintenanceScheduleDto = {
    id: 'sch-1',
    itemId: 'itm-1',
    itemShortCode: 'ITM-001',
    itemName: 'Cordless Drill',
    itemLocationFullPath: 'Garage > Workbench',
    title: 'Battery Maintenance',
    description: 'Top off to 80%',
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

  const mockLog: MaintenanceLogDto = {
    id: 'log-1',
    scheduleId: 'sch-1',
    itemId: 'itm-1',
    itemShortCode: 'ITM-001',
    itemName: 'Cordless Drill',
    scheduleTitle: 'Battery Maintenance',
    completedAt: '2026-10-18T10:00:00Z',
    completedByUserId: 'u-1',
    completedByUsername: 'testuser',
    notes: 'Charged to 80%',
    cost: 0,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MaintenanceService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(MaintenanceService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('gets maintenance summary', () => {
    const mockSummary: MaintenanceSummaryDto = {
      totalActiveSchedules: 1,
      overdueCount: 0,
      dueSoonCount: 1,
      upToDateCount: 0,
      schedules: [mockSchedule],
      recentLogs: [mockLog],
    };

    service.getSummary('itm-1', true).subscribe((res) => {
      expect(res).toEqual(mockSummary);
    });

    const req = httpTesting.expectOne((r) => r.url === apiUrl('/maintenance'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('itemId')).toBe('itm-1');
    expect(req.request.params.get('dueOnly')).toBe('true');
    req.flush(mockSummary);
  });

  it('gets item schedules and logs', () => {
    service.getItemSchedules('itm-1').subscribe((res) => {
      expect(res).toEqual([mockSchedule]);
    });
    const req1 = httpTesting.expectOne(apiUrl('/maintenance/items/itm-1/schedules'));
    expect(req1.request.method).toBe('GET');
    req1.flush([mockSchedule]);

    service.getItemLogs('itm-1').subscribe((res) => {
      expect(res).toEqual([mockLog]);
    });
    const req2 = httpTesting.expectOne(apiUrl('/maintenance/items/itm-1/logs'));
    expect(req2.request.method).toBe('GET');
    req2.flush([mockLog]);
  });

  it('creates, updates, completes and deletes schedule', () => {
    const createReq: CreateMaintenanceScheduleRequest = {
      title: 'Filter Replacement',
      intervalValue: 30,
      intervalUnit: MaintenanceIntervalUnits.Days,
    };

    service.createSchedule('itm-1', createReq).subscribe((res) => {
      expect(res.id).toBe('sch-1');
    });
    const req1 = httpTesting.expectOne(apiUrl('/maintenance/items/itm-1/schedules'));
    expect(req1.request.method).toBe('POST');
    expect(req1.request.body).toEqual(createReq);
    req1.flush(mockSchedule);

    const updateReq: UpdateMaintenanceScheduleRequest = {
      title: 'Filter Replacement (Updated)',
      intervalValue: 60,
    };
    service.updateSchedule('sch-1', updateReq).subscribe((res) => {
      expect(res.id).toBe('sch-1');
    });
    const req2 = httpTesting.expectOne(apiUrl('/maintenance/schedules/sch-1'));
    expect(req2.request.method).toBe('PUT');
    req2.flush(mockSchedule);

    const completeReq: CompleteMaintenanceTaskRequest = {
      notes: 'Done',
      cost: 15,
    };
    service.completeTask('sch-1', completeReq).subscribe((res) => {
      expect(res.id).toBe('sch-1');
    });
    const req3 = httpTesting.expectOne(apiUrl('/maintenance/schedules/sch-1/complete'));
    expect(req3.request.method).toBe('POST');
    req3.flush(mockSchedule);

    service.deleteSchedule('sch-1').subscribe();
    const req4 = httpTesting.expectOne(apiUrl('/maintenance/schedules/sch-1'));
    expect(req4.request.method).toBe('DELETE');
    req4.flush(null);
  });
});
