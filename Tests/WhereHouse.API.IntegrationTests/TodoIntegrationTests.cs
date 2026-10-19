using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Todos;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class TodoIntegrationTests
{
    private WhereHouseWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    [TestInitialize]
    public void Setup()
    {
        _factory = new WhereHouseWebApplicationFactory();
        _client = _factory.CreateClient();
    }

    [TestCleanup]
    public void Cleanup()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private async Task<AuthResponse> RegisterAndAuthenticateAsync(
        HttpClient client,
        string email,
        string username
    )
    {
        var register = new RegisterRequest(email, username, "Password123!");
        var response = await client.PostAsJsonAsync("/api/auth/register", register);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            auth.Token
        );
        return auth;
    }

    [TestMethod]
    public async Task CreateAndGetTodoItems_ReturnsCreatedItem()
    {
        await RegisterAndAuthenticateAsync(_client, "todo1@example.com", "todouser1");

        var createRequest = new CreateTodoItemRequest("Write documentation", "Add setup steps");
        var createResponse = await _client.PostAsJsonAsync("/api/todos", createRequest);
        Assert.AreEqual(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<TodoItemDto>();
        Assert.IsNotNull(created);
        Assert.AreEqual("Write documentation", created.Title);
        Assert.AreEqual("Add setup steps", created.Description);
        Assert.IsFalse(created.IsCompleted);

        var listResponse = await _client.GetAsync("/api/todos");
        Assert.AreEqual(HttpStatusCode.OK, listResponse.StatusCode);

        var list = await listResponse.Content.ReadFromJsonAsync<List<TodoItemDto>>();
        Assert.IsNotNull(list);
        Assert.HasCount(1, list);
        Assert.AreEqual(created.Id, list[0].Id);
    }

    [TestMethod]
    public async Task UpdateAndDeleteTodoItem_UpdatesAndDeletesSuccessfully()
    {
        await RegisterAndAuthenticateAsync(_client, "todo2@example.com", "todouser2");

        var createResponse = await _client.PostAsJsonAsync(
            "/api/todos",
            new CreateTodoItemRequest("Initial Task", "Initial description")
        );
        var created = await createResponse.Content.ReadFromJsonAsync<TodoItemDto>();
        Assert.IsNotNull(created);

        var updateRequest = new UpdateTodoItemRequest(
            "Updated Task",
            "Updated description",
            IsCompleted: true
        );
        var updateResponse = await _client.PutAsJsonAsync(
            $"/api/todos/{created.Id}",
            updateRequest
        );
        Assert.AreEqual(HttpStatusCode.OK, updateResponse.StatusCode);

        var updated = await updateResponse.Content.ReadFromJsonAsync<TodoItemDto>();
        Assert.IsNotNull(updated);
        Assert.AreEqual("Updated Task", updated.Title);
        Assert.AreEqual("Updated description", updated.Description);
        Assert.IsTrue(updated.IsCompleted);

        var deleteResponse = await _client.DeleteAsync($"/api/todos/{created.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.GetAsync($"/api/todos/{created.Id}");
        Assert.AreEqual(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [TestMethod]
    public async Task AccessOtherUsersTodoItem_ReturnsForbidden()
    {
        await RegisterAndAuthenticateAsync(_client, "owner@example.com", "owneruser");
        var createResponse = await _client.PostAsJsonAsync(
            "/api/todos",
            new CreateTodoItemRequest("Private Task")
        );
        var created = await createResponse.Content.ReadFromJsonAsync<TodoItemDto>();
        Assert.IsNotNull(created);

        using var otherClient = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(otherClient, "other@example.com", "otheruser");

        var getResponse = await otherClient.GetAsync($"/api/todos/{created.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, getResponse.StatusCode);

        var updateResponse = await otherClient.PutAsJsonAsync(
            $"/api/todos/{created.Id}",
            new UpdateTodoItemRequest("Hacked", null, true)
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, updateResponse.StatusCode);

        var deleteResponse = await otherClient.DeleteAsync($"/api/todos/{created.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, deleteResponse.StatusCode);
    }
}
