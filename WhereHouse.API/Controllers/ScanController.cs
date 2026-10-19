using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.QrCodes;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("scan")]
[Authorize]
public sealed class ScanController(IScanService scanService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet("{*code}")]
    [ProducesResponseType(typeof(ScanResolutionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResolveScan(
        string? code,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Scan Input",
                    Detail = "Scanned code or URL cannot be empty.",
                }
            );
        }

        try
        {
            var result = await scanService.ResolveScanAsync(CurrentUserId, code, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Scan Input",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPost("bulk-move-audit")]
    [ProducesResponseType(typeof(BulkScanAuditResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ExecuteBulkMoveAudit(
        [FromBody] BulkScanAuditRequest request,
        CancellationToken cancellationToken = default
    )
    {
        if (request is null || request.ScannedCodes is null || request.ScannedCodes.Count == 0)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Bulk Audit Request",
                    Detail = "At least one scanned code must be provided.",
                }
            );
        }

        try
        {
            var result = await scanService.ExecuteBulkMoveAuditAsync(
                CurrentUserId,
                request,
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
                    Title = "Destination Not Found",
                    Detail = ex.Message,
                }
            );
        }
    }
}
