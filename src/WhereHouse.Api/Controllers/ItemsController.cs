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
public class ItemsController : ControllerBase
{
    private readonly WhereHouseDbContext _context;
    private readonly IQrCodeService _qrCodeService;

    public ItemsController(WhereHouseDbContext context, IQrCodeService qrCodeService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
    }

    private int GetUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<List<ItemDto>>> GetItems()
    {
        var userId = GetUserId();
        var items = await _context.Items
            .Where(i => i.UserId == userId)
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

        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ItemDto>> GetItem(int id)
    {
        var userId = GetUserId();
        var item = await _context.Items
            .Where(i => i.Id == id && i.UserId == userId)
            .Include(i => i.Location)
            .Include(i => i.ItemTags)
                .ThenInclude(it => it.Tag)
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound();
        }

        var dto = new ItemDto(
            item.Id,
            item.Name,
            item.Description,
            item.Notes,
            item.Value,
            item.Manufacturer,
            item.SerialNumber,
            item.ModelNumber,
            item.PurchaseDate,
            item.QrCode,
            item.LocationId,
            item.Location?.Name,
            item.ItemTags.Select(it => new TagDto(it.Tag.Id, it.Tag.Name, it.Tag.Color, it.Tag.CreatedAt)).ToList(),
            item.CreatedAt,
            item.UpdatedAt);

        return Ok(dto);
    }

    [HttpGet("qr/{qrCode}")]
    public async Task<ActionResult<ItemDto>> GetItemByQrCode(string qrCode)
    {
        var userId = GetUserId();
        var item = await _context.Items
            .Where(i => i.QrCode == qrCode && i.UserId == userId)
            .Include(i => i.Location)
            .Include(i => i.ItemTags)
                .ThenInclude(it => it.Tag)
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound();
        }

        var dto = new ItemDto(
            item.Id,
            item.Name,
            item.Description,
            item.Notes,
            item.Value,
            item.Manufacturer,
            item.SerialNumber,
            item.ModelNumber,
            item.PurchaseDate,
            item.QrCode,
            item.LocationId,
            item.Location?.Name,
            item.ItemTags.Select(it => new TagDto(it.Tag.Id, it.Tag.Name, it.Tag.Color, it.Tag.CreatedAt)).ToList(),
            item.CreatedAt,
            item.UpdatedAt);

        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<ItemDto>> CreateItem([FromBody] CreateItemRequest request)
    {
        var userId = GetUserId();

        if (request.LocationId.HasValue)
        {
            var locationExists = await _context.Locations
                .AnyAsync(l => l.Id == request.LocationId.Value && l.UserId == userId);
            
            if (!locationExists)
            {
                return BadRequest(new { message = "Location not found" });
            }
        }

        var item = new Item
        {
            Name = request.Name,
            Description = request.Description,
            Notes = request.Notes,
            Value = request.Value,
            Manufacturer = request.Manufacturer,
            SerialNumber = request.SerialNumber,
            ModelNumber = request.ModelNumber,
            PurchaseDate = request.PurchaseDate,
            QrCode = _qrCodeService.GenerateUniqueCode(),
            LocationId = request.LocationId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Items.Add(item);
        await _context.SaveChangesAsync();

        if (request.TagIds != null && request.TagIds.Any())
        {
            foreach (var tagId in request.TagIds)
            {
                _context.ItemTags.Add(new ItemTag
                {
                    ItemId = item.Id,
                    TagId = tagId,
                    CreatedAt = DateTime.UtcNow
                });
            }
            await _context.SaveChangesAsync();
        }

        var tags = await _context.ItemTags
            .Where(it => it.ItemId == item.Id)
            .Include(it => it.Tag)
            .Select(it => new TagDto(it.Tag.Id, it.Tag.Name, it.Tag.Color, it.Tag.CreatedAt))
            .ToListAsync();

        return CreatedAtAction(nameof(GetItem), new { id = item.Id },
            new ItemDto(item.Id, item.Name, item.Description, item.Notes, item.Value,
                item.Manufacturer, item.SerialNumber, item.ModelNumber, item.PurchaseDate,
                item.QrCode, item.LocationId, null, tags, item.CreatedAt, item.UpdatedAt));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ItemDto>> UpdateItem(int id, [FromBody] UpdateItemRequest request)
    {
        var userId = GetUserId();
        var item = await _context.Items
            .Include(i => i.ItemTags)
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId);

        if (item == null)
        {
            return NotFound();
        }

        if (request.LocationId.HasValue)
        {
            var locationExists = await _context.Locations
                .AnyAsync(l => l.Id == request.LocationId.Value && l.UserId == userId);
            
            if (!locationExists)
            {
                return BadRequest(new { message = "Location not found" });
            }
        }

        if (request.Name != null) item.Name = request.Name;
        if (request.Description != null) item.Description = request.Description;
        if (request.Notes != null) item.Notes = request.Notes;
        if (request.Value.HasValue) item.Value = request.Value;
        if (request.Manufacturer != null) item.Manufacturer = request.Manufacturer;
        if (request.SerialNumber != null) item.SerialNumber = request.SerialNumber;
        if (request.ModelNumber != null) item.ModelNumber = request.ModelNumber;
        if (request.PurchaseDate.HasValue) item.PurchaseDate = request.PurchaseDate;
        if (request.LocationId.HasValue) item.LocationId = request.LocationId;

        if (request.TagIds != null)
        {
            _context.ItemTags.RemoveRange(item.ItemTags);
            foreach (var tagId in request.TagIds)
            {
                _context.ItemTags.Add(new ItemTag
                {
                    ItemId = item.Id,
                    TagId = tagId,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        item.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var tags = await _context.ItemTags
            .Where(it => it.ItemId == item.Id)
            .Include(it => it.Tag)
            .Select(it => new TagDto(it.Tag.Id, it.Tag.Name, it.Tag.Color, it.Tag.CreatedAt))
            .ToListAsync();

        var location = await _context.Locations.FindAsync(item.LocationId);

        return Ok(new ItemDto(item.Id, item.Name, item.Description, item.Notes, item.Value,
            item.Manufacturer, item.SerialNumber, item.ModelNumber, item.PurchaseDate,
            item.QrCode, item.LocationId, location?.Name, tags, item.CreatedAt, item.UpdatedAt));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteItem(int id)
    {
        var userId = GetUserId();
        var item = await _context.Items
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId);

        if (item == null)
        {
            return NotFound();
        }

        _context.Items.Remove(item);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id}/qr-image")]
    public async Task<IActionResult> GetQrCodeImage(int id)
    {
        var userId = GetUserId();
        var item = await _context.Items
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId);

        if (item == null)
        {
            return NotFound();
        }

        var qrImage = _qrCodeService.GenerateQrCodeImage(item.QrCode);
        return File(qrImage, "image/png");
    }
}
