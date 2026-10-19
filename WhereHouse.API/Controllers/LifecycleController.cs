using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Lifecycle;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("lifecycle")]
[Authorize]
public sealed class LifecycleController(ILifecycleService lifecycleService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet("staged")]
    [ProducesResponseType(typeof(DeclutterStagingSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStagedItems(
        [FromQuery] ItemStatus? status,
        [FromQuery] Guid? locationId,
        [FromQuery] bool includeSubtreeLocations = true,
        CancellationToken cancellationToken = default
    )
    {
        var result = await lifecycleService.GetStagedItemsAsync(
            CurrentUserId,
            status,
            locationId,
            includeSubtreeLocations,
            cancellationToken
        );
        return Ok(result);
    }

    [HttpGet("graveyard")]
    [ProducesResponseType(typeof(GraveyardSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGraveyardItems(
        [FromQuery] DispositionReason? dispositionReason,
        [FromQuery] string? search,
        CancellationToken cancellationToken = default
    )
    {
        var result = await lifecycleService.GetGraveyardItemsAsync(
            CurrentUserId,
            dispositionReason,
            search,
            cancellationToken
        );
        return Ok(result);
    }

    [HttpGet("dust-collectors")]
    [ProducesResponseType(typeof(DustCollectorInsightsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDustCollectors(
        [FromQuery] int minUntouchedDays = 365,
        [FromQuery] Guid? locationId = null,
        [FromQuery] bool includeSubtreeLocations = true,
        [FromQuery] Guid? categoryId = null,
        CancellationToken cancellationToken = default
    )
    {
        var result = await lifecycleService.GetDustCollectorsAsync(
            CurrentUserId,
            minUntouchedDays,
            locationId,
            includeSubtreeLocations,
            categoryId,
            cancellationToken
        );
        return Ok(result);
    }

    [HttpPost("items/{id:guid}/stage")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StageItem(
        Guid id,
        [FromBody] StageItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await lifecycleService.StageItemAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );

            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ProblemDetails { Detail = ex.Message });
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("items/{id:guid}/unstage")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnstageItem(
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await lifecycleService.UnstageItemAsync(
                CurrentUserId,
                id,
                cancellationToken
            );

            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("items/{id:guid}/archive")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ArchiveItem(
        Guid id,
        [FromBody] ArchiveItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await lifecycleService.ArchiveItemAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );

            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ProblemDetails { Detail = ex.Message });
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("items/{id:guid}/restore")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RestoreArchivedItem(
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await lifecycleService.RestoreArchivedItemAsync(
                CurrentUserId,
                id,
                cancellationToken
            );

            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("items/{id:guid}/touch")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TouchItem(
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await lifecycleService.TouchItemAsync(
                CurrentUserId,
                id,
                cancellationToken
            );

            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("bulk-archive")]
    [ProducesResponseType(typeof(BulkLifecycleResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> BulkArchiveItems(
        [FromBody] BulkArchiveRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await lifecycleService.BulkArchiveItemsAsync(
                CurrentUserId,
                request,
                cancellationToken
            );
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }

    [HttpPost("bulk-unstage")]
    [ProducesResponseType(typeof(BulkLifecycleResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> BulkUnstageItems(
        [FromBody] BulkUnstageRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await lifecycleService.BulkUnstageItemsAsync(
                CurrentUserId,
                request,
                cancellationToken
            );
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }
}
