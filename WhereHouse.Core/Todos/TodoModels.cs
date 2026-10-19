using System.ComponentModel.DataAnnotations;

namespace WhereHouse.Core.Todos;

public sealed record TodoItemDto(
    Guid Id,
    string Title,
    string? Description,
    bool IsCompleted,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record CreateTodoItemRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(1000)] string? Description = null
);

public sealed record UpdateTodoItemRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(1000)] string? Description,
    bool IsCompleted
);
