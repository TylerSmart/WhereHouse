namespace WhereHouse.Api.DTOs;

public record LocationDto(
    int Id,
    string Name,
    string? Description,
    string QrCode,
    int? ParentLocationId,
    string? ParentLocationName,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreateLocationRequest(
    string Name,
    string? Description,
    int? ParentLocationId);

public record UpdateLocationRequest(
    string? Name,
    string? Description,
    int? ParentLocationId);

public record LocationWithChildrenDto(
    int Id,
    string Name,
    string? Description,
    string QrCode,
    int? ParentLocationId,
    List<LocationDto> ChildLocations,
    List<ItemSummaryDto> Items,
    DateTime CreatedAt,
    DateTime UpdatedAt);
