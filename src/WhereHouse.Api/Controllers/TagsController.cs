using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Api.DTOs;
using WhereHouse.Domain.Entities;
using WhereHouse.Infrastructure.Data;

namespace WhereHouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TagsController : ControllerBase
{
    private readonly WhereHouseDbContext _context;

    public TagsController(WhereHouseDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<TagDto>>> GetTags()
    {
        var tags = await _context.Tags
            .Select(t => new TagDto(t.Id, t.Name, t.Color, t.CreatedAt))
            .ToListAsync();

        return Ok(tags);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TagDto>> GetTag(int id)
    {
        var tag = await _context.Tags.FindAsync(id);

        if (tag == null)
        {
            return NotFound();
        }

        return Ok(new TagDto(tag.Id, tag.Name, tag.Color, tag.CreatedAt));
    }

    [HttpPost]
    public async Task<ActionResult<TagDto>> CreateTag([FromBody] CreateTagRequest request)
    {
        if (await _context.Tags.AnyAsync(t => t.Name == request.Name))
        {
            return BadRequest(new { message = "Tag with this name already exists" });
        }

        var tag = new Tag
        {
            Name = request.Name,
            Color = request.Color,
            CreatedAt = DateTime.UtcNow
        };

        _context.Tags.Add(tag);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTag), new { id = tag.Id },
            new TagDto(tag.Id, tag.Name, tag.Color, tag.CreatedAt));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TagDto>> UpdateTag(int id, [FromBody] UpdateTagRequest request)
    {
        var tag = await _context.Tags.FindAsync(id);

        if (tag == null)
        {
            return NotFound();
        }

        if (request.Name != null && request.Name != tag.Name)
        {
            if (await _context.Tags.AnyAsync(t => t.Name == request.Name))
            {
                return BadRequest(new { message = "Tag with this name already exists" });
            }
            tag.Name = request.Name;
        }

        if (request.Color != null) tag.Color = request.Color;

        await _context.SaveChangesAsync();

        return Ok(new TagDto(tag.Id, tag.Name, tag.Color, tag.CreatedAt));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTag(int id)
    {
        var tag = await _context.Tags.FindAsync(id);

        if (tag == null)
        {
            return NotFound();
        }

        _context.Tags.Remove(tag);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
