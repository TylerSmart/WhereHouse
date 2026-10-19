using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Locations;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("locations")]
[Authorize]
public sealed class LocationsController(ILocationService locationService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet("tree")]
    [ProducesResponseType(typeof(IReadOnlyList<LocationTreeNodeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLocationTree(CancellationToken cancellationToken)
    {
        var tree = await locationService.GetLocationTreeAsync(CurrentUserId, cancellationToken);
        return Ok(tree);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<LocationNodeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLocationNodes(
        [FromQuery] Guid? parentId,
        [FromQuery] bool includeAllDepths = false,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var nodes = await locationService.GetLocationNodesAsync(
                CurrentUserId,
                parentId,
                includeAllDepths,
                search,
                cancellationToken
            );
            return Ok(nodes);
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

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(LocationNodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetLocationNodeById(
        Guid id,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var node = await locationService.GetLocationNodeByIdAsync(
                CurrentUserId,
                id,
                cancellationToken
            );
            return node is not null ? Ok(node) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(LocationNodeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateLocationNode(
        [FromBody] CreateLocationNodeRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var node = await locationService.CreateLocationNodeAsync(
                CurrentUserId,
                request,
                cancellationToken
            );
            return CreatedAtAction(nameof(GetLocationNodeById), new { id = node.Id }, node);
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
    [ProducesResponseType(typeof(LocationNodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLocationNode(
        Guid id,
        [FromBody] UpdateLocationNodeRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var node = await locationService.UpdateLocationNodeAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            return node is not null ? Ok(node) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPatch("{id:guid}/move")]
    [ProducesResponseType(typeof(LocationNodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> MoveLocationNode(
        Guid id,
        [FromBody] MoveLocationNodeRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var node = await locationService.MoveLocationNodeAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            return node is not null ? Ok(node) : NotFound();
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

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteLocationNode(
        Guid id,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var deleted = await locationService.DeleteLocationNodeAsync(
                CurrentUserId,
                id,
                cancellationToken
            );
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
