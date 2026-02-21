---
name: scaffolding
description: >
  Code scaffolding patterns for .NET 10 features, entities, and tests.
  Generates complete feature slices, entities with EF Core configuration,
  and integration tests following the project's chosen architecture.
  Load when: "scaffold", "create feature", "add feature", "new endpoint",
  "generate", "add entity", "new entity", "scaffold test", "add module".
---

# Scaffolding

## Core Principles

1. **Architecture-aware generation** — Never scaffold without knowing the project's architecture (VSA, CA, DDD, Modular Monolith). If unknown, ask first or run the architecture-advisor questionnaire.
2. **Complete vertical slices** — Never generate half a feature. A scaffold includes endpoint, handler, validation, DTOs, EF configuration, and tests as a single unit.
3. **Tests included by default** — Every scaffolded feature includes at least one integration test using `WebApplicationFactory` + `Testcontainers`. Skip only if explicitly told to.
4. **Modern C# 14 patterns** — Primary constructors, collection expressions, `file`-scoped types, records for DTOs, `sealed` on all handler classes.
5. **Convention-matching** — Before generating, check existing code for naming patterns (`*Handler`, `*Service`, `*Endpoint`), folder structure, and access modifiers. Match what exists.

## Patterns

### Feature Scaffold — Vertical Slice Architecture (VSA)

Single-file feature with command, handler, response, and endpoint mapping:

```csharp
// Features/Orders/CreateOrder.cs
using FluentValidation;
using Microsoft.AspNetCore.Http.HttpResults;

namespace MyApp.Features.Orders;

public static class CreateOrder
{
    public record Command(string CustomerId, List<ItemDto> Items);
    public record ItemDto(Guid ProductId, int Quantity, decimal UnitPrice);
    public record Response(Guid Id, decimal Total, DateTimeOffset CreatedAt);

    internal sealed class Handler(AppDbContext db, TimeProvider clock)
    {
        public async Task<Response> HandleAsync(Command command, CancellationToken ct)
        {
            var order = Order.Create(command.CustomerId, command.Items, clock.GetUtcNow());
            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);
            return new Response(order.Id, order.Total, order.CreatedAt);
        }
    }

    internal sealed class Validator : AbstractValidator<Command>
    {
        public Validator()
        {
            RuleFor(x => x.CustomerId).NotEmpty();
            RuleFor(x => x.Items).NotEmpty();
            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(x => x.Quantity).GreaterThan(0);
                item.RuleFor(x => x.UnitPrice).GreaterThan(0);
            });
        }
    }
}

// In endpoint mapping:
// group.MapPost("/", async (CreateOrder.Command cmd, CreateOrder.Handler handler, CancellationToken ct) =>
//     TypedResults.Created($"/orders/{result.Id}", await handler.HandleAsync(cmd, ct)));
```

### Feature Scaffold — Clean Architecture (CA)

Separate files across layers:

```csharp
// Domain/Entities/Order.cs
namespace MyApp.Domain.Entities;

public sealed class Order
{
    public Guid Id { get; private set; }
    public string CustomerId { get; private set; } = string.Empty;
    public decimal Total { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public List<OrderItem> Items { get; private set; } = [];

    public static Order Create(string customerId, List<OrderItem> items, DateTimeOffset now)
    {
        var order = new Order { Id = Guid.NewGuid(), CustomerId = customerId, Items = items, CreatedAt = now };
        order.Total = items.Sum(i => i.UnitPrice * i.Quantity);
        return order;
    }
}
```
```csharp
// Application/Orders/CreateOrder/CreateOrderCommand.cs
namespace MyApp.Application.Orders.CreateOrder;

public record CreateOrderCommand(string CustomerId, List<OrderItemDto> Items) : IRequest<Result<CreateOrderResponse>>;
public record OrderItemDto(Guid ProductId, int Quantity, decimal UnitPrice);
public record CreateOrderResponse(Guid Id, decimal Total, DateTimeOffset CreatedAt);
```
```csharp
// Application/Orders/CreateOrder/CreateOrderHandler.cs
namespace MyApp.Application.Orders.CreateOrder;

internal sealed class CreateOrderHandler(IAppDbContext db, TimeProvider clock)
    : IRequestHandler<CreateOrderCommand, Result<CreateOrderResponse>>
{
    public async Task<Result<CreateOrderResponse>> Handle(CreateOrderCommand request, CancellationToken ct)
    {
        var items = request.Items.Select(i => new OrderItem(i.ProductId, i.Quantity, i.UnitPrice)).ToList();
        var order = Order.Create(request.CustomerId, items, clock.GetUtcNow());
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        return new CreateOrderResponse(order.Id, order.Total, order.CreatedAt);
    }
}
```
```csharp
// Api/Endpoints/OrderEndpoints.cs
namespace MyApp.Api.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Orders");
        group.MapPost("/", async (CreateOrderCommand cmd, ISender sender, CancellationToken ct) =>
        {
            var result = await sender.Send(cmd, ct);
            return result.Match(
                success => TypedResults.Created($"/api/orders/{success.Id}", success),
                error => Results.Problem(error.Message, statusCode: 400));
        });
    }
}
```

