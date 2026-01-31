using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Api.DTOs;
using WhereHouse.Infrastructure.Data;
using WhereHouse.Infrastructure.Services;

namespace WhereHouse.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class LabelsController : ControllerBase
{
    private readonly WhereHouseDbContext _context;
    private readonly IQrCodeService _qrCodeService;

    public LabelsController(WhereHouseDbContext context, IQrCodeService qrCodeService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
    }

    [HttpGet("templates")]
    public async Task<ActionResult<List<LabelTemplateDto>>> GetTemplates()
    {
        var templates = await _context.LabelTemplates
            .Select(t => new LabelTemplateDto(
                t.Id,
                t.Name,
                t.TemplateName,
                t.PageWidth,
                t.PageHeight,
                t.LabelsPerRow,
                t.LabelsPerColumn,
                t.LabelWidth,
                t.LabelHeight,
                t.HorizontalSpacing,
                t.VerticalSpacing,
                t.LeftMargin,
                t.TopMargin,
                t.IsDefault))
            .ToListAsync();

        return Ok(templates);
    }

    [HttpGet("templates/{id}")]
    public async Task<ActionResult<LabelTemplateDto>> GetTemplate(int id)
    {
        var template = await _context.LabelTemplates.FindAsync(id);

        if (template == null)
        {
            return NotFound();
        }

        return Ok(new LabelTemplateDto(
            template.Id,
            template.Name,
            template.TemplateName,
            template.PageWidth,
            template.PageHeight,
            template.LabelsPerRow,
            template.LabelsPerColumn,
            template.LabelWidth,
            template.LabelHeight,
            template.HorizontalSpacing,
            template.VerticalSpacing,
            template.LeftMargin,
            template.TopMargin,
            template.IsDefault));
    }

    [HttpPost("generate-qr")]
    public IActionResult GenerateQrCode([FromBody] string data)
    {
        var qrImage = _qrCodeService.GenerateQrCodeImage(data);
        return File(qrImage, "image/png");
    }
}
