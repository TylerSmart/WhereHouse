namespace WhereHouse.Api.DTOs;

public record SearchRequest(string Query);

public record SearchResult(
    List<ItemDto> Items,
    List<LocationDto> Locations);
