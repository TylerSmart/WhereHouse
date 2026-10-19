using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Attachments;
using WhereHouse.Core.Exceptions;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("items/{itemId:guid}/attachments")]
[Authorize]
public sealed class AttachmentsController(IAttachmentService attachmentService) : ControllerBase
{
    private const long MaxFileSizeBytes = 50L * 1024L * 1024L;

    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ItemAttachmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAttachments(
        Guid itemId,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var attachments = await attachmentService.GetAttachmentsAsync(
                CurrentUserId,
                itemId,
                cancellationToken
            );

            if (attachments is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status404NotFound,
                        Title = "Not Found",
                        Detail = $"Item with ID '{itemId}' was not found.",
                    }
                );
            }

            return Ok(attachments);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Not Found",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ItemAttachmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadAttachment(
        Guid itemId,
        IFormFile? file,
        [FromForm] AttachmentType attachmentType = AttachmentType.Photo,
        [FromForm] string? notes = null,
        [FromForm] bool isPrimaryPhoto = false,
        CancellationToken cancellationToken = default
    )
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Bad Request",
                    Detail = "File is required and cannot be empty.",
                }
            );
        }

        if (file.Length > MaxFileSizeBytes)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Bad Request",
                    Detail = "File size exceeds the 50 MB limit.",
                }
            );
        }

        try
        {
            await using var stream = file.OpenReadStream();
            var request = new UploadItemAttachmentRequest(attachmentType, notes, isPrimaryPhoto);
            var attachment = await attachmentService.UploadAttachmentAsync(
                CurrentUserId,
                itemId,
                stream,
                file.FileName,
                string.IsNullOrWhiteSpace(file.ContentType)
                    ? "application/octet-stream"
                    : file.ContentType,
                file.Length,
                request,
                cancellationToken
            );

            if (attachment is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status404NotFound,
                        Title = "Not Found",
                        Detail = $"Item with ID '{itemId}' was not found.",
                    }
                );
            }

            return CreatedAtAction(
                nameof(GetAttachmentContent),
                new { itemId, attachmentId = attachment.Id },
                attachment
            );
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Not Found",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpGet("{attachmentId:guid}/content")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAttachmentContent(
        Guid itemId,
        Guid attachmentId,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var result = await attachmentService.OpenAttachmentContentAsync(
                CurrentUserId,
                itemId,
                attachmentId,
                cancellationToken
            );

            if (result is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status404NotFound,
                        Title = "Not Found",
                        Detail = "Attachment content not found on disk.",
                    }
                );
            }

            var contentType = string.IsNullOrWhiteSpace(result.ContentType)
                ? "application/octet-stream"
                : result.ContentType;

            return File(result.Content, contentType, result.FileName);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Not Found",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPatch("{attachmentId:guid}")]
    [ProducesResponseType(typeof(ItemAttachmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAttachment(
        Guid itemId,
        Guid attachmentId,
        [FromBody] UpdateItemAttachmentRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var updated = await attachmentService.UpdateAttachmentAsync(
                CurrentUserId,
                itemId,
                attachmentId,
                request,
                cancellationToken
            );

            if (updated is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status404NotFound,
                        Title = "Not Found",
                        Detail = $"Attachment with ID '{attachmentId}' was not found.",
                    }
                );
            }

            return Ok(updated);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Not Found",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpDelete("{attachmentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAttachment(
        Guid itemId,
        Guid attachmentId,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var deleted = await attachmentService.DeleteAttachmentAsync(
                CurrentUserId,
                itemId,
                attachmentId,
                cancellationToken
            );

            if (!deleted)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status404NotFound,
                        Title = "Not Found",
                        Detail = $"Attachment with ID '{attachmentId}' was not found.",
                    }
                );
            }

            return NoContent();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Not Found",
                    Detail = ex.Message,
                }
            );
        }
    }
}
