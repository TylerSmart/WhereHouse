# Phase 09: Action Center Dashboard & Outbound Webhook/Push Notification Engine

> **Branch:** `feature/phase-09-action-center-and-webhook-notifications`
> **Status:** [ ] Not Started
> **PRD Reference:** `docs/prd.md` — Sections 4.2.1 (`Low-Stock Threshold`), 4.5.1 (`Out of Place & External Loans`), 4.6.2 (`Return Window & Warranty Lifecycle`), 4.6.3 (`Recurring Maintenance Due`), 4.8.2 (`"Secret / Gift Mode" Privacy`), and 4.8.3 (`Action Center Dashboard & Outbound Notifications`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase completes **Milestone 4 (Advanced Vault & Automation)**—and the full WhereHouse PRD roadmap—by delivering **PRD Section 4.8.3 (Action Center Dashboard & Outbound Notifications)**:

1. **Unified Action Center Dashboard (`IActionCenterService`, `ActionCenterController`, PRD 4.6.2 & 4.8.3):**
   - Aggregates all five household action categories into a single, real-time `ActionCenterOverviewDto` (`GET /api/action-center?coverageWindowDays=30`):
     1. **Out of Place / Currently In Use (`OutOfPlaceItems`):** Non-archived items with `Status == ItemStatus.InUse`, sorted by `CheckedOutAt` ascending (longest out first), including `DaysOut`, `CheckedOutByUsername`, `CheckoutNote`, `ActiveLoadoutName`, and `HomeLocationFullPath`.
     2. **Active & Overdue External Loans (`ExternalLoans`):** Non-archived items with `Status == ItemStatus.LoanedOut`, highlighting overdue loans (`CheckoutDueAt < UtcNow`) first, with `BorrowerName`, `BorrowerContact`, `DueAt`, `IsOverdue`, and `DaysUntilDue`.
     3. **Maintenance Due (`DueMaintenanceSchedules`):** Active `MaintenanceSchedule` items whose calculated `MaintenanceDueStatus` is `Overdue` or `DueSoon` (within 14 days), ordered by `Overdue` first then `NextDueAt`.
     4. **Expiring Warranties & Return Windows (`ExpiringCoverages`):** Non-archived items whose `ReturnWindowEndDate` or `WarrantyExpirationDate` falls within `[UtcNow.AddDays(-7), UtcNow.AddDays(coverageWindowDays)]`, ordered by `ExpirationDate` ascending.
     5. **Low Stock Alerts (`LowStockItems`):** Non-archived items where `MinQuantity.HasValue && CurrentQuantity <= MinQuantity.Value`, ordered by ratio `CurrentQuantity / Max(1, MinQuantity)` ascending.
   - Surfaces both an interactive **Action Center Summary Strip** on the main `DashboardComponent` and a comprehensive **`ActionCenterDialogComponent`** with 1-tap resolution shortcuts (*Return to Home Bin*, *Complete Maintenance*, *Restock +1*, *Navigate to Bin*).

2. **Webhook & Push Notification Engine (`INotificationDispatcher`, `NotificationChannel`, `NotificationDeliveryLog`, PRD 4.8.3):**
   - Supports configurable outbound notification channels across all four PRD providers:
     - **ntfy** (`NotificationChannelType.Ntfy`) — HTTP `POST` with `Title`, `Priority`, `Tags`, and optional Bearer token.
     - **Slack Webhooks** (`NotificationChannelType.SlackWebhook`) — HTTP `POST` with Markdown JSON payload `{ "text": ... }`.
     - **Pushover** (`NotificationChannelType.Pushover`) — HTTP `POST` to Pushover API (`https://api.pushover.net/1/messages.json` or custom endpoint) with `{ "token", "user", "title", "message" }`.
     - **Email (SMTP)** (`NotificationChannelType.SmtpEmail`) — Configurable `SmtpHost`, `SmtpPort`, `SmtpUsername`, `AccessTokenOrKey` (password), `SmtpFromAddress`, `RecipientOrUserKey` (recipient email), and `SmtpUseSsl`.
   - Supports **Test Channel Delivery** (`POST /api/action-center/channels/{channelId}/test`) and **On-Demand / Scheduled Weekly Household Digest** (`POST /api/action-center/digest/send`), recording every dispatch attempt in `NotificationDeliveryLog`.
   - Enforces strict **"Secret / Gift Mode" (`IsPrivate`)** boundaries:
     - Personal channels (`IsSharedHouseholdChannel == false`) are strictly isolated to their `OwnerId` (`403 Forbidden` if accessed/modified by another user).
     - Shared household channels (`IsSharedHouseholdChannel == true`) automatically strip all `IsPrivate` items and private location subtrees when composing digests so shared Slack/ntfy channels never leak secret gift items to other household members.

---

## 2. Domain & Database Design (`WhereHouse.Core`, `WhereHouse.Data`, `WhereHouse.Infrastructure`)

### 2.1 Models, Enums & Contracts (`WhereHouse.Core/ActionCenter/`)

1. **Create `WhereHouse.Core/ActionCenter/ActionCenterModels.cs`:**
   ```csharp
   using System.ComponentModel.DataAnnotations;
   using WhereHouse.Core.Maintenance;

   namespace WhereHouse.Core.ActionCenter;

   public enum NotificationChannelType
   {
       Ntfy = 0,
       SlackWebhook = 1,
       Pushover = 2,
       SmtpEmail = 3,
   }

   public enum NotificationEventType
   {
       TestNotification = 0,
       WeeklyDigest = 1,
       OverdueLoanAlert = 2,
       MaintenanceDueAlert = 3,
       WarrantyReturnExpiryAlert = 4,
       LowStockAlert = 5,
   }

   public enum WarrantyOrReturnAlertType
   {
       ReturnWindow = 0,
       WarrantyExpiration = 1,
   }

   public sealed record OutOfPlaceItemAlertDto(
       Guid ItemId,
       string ShortCode,
       string Name,
       string? HomeLocationId,
       string? HomeLocationFullPath,
       Guid? CheckedOutByUserId,
       string? CheckedOutByUsername,
       string? CheckoutNote,
       Guid? ActiveLoadoutId,
       string? ActiveLoadoutName,
       DateTimeOffset? CheckedOutAt,
       int DaysOut
   );

   public sealed record ExternalLoanAlertDto(
       Guid ItemId,
       string ShortCode,
       string Name,
       string? HomeLocationFullPath,
       string? BorrowerName,
       string? BorrowerContact,
       string? CheckoutNote,
       DateTimeOffset? CheckedOutAt,
       DateTimeOffset? DueAt,
       bool IsOverdue,
       int? DaysUntilDue
   );

   public sealed record ExpiringCoverageAlertDto(
       Guid ItemId,
       string ShortCode,
       string Name,
       string? Brand,
       string? ModelNumber,
       string? Retailer,
       decimal? PurchasePrice,
       string? HomeLocationFullPath,
       WarrantyOrReturnAlertType AlertType,
       DateTimeOffset ExpirationDate,
       int DaysRemaining,
       bool IsExpired,
       string? WarrantyNotes
   );

   public sealed record LowStockItemAlertDto(
       Guid ItemId,
       string ShortCode,
       string Name,
       string? CategoryName,
       string? HomeLocationFullPath,
       decimal CurrentQuantity,
       decimal MinQuantity,
       string? Unit
   );

   public sealed record ActionCenterOverviewDto(
       int TotalAlertsCount,
       int OutOfPlaceCount,
       int ActiveLoansCount,
       int OverdueLoansCount,
       int MaintenanceDueCount,
       int MaintenanceOverdueCount,
       int ExpiringCoverageCount,
       int LowStockCount,
       IReadOnlyList<OutOfPlaceItemAlertDto> OutOfPlaceItems,
       IReadOnlyList<ExternalLoanAlertDto> ExternalLoans,
       IReadOnlyList<MaintenanceScheduleDto> DueMaintenanceSchedules,
       IReadOnlyList<ExpiringCoverageAlertDto> ExpiringCoverages,
       IReadOnlyList<LowStockItemAlertDto> LowStockItems
   );

   public sealed record NotificationChannelDto(
       Guid Id,
       Guid OwnerId,
       string Name,
       NotificationChannelType ChannelType,
       bool IsEnabled,
       bool IsSharedHouseholdChannel,
       string? EndpointUrl,
       bool HasAccessTokenOrKey,
       string? RecipientOrUserKey,
       string? SmtpHost,
       int? SmtpPort,
       string? SmtpUsername,
       string? SmtpFromAddress,
       bool SmtpUseSsl,
       bool NotifyOnOverdueLoans,
       bool NotifyOnMaintenanceDue,
       bool NotifyOnExpiringWarranties,
       bool NotifyOnLowStock,
       bool EnableWeeklyDigest,
       DayOfWeek DigestDayOfWeek,
       int DigestHourUtc,
       DateTimeOffset? LastTriggeredAt,
       string? LastDeliveryStatus,
       DateTimeOffset CreatedAt,
       DateTimeOffset ModifiedAt
   );

   public sealed record NotificationDeliveryLogDto(
       Guid Id,
       Guid ChannelId,
       string ChannelName,
       NotificationChannelType ChannelType,
       NotificationEventType EventType,
       string Subject,
       string MessageBody,
       bool Success,
       string? ResponseSummary,
       DateTimeOffset DeliveredAt
   );

   public sealed record CreateNotificationChannelRequest(
       [Required, MaxLength(150)] string Name,
       NotificationChannelType ChannelType = NotificationChannelType.Ntfy,
       bool IsEnabled = true,
       bool IsSharedHouseholdChannel = false,
       [MaxLength(1000)] string? EndpointUrl = null,
       [MaxLength(500)] string? AccessTokenOrKey = null,
       [MaxLength(320)] string? RecipientOrUserKey = null,
       [MaxLength(255)] string? SmtpHost = null,
       [Range(1, 65535)] int? SmtpPort = 587,
       [MaxLength(255)] string? SmtpUsername = null,
       [MaxLength(320)] string? SmtpFromAddress = null,
       bool SmtpUseSsl = true,
       bool NotifyOnOverdueLoans = true,
       bool NotifyOnMaintenanceDue = true,
       bool NotifyOnExpiringWarranties = true,
       bool NotifyOnLowStock = true,
       bool EnableWeeklyDigest = true,
       DayOfWeek DigestDayOfWeek = DayOfWeek.Sunday,
       [Range(0, 23)] int DigestHourUtc = 9
   );

   public sealed record UpdateNotificationChannelRequest(
       [Required, MaxLength(150)] string Name,
       NotificationChannelType ChannelType = NotificationChannelType.Ntfy,
       bool IsEnabled = true,
       bool IsSharedHouseholdChannel = false,
       [MaxLength(1000)] string? EndpointUrl = null,
       [MaxLength(500)] string? AccessTokenOrKey = null,
       bool ClearAccessTokenOrKey = false,
       [MaxLength(320)] string? RecipientOrUserKey = null,
       [MaxLength(255)] string? SmtpHost = null,
       [Range(1, 65535)] int? SmtpPort = 587,
       [MaxLength(255)] string? SmtpUsername = null,
       [MaxLength(320)] string? SmtpFromAddress = null,
       bool SmtpUseSsl = true,
       bool NotifyOnOverdueLoans = true,
       bool NotifyOnMaintenanceDue = true,
       bool NotifyOnExpiringWarranties = true,
       bool NotifyOnLowStock = true,
       bool EnableWeeklyDigest = true,
       DayOfWeek DigestDayOfWeek = DayOfWeek.Sunday,
       [Range(0, 23)] int DigestHourUtc = 9
   );

   public sealed record SendNotificationDigestRequest(
       Guid? ChannelId = null,
       [Range(1, 365)] int CoverageWindowDays = 30
   );

   public sealed record NotificationDispatchResultDto(
       int ChannelsTargeted,
       int SuccessCount,
       int FailureCount,
       string DigestSubject,
       string DigestBodyPreview,
       IReadOnlyList<NotificationDeliveryLogDto> Deliveries
   );

   public sealed record NotificationDispatchCommand(
       NotificationChannelType ChannelType,
       string ChannelName,
       string? EndpointUrl,
       string? AccessTokenOrKey,
       string? RecipientOrUserKey,
       string? SmtpHost,
       int? SmtpPort,
       string? SmtpUsername,
       string? SmtpFromAddress,
       bool SmtpUseSsl,
       string Subject,
       string MessageBody
   );

   public sealed record NotificationTransportOutcome(
       bool Success,
       string ResponseSummary
   );
   ```

2. **Create `WhereHouse.Core/ActionCenter/INotificationDispatcher.cs`:**
   ```csharp
   namespace WhereHouse.Core.ActionCenter;

   public interface INotificationDispatcher
   {
       Task<NotificationTransportOutcome> DispatchAsync(
           NotificationDispatchCommand command,
           CancellationToken cancellationToken = default
       );
   }
   ```

3. **Create `WhereHouse.Core/ActionCenter/IActionCenterService.cs`:**
   ```csharp
   namespace WhereHouse.Core.ActionCenter;

   public interface IActionCenterService
   {
       Task<ActionCenterOverviewDto> GetOverviewAsync(
           Guid userId,
           int coverageWindowDays = 30,
           CancellationToken cancellationToken = default
       );

       Task<IReadOnlyList<NotificationChannelDto>> GetChannelsAsync(
           Guid userId,
           CancellationToken cancellationToken = default
       );

       Task<NotificationChannelDto?> GetChannelByIdAsync(
           Guid userId,
           Guid channelId,
           CancellationToken cancellationToken = default
       );

       Task<NotificationChannelDto> CreateChannelAsync(
           Guid userId,
           CreateNotificationChannelRequest request,
           CancellationToken cancellationToken = default
       );

       Task<NotificationChannelDto?> UpdateChannelAsync(
           Guid userId,
           Guid channelId,
           UpdateNotificationChannelRequest request,
           CancellationToken cancellationToken = default
       );

       Task<bool> DeleteChannelAsync(
           Guid userId,
           Guid channelId,
           CancellationToken cancellationToken = default
       );

       Task<NotificationDeliveryLogDto?> SendTestNotificationAsync(
           Guid userId,
           Guid channelId,
           CancellationToken cancellationToken = default
       );

       Task<NotificationDispatchResultDto> SendDigestAsync(
           Guid userId,
           SendNotificationDigestRequest request,
           CancellationToken cancellationToken = default
       );

       Task<IReadOnlyList<NotificationDeliveryLogDto>> GetRecentDeliveriesAsync(
           Guid userId,
           int limit = 30,
           CancellationToken cancellationToken = default
       );
   }
   ```

---

### 2.2 Entities & EF Core Configurations (`WhereHouse.Data/`)

1. **Create `WhereHouse.Data/Entities/NotificationChannel.cs`:**
   ```csharp
   using WhereHouse.Core.ActionCenter;

   namespace WhereHouse.Data.Entities;

   public sealed class NotificationChannel : IAuditable
   {
       public Guid Id { get; set; } = Guid.NewGuid();

       public Guid OwnerId { get; set; }

       public User Owner { get; set; } = null!;

       public string Name { get; set; } = string.Empty;

       public NotificationChannelType ChannelType { get; set; } = NotificationChannelType.Ntfy;

       public bool IsEnabled { get; set; } = true;

       public bool IsSharedHouseholdChannel { get; set; }

       public string? EndpointUrl { get; set; }

       public string? AccessTokenOrKey { get; set; }

       public string? RecipientOrUserKey { get; set; }

       public string? SmtpHost { get; set; }

       public int? SmtpPort { get; set; } = 587;

       public string? SmtpUsername { get; set; }

       public string? SmtpFromAddress { get; set; }

       public bool SmtpUseSsl { get; set; } = true;

       public bool NotifyOnOverdueLoans { get; set; } = true;

       public bool NotifyOnMaintenanceDue { get; set; } = true;

       public bool NotifyOnExpiringWarranties { get; set; } = true;

       public bool NotifyOnLowStock { get; set; } = true;

       public bool EnableWeeklyDigest { get; set; } = true;

       public DayOfWeek DigestDayOfWeek { get; set; } = DayOfWeek.Sunday;

       public int DigestHourUtc { get; set; } = 9;

       public DateTimeOffset? LastTriggeredAt { get; set; }

       public string? LastDeliveryStatus { get; set; }

       public ICollection<NotificationDeliveryLog> DeliveryLogs { get; set; } =
           new List<NotificationDeliveryLog>();

       public DateTimeOffset CreatedAt { get; set; }

       public string CreatedBy { get; set; } = "System";

       public DateTimeOffset ModifiedAt { get; set; }

       public string ModifiedBy { get; set; } = "System";
   }
   ```

2. **Create `WhereHouse.Data/Entities/NotificationDeliveryLog.cs`:**
   ```csharp
   using WhereHouse.Core.ActionCenter;

   namespace WhereHouse.Data.Entities;

   public sealed class NotificationDeliveryLog : IAuditable
   {
       public Guid Id { get; set; } = Guid.NewGuid();

       public Guid ChannelId { get; set; }

       public NotificationChannel Channel { get; set; } = null!;

       public Guid OwnerId { get; set; }

       public string ChannelName { get; set; } = string.Empty;

       public NotificationChannelType ChannelType { get; set; }

       public NotificationEventType EventType { get; set; }

       public string Subject { get; set; } = string.Empty;

       public string MessageBody { get; set; } = string.Empty;

       public bool Success { get; set; }

       public string? ResponseSummary { get; set; }

       public DateTimeOffset DeliveredAt { get; set; }

       public DateTimeOffset CreatedAt { get; set; }

       public string CreatedBy { get; set; } = "System";

       public DateTimeOffset ModifiedAt { get; set; }

       public string ModifiedBy { get; set; } = "System";
   }
   ```

3. **Create `WhereHouse.Data/Configurations/NotificationChannelConfiguration.cs`:**
   - Table: `"NotificationChannels"`.
   - Primary key: `c.Id`.
   - `Name`: `IsRequired()`, `HasMaxLength(150)`.
   - `EndpointUrl`: `HasMaxLength(1000)`.
   - `AccessTokenOrKey`: `HasMaxLength(500)`.
   - `RecipientOrUserKey`: `HasMaxLength(320)`.
   - `SmtpHost`: `HasMaxLength(255)`.
   - `SmtpUsername`: `HasMaxLength(255)`.
   - `SmtpFromAddress`: `HasMaxLength(320)`.
   - `LastDeliveryStatus`: `HasMaxLength(500)`.
   - `CreatedBy`, `ModifiedBy`: `IsRequired()`, `HasMaxLength(100)`.
   - Indexes: `HasIndex(c => c.OwnerId)`, `HasIndex(c => c.IsEnabled)`, `HasIndex(c => c.IsSharedHouseholdChannel)`.
   - Foreign Key:
     ```csharp
     builder
         .HasOne(c => c.Owner)
         .WithMany()
         .HasForeignKey(c => c.OwnerId)
         .OnDelete(DeleteBehavior.Cascade);
     ```

4. **Create `WhereHouse.Data/Configurations/NotificationDeliveryLogConfiguration.cs`:**
   - Table: `"NotificationDeliveryLogs"`.
   - Primary key: `l.Id`.
   - `ChannelName`: `IsRequired()`, `HasMaxLength(150)`.
   - `Subject`: `IsRequired()`, `HasMaxLength(300)`.
   - `MessageBody`: `IsRequired()`, `HasMaxLength(4000)`.
   - `ResponseSummary`: `HasMaxLength(1000)`.
   - `CreatedBy`, `ModifiedBy`: `IsRequired()`, `HasMaxLength(100)`.
   - Indexes: `HasIndex(l => l.ChannelId)`, `HasIndex(l => l.OwnerId)`, `HasIndex(l => l.DeliveredAt)`.
   - Foreign Key (**SQL Server Multiple-Cascade-Path Safety**):
     - Cascade from `NotificationChannel`:
       ```csharp
       builder
           .HasOne(l => l.Channel)
           .WithMany(c => c.DeliveryLogs)
           .HasForeignKey(l => l.ChannelId)
           .OnDelete(DeleteBehavior.Cascade);
       ```
     - `OwnerId` is a scalar indexed `Guid` column with no navigation/FK to `User` so SQL Server never encounters multiple cascade paths from `User -> NotificationChannel -> NotificationDeliveryLog`.

5. **Update `WhereHouse.Data/WhereHouseDbContext.cs`:**
   - Add:
     ```csharp
     public DbSet<NotificationChannel> NotificationChannels => Set<NotificationChannel>();

     public DbSet<NotificationDeliveryLog> NotificationDeliveryLogs => Set<NotificationDeliveryLog>();
     ```

6. **EF Core Migration Name:**
   - `AddActionCenterNotificationChannels`

---

### 2.3 Service & Dispatcher Implementation (`WhereHouse.Infrastructure` & `WhereHouse.Data`)

1. **Create `WhereHouse.Infrastructure/Notifications/NotificationDispatcher.cs`:**
   - Primary constructor: `public sealed class NotificationDispatcher(HttpClient httpClient) : INotificationDispatcher`.
   - **Validation & Dispatch Rules (`DispatchAsync`):**
     - Validates `command` is not null and `Subject`/`MessageBody` are non-empty.
     - **Simulated / Loopback Test Mode Detection (`IsSimulatedEndpoint`):**
       - Returns `true` if `uri.Scheme` is `"mock"` or `uri.Host` ends with `".mock.local"` or equals `"mock.local"` or `"example.com"`.
       - When `IsSimulatedEndpoint` is `true`, returns `new NotificationTransportOutcome(true, $"Simulated 200 OK ({command.ChannelType} -> {uri.Host})")` without opening an external socket.
     - **Provider 1 — `NotificationChannelType.Ntfy`:**
       - Requires valid `EndpointUrl` (`http://`, `https://`, or `mock://`); otherwise returns `new NotificationTransportOutcome(false, "Invalid or missing ntfy endpoint URL.")`.
       - If not simulated: builds `HttpRequestMessage(HttpMethod.Post, uri)` with UTF-8 plain text `command.MessageBody`, adds headers `Title: command.Subject`, `Priority: default`, `Tags: house,package`, and if `!string.IsNullOrWhiteSpace(command.AccessTokenOrKey)`, sets `Authorization = new AuthenticationHeaderValue("Bearer", command.AccessTokenOrKey.Trim())`.
       - Sends via `httpClient.SendAsync(request, cancellationToken)` and returns `Success = response.IsSuccessStatusCode` with `ResponseSummary = $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}"`.
     - **Provider 2 — `NotificationChannelType.SlackWebhook`:**
       - Requires valid `EndpointUrl`; otherwise returns `new NotificationTransportOutcome(false, "Invalid or missing Slack webhook URL.")`.
       - If not simulated: builds JSON payload `new { text = $"*{command.Subject}*\n{command.MessageBody}" }` and posts via `httpClient.PostAsJsonAsync(uri, payload, cancellationToken)`.
     - **Provider 3 — `NotificationChannelType.Pushover`:**
       - Requires non-empty `AccessTokenOrKey` (API token) and `RecipientOrUserKey` (user key); otherwise returns `new NotificationTransportOutcome(false, "Pushover requires both an Application API Token and a User/Group Key.")`.
       - Target URL defaults to `"https://api.pushover.net/1/messages.json"` if `command.EndpointUrl` is null/whitespace.
       - If not simulated: posts JSON `{ token = command.AccessTokenOrKey, user = command.RecipientOrUserKey, title = command.Subject, message = command.MessageBody }`.
     - **Provider 4 — `NotificationChannelType.SmtpEmail`:**
       - Requires non-empty `SmtpHost` and `RecipientOrUserKey` (recipient email); otherwise returns `new NotificationTransportOutcome(false, "SMTP Email requires both an SMTP Host and a Recipient Email Address.")`.
       - If `SmtpHost` starts with `"mock"` or ends with `".local"` / `"example.com"`, returns `new NotificationTransportOutcome(true, $"Simulated SMTP 250 OK ({command.SmtpHost}:{command.SmtpPort ?? 587} -> {command.RecipientOrUserKey})")`.
       - Otherwise constructs `System.Net.Mail.MailMessage` (`From = command.SmtpFromAddress ?? "wherehouse@localhost"`, `To = command.RecipientOrUserKey`, `Subject = command.Subject`, `Body = command.MessageBody`) and sends via `SmtpClient(command.SmtpHost, command.SmtpPort ?? 587)`.
     - Catches any `Exception ex` during transport and returns `new NotificationTransportOutcome(false, $"Delivery failed: {ex.Message}")` so a failing webhook never crashes the API request.

2. **Register `INotificationDispatcher` in `WhereHouse.Infrastructure/InfrastructureServiceCollectionExtensions.cs`:**
   - Add `services.AddHttpClient<INotificationDispatcher, NotificationDispatcher>();`.

3. **Create `WhereHouse.Data/Services/ActionCenterService.cs`:**
   - Primary constructor: `public sealed class ActionCenterService(WhereHouseDbContext dbContext, INotificationDispatcher notificationDispatcher) : IActionCenterService`.
   - **`GetOverviewAsync(Guid userId, int coverageWindowDays = 30, CancellationToken cancellationToken = default)`:**
     - Clamps `coverageWindowDays = Math.Clamp(coverageWindowDays, 1, 365)`.
     - Loads `allLocations = await dbContext.LocationNodes.AsNoTracking().ToListAsync(cancellationToken)`, builds `locationMap`, and computes `accessibleLocationIds = ComputeAccessibleLocationIds(allLocations, userId)` (excluding any node where `IsPrivate && OwnerId != userId` and its descendants).
     - Queries `InventoryItems.AsNoTracking().Include(i => i.Category).Where(i => i.Status != ItemStatus.Archived)`.
     - Filters to `accessibleItems` where `(!i.IsPrivate || i.OwnerId == userId)` and `(!i.HomeLocationId.HasValue || accessibleLocationIds.Contains(i.HomeLocationId.Value))`.
     - Computes the 5 alert lists (`utcNow = DateTimeOffset.UtcNow`):
       1. **`OutOfPlaceItems`:** Items where `i.Status == ItemStatus.InUse`, ordered by `i.CheckedOutAt ?? i.ModifiedAt` ascending. `DaysOut = i.CheckedOutAt.HasValue ? Math.Max(0, (int)Math.Floor((utcNow - i.CheckedOutAt.Value).TotalDays)) : 0`.
       2. **`ExternalLoans`:** Items where `i.Status == ItemStatus.LoanedOut`. `IsOverdue = i.CheckoutDueAt.HasValue && i.CheckoutDueAt.Value < utcNow`. `DaysUntilDue = i.CheckoutDueAt.HasValue ? (int)Math.Ceiling((i.CheckoutDueAt.Value - utcNow).TotalDays) : null`. Ordered by `IsOverdue` descending, then `i.CheckoutDueAt ?? DateTimeOffset.MaxValue` ascending.
       3. **`DueMaintenanceSchedules`:** Queries `MaintenanceSchedules.AsNoTracking().Include(s => s.Item).Where(s => s.IsActive && s.Item.Status != ItemStatus.Archived)`. Filters by the same `accessibleItems` rule. Computes `DueStatus` (`Overdue` if `s.NextDueAt < utcNow`, `DueSoon` if `s.NextDueAt <= utcNow.AddDays(14)`). Keeps only `Overdue` and `DueSoon`, ordered by `Overdue` first then `s.NextDueAt` ascending.
       4. **`ExpiringCoverages`:** For each item in `accessibleItems`:
          - Checks `i.ReturnWindowEndDate`: if within `[utcNow.AddDays(-7), utcNow.AddDays(coverageWindowDays)]`, emits an `ExpiringCoverageAlertDto` with `AlertType = WarrantyOrReturnAlertType.ReturnWindow`, `DaysRemaining = (int)Math.Ceiling((i.ReturnWindowEndDate.Value - utcNow).TotalDays)`, `IsExpired = i.ReturnWindowEndDate.Value < utcNow`.
          - Checks `i.WarrantyExpirationDate`: if within `[utcNow.AddDays(-7), utcNow.AddDays(coverageWindowDays)]`, emits an `ExpiringCoverageAlertDto` with `AlertType = WarrantyOrReturnAlertType.WarrantyExpiration`, `DaysRemaining = (int)Math.Ceiling((i.WarrantyExpirationDate.Value - utcNow).TotalDays)`, `IsExpired = i.WarrantyExpirationDate.Value < utcNow`.
          - Orders by `ExpirationDate` ascending.
       5. **`LowStockItems`:** Items in `accessibleItems` where `i.MinQuantity.HasValue && i.CurrentQuantity <= i.MinQuantity.Value`, ordered by `i.CurrentQuantity` ascending, then `i.Name`.
     - Computes counts and `TotalAlertsCount = OutOfPlaceItems.Count + ExternalLoans.Count + DueMaintenanceSchedules.Count + ExpiringCoverages.Count + LowStockItems.Count`.
   - **Channel Management (`GetChannelsAsync`, `CreateChannelAsync`, `UpdateChannelAsync`, `DeleteChannelAsync`):**
     - `GetChannelsAsync`: Returns channels where `c.OwnerId == userId || c.IsSharedHouseholdChannel`, ordered by `c.Name`.
     - `CreateChannelAsync`: Validates channel configuration (e.g., `Name` not whitespace; for `Ntfy`/`SlackWebhook`, `EndpointUrl` is required; for `Pushover`, `AccessTokenOrKey` and `RecipientOrUserKey` are required; for `SmtpEmail`, `SmtpHost` and `RecipientOrUserKey` are required—throws `ArgumentException` if missing). Saves and returns `NotificationChannelDto` (note: `AccessTokenOrKey` is never exposed in `NotificationChannelDto`; only `HasAccessTokenOrKey = !string.IsNullOrWhiteSpace(c.AccessTokenOrKey)` is returned).
     - `UpdateChannelAsync` & `DeleteChannelAsync`: If channel does not exist, return `null` / `false`. If `channel.OwnerId != userId`, throw `ForbiddenException`.
   - **`SendTestNotificationAsync(Guid userId, Guid channelId, CancellationToken cancellationToken)`:**
     - Loads channel; if not found, returns `null`. If `channel.OwnerId != userId && !channel.IsSharedHouseholdChannel`, throws `ForbiddenException`.
     - Builds subject `"WhereHouse — Test Notification"` and message `"This is a test notification from your WhereHouse Action Center for channel '<Name>'."`.
     - Calls `notificationDispatcher.DispatchAsync(...)`, records a `NotificationDeliveryLog` (`EventType = NotificationEventType.TestNotification`), updates `channel.LastTriggeredAt = DateTimeOffset.UtcNow` and `channel.LastDeliveryStatus = outcome.ResponseSummary`, saves, and returns `NotificationDeliveryLogDto`.
   - **`SendDigestAsync(Guid userId, SendNotificationDigestRequest request, CancellationToken cancellationToken)`:**
     - Resolves target channels:
       - If `request.ChannelId.HasValue`: loads that channel; if null, throws `ArgumentException("Notification channel not found.")`. If `channel.OwnerId != userId && !channel.IsSharedHouseholdChannel`, throws `ForbiddenException`.
       - Otherwise: loads all enabled channels accessible to `userId` (`c.IsEnabled && (c.OwnerId == userId || c.IsSharedHouseholdChannel)`).
     - For each target channel:
       - Computes the digest overview:
         - **Privacy Rule:** If `channel.IsSharedHouseholdChannel` is `true`, builds the digest using only **public/shared household items and locations** (`!i.IsPrivate` and no private ancestor locations) so a shared household Slack/ntfy channel never leaks private/secret gift items! If `channel.IsSharedHouseholdChannel` is `false`, builds the digest scoped to `channel.OwnerId`.
       - Formats a clean Markdown/plain-text digest body summarizing:
         - Out of Place items (`OutOfPlaceCount`)
         - Active & Overdue External Loans (`ActiveLoansCount` / `OverdueLoansCount`, filtered by `channel.NotifyOnOverdueLoans`)
         - Due & Overdue Maintenance Tasks (`MaintenanceDueCount`, filtered by `channel.NotifyOnMaintenanceDue`)
         - Expiring Return Windows & Warranties (`ExpiringCoverageCount`, filtered by `channel.NotifyOnExpiringWarranties`)
         - Low Stock Consumables (`LowStockCount`, filtered by `channel.NotifyOnLowStock`)
       - Dispatches via `notificationDispatcher.DispatchAsync(...)`, saves a `NotificationDeliveryLog` (`EventType = NotificationEventType.WeeklyDigest`), and updates `channel.LastTriggeredAt` and `channel.LastDeliveryStatus`.
     - Returns `NotificationDispatchResultDto`.

4. **Register `IActionCenterService` in `WhereHouse.Data/DataServiceCollectionExtensions.cs`:**
   - Add `services.AddScoped<IActionCenterService, ActionCenterService>();`.

---

## 3. API Endpoints (`WhereHouse.API/Controllers/ActionCenterController.cs`)

- Attributes: `[ApiController]`, `[Route("action-center")]`, `[Authorize]`.

| Verb | Route (`/api/...`) | Request Body / Query | Response | Error Cases |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/action-center` | `?coverageWindowDays=30` | `200 OK` (`ActionCenterOverviewDto`) | — |
| `GET` | `/action-center/channels` | — | `200 OK` (`IReadOnlyList<NotificationChannelDto>`) | — |
| `GET` | `/action-center/channels/{channelId:guid}` | — | `200 OK` (`NotificationChannelDto`) | `403`, `404` |
| `POST` | `/action-center/channels` | `CreateNotificationChannelRequest` | `201 Created` (`NotificationChannelDto`) | `400` |
| `PUT` | `/action-center/channels/{channelId:guid}` | `UpdateNotificationChannelRequest` | `200 OK` (`NotificationChannelDto`) | `400`, `403`, `404` |
| `DELETE` | `/action-center/channels/{channelId:guid}` | — | `204 No Content` | `403`, `404` |
| `POST` | `/action-center/channels/{channelId:guid}/test` | — | `200 OK` (`NotificationDeliveryLogDto`) | `403`, `404` |
| `POST` | `/action-center/digest/send` | `SendNotificationDigestRequest` | `200 OK` (`NotificationDispatchResultDto`) | `400`, `403` |
| `GET` | `/action-center/deliveries` | `?limit=30` | `200 OK` (`IReadOnlyList<NotificationDeliveryLogDto>`) | — |

---

## 4. Angular Frontend Design (`WhereHouse.Client`)

### 4.1 Models & Services (`src/app/core/`)

1. **Create `src/app/core/models/action-center.models.ts`:**
   - Define `NotificationChannelType` (`0 | 1 | 2 | 3`), `NotificationChannelTypes`, `NOTIFICATION_CHANNEL_LABELS`, `NotificationEventType` (`0 | 1 | 2 | 3 | 4 | 5`), `WarrantyOrReturnAlertType` (`0 | 1`), `OutOfPlaceItemAlertDto`, `ExternalLoanAlertDto`, `ExpiringCoverageAlertDto`, `LowStockItemAlertDto`, `ActionCenterOverviewDto`, `NotificationChannelDto`, `NotificationDeliveryLogDto`, `CreateNotificationChannelRequest`, `UpdateNotificationChannelRequest`, `SendNotificationDigestRequest`, and `NotificationDispatchResultDto`.

2. **Create `src/app/core/services/action-center/action-center.service.ts` (& `.spec.ts`):**
   - Decorated with `@Service()`, wrapping `/action-center` endpoints via `apiUrl('/action-center')`:
     - `getOverview(coverageWindowDays?: number): Observable<ActionCenterOverviewDto>`
     - `getChannels(): Observable<NotificationChannelDto[]>`
     - `createChannel(request: CreateNotificationChannelRequest): Observable<NotificationChannelDto>`
     - `updateChannel(channelId: string, request: UpdateNotificationChannelRequest): Observable<NotificationChannelDto>`
     - `deleteChannel(channelId: string): Observable<void>`
     - `sendTestNotification(channelId: string): Observable<NotificationDeliveryLogDto>`
     - `sendDigest(request?: SendNotificationDigestRequest): Observable<NotificationDispatchResultDto>`
     - `getRecentDeliveries(limit?: number): Observable<NotificationDeliveryLogDto[]>`

---

### 4.2 Dialog & Dashboard Integration (`src/app/features/dashboard/`)

1. **Create `ActionCenterDialogComponent` (`src/app/features/dashboard/action-center-dialog/action-center-dialog.component.ts` & `.spec.ts`):**
   - Accepts `ActionCenterDialogData { initialTab?: 'alerts' | 'channels' | 'history'; initialFilter?: 'all' | 'out-of-place' | 'loans' | 'maintenance' | 'warranties' | 'low-stock' }`.
   - **Header & KPI Summary Cards:**
     - Displays 5 interactive metric pills/cards:
       - `Out of Place` (`OutOfPlaceCount`)
       - `External Loans` (`ActiveLoansCount`, with red overdue counter `OverdueLoansCount`)
       - `Maintenance Due` (`MaintenanceDueCount`, with red overdue counter `MaintenanceOverdueCount`)
       - `Warranties & Returns` (`ExpiringCoverageCount`)
       - `Low Stock` (`LowStockCount`)
     - **"Send Household Digest Now"** button (`send` icon) that dispatches the live digest to all enabled channels and displays a toast summary.
   - **Three Tabs (`alerts` | `channels` | `history`):**
     - **Tab 1 — Actionable Household Alerts (`alerts`):**
       - Filter chips (`All Alerts`, `Out of Place`, `External Loans`, `Maintenance Due`, `Expiring Warranties/Returns`, `Low Stock`) + Coverage Window selector (`14d`, `30d`, `60d`, `90d`).
       - Renders each alert section with 1-tap resolution actions:
         - *Out of Place / External Loans*: **"Quick Return"** button (`assignment_return` icon) calling `checkoutLoadoutService.returnItem(alert.itemId, {})` and refreshing the overview.
         - *Maintenance Due*: **"Complete Task"** button (`task_alt` icon) calling `maintenanceService.completeTask(schedule.id, {})`.
         - *Expiring Warranties & Returns*: Shows badge (`RETURN WINDOW` vs `WARRANTY`), expiration date, days remaining, retailer, and purchase price.
         - *Low Stock*: **"Restock +1"** button (`add_circle` icon) calling `itemService.adjustQuantity(item.itemId, { delta: 1 })`.
     - **Tab 2 — Webhook & Push Notification Channels (`channels`):**
       - Collapsible **"Add Notification Channel"** form supporting `ntfy`, `Slack Webhook`, `Pushover`, and `Email (SMTP)` with dynamic fields per provider, trigger checkboxes (`Overdue Loans`, `Maintenance Due`, `Expiring Warranties`, `Low Stock`, `Weekly Digest`), and `IsSharedHouseholdChannel` toggle.
       - Channel list showing provider badge, target URL/host, enabled toggle, last delivery status, **"Test"** button (`bolt` icon), and **"Delete"** button.
     - **Tab 3 — Delivery History Log (`history`):**
       - Lists recent `NotificationDeliveryLogDto` entries with status badge (`DELIVERED` vs `FAILED`), timestamp, channel name, subject, response summary, and expandable message body preview.

2. **Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`):**
   - Inject `ActionCenterService` and load `actionCenterOverview` signal alongside dashboard initialization.
   - Add an **"Action Center"** button (`notifications_active` icon) in the top navigation bar with a live pill badge showing `actionCenterOverview()?.totalAlertsCount` when `> 0`.
   - Render a compact, high-visibility **Action Center Overview Strip** above the main workspace grid when `actionCenterOverview()?.totalAlertsCount > 0` (at root view when not searching), allowing 1-click drill-down into `Out of Place`, `Active Loans`, `Maintenance Due`, `Expiring Warranties`, or `Low Stock`.

