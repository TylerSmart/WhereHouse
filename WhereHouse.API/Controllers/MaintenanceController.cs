using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Maintenance;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("maintenance")]
[Authorize]
public sealed class MaintenanceController(IMaintenanceService maintenanceService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(MaintenanceSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary(
        [FromQuery] Guid? itemId = null,
        [FromQuery] bool dueOnly = false,
        CancellationToken cancellationToken = default
    )
    {
        var result = await maintenanceService.GetSummaryAsync(
            CurrentUserId,
            itemId,
            dueOnly,
            cancellationToken
        );
        return Ok(result);
    }

    [HttpGet("items/{itemId:guid}/schedules")]
    [ProducesResponseType(typeof(IReadOnlyList<MaintenanceScheduleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetItemSchedules(
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await maintenanceService.GetItemSchedulesAsync(
                CurrentUserId,
                itemId,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpGet("items/{itemId:guid}/logs")]
    [ProducesResponseType(typeof(IReadOnlyList<MaintenanceLogDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetItemLogs(
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await maintenanceService.GetItemLogsAsync(
                CurrentUserId,
                itemId,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost("items/{itemId:guid}/schedules")]
    [ProducesResponseType(typeof(MaintenanceScheduleDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateSchedule(
        Guid itemId,
        [FromBody] CreateMaintenanceScheduleRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await maintenanceService.CreateScheduleAsync(
                CurrentUserId,
                itemId,
                request,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound();
            }

            return Created($"/maintenance/schedules/{result.Id}", result);
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

    [HttpPut("schedules/{scheduleId:guid}")]
    [ProducesResponseType(typeof(MaintenanceScheduleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSchedule(
        Guid scheduleId,
        [FromBody] UpdateMaintenanceScheduleRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await maintenanceService.UpdateScheduleAsync(
                CurrentUserId,
                scheduleId,
                request,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
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

    [HttpPost("schedules/{scheduleId:guid}/complete")]
    [ProducesResponseType(typeof(MaintenanceScheduleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CompleteTask(
        Guid scheduleId,
        [FromBody] CompleteMaintenanceTaskRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var result = await maintenanceService.CompleteTaskAsync(
                CurrentUserId,
                scheduleId,
                request,
                cancellationToken
            );
            if (result is null)
            {
                return NotFound();
            }

            return Ok(result);
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

    [HttpDelete("schedules/{scheduleId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSchedule(
        Guid scheduleId,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var success = await maintenanceService.DeleteScheduleAsync(
                CurrentUserId,
                scheduleId,
                cancellationToken
            );
            if (!success)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }
}
