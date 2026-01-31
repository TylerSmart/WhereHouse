using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Api.DTOs;
using WhereHouse.Domain.Entities;
using WhereHouse.Infrastructure.Data;
using WhereHouse.Infrastructure.Services;

namespace WhereHouse.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly WhereHouseDbContext _context;
    private readonly IPasswordService _passwordService;

    public UsersController(WhereHouseDbContext context, IPasswordService passwordService)
    {
        _context = context;
        _passwordService = passwordService;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetUsers()
    {
        var users = await _context.Users
            .Select(u => new UserDto(u.Id, u.Username, u.Email, u.IsAdmin, u.CreatedAt, u.LastLoginAt))
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserDto>> GetUser(int id)
    {
        var user = await _context.Users.FindAsync(id);

        if (user == null)
        {
            return NotFound();
        }

        return Ok(new UserDto(user.Id, user.Username, user.Email, user.IsAdmin, user.CreatedAt, user.LastLoginAt));
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Username == request.Username))
        {
            return BadRequest(new { message = "Username already exists" });
        }

        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = _passwordService.HashPassword(request.Password),
            IsAdmin = request.IsAdmin,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUser), new { id = user.Id },
            new UserDto(user.Id, user.Username, user.Email, user.IsAdmin, user.CreatedAt, user.LastLoginAt));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserDto>> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.Users.FindAsync(id);

        if (user == null)
        {
            return NotFound();
        }

        if (request.Email != null) user.Email = request.Email;
        if (request.Password != null) user.PasswordHash = _passwordService.HashPassword(request.Password);
        if (request.IsAdmin.HasValue) user.IsAdmin = request.IsAdmin.Value;

        await _context.SaveChangesAsync();

        return Ok(new UserDto(user.Id, user.Username, user.Email, user.IsAdmin, user.CreatedAt, user.LastLoginAt));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);

        if (user == null)
        {
            return NotFound();
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
