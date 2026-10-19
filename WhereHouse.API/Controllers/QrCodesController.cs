using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.QrCodes;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("qrcodes")]
[Authorize]
public sealed class QrCodesController(IQrCodeService qrCodeService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<QrCodeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQrCodes(
        [FromQuery] QrTargetType? targetType = null,
        CancellationToken cancellationToken = default
    )
    {
        var results = await qrCodeService.GetQrCodesAsync(
            CurrentUserId,
            targetType,
            cancellationToken
        );
        return Ok(results);
    }

    [HttpPost("batch")]
    [ProducesResponseType(typeof(IReadOnlyList<QrCodeDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GenerateBatch(
        [FromBody] GenerateQrCodeBatchRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var results = await qrCodeService.GenerateBatchAsync(
                CurrentUserId,
                request,
                cancellationToken
            );
            return StatusCode(StatusCodes.Status201Created, results);
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Batch Count",
                    Detail = ex.Message,
                }
            );
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Request",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPost("{token}/bind")]
    [ProducesResponseType(typeof(QrCodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> BindQrCode(
        string token,
        [FromBody] BindQrCodeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await qrCodeService.BindQrCodeAsync(
                CurrentUserId,
                token,
                request,
                cancellationToken
            );
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Binding Request",
                    Detail = ex.Message,
                }
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
                    Title = "Resource Not Found",
                    Detail = ex.Message,
                }
            );
        }
        catch (ConflictException ex)
        {
            return Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Binding Conflict",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPost("{token}/unbind")]
    [ProducesResponseType(typeof(QrCodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnbindQrCode(
        string token,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await qrCodeService.UnbindQrCodeAsync(
                CurrentUserId,
                token,
                cancellationToken
            );
            return Ok(result);
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
                    Title = "QR Code Not Found",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteQrCode(
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var deleted = await qrCodeService.DeleteQrCodeAsync(
                CurrentUserId,
                id,
                cancellationToken
            );
            if (!deleted)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status404NotFound,
                        Title = "QR Code Not Found",
                        Detail = $"QR Code with ID '{id}' was not found.",
                    }
                );
            }

            return NoContent();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }
}
