import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import { DispositionReason, ItemDto, ItemStatus } from '../../models/item.models';
import {
  ArchiveItemRequest,
  BulkArchiveRequest,
  BulkLifecycleResultDto,
  BulkUnstageRequest,
  DeclutterStagingSummaryDto,
  DustCollectorInsightsDto,
  GraveyardSummaryDto,
  StageItemRequest,
} from '../../models/lifecycle.models';

@Service()
export class LifecycleService {
  private readonly http = inject(HttpClient);

  getStagedItems(
    statusFilter?: ItemStatus,
    locationId?: string,
    includeSubtreeLocations = true,
  ): Observable<DeclutterStagingSummaryDto> {
    let params = new HttpParams().set('includeSubtreeLocations', includeSubtreeLocations);
    if (statusFilter !== undefined && statusFilter !== null) {
      params = params.set('status', statusFilter.toString());
    }
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    return this.http.get<DeclutterStagingSummaryDto>(apiUrl('/lifecycle/staged'), { params });
  }

  getGraveyardItems(
    dispositionReason?: DispositionReason,
    search?: string,
  ): Observable<GraveyardSummaryDto> {
    let params = new HttpParams();
    if (dispositionReason !== undefined && dispositionReason !== null) {
      params = params.set('dispositionReason', dispositionReason.toString());
    }
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<GraveyardSummaryDto>(apiUrl('/lifecycle/graveyard'), { params });
  }

  getDustCollectors(
    minUntouchedDays = 365,
    locationId?: string,
    includeSubtreeLocations = true,
    categoryId?: string,
  ): Observable<DustCollectorInsightsDto> {
    let params = new HttpParams()
      .set('minUntouchedDays', minUntouchedDays.toString())
      .set('includeSubtreeLocations', includeSubtreeLocations);
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    if (categoryId) {
      params = params.set('categoryId', categoryId);
    }
    return this.http.get<DustCollectorInsightsDto>(apiUrl('/lifecycle/dust-collectors'), {
      params,
    });
  }

  stageItem(itemId: string, request: StageItemRequest): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl(`/lifecycle/items/${itemId}/stage`), request);
  }

  unstageItem(itemId: string): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl(`/lifecycle/items/${itemId}/unstage`), {});
  }

  archiveItem(itemId: string, request: ArchiveItemRequest): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl(`/lifecycle/items/${itemId}/archive`), request);
  }

  restoreArchivedItem(itemId: string): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl(`/lifecycle/items/${itemId}/restore`), {});
  }

  touchItem(itemId: string): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl(`/lifecycle/items/${itemId}/touch`), {});
  }

  bulkArchiveItems(request: BulkArchiveRequest): Observable<BulkLifecycleResultDto> {
    return this.http.post<BulkLifecycleResultDto>(apiUrl('/lifecycle/bulk-archive'), request);
  }

  bulkUnstageItems(request: BulkUnstageRequest): Observable<BulkLifecycleResultDto> {
    return this.http.post<BulkLifecycleResultDto>(apiUrl('/lifecycle/bulk-unstage'), request);
  }
}
