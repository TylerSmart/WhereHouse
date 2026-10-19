import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  CompleteMaintenanceTaskRequest,
  CreateMaintenanceScheduleRequest,
  MaintenanceLogDto,
  MaintenanceScheduleDto,
  MaintenanceSummaryDto,
  UpdateMaintenanceScheduleRequest,
} from '../../models/maintenance.models';

@Service()
export class MaintenanceService {
  private readonly http = inject(HttpClient);

  getSummary(itemId?: string | null, dueOnly?: boolean): Observable<MaintenanceSummaryDto> {
    let params = new HttpParams();
    if (itemId) {
      params = params.set('itemId', itemId);
    }
    if (dueOnly !== undefined) {
      params = params.set('dueOnly', dueOnly ? 'true' : 'false');
    }
    return this.http.get<MaintenanceSummaryDto>(apiUrl('/maintenance'), { params });
  }

  getItemSchedules(itemId: string): Observable<MaintenanceScheduleDto[]> {
    return this.http.get<MaintenanceScheduleDto[]>(
      apiUrl(`/maintenance/items/${itemId}/schedules`),
    );
  }

  getItemLogs(itemId: string): Observable<MaintenanceLogDto[]> {
    return this.http.get<MaintenanceLogDto[]>(apiUrl(`/maintenance/items/${itemId}/logs`));
  }

  createSchedule(
    itemId: string,
    request: CreateMaintenanceScheduleRequest,
  ): Observable<MaintenanceScheduleDto> {
    return this.http.post<MaintenanceScheduleDto>(
      apiUrl(`/maintenance/items/${itemId}/schedules`),
      request,
    );
  }

  updateSchedule(
    scheduleId: string,
    request: UpdateMaintenanceScheduleRequest,
  ): Observable<MaintenanceScheduleDto> {
    return this.http.put<MaintenanceScheduleDto>(
      apiUrl(`/maintenance/schedules/${scheduleId}`),
      request,
    );
  }

  completeTask(
    scheduleId: string,
    request: CompleteMaintenanceTaskRequest,
  ): Observable<MaintenanceScheduleDto> {
    return this.http.post<MaintenanceScheduleDto>(
      apiUrl(`/maintenance/schedules/${scheduleId}/complete`),
      request,
    );
  }

  deleteSchedule(scheduleId: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/maintenance/schedules/${scheduleId}`));
  }
}
