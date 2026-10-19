import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  AttachmentType,
  ItemAttachmentDto,
  UpdateItemAttachmentRequest,
} from '../../models/attachment.models';

@Service()
export class AttachmentService {
  private readonly http = inject(HttpClient);

  getAttachments(itemId: string): Observable<ItemAttachmentDto[]> {
    return this.http.get<ItemAttachmentDto[]>(apiUrl(`/items/${itemId}/attachments`));
  }

  uploadAttachment(
    itemId: string,
    file: File,
    options?: {
      attachmentType?: AttachmentType;
      notes?: string | null;
      isPrimaryPhoto?: boolean;
    },
  ): Observable<ItemAttachmentDto> {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.attachmentType !== undefined && options.attachmentType !== null) {
      formData.append('attachmentType', options.attachmentType.toString());
    }
    if (options?.notes && options.notes.trim()) {
      formData.append('notes', options.notes.trim());
    }
    if (options?.isPrimaryPhoto !== undefined) {
      formData.append('isPrimaryPhoto', options.isPrimaryPhoto ? 'true' : 'false');
    }

    return this.http.post<ItemAttachmentDto>(apiUrl(`/items/${itemId}/attachments`), formData);
  }

  downloadAttachment(itemId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(apiUrl(`/items/${itemId}/attachments/${attachmentId}/content`), {
      responseType: 'blob',
    });
  }

  updateAttachment(
    itemId: string,
    attachmentId: string,
    request: UpdateItemAttachmentRequest,
  ): Observable<ItemAttachmentDto> {
    return this.http.patch<ItemAttachmentDto>(
      apiUrl(`/items/${itemId}/attachments/${attachmentId}`),
      request,
    );
  }

  deleteAttachment(itemId: string, attachmentId: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/items/${itemId}/attachments/${attachmentId}`));
  }
}
