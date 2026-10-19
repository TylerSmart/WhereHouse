import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  BarcodeProductLookupDto,
  CsvImportRequest,
  ImportResultDto,
  JsonImportRequest,
  PortabilityEntityType,
  RapidBatchIntakeRequest,
  RapidBatchIntakeResponseDto,
  RapidIntakeItemRequest,
  WhereHouseExportBundleDto,
} from '../../models/intake-portability.models';
import { ItemDto } from '../../models/item.models';

@Service()
export class IntakePortabilityService {
  private readonly http = inject(HttpClient);

  lookupBarcode(barcode: string): Observable<BarcodeProductLookupDto> {
    return this.http.get<BarcodeProductLookupDto>(
      apiUrl(`/intake/barcode/${encodeURIComponent(barcode.trim())}`),
    );
  }

  createRapidItem(request: RapidIntakeItemRequest): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl('/intake/rapid'), request);
  }

  createRapidBatch(request: RapidBatchIntakeRequest): Observable<RapidBatchIntakeResponseDto> {
    return this.http.post<RapidBatchIntakeResponseDto>(apiUrl('/intake/rapid-batch'), request);
  }

  exportJsonBundle(): Observable<WhereHouseExportBundleDto> {
    return this.http.get<WhereHouseExportBundleDto>(apiUrl('/portability/export/json'));
  }

  exportCsv(entityType: PortabilityEntityType): Observable<string> {
    const params = new HttpParams().set('entityType', entityType.toString());
    return this.http.get(apiUrl('/portability/export/csv'), {
      params,
      responseType: 'text',
    });
  }

  importJsonBundle(request: JsonImportRequest): Observable<ImportResultDto> {
    return this.http.post<ImportResultDto>(apiUrl('/portability/import/json'), request);
  }

  importCsv(request: CsvImportRequest): Observable<ImportResultDto> {
    return this.http.post<ImportResultDto>(apiUrl('/portability/import/csv'), request);
  }
}
