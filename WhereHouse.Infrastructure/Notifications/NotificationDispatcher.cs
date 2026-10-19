using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Text;
using WhereHouse.Core.ActionCenter;

namespace WhereHouse.Infrastructure.Notifications;

public sealed class NotificationDispatcher(HttpClient httpClient) : INotificationDispatcher
{
    public async Task<NotificationTransportOutcome> DispatchAsync(
        NotificationDispatchCommand command,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(command);

        if (string.IsNullOrWhiteSpace(command.Subject))
        {
            return new NotificationTransportOutcome(false, "Notification subject cannot be empty.");
        }

        if (string.IsNullOrWhiteSpace(command.MessageBody))
        {
            return new NotificationTransportOutcome(
                false,
                "Notification message body cannot be empty."
            );
        }

        try
        {
            return command.ChannelType switch
            {
                NotificationChannelType.Ntfy => await DispatchNtfyAsync(command, cancellationToken),
                NotificationChannelType.SlackWebhook => await DispatchSlackAsync(
                    command,
                    cancellationToken
                ),
                NotificationChannelType.Pushover => await DispatchPushoverAsync(
                    command,
                    cancellationToken
                ),
                NotificationChannelType.SmtpEmail => await DispatchSmtpAsync(
                    command,
                    cancellationToken
                ),
                _ => new NotificationTransportOutcome(
                    false,
                    $"Unsupported channel type: {command.ChannelType}"
                ),
            };
        }
        catch (Exception ex)
        {
            return new NotificationTransportOutcome(false, $"Delivery failed: {ex.Message}");
        }
    }

    private async Task<NotificationTransportOutcome> DispatchNtfyAsync(
        NotificationDispatchCommand command,
        CancellationToken cancellationToken
    )
    {
        if (
            string.IsNullOrWhiteSpace(command.EndpointUrl)
            || !Uri.TryCreate(command.EndpointUrl, UriKind.Absolute, out var uri)
        )
        {
            return new NotificationTransportOutcome(false, "Invalid or missing ntfy endpoint URL.");
        }

        if (IsSimulatedEndpoint(uri))
        {
            return new NotificationTransportOutcome(true, $"Simulated 200 OK (Ntfy -> {uri.Host})");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = new StringContent(command.MessageBody, Encoding.UTF8, "text/plain"),
        };

        request.Headers.TryAddWithoutValidation("Title", command.Subject);
        request.Headers.TryAddWithoutValidation("Priority", "default");
        request.Headers.TryAddWithoutValidation("Tags", "house,package");

        if (!string.IsNullOrWhiteSpace(command.AccessTokenOrKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue(
                "Bearer",
                command.AccessTokenOrKey.Trim()
            );
        }

        var response = await httpClient.SendAsync(request, cancellationToken);
        return new NotificationTransportOutcome(
            response.IsSuccessStatusCode,
            $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}"
        );
    }

    private async Task<NotificationTransportOutcome> DispatchSlackAsync(
        NotificationDispatchCommand command,
        CancellationToken cancellationToken
    )
    {
        if (
            string.IsNullOrWhiteSpace(command.EndpointUrl)
            || !Uri.TryCreate(command.EndpointUrl, UriKind.Absolute, out var uri)
        )
        {
            return new NotificationTransportOutcome(false, "Invalid or missing Slack webhook URL.");
        }

        if (IsSimulatedEndpoint(uri))
        {
            return new NotificationTransportOutcome(
                true,
                $"Simulated 200 OK (SlackWebhook -> {uri.Host})"
            );
        }

        var payload = new { text = $"*{command.Subject}*\n{command.MessageBody}" };

        var response = await httpClient.PostAsJsonAsync(uri, payload, cancellationToken);
        return new NotificationTransportOutcome(
            response.IsSuccessStatusCode,
            $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}"
        );
    }

    private async Task<NotificationTransportOutcome> DispatchPushoverAsync(
        NotificationDispatchCommand command,
        CancellationToken cancellationToken
    )
    {
        if (
            string.IsNullOrWhiteSpace(command.AccessTokenOrKey)
            || string.IsNullOrWhiteSpace(command.RecipientOrUserKey)
        )
        {
            return new NotificationTransportOutcome(
                false,
                "Pushover requires both an Application API Token and a User/Group Key."
            );
        }

        var endpointUrl = string.IsNullOrWhiteSpace(command.EndpointUrl)
            ? "https://api.pushover.net/1/messages.json"
            : command.EndpointUrl.Trim();

        if (!Uri.TryCreate(endpointUrl, UriKind.Absolute, out var uri))
        {
            return new NotificationTransportOutcome(false, "Invalid Pushover endpoint URL.");
        }

        if (IsSimulatedEndpoint(uri))
        {
            return new NotificationTransportOutcome(
                true,
                $"Simulated 200 OK (Pushover -> {uri.Host})"
            );
        }

        var payload = new
        {
            token = command.AccessTokenOrKey.Trim(),
            user = command.RecipientOrUserKey.Trim(),
            title = command.Subject,
            message = command.MessageBody,
        };

        var response = await httpClient.PostAsJsonAsync(uri, payload, cancellationToken);
        return new NotificationTransportOutcome(
            response.IsSuccessStatusCode,
            $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}"
        );
    }

    private Task<NotificationTransportOutcome> DispatchSmtpAsync(
        NotificationDispatchCommand command,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (
            string.IsNullOrWhiteSpace(command.SmtpHost)
            || string.IsNullOrWhiteSpace(command.RecipientOrUserKey)
        )
        {
            return Task.FromResult(
                new NotificationTransportOutcome(
                    false,
                    "SMTP Email requires both an SMTP Host and a Recipient Email Address."
                )
            );
        }

        var host = command.SmtpHost.Trim();
        var recipient = command.RecipientOrUserKey.Trim();
        var port = command.SmtpPort is > 0 and <= 65535 ? command.SmtpPort.Value : 587;

        if (IsSimulatedSmtpHost(host))
        {
            return Task.FromResult(
                new NotificationTransportOutcome(
                    true,
                    $"Simulated SMTP 250 OK ({host}:{port} -> {recipient})"
                )
            );
        }

        var fromAddress = string.IsNullOrWhiteSpace(command.SmtpFromAddress)
            ? "wherehouse@localhost"
            : command.SmtpFromAddress.Trim();

        using var message = new MailMessage(
            fromAddress,
            recipient,
            command.Subject,
            command.MessageBody
        );
        using var client = new SmtpClient(host, port) { EnableSsl = command.SmtpUseSsl };

        if (
            !string.IsNullOrWhiteSpace(command.SmtpUsername)
            && !string.IsNullOrWhiteSpace(command.AccessTokenOrKey)
        )
        {
            client.Credentials = new System.Net.NetworkCredential(
                command.SmtpUsername.Trim(),
                command.AccessTokenOrKey.Trim()
            );
        }

        client.Send(message);
        return Task.FromResult(
            new NotificationTransportOutcome(true, $"SMTP 250 OK ({host}:{port} -> {recipient})")
        );
    }

    private static bool IsSimulatedEndpoint(Uri uri)
    {
        if (string.Equals(uri.Scheme, "mock", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var host = uri.Host;
        return string.Equals(host, "mock.local", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".mock.local", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "example.com", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsSimulatedSmtpHost(string host)
    {
        return host.StartsWith("mock", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".local", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith("example.com", StringComparison.OrdinalIgnoreCase);
    }
}
