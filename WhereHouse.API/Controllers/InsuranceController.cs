using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Insurance;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("insurance")]
[Authorize]
public sealed class InsuranceController(IInsuranceExportService insuranceService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet("preview")]
    [ProducesResponseType(typeof(InsuranceClaimPreviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPreview(
        [FromQuery] Guid? locationId = null,
        [FromQuery] bool includeSubtree = true,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] decimal? minValue = null,
        [FromQuery] bool includeArchived = false,
        [FromQuery] bool includeAttachments = true,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var query = new InsuranceClaimFilterQuery(
                locationId,
                includeSubtree,
                categoryId,
                minValue,
                includeArchived,
                includeAttachments
            );

            var preview = await insuranceService.GetClaimPreviewAsync(
                CurrentUserId,
                query,
                cancellationToken
            );
            return Ok(preview);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }

    [HttpGet("export-zip")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ExportZip(
        [FromQuery] Guid? locationId = null,
        [FromQuery] bool includeSubtree = true,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] decimal? minValue = null,
        [FromQuery] bool includeArchived = false,
        [FromQuery] bool includeAttachments = true,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var query = new InsuranceClaimFilterQuery(
                locationId,
                includeSubtree,
                categoryId,
                minValue,
                includeArchived,
                includeAttachments
            );

            var result = await insuranceService.GenerateClaimZipAsync(
                CurrentUserId,
                query,
                cancellationToken
            );

            return File(result.ZipBytes, "application/zip", result.FileName);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }
}
