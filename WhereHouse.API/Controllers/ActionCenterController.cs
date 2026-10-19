using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.ActionCenter;
using WhereHouse.Core.Exceptions;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("action-center")]
[Authorize]
public sealed class ActionCenterController(IActionCenterService actionCenterService)
    : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(ActionCenterOverviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview(
        [FromQuery] int coverageWindowDays = 30,
        CancellationToken cancellationToken = default
    )
    {
        var overview = await actionCenterService.GetOverviewAsync(
            CurrentUserId,
            coverageWindowDays,
            cancellationToken
        );
        return Ok(overview);
    }

    [HttpGet("channels")]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationChannelDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetChannels(CancellationToken cancellationToken = default)
    {
        var channels = await actionCenterService.GetChannelsAsync(CurrentUserId, cancellationToken);
        return Ok(channels);
    }

    [HttpGet("channels/{channelId:guid}")]
    [ProducesResponseType(typeof(NotificationChannelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetChannelById(
        Guid channelId,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var channel = await actionCenterService.GetChannelByIdAsync(
                CurrentUserId,
                channelId,
                cancellationToken
            );

            if (channel is null)
            {
                return NotFound();
            }

            return Ok(channel);
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPost("channels")]
    [ProducesResponseType(typeof(NotificationChannelDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateChannel(
        [FromBody] CreateNotificationChannelRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var channel = await actionCenterService.CreateChannelAsync(
                CurrentUserId,
                request,
                cancellationToken
            );

            return CreatedAtAction(nameof(GetChannelById), new { channelId = channel.Id }, channel);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Channel Configuration",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPut("channels/{channelId:guid}")]
    [ProducesResponseType(typeof(NotificationChannelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateChannel(
        Guid channelId,
        [FromBody] UpdateNotificationChannelRequest request,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var channel = await actionCenterService.UpdateChannelAsync(
                CurrentUserId,
                channelId,
                request,
                cancellationToken
            );

            if (channel is null)
            {
                return NotFound();
            }

            return Ok(channel);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Channel Configuration",
                    Detail = ex.Message,
                }
            );
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpDelete("channels/{channelId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteChannel(
        Guid channelId,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var deleted = await actionCenterService.DeleteChannelAsync(
                CurrentUserId,
                channelId,
                cancellationToken
            );

            if (!deleted)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPost("channels/{channelId:guid}/test")]
    [ProducesResponseType(typeof(NotificationDeliveryLogDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SendTestNotification(
        Guid channelId,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var log = await actionCenterService.SendTestNotificationAsync(
                CurrentUserId,
                channelId,
                cancellationToken
            );

            if (log is null)
            {
                return NotFound();
            }

            return Ok(log);
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpPost("digest/send")]
    [ProducesResponseType(typeof(NotificationDispatchResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SendDigest(
        [FromBody] SendNotificationDigestRequest? request = null,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var req = request ?? new SendNotificationDigestRequest();
            var result = await actionCenterService.SendDigestAsync(
                CurrentUserId,
                req,
                cancellationToken
            );

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid Digest Request",
                    Detail = ex.Message,
                }
            );
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = ex.Message,
                }
            );
        }
    }

    [HttpGet("deliveries")]
    [ProducesResponseType(
        typeof(IReadOnlyList<NotificationDeliveryLogDto>),
        StatusCodes.Status200OK
    )]
    public async Task<IActionResult> GetRecentDeliveries(
        [FromQuery] int limit = 30,
        CancellationToken cancellationToken = default
    )
    {
        var deliveries = await actionCenterService.GetRecentDeliveriesAsync(
            CurrentUserId,
            limit,
            cancellationToken
        );

        return Ok(deliveries);
    }
}