---

## 5. Step-by-Step Execution Checklist (For Implementation Agent)

- [ ] **Task 1: Backend Core, Infrastructure & Data Layer (`WhereHouse.Core`, `WhereHouse.Infrastructure`, `WhereHouse.Data`)**
  - Create `WhereHouse.Core/ActionCenter/ActionCenterModels.cs`, `WhereHouse.Core/ActionCenter/INotificationDispatcher.cs`, and `WhereHouse.Core/ActionCenter/IActionCenterService.cs`.
  - Create `WhereHouse.Infrastructure/Notifications/NotificationDispatcher.cs` and register `services.AddHttpClient<INotificationDispatcher, NotificationDispatcher>();` in `WhereHouse.Infrastructure/InfrastructureServiceCollectionExtensions.cs`.
  - Create `WhereHouse.Data/Entities/NotificationChannel.cs`, `WhereHouse.Data/Entities/NotificationDeliveryLog.cs`, `WhereHouse.Data/Configurations/NotificationChannelConfiguration.cs`, and `WhereHouse.Data/Configurations/NotificationDeliveryLogConfiguration.cs`.
  - Update `WhereHouse.Data/WhereHouseDbContext.cs` with `NotificationChannels` and `NotificationDeliveryLogs` `DbSet`s.
  - Create `WhereHouse.Data/Services/ActionCenterService.cs` and register `services.AddScoped<IActionCenterService, ActionCenterService>();` in `WhereHouse.Data/DataServiceCollectionExtensions.cs`.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddActionCenterNotificationChannels --project WhereHouse.Data
    dotnet ef database update --project WhereHouse.Data
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Write unit tests for `NotificationDispatcher` in `Tests/WhereHouse.Infrastructure.UnitTests/NotificationDispatcherTests.cs` (testing `Ntfy`, `SlackWebhook`, `Pushover`, and `SmtpEmail` formatting, headers, validation, and mock endpoints) and run:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    dotnet test --project Tests/WhereHouse.Infrastructure.UnitTests/WhereHouse.Infrastructure.UnitTests.csproj
    ```

- [ ] **Task 2: API Controller & Integration Tests (`WhereHouse.API` & `Tests/WhereHouse.API.IntegrationTests`)**
  - Create `WhereHouse.API/Controllers/ActionCenterController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/action-center"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/Phase09ActionCenterAndNotificationsIntegrationTests.cs` covering:
    1. **Unified Action Center Aggregation (`PRD 4.8.3`):** Creating an `InUse` item, an overdue `LoanedOut` item, an overdue `MaintenanceSchedule`, an item with an expiring `ReturnWindowEndDate` & `WarrantyExpirationDate`, and a low-stock `Quantity` item (`CurrentQuantity <= MinQuantity`), then verifying `GET /api/action-center` returns all 5 alerts with accurate counts and metadata.
    2. **Notification Channel CRUD & Test Dispatch (`PRD 4.8.3`):** Creating `Ntfy`, `SlackWebhook`, `Pushover`, and `SmtpEmail` channels (`mock.local` endpoints), updating a channel, triggering `POST /api/action-center/channels/{id}/test`, and verifying `GET /api/action-center/deliveries` records the delivery log.
    3. **Weekly Household Digest Generation & Dispatch (`PRD 4.8.3`):** Triggering `POST /api/action-center/digest/send` and verifying the generated digest subject/body includes active alerts and records `WeeklyDigest` delivery logs across enabled channels.
    4. **"Secret / Gift Mode" (`IsPrivate`) Isolation:** Verifying User B cannot view/modify/test User A's personal notification channels (`403 Forbidden`), User A's private items are excluded from User B's `GET /api/action-center` overview, and a shared household channel (`IsSharedHouseholdChannel = true`) strips User A's private items from the outbound digest body.
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [ ] **Task 3: Angular Client & Unit Tests (`WhereHouse.Client`)**
  - Create `src/app/core/models/action-center.models.ts`.
  - Create `src/app/core/services/action-center/action-center.service.ts` (& `.spec.ts`).
  - Create `ActionCenterDialogComponent` (`src/app/features/dashboard/action-center-dialog/action-center-dialog.component.ts` & `.spec.ts`).
  - Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`) with the Action Center top-bar button, alert badge, and overview strip.
  - Run frontend lint, build, and unit tests in `WhereHouse.Client` until 100% green:
    ```powershell
    npm run lint
    npm run build
    npm test -- --watch=false
    ```

- [ ] **Task 4: E2E Verification & Final Formatting**
  - Run E2E test suite to verify zero regressions:
    ```powershell
    dotnet test --project Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj
    ```
  - Format all backend and frontend files:
    ```powershell
    dotnet csharpier format .
    # In WhereHouse.Client:
    npm run format
    npm run lint:fix
    ```
  - Update `docs/plans/phase-09-action-center-and-webhook-notifications.md` status to `[x] Completed`.
