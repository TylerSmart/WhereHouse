import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  InsuranceClaimFilterParams,
  InsuranceClaimPreviewDto,
} from '../../models/insurance.models';

@Service()
export class InsuranceService {
  private readonly http = inject(HttpClient);

  getPreview(params: InsuranceClaimFilterParams): Observable<InsuranceClaimPreviewDto> {
    const httpParams = this.buildParams(params);
    return this.http.get<InsuranceClaimPreviewDto>(apiUrl('/insurance/preview'), {
      params: httpParams,
    });
  }

  exportZip(params: InsuranceClaimFilterParams): Observable<Blob> {
    const httpParams = this.buildParams(params);
    return this.http.get(apiUrl('/insurance/export-zip'), {
      params: httpParams,
      responseType: 'blob',
    });
  }

  private buildParams(params: InsuranceClaimFilterParams): HttpParams {
    let httpParams = new HttpParams();
    if (params.locationId) {
      httpParams = httpParams.set('locationId', params.locationId);
    }
    if (params.includeSubtree !== undefined) {
      httpParams = httpParams.set('includeSubtree', params.includeSubtree ? 'true' : 'false');
    }
    if (params.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }
    if (params.minValue !== undefined && params.minValue !== null) {
      httpParams = httpParams.set('minValue', params.minValue.toString());
    }
    if (params.includeArchived !== undefined) {
      httpParams = httpParams.set('includeArchived', params.includeArchived ? 'true' : 'false');
    }
    if (params.includeAttachments !== undefined) {
      httpParams = httpParams.set(
        'includeAttachments',
        params.includeAttachments ? 'true' : 'false',
      );
    }
    return httpParams;
  }
}
