import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  ActionCenterOverviewDto,
  CreateNotificationChannelRequest,
  NotificationChannelDto,
  NotificationChannelTypes,
  NotificationDeliveryLogDto,
  NotificationDispatchResultDto,
  NotificationEventTypes,
} from '../../models/action-center.models';
import { ActionCenterService } from './action-center.service';

describe('ActionCenterService', () => {
  let service: ActionCenterService;
  let httpTesting: HttpTestingController;

  const mockOverview: ActionCenterOverviewDto = {
    totalAlertsCount: 3,
    outOfPlaceCount: 1,
    activeLoansCount: 1,
    overdueLoansCount: 1,
    maintenanceDueCount: 0,
    maintenanceOverdueCount: 0,
    expiringCoverageCount: 1,
    lowStockCount: 0,
    outOfPlaceItems: [
      {
        itemId: 'i-1',
        shortCode: 'ITM-001',
        name: 'Drill',
        daysOut: 2,
      },
    ],
    externalLoans: [
      {
        itemId: 'i-2',
        shortCode: 'ITM-002',
        name: 'Saw',
        borrowerName: 'Bob',
        isOverdue: true,
        daysUntilDue: -2,
      },
    ],
    dueMaintenanceSchedules: [],
    expiringCoverages: [],
    lowStockItems: [],
  };

  const mockChannel: NotificationChannelDto = {
    id: 'chan-1',
    ownerId: 'u-1',
    name: 'Home Ntfy',
    channelType: NotificationChannelTypes.Ntfy,
    isEnabled: true,
    isSharedHouseholdChannel: false,
    endpointUrl: 'https://ntfy.sh/my-topic',
    hasAccessTokenOrKey: false,
    smtpUseSsl: true,
    notifyOnOverdueLoans: true,
    notifyOnMaintenanceDue: true,
    notifyOnExpiringWarranties: true,
    notifyOnLowStock: true,
    enableWeeklyDigest: true,
    digestDayOfWeek: 0,
    digestHourUtc: 9,
    createdAt: '2026-10-19T00:00:00Z',
    modifiedAt: '2026-10-19T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ActionCenterService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ActionCenterService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('gets action center overview with query param', () => {
    service.getOverview(45).subscribe((res) => {
      expect(res.totalAlertsCount).toBe(3);
      expect(res.outOfPlaceItems.length).toBe(1);
    });

    const req = httpTesting.expectOne(apiUrl('/action-center?coverageWindowDays=45'));
    expect(req.request.method).toBe('GET');
    req.flush(mockOverview);
  });

  it('gets channels and creates channel', () => {
    service.getChannels().subscribe((res) => {
      expect(res.length).toBe(1);
      expect(res[0].name).toBe('Home Ntfy');
    });

    const getReq = httpTesting.expectOne(apiUrl('/action-center/channels'));
    expect(getReq.request.method).toBe('GET');
    getReq.flush([mockChannel]);

    const createReq: CreateNotificationChannelRequest = {
      name: 'New Channel',
      channelType: NotificationChannelTypes.SlackWebhook,
      endpointUrl: 'https://hooks.slack.com/services/...',
    };

    service.createChannel(createReq).subscribe((res) => {
      expect(res.id).toBe('chan-1');
    });

    const postReq = httpTesting.expectOne(apiUrl('/action-center/channels'));
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual(createReq);
    postReq.flush(mockChannel);
  });

  it('sends test notification and digest', () => {
    const mockLog: NotificationDeliveryLogDto = {
      id: 'log-1',
      channelId: 'chan-1',
      channelName: 'Home Ntfy',
      channelType: NotificationChannelTypes.Ntfy,
      eventType: NotificationEventTypes.TestNotification,
      subject: 'Test Notification',
      messageBody: 'Hello',
      success: true,
      deliveredAt: '2026-10-19T10:00:00Z',
    };

    service.sendTestNotification('chan-1').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const testReq = httpTesting.expectOne(apiUrl('/action-center/channels/chan-1/test'));
    expect(testReq.request.method).toBe('POST');
    testReq.flush(mockLog);

    const mockDigestResult: NotificationDispatchResultDto = {
      channelsTargeted: 1,
      successCount: 1,
      failureCount: 0,
      digestSubject: 'WhereHouse Digest',
      digestBodyPreview: 'Preview',
      deliveries: [mockLog],
    };

    service.sendDigest({ channelId: 'chan-1' }).subscribe((res) => {
      expect(res.channelsTargeted).toBe(1);
    });

    const digestReq = httpTesting.expectOne(apiUrl('/action-center/digest/send'));
    expect(digestReq.request.method).toBe('POST');
    digestReq.flush(mockDigestResult);
  });
});
