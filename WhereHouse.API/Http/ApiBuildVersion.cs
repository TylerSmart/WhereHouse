namespace WhereHouse.API.Http;

public static class ApiBuildVersion
{
    public static string Value { get; } =
        typeof(ApiBuildVersion).Assembly.GetName().Version?.ToString() ?? "0.0.0.0";
}
