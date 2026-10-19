using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Search;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("search")]
[Authorize]
public sealed class SearchController(ISearchService searchService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(SmartSearchResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Search(
        [FromQuery] string? q = null,
        [FromQuery] Guid? locationId = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] ItemType? itemType = null,
        [FromQuery] ItemStatus? status = null,
        [FromQuery] bool? outOfPlaceOnly = null,
        [FromQuery] bool? lowStockOnly = null,
        [FromQuery] string? attributeName = null,
        [FromQuery] string? attributeValue = null,
        [FromQuery] decimal? attributeMinNumber = null,
        [FromQuery] decimal? attributeMaxNumber = null,
        [FromQuery] bool includeArchived = true,
        CancellationToken cancellationToken = default
    )
    {
        var query = new SmartSearchQuery(
            q,
            locationId,
            categoryId,
            itemType,
            status,
            outOfPlaceOnly ?? false,
            lowStockOnly ?? false,
            attributeName,
            attributeValue,
            attributeMinNumber,
            attributeMaxNumber,
            includeArchived
        );

        var result = await searchService.SearchAsync(CurrentUserId, query, cancellationToken);
        return Ok(result);
    }
}
