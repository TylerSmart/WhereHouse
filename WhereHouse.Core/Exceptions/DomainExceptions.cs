namespace WhereHouse.Core.Exceptions;

public class ForbiddenException(
    string message = "You do not have permission to perform this action."
) : Exception(message);

public class ConflictException(string message, string title = "Conflict") : Exception(message)
{
    public string Title { get; } = title;
}

public class NotFoundException(string message = "The requested resource was not found.")
    : Exception(message);
