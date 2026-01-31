namespace WhereHouse.Api.DTOs;

public record LoginRequest(string Username, string Password);

public record LoginResponse(string Token, int UserId, string Username, bool IsAdmin);

public record RegisterRequest(string Username, string Email, string Password);

public record UserDto(int Id, string Username, string Email, bool IsAdmin, DateTime CreatedAt, DateTime? LastLoginAt);

public record CreateUserRequest(string Username, string Email, string Password, bool IsAdmin);

public record UpdateUserRequest(string? Email, string? Password, bool? IsAdmin);