### Feature Scaffold — DDD

Aggregate method + application handler — domain logic lives in the aggregate:

```csharp
// Domain/Orders/Order.cs — Aggregate root
namespace MyApp.Domain.Orders;

public sealed class Order : AggregateRoot
{
    private readonly List<OrderItem> _items = [];
    public IReadOnlyList<OrderItem> Items => _items.AsReadOnly();
    public decimal Total { get; private set; }
    public OrderStatus Status { get; private set; }

    private Order() { }

    public static Order Place(string customerId, List<(Guid ProductId, int Qty, decimal Price)> items, DateTimeOffset now)
    {
        if (items.Count == 0) throw new DomainException("Order must have at least one item.");
        var order = new Order { Id = Guid.NewGuid(), Status = OrderStatus.Placed };
        foreach (var (productId, qty, price) in items)
            order._items.Add(OrderItem.Create(productId, qty, price));
        order.Total = order._items.Sum(i => i.LineTotal);
        order.AddDomainEvent(new OrderPlacedEvent(order.Id, customerId, order.Total, now));
        return order;
    }

    public void Cancel()
    {
        if (Status is OrderStatus.Shipped or OrderStatus.Delivered)
            throw new DomainException("Cannot cancel a shipped or delivered order.");
        Status = OrderStatus.Cancelled;
        AddDomainEvent(new OrderCancelledEvent(Id));
    }
}
```

### Feature Scaffold — Modular Monolith
Feature within a module boundary with its own DbContext:

```csharp
// Modules/Orders/Features/PlaceOrder.cs
namespace MyApp.Modules.Orders.Features;

public static class PlaceOrder
{
    public record Command(string CustomerId, List<ItemDto> Items);
    public record ItemDto(Guid ProductId, int Quantity, decimal UnitPrice);
    public record Response(Guid OrderId, decimal Total);

    internal sealed class Handler(OrdersDbContext db, TimeProvider clock, IEventBus bus)
    {
        public async Task<Response> HandleAsync(Command command, CancellationToken ct)
        {
            var order = Order.Place(command.CustomerId, command.Items, clock.GetUtcNow());
            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);
            await bus.PublishAsync(new OrderPlacedIntegrationEvent(order.Id, order.Total), ct);
            return new Response(order.Id, order.Total);
        }
    }
}
```

### Entity Scaffold
Entity + EF Core `IEntityTypeConfiguration<T>` — always paired:

```csharp
// Domain/Entities/Product.cs (or within module)
namespace MyApp.Domain.Entities;

public sealed class Product
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Sku { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static Product Create(string name, string sku, decimal price) =>
        new() { Id = Guid.NewGuid(), Name = name, Sku = sku, Price = price };

    public void UpdatePrice(decimal newPrice)
    {
        if (newPrice <= 0) throw new ArgumentOutOfRangeException(nameof(newPrice));
        Price = newPrice;
    }
}
```
```csharp
// Infrastructure/Persistence/Configurations/ProductConfiguration.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MyApp.Infrastructure.Persistence.Configurations;

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Sku).HasMaxLength(50).IsRequired();
        builder.HasIndex(x => x.Sku).IsUnique();
        builder.Property(x => x.Price).HasPrecision(18, 2);
    }
}
```

After creating entity + config, run: `dotnet ef migrations add AddProduct --project src/Infrastructure --startup-project src/Api`

### Test Scaffold
Integration test with WebApplicationFactory + Testcontainers:

