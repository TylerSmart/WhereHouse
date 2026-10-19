namespace WhereHouse.Core.Todos;

public interface ITodoService
{
    Task<IReadOnlyList<TodoItemDto>> GetTodoItemsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<TodoItemDto?> GetTodoItemByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<TodoItemDto> CreateTodoItemAsync(
        Guid userId,
        CreateTodoItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<TodoItemDto?> UpdateTodoItemAsync(
        Guid userId,
        Guid id,
        UpdateTodoItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteTodoItemAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );
}
