using System.ComponentModel.DataAnnotations;

namespace WhereHouse.Core.Attachments;

public enum AttachmentType
{
    Photo = 0,
    ReceiptInvoice = 1,
    UserManual = 2,
    WarrantyCard = 3,
    SpecSheet = 4,
    RepairLog = 5,
    Other = 6,
}

public sealed record ItemAttachmentDto(
    Guid Id,
    Guid ItemId,
    AttachmentType AttachmentType,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    string? Notes,
    bool IsPrimaryPhoto,
    Guid UploadedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record AttachmentContentResult(
    Stream Content,
    string FileName,
    string ContentType,
    long FileSizeBytes
);

public sealed record UploadItemAttachmentRequest(
    AttachmentType AttachmentType = AttachmentType.Photo,
    [MaxLength(500)] string? Notes = null,
    bool IsPrimaryPhoto = false
);

public sealed record UpdateItemAttachmentRequest(
    AttachmentType AttachmentType,
    [MaxLength(500)] string? Notes = null,
    bool IsPrimaryPhoto = false
);
