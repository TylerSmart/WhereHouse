namespace WhereHouse.Api.DTOs;

public record ItemDto(
    int Id,
    string Name,
    string? Description,
    string? Notes,
    decimal? Value,
    string? Manufacturer,
    string? SerialNumber,
    string? ModelNumber,
    DateTime? PurchaseDate,
    string QrCode,
    int? LocationId,
    string? LocationName,
    List<TagDto> Tags,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ItemSummaryDto(
    int Id,
    string Name,
    string? Description,
    decimal? Value,
    string QrCode,
    int? LocationId);

public record CreateItemRequest(
    string Name,
    string? Description,
    string? Notes,
    decimal? Value,
    string? Manufacturer,
    string? SerialNumber,
    string? ModelNumber,
    DateTime? PurchaseDate,
    int? LocationId,
    List<int>? TagIds);

public record UpdateItemRequest(
    string? Name,
    string? Description,
    string? Notes,
    decimal? Value,
    string? Manufacturer,
    string? SerialNumber,
    string? ModelNumber,
    DateTime? PurchaseDate,
    int? LocationId,
    List<int>? TagIds);
