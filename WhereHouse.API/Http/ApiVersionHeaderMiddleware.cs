namespace WhereHouse.API.Http;

public sealed class ApiVersionHeaderMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.OnStarting(
                static state =>
                {
                    var response = (HttpResponse)state;
                    response.Headers["X-Api-Version"] = ApiBuildVersion.Value;
                    return Task.CompletedTask;
                },
                context.Response
            );
        }

        await next(context);
    }
}
