import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  ActionCenterOverviewDto,
  CreateNotificationChannelRequest,
  NotificationChannelDto,
  NotificationDeliveryLogDto,
  NotificationDispatchResultDto,
  SendNotificationDigestRequest,
  UpdateNotificationChannelRequest,
} from '../../models/action-center.models';

@Service()
export class ActionCenterService {
  private readonly http = inject(HttpClient);

  getOverview(coverageWindowDays = 30): Observable<ActionCenterOverviewDto> {
    const params = new HttpParams().set('coverageWindowDays', coverageWindowDays.toString());
    return this.http.get<ActionCenterOverviewDto>(apiUrl('/action-center'), { params });
  }

  getChannels(): Observable<NotificationChannelDto[]> {
    return this.http.get<NotificationChannelDto[]>(apiUrl('/action-center/channels'));
  }

  getChannelById(channelId: string): Observable<NotificationChannelDto> {
    return this.http.get<NotificationChannelDto>(apiUrl(`/action-center/channels/${channelId}`));
  }

  createChannel(request: CreateNotificationChannelRequest): Observable<NotificationChannelDto> {
    return this.http.post<NotificationChannelDto>(apiUrl('/action-center/channels'), request);
  }

  updateChannel(
    channelId: string,
    request: UpdateNotificationChannelRequest,
  ): Observable<NotificationChannelDto> {
    return this.http.put<NotificationChannelDto>(
      apiUrl(`/action-center/channels/${channelId}`),
      request,
    );
  }

  deleteChannel(channelId: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/action-center/channels/${channelId}`));
  }

  sendTestNotification(channelId: string): Observable<NotificationDeliveryLogDto> {
    return this.http.post<NotificationDeliveryLogDto>(
      apiUrl(`/action-center/channels/${channelId}/test`),
      {},
    );
  }

  sendDigest(request?: SendNotificationDigestRequest): Observable<NotificationDispatchResultDto> {
    return this.http.post<NotificationDispatchResultDto>(
      apiUrl('/action-center/digest/send'),
      request ?? {},
    );
  }

  getRecentDeliveries(limit = 30): Observable<NotificationDeliveryLogDto[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<NotificationDeliveryLogDto[]>(apiUrl('/action-center/deliveries'), {
      params,
    });
  }
}
