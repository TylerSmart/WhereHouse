import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { apiUrl } from '../../api/api-url';
import {
  BindQrCodeRequest,
  BulkScanAuditRequest,
  BulkScanAuditResponseDto,
  GenerateQrCodeBatchRequest,
  QrCodeDto,
  QrTargetTypes,
  ScanResolutionDto,
  ScanResolutionTypes,
} from '../../models/qrcode.models';
import { QrCodeService } from './qrcode.service';

describe('QrCodeService', () => {
  let service: QrCodeService;
  let httpTesting: HttpTestingController;

  const mockQr: QrCodeDto = {
    id: 'qr-1',
    token: 'QR-0001',
    targetType: QrTargetTypes.Unassigned,
    printedCount: 1,
    createdByUserId: 'u-1',
    createdAt: '2026-10-18T00:00:00Z',
    modifiedAt: '2026-10-18T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [QrCodeService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(QrCodeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('getQrCodes sends GET request with optional targetType filter', () => {
    service.getQrCodes(QrTargetTypes.Unassigned).subscribe((data) => {
      expect(data).toEqual([mockQr]);
    });

    const req = httpTesting.expectOne((r) => r.url.startsWith(apiUrl('/qrcodes')));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('targetType')).toBe('0');
    req.flush([mockQr]);
  });

  it('generateBatch sends POST request to /api/qrcodes/batch', () => {
    const batchReq: GenerateQrCodeBatchRequest = {
      count: 5,
      prefix: 'QR',
      labelNote: 'New Bin Stickers',
    };

    service.generateBatch(batchReq).subscribe((data) => {
      expect(data.length).toBe(1);
    });

    const req = httpTesting.expectOne(apiUrl('/qrcodes/batch'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(batchReq);
    req.flush([mockQr]);
  });

  it('bindQrCode sends POST request with encoded token', () => {
    const bindReq: BindQrCodeRequest = {
      targetType: QrTargetTypes.LocationNode,
      targetId: 'loc-1',
      labelNote: 'Box 1',
    };

    service.bindQrCode('QR-0001', bindReq).subscribe((data) => {
      expect(data.targetType).toBe(QrTargetTypes.LocationNode);
    });

    const req = httpTesting.expectOne(apiUrl('/qrcodes/QR-0001/bind'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(bindReq);
    req.flush({ ...mockQr, targetType: QrTargetTypes.LocationNode });
  });

  it('unbindQrCode sends POST request to /api/qrcodes/{token}/unbind', () => {
    service.unbindQrCode('QR-0001').subscribe((data) => {
      expect(data.targetType).toBe(QrTargetTypes.Unassigned);
    });

    const req = httpTesting.expectOne(apiUrl('/qrcodes/QR-0001/unbind'));
    expect(req.request.method).toBe('POST');
    req.flush(mockQr);
  });

  it('deleteQrCode sends DELETE request', () => {
    service.deleteQrCode('qr-1').subscribe();

    const req = httpTesting.expectOne(apiUrl('/qrcodes/qr-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('resolveScan sends GET request with encoded code', () => {
    const mockResolution: ScanResolutionDto = {
      scannedCode: 'BIN-001',
      resolutionType: ScanResolutionTypes.LocationNode,
      message: 'Found container',
    };

    service.resolveScan('BIN-001').subscribe((data) => {
      expect(data.resolutionType).toBe(ScanResolutionTypes.LocationNode);
    });

    const req = httpTesting.expectOne(apiUrl('/scan/BIN-001'));
    expect(req.request.method).toBe('GET');
    req.flush(mockResolution);
  });

  it('bulkMoveAudit sends POST request to /api/scan/bulk-move-audit', () => {
    const auditReq: BulkScanAuditRequest = {
      destinationLocationId: 'dest-1',
      scannedCodes: ['BIN-001', 'ITM-002'],
    };

    const mockResponse: BulkScanAuditResponseDto = {
      destinationLocationId: 'dest-1',
      destinationName: 'Garage Shelf',
      destinationShortCode: 'LOC-001',
      destinationFullPath: 'Garage / Shelf',
      auditedAt: '2026-10-18T00:00:00Z',
      movedCount: 1,
      auditedPresentCount: 1,
      errorOrSkippedCount: 0,
      results: [],
    };

    service.bulkMoveAudit(auditReq).subscribe((data) => {
      expect(data.movedCount).toBe(1);
    });

    const req = httpTesting.expectOne(apiUrl('/scan/bulk-move-audit'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(auditReq);
    req.flush(mockResponse);
  });
});
