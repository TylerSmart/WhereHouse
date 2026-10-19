using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Portability;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("portability")]
[Authorize]
public sealed class PortabilityController(IDataPortabilityService portabilityService)
    : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet("export/json")]
    [ProducesResponseType(typeof(WhereHouseExportBundleDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportJson(CancellationToken cancellationToken = default)
    {
        var bundle = await portabilityService.ExportJsonBundleAsync(
            CurrentUserId,
            cancellationToken
        );
        return Ok(bundle);
    }

    [HttpGet("export/csv")]
    [Produces("text/csv")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] PortabilityEntityType entityType = PortabilityEntityType.Items,
        CancellationToken cancellationToken = default
    )
    {
        var csv = await portabilityService.ExportCsvAsync(
            CurrentUserId,
            entityType,
            cancellationToken
        );

        var bytes = Encoding.UTF8.GetBytes(csv);
        var filename =
            $"wherehouse-{entityType.ToString().ToLowerInvariant()}-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";

        return File(bytes, "text/csv", filename);
    }

    [HttpPost("import/json")]
    [ProducesResponseType(typeof(ImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ImportJson(
        [FromBody] JsonImportRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var result = await portabilityService.ImportJsonBundleAsync(
            CurrentUserId,
            request,
            cancellationToken
        );
        return Ok(result);
    }

    [HttpPost("import/csv")]
    [ProducesResponseType(typeof(ImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ImportCsv(
        [FromBody] CsvImportRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var result = await portabilityService.ImportCsvAsync(
            CurrentUserId,
            request,
            cancellationToken
        );
        return Ok(result);
    }
}
