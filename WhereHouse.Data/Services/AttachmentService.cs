using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Attachments;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Storage;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class AttachmentService(
    WhereHouseDbContext dbContext,
    IFileStorageService fileStorageService
) : IAttachmentService
{
    private const long MaxAllowedFileSizeBytes = 50L * 1024L * 1024L; // 50 MB

    public async Task<IReadOnlyList<ItemAttachmentDto>?> GetAttachmentsAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        var item = await VerifyItemAccessAsync(userId, itemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var attachments = await dbContext
            .ItemAttachments.AsNoTracking()
            .Where(a => a.ItemId == itemId)
            .OrderByDescending(a => a.IsPrimaryPhoto)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

        return attachments.Select(MapToDto).ToList();
    }

    public async Task<ItemAttachmentDto?> UploadAttachmentAsync(
        Guid userId,
        Guid itemId,
        Stream fileStream,
        string originalFileName,
        string contentType,
        long fileSizeBytes,
        UploadItemAttachmentRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(fileStream);
        ArgumentNullException.ThrowIfNull(request);

        if (fileSizeBytes <= 0 || fileSizeBytes > MaxAllowedFileSizeBytes)
        {
            throw new ArgumentException(
                $"File size must be between 1 byte and {MaxAllowedFileSizeBytes / (1024 * 1024)} MB.",
                nameof(fileSizeBytes)
            );
        }

        var item = await VerifyItemAccessAsync(userId, itemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var stored = await fileStorageService.SaveFileAsync(
            fileStream,
            originalFileName,
            cancellationToken
        );

        var existingAttachments = await dbContext
            .ItemAttachments.Where(a => a.ItemId == itemId)
            .ToListAsync(cancellationToken);

        var shouldBePrimary =
            request.IsPrimaryPhoto
            || (
                request.AttachmentType == AttachmentType.Photo
                && !existingAttachments.Any(a => a.IsPrimaryPhoto)
            );

        if (shouldBePrimary && existingAttachments.Count > 0)
        {
            foreach (var existing in existingAttachments.Where(a => a.IsPrimaryPhoto))
            {
                existing.IsPrimaryPhoto = false;
            }
        }

        var attachment = new ItemAttachment
        {
            ItemId = itemId,
            AttachmentType = request.AttachmentType,
            FileName = stored.SanitizedFileName,
            ContentType = string.IsNullOrWhiteSpace(contentType)
                ? "application/octet-stream"
                : contentType.Trim(),
            FileSizeBytes = stored.FileSizeBytes,
            StorageRelativePath = stored.StorageRelativePath,
            Notes = request.Notes?.Trim(),
            IsPrimaryPhoto = shouldBePrimary,
            UploadedByUserId = userId,
        };

        dbContext.ItemAttachments.Add(attachment);
        item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(attachment);
    }

    public async Task<AttachmentContentResult?> OpenAttachmentContentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        CancellationToken cancellationToken = default
    )
    {
        var item = await VerifyItemAccessAsync(userId, itemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var attachment = await dbContext
            .ItemAttachments.AsNoTracking()
            .SingleOrDefaultAsync(
                a => a.Id == attachmentId && a.ItemId == itemId,
                cancellationToken
            );

        if (attachment is null)
        {
            return null;
        }

        var stream = await fileStorageService.OpenReadAsync(
            attachment.StorageRelativePath,
            cancellationToken
        );
        if (stream is null)
        {
            return null;
        }

        return new AttachmentContentResult(
            stream,
            attachment.FileName,
            attachment.ContentType,
            attachment.FileSizeBytes
        );
    }

    public async Task<ItemAttachmentDto?> UpdateAttachmentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        UpdateItemAttachmentRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var item = await VerifyItemAccessAsync(userId, itemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var attachment = await dbContext.ItemAttachments.SingleOrDefaultAsync(
            a => a.Id == attachmentId && a.ItemId == itemId,
            cancellationToken
        );

        if (attachment is null)
        {
            return null;
        }

        if (request.IsPrimaryPhoto && !attachment.IsPrimaryPhoto)
        {
            var otherAttachments = await dbContext
                .ItemAttachments.Where(a => a.ItemId == itemId && a.Id != attachmentId)
                .ToListAsync(cancellationToken);

            foreach (var other in otherAttachments.Where(a => a.IsPrimaryPhoto))
            {
                other.IsPrimaryPhoto = false;
            }
        }

        attachment.AttachmentType = request.AttachmentType;
        attachment.Notes = request.Notes?.Trim();
        attachment.IsPrimaryPhoto = request.IsPrimaryPhoto;
        item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(attachment);
    }

    public async Task<bool> DeleteAttachmentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        CancellationToken cancellationToken = default
    )
    {
        var item = await VerifyItemAccessAsync(userId, itemId, cancellationToken);
        if (item is null)
        {
            return false;
        }

        var attachment = await dbContext.ItemAttachments.SingleOrDefaultAsync(
            a => a.Id == attachmentId && a.ItemId == itemId,
            cancellationToken
        );

        if (attachment is null)
        {
            return false;
        }

        dbContext.ItemAttachments.Remove(attachment);
        item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        await fileStorageService.DeleteFileAsync(attachment.StorageRelativePath, cancellationToken);

        return true;
    }

    private async Task<InventoryItem?> VerifyItemAccessAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken
    )
    {
        var item = await dbContext.InventoryItems.SingleOrDefaultAsync(
            i => i.Id == itemId,
            cancellationToken
        );

        if (item is null)
        {
            return null;
        }

        if (item.IsPrivate && item.OwnerId != userId)
        {
            throw new ForbiddenException(
                "You do not have permission to access attachments for this private item."
            );
        }

        if (item.HomeLocationId.HasValue)
        {
            var allLocations = await dbContext
                .LocationNodes.AsNoTracking()
                .ToListAsync(cancellationToken);

            var locationMap = allLocations.ToDictionary(n => n.Id);
            var currentId = item.HomeLocationId;

            while (currentId.HasValue && locationMap.TryGetValue(currentId.Value, out var loc))
            {
                if (loc.IsPrivate && loc.OwnerId != userId)
                {
                    throw new ForbiddenException(
                        "You do not have permission to access attachments for this item stored in a private location."
                    );
                }
                currentId = loc.ParentId;
            }
        }

        return item;
    }

    private static ItemAttachmentDto MapToDto(ItemAttachment a) =>
        new(
            a.Id,
            a.ItemId,
            a.AttachmentType,
            a.FileName,
            a.ContentType,
            a.FileSizeBytes,
            a.Notes,
            a.IsPrimaryPhoto,
            a.UploadedByUserId,
            a.CreatedAt,
            a.ModifiedAt
        );
}
