using System.Net;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.ActionCenter;
using WhereHouse.Infrastructure.Notifications;

namespace WhereHouse.Infrastructure.UnitTests;

[TestClass]
public sealed class NotificationDispatcherTests
{
    private sealed class MockHttpMessageHandler(
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler
    ) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        ) => handler(request, cancellationToken);
    }

    [TestMethod]
    public async Task DispatchAsync_WithEmptySubjectOrBody_ReturnsFailure()
    {
        var dispatcher = new NotificationDispatcher(new HttpClient());

        var emptySubjectCommand = new NotificationDispatchCommand(
            NotificationChannelType.Ntfy,
            "Channel",
            "https://ntfy.sh/topic",
            null,
            null,
            null,
            null,
            null,
            null,
            true,
            "",
            "Body"
        );

        var result1 = await dispatcher.DispatchAsync(emptySubjectCommand);
        Assert.IsFalse(result1.Success);
        StringAssert.Contains(result1.ResponseSummary, "subject cannot be empty");

        var emptyBodyCommand = emptySubjectCommand with
        {
            Subject = "Subject",
            MessageBody = "   ",
        };
        var result2 = await dispatcher.DispatchAsync(emptyBodyCommand);
        Assert.IsFalse(result2.Success);
        StringAssert.Contains(result2.ResponseSummary, "body cannot be empty");
    }

    [TestMethod]
    public async Task DispatchAsync_Ntfy_WithSimulatedEndpoint_ReturnsSuccessWithoutNetworkCall()
    {
        var dispatcher = new NotificationDispatcher(new HttpClient());

        var command = new NotificationDispatchCommand(
            NotificationChannelType.Ntfy,
            "Ntfy Channel",
            "https://test.mock.local/wherehouse",
            "test-token",
            null,
            null,
            null,
            null,
            null,
            true,
            "Alert Title",
            "Alert Message Content"
        );

        var result = await dispatcher.DispatchAsync(command);

        Assert.IsTrue(result.Success);
        StringAssert.Contains(result.ResponseSummary, "Simulated 200 OK");
        StringAssert.Contains(result.ResponseSummary, "Ntfy");
    }

    [TestMethod]
    public async Task DispatchAsync_Ntfy_WithRealHttp_SetsHeadersAndBody()
    {
        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;

        var handler = new MockHttpMessageHandler(
            async (req, ct) =>
            {
                capturedRequest = req;
                capturedBody = await req.Content!.ReadAsStringAsync(ct);
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
        );

        var dispatcher = new NotificationDispatcher(new HttpClient(handler));

        var command = new NotificationDispatchCommand(
            NotificationChannelType.Ntfy,
            "Ntfy Topic",
            "https://ntfy.sh/my-topic",
            "secret-bearer-token",
            null,
            null,
            null,
            null,
            null,
            true,
            "Overdue Alert",
            "Wrench was not returned"
        );

        var result = await dispatcher.DispatchAsync(command);

        Assert.IsTrue(result.Success);
        Assert.IsNotNull(capturedRequest);
        Assert.AreEqual(HttpMethod.Post, capturedRequest.Method);
        Assert.AreEqual("https://ntfy.sh/my-topic", capturedRequest.RequestUri?.ToString());
        Assert.AreEqual(
            "Overdue Alert",
            capturedRequest.Headers.GetValues("Title").FirstOrDefault()
        );
        Assert.AreEqual("Bearer", capturedRequest.Headers.Authorization?.Scheme);
        Assert.AreEqual("secret-bearer-token", capturedRequest.Headers.Authorization?.Parameter);
        Assert.AreEqual("Wrench was not returned", capturedBody);
    }

    [TestMethod]
    public async Task DispatchAsync_SlackWebhook_PostsJsonPayload()
    {
        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;

        var handler = new MockHttpMessageHandler(
            async (req, ct) =>
            {
                capturedRequest = req;
                capturedBody = await req.Content!.ReadAsStringAsync(ct);
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
        );

        var dispatcher = new NotificationDispatcher(new HttpClient(handler));

        var command = new NotificationDispatchCommand(
            NotificationChannelType.SlackWebhook,
            "Slack Alerts",
            "https://hooks.slack.com/services/T000/B000/XXXX",
            null,
            null,
            null,
            null,
            null,
            null,
            true,
            "Weekly Digest",
            "2 items out of place"
        );

        var result = await dispatcher.DispatchAsync(command);

        Assert.IsTrue(result.Success);
        Assert.IsNotNull(capturedRequest);
        Assert.IsNotNull(capturedBody);

        using var doc = JsonDocument.Parse(capturedBody);
        var text = doc.RootElement.GetProperty("text").GetString();
        Assert.IsNotNull(text);
        StringAssert.Contains(text, "*Weekly Digest*");
        StringAssert.Contains(text, "2 items out of place");
    }

    [TestMethod]
    public async Task DispatchAsync_Pushover_WithMissingCredentials_ReturnsFailure()
    {
        var dispatcher = new NotificationDispatcher(new HttpClient());

        var command = new NotificationDispatchCommand(
            NotificationChannelType.Pushover,
            "Pushover",
            null,
            null, // missing token
            "user-key",
            null,
            null,
            null,
            null,
            true,
            "Title",
            "Message"
        );

        var result = await dispatcher.DispatchAsync(command);
        Assert.IsFalse(result.Success);
        StringAssert.Contains(result.ResponseSummary, "Pushover requires both");
    }

    [TestMethod]
    public async Task DispatchAsync_Pushover_PostsExpectedJson()
    {
        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;

        var handler = new MockHttpMessageHandler(
            async (req, ct) =>
            {
                capturedRequest = req;
                capturedBody = await req.Content!.ReadAsStringAsync(ct);
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
        );

        var dispatcher = new NotificationDispatcher(new HttpClient(handler));

        var command = new NotificationDispatchCommand(
            NotificationChannelType.Pushover,
            "My Pushover",
            null,
            "app-token-123",
            "user-key-456",
            null,
            null,
            null,
            null,
            true,
            "Pushover Title",
            "Pushover Body"
        );

        var result = await dispatcher.DispatchAsync(command);

        Assert.IsTrue(result.Success);
        Assert.IsNotNull(capturedRequest);
        Assert.AreEqual(
            "https://api.pushover.net/1/messages.json",
            capturedRequest.RequestUri?.ToString()
        );

        using var doc = JsonDocument.Parse(capturedBody!);
        Assert.AreEqual("app-token-123", doc.RootElement.GetProperty("token").GetString());
        Assert.AreEqual("user-key-456", doc.RootElement.GetProperty("user").GetString());
        Assert.AreEqual("Pushover Title", doc.RootElement.GetProperty("title").GetString());
        Assert.AreEqual("Pushover Body", doc.RootElement.GetProperty("message").GetString());
    }

    [TestMethod]
    public async Task DispatchAsync_SmtpEmail_WithSimulatedHost_ReturnsSuccess()
    {
        var dispatcher = new NotificationDispatcher(new HttpClient());

        var command = new NotificationDispatchCommand(
            NotificationChannelType.SmtpEmail,
            "Admin Email",
            null,
            null,
            "admin@example.com",
            "mail.internal.local",
            25,
            null,
            "alerts@wherehouse.lan",
            false,
            "WhereHouse Digest",
            "Household summary"
        );

        var result = await dispatcher.DispatchAsync(command);

        Assert.IsTrue(result.Success);
        StringAssert.Contains(result.ResponseSummary, "Simulated SMTP 250 OK");
        StringAssert.Contains(result.ResponseSummary, "admin@example.com");
    }

    [TestMethod]
    public async Task DispatchAsync_WhenEndpointReturns500_ReturnsFailureWithStatus()
    {
        var handler = new MockHttpMessageHandler(
            (req, ct) =>
            {
                var res = new HttpResponseMessage(HttpStatusCode.InternalServerError)
                {
                    ReasonPhrase = "Internal Server Error",
                };
                return Task.FromResult(res);
            }
        );

        var dispatcher = new NotificationDispatcher(new HttpClient(handler));

        var command = new NotificationDispatchCommand(
            NotificationChannelType.SlackWebhook,
            "Broken Slack",
            "https://hooks.slack.com/services/broken",
            null,
            null,
            null,
            null,
            null,
            null,
            true,
            "Title",
            "Body"
        );

        var result = await dispatcher.DispatchAsync(command);

        Assert.IsFalse(result.Success);
        StringAssert.Contains(result.ResponseSummary, "HTTP 500");
    }
}
