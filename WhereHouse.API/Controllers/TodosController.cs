using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Todos;

namespace WhereHouse.API.Controllers;

[ApiController]
[Route("todos")]
[Authorize]
public sealed class TodosController(ITodoService todoService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value,
            out var id
        )
            ? id
            : throw new UnauthorizedAccessException();

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TodoItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTodoItems(CancellationToken cancellationToken)
    {
        var items = await todoService.GetTodoItemsAsync(CurrentUserId, cancellationToken);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TodoItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTodoItemById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var item = await todoService.GetTodoItemByIdAsync(CurrentUserId, id, cancellationToken);
            return item is not null ? Ok(item) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(TodoItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateTodoItem(
        [FromBody] CreateTodoItemRequest request,
        CancellationToken cancellationToken
    )
    {
        var item = await todoService.CreateTodoItemAsync(CurrentUserId, request, cancellationToken);
        return CreatedAtAction(nameof(GetTodoItemById), new { id = item.Id }, item);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TodoItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateTodoItem(
        Guid id,
        [FromBody] UpdateTodoItemRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var item = await todoService.UpdateTodoItemAsync(
                CurrentUserId,
                id,
                request,
                cancellationToken
            );
            return item is not null ? Ok(item) : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteTodoItem(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await todoService.DeleteTodoItemAsync(
                CurrentUserId,
                id,
                cancellationToken
            );
            return deleted ? NoContent() : NotFound();
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }
}
