using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Api.DTOs;
using WhereHouse.Domain.Entities;
using WhereHouse.Infrastructure.Data;
using WhereHouse.Infrastructure.Services;
using System.Security.Claims;

namespace WhereHouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class LocationsController : ControllerBase
{
    private readonly WhereHouseDbContext _context;
    private readonly IQrCodeService _qrCodeService;

    public LocationsController(WhereHouseDbContext context, IQrCodeService qrCodeService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
    }

    private int GetUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<List<LocationDto>>> GetLocations()
    {
        var userId = GetUserId();
        var locations = await _context.Locations
            .Where(l => l.UserId == userId)
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

        return Ok(locations);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<LocationWithChildrenDto>> GetLocation(int id)
    {
        var userId = GetUserId();
        var location = await _context.Locations
            .Where(l => l.Id == id && l.UserId == userId)
            .Include(l => l.ChildLocations)
            .Include(l => l.Items)
            .FirstOrDefaultAsync();

        if (location == null)
        {
            return NotFound();
        }

        var dto = new LocationWithChildrenDto(
            location.Id,
            location.Name,
            location.Description,
            location.QrCode,
            location.ParentLocationId,
            location.ChildLocations.Select(c => new LocationDto(
                c.Id,
                c.Name,
                c.Description,
                c.QrCode,
                c.ParentLocationId,
                location.Name,
                c.CreatedAt,
                c.UpdatedAt)).ToList(),
            location.Items.Select(i => new ItemSummaryDto(
                i.Id,
                i.Name,
                i.Description,
                i.Value,
                i.QrCode,
                i.LocationId)).ToList(),
            location.CreatedAt,
            location.UpdatedAt);

        return Ok(dto);
    }

    [HttpGet("qr/{qrCode}")]
    public async Task<ActionResult<LocationWithChildrenDto>> GetLocationByQrCode(string qrCode)
    {
        var userId = GetUserId();
        var location = await _context.Locations
            .Where(l => l.QrCode == qrCode && l.UserId == userId)
            .Include(l => l.ChildLocations)
            .Include(l => l.Items)
            .FirstOrDefaultAsync();

        if (location == null)
        {
            return NotFound();
        }

        var dto = new LocationWithChildrenDto(
            location.Id,
            location.Name,
            location.Description,
            location.QrCode,
            location.ParentLocationId,
            location.ChildLocations.Select(c => new LocationDto(
                c.Id,
                c.Name,
                c.Description,
                c.QrCode,
                c.ParentLocationId,
                location.Name,
                c.CreatedAt,
                c.UpdatedAt)).ToList(),
            location.Items.Select(i => new ItemSummaryDto(
                i.Id,
                i.Name,
                i.Description,
                i.Value,
                i.QrCode,
                i.LocationId)).ToList(),
            location.CreatedAt,
            location.UpdatedAt);

        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<LocationDto>> CreateLocation([FromBody] CreateLocationRequest request)
    {
        var userId = GetUserId();

        if (request.ParentLocationId.HasValue)
        {
            var parentExists = await _context.Locations
                .AnyAsync(l => l.Id == request.ParentLocationId.Value && l.UserId == userId);
            
            if (!parentExists)
            {
                return BadRequest(new { message = "Parent location not found" });
            }
        }

        var location = new Location
        {
            Name = request.Name,
            Description = request.Description,
            QrCode = _qrCodeService.GenerateUniqueCode(),
            ParentLocationId = request.ParentLocationId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Locations.Add(location);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetLocation), new { id = location.Id },
            new LocationDto(location.Id, location.Name, location.Description, location.QrCode,
                location.ParentLocationId, null, location.CreatedAt, location.UpdatedAt));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<LocationDto>> UpdateLocation(int id, [FromBody] UpdateLocationRequest request)
    {
        var userId = GetUserId();
        var location = await _context.Locations
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId);

        if (location == null)
        {
            return NotFound();
        }

        if (request.ParentLocationId.HasValue)
        {
            if (request.ParentLocationId.Value == id)
            {
                return BadRequest(new { message = "Location cannot be its own parent" });
            }

            var parentExists = await _context.Locations
                .AnyAsync(l => l.Id == request.ParentLocationId.Value && l.UserId == userId);
            
            if (!parentExists)
            {
                return BadRequest(new { message = "Parent location not found" });
            }
        }

        if (request.Name != null) location.Name = request.Name;
        if (request.Description != null) location.Description = request.Description;
        if (request.ParentLocationId.HasValue) location.ParentLocationId = request.ParentLocationId;

        location.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new LocationDto(location.Id, location.Name, location.Description, location.QrCode,
            location.ParentLocationId, null, location.CreatedAt, location.UpdatedAt));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteLocation(int id)
    {
        var userId = GetUserId();
        var location = await _context.Locations
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId);

        if (location == null)
        {
            return NotFound();
        }

        _context.Locations.Remove(location);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id}/qr-image")]
    public async Task<IActionResult> GetQrCodeImage(int id)
    {
        var userId = GetUserId();
        var location = await _context.Locations
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId);

        if (location == null)
        {
            return NotFound();
        }

        var qrImage = _qrCodeService.GenerateQrCodeImage(location.QrCode);
        return File(qrImage, "image/png");
    }
}
