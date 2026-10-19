import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import { SmartSearchParams, SmartSearchResponseDto } from '../../models/search.models';

@Service()
export class SearchService {
  private readonly http = inject(HttpClient);

  search(params: SmartSearchParams): Observable<SmartSearchResponseDto> {
    let httpParams = new HttpParams();

    if (params.q && params.q.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }
    if (params.locationId) {
      httpParams = httpParams.set('locationId', params.locationId);
    }
    if (params.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }
    if (params.itemType !== undefined && params.itemType !== null) {
      httpParams = httpParams.set('itemType', params.itemType.toString());
    }
    if (params.status !== undefined && params.status !== null) {
      httpParams = httpParams.set('status', params.status.toString());
    }
    if (params.outOfPlaceOnly) {
      httpParams = httpParams.set('outOfPlaceOnly', 'true');
    }
    if (params.lowStockOnly) {
      httpParams = httpParams.set('lowStockOnly', 'true');
    }
    if (params.attributeName && params.attributeName.trim()) {
      httpParams = httpParams.set('attributeName', params.attributeName.trim());
    }
    if (params.attributeValue && params.attributeValue.trim()) {
      httpParams = httpParams.set('attributeValue', params.attributeValue.trim());
    }
    if (params.attributeMinNumber !== undefined && params.attributeMinNumber !== null) {
      httpParams = httpParams.set('attributeMinNumber', params.attributeMinNumber.toString());
    }
    if (params.attributeMaxNumber !== undefined && params.attributeMaxNumber !== null) {
      httpParams = httpParams.set('attributeMaxNumber', params.attributeMaxNumber.toString());
    }
    if (params.includeArchived !== undefined) {
      httpParams = httpParams.set('includeArchived', params.includeArchived ? 'true' : 'false');
    }

    return this.http.get<SmartSearchResponseDto>(apiUrl('/search'), { params: httpParams });
  }
}
