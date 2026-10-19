using WhereHouse.Core.Attachments;

namespace WhereHouse.Data.Entities;

public sealed class ItemAttachment : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ItemId { get; set; }

    public InventoryItem Item { get; set; } = null!;

    public AttachmentType AttachmentType { get; set; } = AttachmentType.Photo;

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = "application/octet-stream";

    public long FileSizeBytes { get; set; }

    public string StorageRelativePath { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public string? ExtractedText { get; set; }

    public bool IsPrimaryPhoto { get; set; }

    public Guid UploadedByUserId { get; set; }

    public User UploadedByUser { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
