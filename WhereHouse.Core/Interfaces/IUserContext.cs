namespace WhereHouse.Core.Interfaces;

/// <summary>
/// Resolves the identity of the user making the current request.
/// </summary>
public interface IUserContext
{
    string UserId { get; }
}