```csharp
// Tests/Features/Orders/CreateOrderTests.cs
namespace MyApp.Tests.Features.Orders;

public sealed class CreateOrderTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task CreateOrder_ValidRequest_Returns201()
    {
        // Arrange
        var command = new { CustomerId = "CUST-001", Items = new[] { new { ProductId = Guid.NewGuid(), Quantity = 2, UnitPrice = 29.99m } } };

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", command);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(Guid.Empty, result.GetProperty("id").GetGuid());
        Assert.True(result.GetProperty("total").GetDecimal() > 0);
    }

    [Fact]
    public async Task CreateOrder_EmptyItems_Returns400()
    {
        var command = new { CustomerId = "CUST-001", Items = Array.Empty<object>() };

        var response = await _client.PostAsJsonAsync("/api/orders", command);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
```

### Module Scaffold (Modular Monolith)
Complete module setup with its own DbContext, DI, and integration events:

```csharp
// Modules/Inventory/InventoryModule.cs
namespace MyApp.Modules.Inventory;

public static class InventoryModule
{
    public static IServiceCollection AddInventoryModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<InventoryDbContext>(options =>
            options.UseNpgsql(config.GetConnectionString("Inventory")));
        services.AddScoped<StockService>();
        return services;
    }

    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/inventory").WithTags("Inventory");
        // Map module-specific endpoints here
        return app;
    }
}
```
```csharp
// Modules/Inventory/Persistence/InventoryDbContext.cs
namespace MyApp.Modules.Inventory.Persistence;

internal sealed class InventoryDbContext(DbContextOptions<InventoryDbContext> options) : DbContext(options)
{
    public DbSet<StockItem> StockItems => Set<StockItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("inventory");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(InventoryDbContext).Assembly);
    }
}
```

## Anti-patterns

### Scaffolding Without Architecture

```csharp
// BAD — Generating code without knowing if project uses VSA, CA, or DDD
public class CreateOrderHandler { /* random structure */ }
```
```csharp
// GOOD — Ask first, then generate matching the architecture
// "What architecture does this project use? I see feature folders, so I'll scaffold using VSA patterns."
public static class CreateOrder { /* VSA single-file feature */ }
```

### Feature Without Tests

```csharp
// BAD — Generating only the feature, leaving tests for "later"
// Later never comes. Ship features with tests.
```
```csharp
// GOOD — Feature + test as a single deliverable
// CreateOrder.cs + CreateOrderTests.cs always scaffolded together
```

### Entity Without EF Configuration

```csharp
// BAD — Entity with data annotations scattered in the class
public class Product
{
    [Key] public Guid Id { get; set; }
    [MaxLength(200)] public string Name { get; set; } = "";
    [Column(TypeName = "decimal(18,2)")] public decimal Price { get; set; }
}
```
```csharp
// GOOD — Clean entity + separate IEntityTypeConfiguration<T>
public sealed class Product { /* Clean domain model, no attributes */ }
internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product> { /* All EF config here */ }
```

### Anemic DTOs That Mirror Entities 1:1

```csharp
// BAD — DTO is just a copy of the entity with no purpose
public record ProductDto(Guid Id, string Name, string Sku, decimal Price, bool IsActive,
    DateTime CreatedAt, DateTime? UpdatedAt, string? UpdatedBy);
```
```csharp
// GOOD — Response DTO shaped for the consumer's needs
public record ProductSummary(Guid Id, string Name, decimal Price);
public record ProductDetail(Guid Id, string Name, string Sku, decimal Price, bool IsActive);
```

## Decision Guide

| Scenario | Architecture | Scaffold Pattern |
|----------|-------------|-----------------|
| New CRUD endpoint | VSA | Single-file feature (Command + Handler + Validator + Response) |
| New business operation | CA | Command in Application/, Handler in Application/, Endpoint in Api/ |
| Complex domain logic | DDD | Aggregate method + Application handler + Domain event |
| Feature in a module | Modular Monolith | Feature file in Modules/{Name}/Features/ with module DbContext |
| New entity | Any | Entity class + `IEntityTypeConfiguration<T>` + migration |
| New module | Modular Monolith | Module folder + DbContext + DI registration + integration events |
| Tests for feature | Any | Integration test with `WebApplicationFactory` + `Testcontainers` |
| Architecture unknown | Any | **Ask first** — run architecture-advisor questionnaire |
