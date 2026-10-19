import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  BindQrCodeRequest,
  BulkScanAuditRequest,
  BulkScanAuditResponseDto,
  GenerateQrCodeBatchRequest,
  QrCodeDto,
  QrTargetType,
  ScanResolutionDto,
} from '../../models/qrcode.models';

@Service()
export class QrCodeService {
  private readonly http = inject(HttpClient);

  getQrCodes(targetType?: QrTargetType): Observable<QrCodeDto[]> {
    let params = new HttpParams();
    if (targetType !== undefined && targetType !== null) {
      params = params.set('targetType', targetType.toString());
    }
    return this.http.get<QrCodeDto[]>(apiUrl('/qrcodes'), { params });
  }

  generateBatch(request: GenerateQrCodeBatchRequest): Observable<QrCodeDto[]> {
    return this.http.post<QrCodeDto[]>(apiUrl('/qrcodes/batch'), request);
  }

  bindQrCode(token: string, request: BindQrCodeRequest): Observable<QrCodeDto> {
    return this.http.post<QrCodeDto>(apiUrl(`/qrcodes/${encodeURIComponent(token)}/bind`), request);
  }

  unbindQrCode(token: string): Observable<QrCodeDto> {
    return this.http.post<QrCodeDto>(apiUrl(`/qrcodes/${encodeURIComponent(token)}/unbind`), {});
  }

  deleteQrCode(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/qrcodes/${id}`));
  }

  resolveScan(codeOrUrl: string): Observable<ScanResolutionDto> {
    return this.http.get<ScanResolutionDto>(apiUrl(`/scan/${encodeURIComponent(codeOrUrl)}`));
  }

  bulkMoveAudit(request: BulkScanAuditRequest): Observable<BulkScanAuditResponseDto> {
    return this.http.post<BulkScanAuditResponseDto>(apiUrl('/scan/bulk-move-audit'), request);
  }
}
