using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Api.DTOs;
using WhereHouse.Infrastructure.Data;
using System.Security.Claims;

namespace WhereHouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly WhereHouseDbContext _context;

    public SearchController(WhereHouseDbContext context)
    {
        _context = context;
    }

    private int GetUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<SearchResult>> Search([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest(new { message = "Search query is required" });
        }

        var userId = GetUserId();
        var searchTerm = query.ToLower();

        var items = await _context.Items
            .Where(i => i.UserId == userId &&
                (i.Name.ToLower().Contains(searchTerm) ||
                 i.Description!.ToLower().Contains(searchTerm) ||
                 i.Notes!.ToLower().Contains(searchTerm) ||
                 i.Manufacturer!.ToLower().Contains(searchTerm) ||
                 i.SerialNumber!.ToLower().Contains(searchTerm) ||
                 i.ModelNumber!.ToLower().Contains(searchTerm) ||
                 i.ItemTags.Any(it => it.Tag.Name.ToLower().Contains(searchTerm))))
            .Include(i => i.Location)
            .Include(i => i.ItemTags)
                .ThenInclude(it => it.Tag)
            .Select(i => new ItemDto(
                i.Id,
                i.Name,
                i.Description,
                i.Notes,
                i.Value,
                i.Manufacturer,
                i.SerialNumber,
                i.ModelNumber,
                i.PurchaseDate,
                i.QrCode,
                i.LocationId,
                i.Location != null ? i.Location.Name : null,
                i.ItemTags.Select(it => new TagDto(it.Tag.Id, it.Tag.Name, it.Tag.Color, it.Tag.CreatedAt)).ToList(),
                i.CreatedAt,
                i.UpdatedAt))
            .ToListAsync();

        var locations = await _context.Locations
            .Where(l => l.UserId == userId &&
                (l.Name.ToLower().Contains(searchTerm) ||
                 l.Description!.ToLower().Contains(searchTerm)))
            .Include(l => l.ParentLocation)
            .Select(l => new LocationDto(
                l.Id,
                l.Name,
                l.Description,
                l.QrCode,
                l.ParentLocationId,
                l.ParentLocation != null ? l.ParentLocation.Name : null,
                l.CreatedAt,
                l.UpdatedAt))
            .ToListAsync();

        return Ok(new SearchResult(items, locations));
    }
}
