using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("items")]
[Authorize]
public sealed class ItemsController(IItemService itemService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetItems(
        [FromQuery] Guid? locationId,
        [FromQuery] bool includeSubtreeLocations = false,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] ItemType? itemType = null,
        [FromQuery] ItemStatus? status = null,
        [FromQuery] bool? lowStockOnly = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var items = await itemService.GetItemsAsync(
                CurrentUserId,
                locationId,
                includeSubtreeLocations,
                categoryId,
                itemType,
                status,
                lowStockOnly,
                search,
                cancellationToken
            );
            return Ok(items);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetItemById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var item = await itemService.GetItemByIdAsync(CurrentUserId, id, cancellationToken);
            return item is not null ? Ok(item) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateItem(
        [FromBody] CreateItemRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var item = await itemService.CreateItemAsync(CurrentUserId, request, cancellationToken);
            return CreatedAtAction(nameof(GetItemById), new { id = item.Id }, item);
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

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateItem(
        Guid id,
        [FromBody] UpdateItemRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var item = await itemService.UpdateItemAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            return item is not null ? Ok(item) : NotFound();
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

    [HttpPatch("{id:guid}/quantity")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustItemQuantity(
        Guid id,
        [FromBody] AdjustItemQuantityRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var item = await itemService.AdjustItemQuantityAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            return item is not null ? Ok(item) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("{id:guid}/duplicate")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DuplicateItem(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var duplicate = await itemService.DuplicateItemAsync(
                CurrentUserId,
                id,
                cancellationToken
            );
            return duplicate is not null
                ? CreatedAtAction(nameof(GetItemById), new { id = duplicate.Id }, duplicate)
                : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await itemService.DeleteItemAsync(CurrentUserId, id, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
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
