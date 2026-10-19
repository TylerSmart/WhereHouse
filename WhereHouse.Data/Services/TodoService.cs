using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Todos;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class TodoService(WhereHouseDbContext dbContext) : ITodoService
{
    public async Task<IReadOnlyList<TodoItemDto>> GetTodoItemsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var items = await dbContext
            .TodoItems.AsNoTracking()
            .Where(t => t.OwnerId == userId)
            .OrderBy(t => t.IsCompleted)
            .ThenByDescending(t => t.ModifiedAt)
            .ToListAsync(cancellationToken);

        return items.Select(MapToDto).ToList();
    }

    public async Task<TodoItemDto?> GetTodoItemByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var item = await dbContext
            .TodoItems.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (item is null)
        {
            return null;
        }

        if (item.OwnerId != userId)
        {
            throw new ForbiddenException();
        }

        return MapToDto(item);
    }

    public async Task<TodoItemDto> CreateTodoItemAsync(
        Guid userId,
        CreateTodoItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var item = new TodoItem
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim(),
            IsCompleted = false,
            OwnerId = userId,
        };

        dbContext.TodoItems.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<TodoItemDto?> UpdateTodoItemAsync(
        Guid userId,
        Guid id,
        UpdateTodoItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var item = await dbContext.TodoItems.FirstOrDefaultAsync(
            t => t.Id == id,
            cancellationToken
        );

        if (item is null)
        {
            return null;
        }

        if (item.OwnerId != userId)
        {
            throw new ForbiddenException();
        }

        item.Title = request.Title.Trim();
        item.Description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();
        item.IsCompleted = request.IsCompleted;

        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<bool> DeleteTodoItemAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var item = await dbContext.TodoItems.FirstOrDefaultAsync(
            t => t.Id == id,
            cancellationToken
        );

        if (item is null)
        {
            return false;
        }

        if (item.OwnerId != userId)
        {
            throw new ForbiddenException();
        }

        dbContext.TodoItems.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static TodoItemDto MapToDto(TodoItem item) =>
        new(
            item.Id,
            item.Title,
            item.Description,
            item.IsCompleted,
            item.CreatedAt,
            item.ModifiedAt
        );
}
