using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Checkouts;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("checkouts")]
[Authorize]
public sealed class CheckoutsController(ICheckoutService checkoutService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet("active")]
    [ProducesResponseType(typeof(IReadOnlyList<ItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActiveCheckouts(
        [FromQuery] bool? externalLoansOnly,
        [FromQuery] bool? overdueOnly,
        CancellationToken cancellationToken = default
    )
    {
        var result = await checkoutService.GetActiveCheckoutsAsync(
            CurrentUserId,
            externalLoansOnly,
            overdueOnly,
            cancellationToken
        );
        return Ok(result);
    }

    [HttpGet("items/{itemId:guid}/history")]
    [ProducesResponseType(typeof(IReadOnlyList<CheckoutLogDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetItemCheckoutHistory(
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var logs = await checkoutService.GetItemCheckoutHistoryAsync(
                CurrentUserId,
                itemId,
                cancellationToken
            );
            return Ok(logs);
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
                    Title = "Not Found",
                    Detail = ex.Message,
                    Status = StatusCodes.Status404NotFound,
                }
            );
        }
    }

    [HttpPost("items/{itemId:guid}/checkout")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CheckoutItem(
        Guid itemId,
        [FromBody] CheckoutItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var item = await checkoutService.CheckoutItemAsync(
                CurrentUserId,
                itemId,
                request,
                cancellationToken
            );

            if (item is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Title = "Not Found",
                        Detail = "Item not found.",
                        Status = StatusCodes.Status404NotFound,
                    }
                );
            }

            return Ok(item);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Title = "Bad Request",
                    Detail = ex.Message,
                    Status = StatusCodes.Status400BadRequest,
                }
            );
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("items/{itemId:guid}/return")]
    [ProducesResponseType(typeof(ItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReturnItem(
        Guid itemId,
        [FromBody] ReturnItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var item = await checkoutService.ReturnItemAsync(
                CurrentUserId,
                itemId,
                request,
                cancellationToken
            );

            if (item is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Title = "Not Found",
                        Detail = "Item not found.",
                        Status = StatusCodes.Status404NotFound,
                    }
                );
            }

            return Ok(item);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("batch-checkout")]
    [ProducesResponseType(typeof(BatchCheckoutResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> BatchCheckout(
        [FromBody] BatchCheckoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await checkoutService.BatchCheckoutItemsAsync(
                CurrentUserId,
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
                    Title = "Bad Request",
                    Detail = ex.Message,
                    Status = StatusCodes.Status400BadRequest,
                }
            );
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("batch-return")]
    [ProducesResponseType(typeof(BatchCheckoutResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> BatchReturn(
        [FromBody] BatchReturnRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await checkoutService.BatchReturnItemsAsync(
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
    }
}
