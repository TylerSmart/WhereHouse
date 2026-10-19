using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Intake;
using WhereHouse.Core.Items;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("intake")]
[Authorize]
public sealed class IntakeController(
    IBarcodeLookupService barcodeLookupService,
    IRapidIntakeService rapidIntakeService
) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet("barcode/{*barcode}")]
    [ProducesResponseType(typeof(BarcodeProductLookupDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LookupBarcode(
        string? barcode,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(barcode))
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Empty Barcode",
                    Detail = "Barcode parameter cannot be empty.",
                }
            );
        }

        var result = await barcodeLookupService.LookupBarcodeAsync(
            CurrentUserId,
            barcode,
            cancellationToken
        );

        return Ok(result);
    }

    [HttpPost("rapid")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateRapidItem(
        [FromBody] RapidIntakeItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var item = await rapidIntakeService.CreateRapidItemAsync(
                CurrentUserId,
                request,
                cancellationToken
            );
            return StatusCode(StatusCodes.Status201Created, item);
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
        catch (ForbiddenException)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = "You do not have permission to access the target location or item.",
                }
            );
        }
        catch (ConflictException ex)
        {
            return Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = ex.Title,
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPost("rapid-batch")]
    [ProducesResponseType(typeof(RapidBatchIntakeResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateRapidBatch(
        [FromBody] RapidBatchIntakeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await rapidIntakeService.CreateRapidBatchAsync(
                CurrentUserId,
                request,
                cancellationToken
            );
            return Ok(result);
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
        catch (ForbiddenException)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail =
                        "You do not have permission to access the specified location or category.",
                }
            );
        }
        catch (ConflictException ex)
        {
            return Conflict(
                new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = ex.Title,
                    Detail = ex.Message,
                }
            );
        }
    }
}
