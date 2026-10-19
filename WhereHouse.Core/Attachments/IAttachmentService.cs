namespace WhereHouse.Core.Attachments;

public interface IAttachmentService
{
    Task<IReadOnlyList<ItemAttachmentDto>?> GetAttachmentsAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    );

    Task<ItemAttachmentDto?> UploadAttachmentAsync(
        Guid userId,
        Guid itemId,
        Stream fileStream,
        string originalFileName,
        string contentType,
        long fileSizeBytes,
        UploadItemAttachmentRequest request,
        CancellationToken cancellationToken = default
    );

    Task<AttachmentContentResult?> OpenAttachmentContentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        CancellationToken cancellationToken = default
    );

    Task<ItemAttachmentDto?> UpdateAttachmentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        UpdateItemAttachmentRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteAttachmentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        CancellationToken cancellationToken = default
    );
}
