import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  AttachmentTypes,
  ItemAttachmentDto,
  UpdateItemAttachmentRequest,
} from '../../models/attachment.models';
import { AttachmentService } from './attachment.service';

describe('AttachmentService', () => {
  let service: AttachmentService;
  let httpTesting: HttpTestingController;

  const mockAttachment: ItemAttachmentDto = {
    id: 'att-1',
    itemId: 'itm-1',
    attachmentType: AttachmentTypes.Photo,
    fileName: 'photo.jpg',
    contentType: 'image/jpeg',
    fileSizeBytes: 1024,
    notes: 'Sample note',
    isPrimaryPhoto: true,
    uploadedByUserId: 'u-1',
    createdAt: '2026-10-18T00:00:00Z',
    modifiedAt: '2026-10-18T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AttachmentService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AttachmentService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch attachments for an item', () => {
    service.getAttachments('itm-1').subscribe((attachments) => {
      expect(attachments).toEqual([mockAttachment]);
    });

    const req = httpTesting.expectOne(apiUrl('/items/itm-1/attachments'));
    expect(req.request.method).toBe('GET');
    req.flush([mockAttachment]);
  });

  it('should upload attachment with multipart form data', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });

    service
      .uploadAttachment('itm-1', file, {
        attachmentType: AttachmentTypes.UserManual,
        notes: 'Test manual',
        isPrimaryPhoto: false,
      })
      .subscribe((attachment) => {
        expect(attachment).toEqual(mockAttachment);
      });

    const req = httpTesting.expectOne(apiUrl('/items/itm-1/attachments'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(mockAttachment);
  });

  it('should download attachment content as blob', () => {
    const mockBlob = new Blob(['sample data'], { type: 'application/pdf' });

    service.downloadAttachment('itm-1', 'att-1').subscribe((blob) => {
      expect(blob).toEqual(mockBlob);
    });

    const req = httpTesting.expectOne(apiUrl('/items/itm-1/attachments/att-1/content'));
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(mockBlob);
  });

  it('should update attachment metadata', () => {
    const updateReq: UpdateItemAttachmentRequest = {
      attachmentType: AttachmentTypes.ReceiptInvoice,
      notes: 'Updated invoice',
      isPrimaryPhoto: false,
    };

    service.updateAttachment('itm-1', 'att-1', updateReq).subscribe((res) => {
      expect(res.notes).toBe('Updated invoice');
    });

    const req = httpTesting.expectOne(apiUrl('/items/itm-1/attachments/att-1'));
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...mockAttachment, notes: 'Updated invoice' });
  });

  it('should delete attachment', () => {
    service.deleteAttachment('itm-1', 'att-1').subscribe();

    const req = httpTesting.expectOne(apiUrl('/items/itm-1/attachments/att-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
