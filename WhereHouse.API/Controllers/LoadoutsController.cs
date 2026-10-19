using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Loadouts;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("loadouts")]
[Authorize]
public sealed class LoadoutsController(ILoadoutService loadoutService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<LoadoutDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLoadouts(CancellationToken cancellationToken = default)
    {
        var result = await loadoutService.GetLoadoutsAsync(CurrentUserId, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(LoadoutDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLoadoutById(
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await loadoutService.GetLoadoutByIdAsync(
                CurrentUserId,
                id,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Title = "Not Found",
                        Detail = "Loadout not found.",
                        Status = StatusCodes.Status404NotFound,
                    }
                );
            }

            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(LoadoutDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateLoadout(
        [FromBody] CreateLoadoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await loadoutService.CreateLoadoutAsync(
                CurrentUserId,
                request,
                cancellationToken
            );
            return CreatedAtAction(nameof(GetLoadoutById), new { id = result.Id }, result);
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

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(LoadoutDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLoadout(
        Guid id,
        [FromBody] UpdateLoadoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await loadoutService.UpdateLoadoutAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Title = "Not Found",
                        Detail = "Loadout not found.",
                        Status = StatusCodes.Status404NotFound,
                    }
                );
            }

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
                    Title = "Not Found",
                    Detail = ex.Message,
                    Status = StatusCodes.Status404NotFound,
                }
            );
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteLoadout(
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var deleted = await loadoutService.DeleteLoadoutAsync(
                CurrentUserId,
                id,
                cancellationToken
            );
            if (!deleted)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Title = "Not Found",
                        Detail = "Loadout not found.",
                        Status = StatusCodes.Status404NotFound,
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

    [HttpPost("{id:guid}/checkout")]
    [ProducesResponseType(typeof(LoadoutDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CheckoutLoadout(
        Guid id,
        [FromBody] CheckoutLoadoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await loadoutService.CheckoutLoadoutAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Title = "Not Found",
                        Detail = "Loadout not found.",
                        Status = StatusCodes.Status404NotFound,
                    }
                );
            }

            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("{id:guid}/pack-back")]
    [ProducesResponseType(typeof(LoadoutDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PackBackLoadout(
        Guid id,
        [FromBody] PackBackLoadoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await loadoutService.PackBackLoadoutAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound(
                    new ProblemDetails
                    {
                        Title = "Not Found",
                        Detail = "Loadout not found.",
                        Status = StatusCodes.Status404NotFound,
                    }
                );
            }

            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }
}
