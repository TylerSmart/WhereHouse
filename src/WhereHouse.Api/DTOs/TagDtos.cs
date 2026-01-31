namespace WhereHouse.Api.DTOs;

public record TagDto(int Id, string Name, string? Color, DateTime CreatedAt);

public record CreateTagRequest(string Name, string? Color);

public record UpdateTagRequest(string? Name, string? Color);
