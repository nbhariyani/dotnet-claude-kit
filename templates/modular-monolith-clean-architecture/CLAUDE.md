# FlightOperation — Modular Monolith with Clean Architecture

## Project Context

This is a **modular monolith** composed of **independently deployable modules**, each using **Clean Architecture** internally. Each module (Catalog, Flights, Masters, Todo) owns its **Domain**, **Application**, and **Infrastructure** layers. The API server (Server.csproj) wires all modules together. The Shared project provides cross-cutting constants and authorization logic.

**Actual modules:** Catalog, Flights, Masters, Todo

## Tech Stack

- **.NET 9/10** / C# 14
- **ASP.NET Core Minimal APIs** — thin endpoint handlers
- **Entity Framework Core** — PostgreSQL database
- **Serilog** — structured logging
- **Blazor** (Server) — frontend
- **React** — alternate frontend
- **Docker + Compose** — local development orchestration
- **Aspire** — .NET orchestration

## Architecture

### Real Solution Layout

```
src/
  api/
    server/                                 # Main API entry point
      Program.cs                            # Wires all modules
      Server.csproj
      Extensions.cs                         # DI extensions
      appsettings.json
      appsettings.Development.json

    framework/
      Core/                                 # Shared domain logic (Result, DTOs, interfaces)
      Infrastructure/                       # Shared infrastructure (middleware, logging config)

    modules/                                # Modular features
      Catalog/
        Catalog.Domain/                     # Domain layer
          Entities/
          ValueObjects/
          Exceptions/
          Interfaces/
        Catalog.Application/                # Application layer (handlers, DTOs, validators)
          Handlers/
          DTOs/
          Validators/
          Contracts/
        Catalog.Infrastructure/             # Infrastructure layer (EF Core, repositories)
          Persistence/
            CatalogDbContext.cs
          Services/
        CatalogModule.cs                    # Module registration & mapping

      Flights/                              # Same structure as Catalog
        Flights.Domain/
        Flights.Application/
        Flights.Infrastructure/
        FlightsModule.cs

      Masters/                              # Same structure
        Masters.Domain/
        Masters.Application/
        Masters.Infrastructure/
        MastersModule.cs

      Todo/                                 # Same structure
        Todo.Domain/
        Todo.Application/
        Todo.Infrastructure/
        TodoModule.cs

    migrations/                             # EF Core migrations per module

  Shared/                                   # Cross-project shared code
    Authorization/
    Constants/
    Shared.csproj

  apps/
    blazor/                                 # Blazor Server frontend
    react/                                  # React SPA frontend

  compose/                                  # Docker Compose for local dev
  aspire/                                   # .NET Aspire orchestration
  terraform/                                # Infrastructure as code
```

## Module Pattern (Catalog Example)

Each module follows Clean Architecture with three layers:

### 1. Domain Layer (Catalog.Domain/)

```csharp
// Catalog.Domain/Entities/Product.cs
public sealed class Product
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public decimal Price { get; private set; }
    public string Description { get; private set; }

    public static Result<Product> Create(string name, decimal price, string description)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure("Product name is required");

        return Result.Success(new Product
        {
            Id = Guid.NewGuid(),
            Name = name,
            Price = price,
            Description = description
        });
    }
}
```

### 2. Application Layer (Catalog.Application/)

```csharp
// Catalog.Application/Handlers/GetProductsHandler.cs
public sealed class GetProductsHandler(CatalogDbContext db)
{
    public async Task<Result<List<ProductDto>>> Handle(CancellationToken ct)
    {
        var products = await db.Products
            .AsNoTracking()
            .Select(p => new ProductDto(p.Id, p.Name, p.Price))
            .ToListAsync(ct);

        return Result.Success(products);
    }
}

// Catalog.Application/DTOs/ProductDto.cs
public sealed record ProductDto(Guid Id, string Name, decimal Price);

// Catalog.Application/Validators/CreateProductValidator.cs
public sealed class CreateProductValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MinimumLength(3);
        RuleFor(x => x.Price).GreaterThan(0);
    }
}
```

### 3. Infrastructure Layer (Catalog.Infrastructure/)

```csharp
// Catalog.Infrastructure/Persistence/CatalogDbContext.cs
public sealed class CatalogDbContext(DbContextOptions<CatalogDbContext> options)
    : DbContext(options)
{
    public DbSet<Product> Products { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CatalogDbContext).Assembly);
    }
}

// Catalog.Infrastructure/CatalogModule.cs — Module registration
public static class CatalogModule
{
    public static IServiceCollection AddCatalogModule(
        this IServiceCollection services,
        IConfiguration config)
    {
        services.AddDbContext<CatalogDbContext>(options =>
            options.UseNpgsql(
                config.GetConnectionString("CatalogDb"),
                opts => opts.MigrationsHistoryTable("__EFMigrationsHistory", "catalog")));

        return services;
    }

    public static IEndpointRouteBuilder MapCatalogModule(
        this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/catalog")
            .WithTags("Catalog");

        group.MapGet("/products", GetProducts);
        group.MapPost("/products", CreateProduct);

        return app;
    }

    private static async Task<IResult> GetProducts(
        CatalogDbContext db,
        CancellationToken ct)
    {
        var handler = new GetProductsHandler(db);
        var result = await handler.Handle(ct);
        return result.IsSuccess
            ? TypedResults.Ok(result.Value)
            : TypedResults.BadRequest(result.Error);
    }

    private static async Task<IResult> CreateProduct(
        CreateProductRequest request,
        CatalogDbContext db,
        CancellationToken ct)
    {
        var product = Product.Create(request.Name, request.Price, request.Description);
        if (!product.IsSuccess)
            return TypedResults.BadRequest(product.Error);

        db.Products.Add(product.Value);
        await db.SaveChangesAsync(ct);

        return TypedResults.Created($"/api/catalog/products/{product.Value.Id}", product.Value);
    }
}
```

## Server Registration (Program.cs)

```csharp
// src/api/server/Program.cs
var builder = WebApplicationBuilder.CreateBuilder(args);

// Register all modules
builder.Services
    .AddCatalogModule(builder.Configuration)
    .AddFlightsModule(builder.Configuration)
    .AddMastersModule(builder.Configuration)
    .AddTodoModule(builder.Configuration);

// Framework services
builder.Services.AddSerilog();
builder.Services.AddCors(...);

var app = builder.Build();

app.UseHttpsRedirection();
app.UseCors();

// Map all modules
app.MapCatalogModule()
   .MapFlightsModule()
   .MapMastersModule()
   .MapTodoModule();

app.Run();
```

## Key Principles

1. **One DbContext per module** — No cross-module database queries. If needed, use APIs or integration events.
2. **Domain-driven design** — Business logic in domain entities, not in handlers.
3. **Result pattern** — All handlers return `Result<T>` for explicit error handling.
4. **No shared repositories** — Use DbContext directly (EF Core IS the repository).
5. **Thin API layer** — Endpoints just map HTTP ↔ Application handlers.
6. **PostgreSQL with migrations** — Each module manages its own migrations under `src/api/migrations/`.

## Testing Convention

For each module, create tests:

```
tests/
  Modules/
    Catalog.Tests/
      Handlers/
        GetProductsHandlerTests.cs
      Entities/
        ProductTests.cs
```

## Verification Checklist

Before committing:

```bash
/verify          # 7-phase verification: build, tests, security, format
/health-check    # Module health report
/code-review     # Multi-dimensional code review
```

## Key Slash Commands

| Command | Purpose |
|---------|---------|
| `/scaffold` | Generate new handler (Command/Query) in a module |
| `/verify` | 7-phase verification: build → tests → security |
| `/health-check` | Grade your modules (A-F) |
| `/code-review` | Multi-dimensional review for PRs |
| `/migrate` | Safe EF Core migration workflow |

## Skills to Load

- **clean-architecture** — Dependency inversion, layers
- **ef-core** — DbContext per module, migrations, queries
- **minimal-api** — Endpoint mapping
- **error-handling** — Result pattern
- **testing** — WebApplicationFactory integration tests
- **modern-csharp** — C# 14 idioms
        Domain/
          Entities/
            Payment.cs
          Exceptions/
            PaymentException.cs
        Application/
          Commands/
            ProcessPayment/
              ProcessPaymentCommand.cs
              ProcessPaymentHandler.cs
          Consumers/
            BookingCreatedEventConsumer.cs
          Interfaces/
            IPaymentDbContext.cs
        Infrastructure/
          Persistence/
            PaymentDbContext.cs
            Configurations/
          DependencyInjection.cs
        Endpoints/
          PaymentEndpoints.cs

    Flights/
      FlightOperation.Modules.Flights/
        # Same layer structure...

tests/
  Modules/
    FlightOperation.Modules.Bookings.Tests/
      Features/
        CreateBooking/
          CreateBookingHandlerTests.cs
        GetBooking/
          GetBookingHandlerTests.cs
      Fixtures/
        BookingsFixture.cs              # WebApplicationFactory scoped to Bookings module
      Assertions/
        BookingAssertions.cs

  FlightOperation.Integration.Tests/
    Fixtures/
      AppFixture.cs                     # Full application with Testcontainers
    Scenarios/
      BookingToPaymentFlowTests.cs      # Cross-module integration
```

## Module Registration Pattern

Each module exposes a single extension method that wires everything up:

```csharp
// Modules/Bookings/FlightOperation.Modules.Bookings/DependencyInjection.cs
public static class BookingsModule
{
    public static IServiceCollection AddBookingsModule(
        this IServiceCollection services,
        IConfiguration config)
    {
        // Domain + Application
        services.AddMediator(
            serviceAssemblyMarkerType: typeof(BookingsModule),
            assemblyFilter: x => x.Namespace?.StartsWith("FlightOperation.Modules.Bookings") ?? false);
        services.AddValidatorsFromAssembly(typeof(BookingsModule).Assembly);

        // Infrastructure
        services.AddDbContext<BookingDbContext>(options =>
            options.UseNpgsql(config.GetConnectionString("BookingsDb")));

        services.AddScoped<IBookingDbContext>(sp => sp.GetRequiredService<BookingDbContext>());

        // Wolverine consumer auto-discovery
        services.AddWolverineMessaging();

        return services;
    }

    public static IEndpointRouteBuilder MapBookingsModule(
        this IEndpointRouteBuilder app)
    {
        app.MapEndpoints();  // Auto-discovers IEndpointGroup implementations
        return app;
    }
}
```

In `Program.cs`:

```csharp
// src/FlightOperation.Host/Program.cs
var builder = WebApplicationBuilder.CreateBuilder(args);

builder.Services
    .AddBookingsModule(builder.Configuration)
    .AddPaymentsModule(builder.Configuration)
    .AddFlightsModule(builder.Configuration);

var app = builder.Build();

app.UseHttpsRedirection();
app.MapBookingsModule();
app.MapPaymentsModule();
app.MapFlightsModule();

app.Run();
```

## Feature Implementation (Per Module)

Each feature is a **single static class** combining Command + Handler + Validator:

```csharp
// Modules/Bookings/Application/Commands/CreateBooking/CreateBookingCommand.cs

public static class CreateBooking
{
    public record Command(
        string FlightId,
        List<PassengerDto> Passengers,
        CancellationToken CancellationToken) : IRequest<Result<Response>>;

    public record Response(string BookingReference, decimal Total);

    public sealed class Validator : AbstractValidator<Command>
    {
        public Validator()
        {
            RuleFor(x => x.FlightId).NotEmpty();
            RuleFor(x => x.Passengers).NotEmpty();
        }
    }

    public sealed class Handler(
        IBookingDbContext db,
        IMediator mediator,
        TimeProvider clock)
        : IRequestHandler<Command, Result<Response>>
    {
        public async Task<Result<Response>> Handle(
            Command request,
            CancellationToken ct)
        {
            var flight = await db.Flights
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == request.FlightId, ct);

            if (flight is null)
                return Result.NotFound("Flight not found");

            var booking = Booking.Create(
                request.FlightId,
                request.Passengers,
                clock.GetUtcNow());

            db.Bookings.Add(booking);

            // Publish domain events (Wolverine outbox pattern)
            await db.SaveChangesAsync(ct);

            return Result.Success(new Response(
                booking.Reference,
                booking.Total));
        }
    }
}
```

## Integration Events Pattern

Modules publish events; other modules subscribe via consumers:

```csharp
// Shared.Contracts/Events/BookingCreatedEvent.cs
public sealed record BookingCreatedEvent(
    string BookingId,
    string CustomerId,
    decimal Amount,
    DateTimeOffset OccurredAt) : IntegrationEvent;

// Modules/Payments/Application/Consumers/BookingCreatedEventConsumer.cs
public sealed class BookingCreatedEventConsumer(
    IPaymentDbContext db,
    TimeProvider clock)
    : IConsumer<BookingCreatedEvent>
{
    public async Task Consume(IConsumeContext<BookingCreatedEvent> context)
    {
        var payment = Payment.Create(
            context.Message.BookingId,
            context.Message.Amount,
            clock.GetUtcNow());

        db.Payments.Add(payment);
        await db.SaveChangesAsync(context.CancellationToken);
    }
}
```

## Endpoint Groups (Auto-Discovered)

Each module has thin endpoint groups that map HTTP ↔ commands/queries:

```csharp
// Modules/Bookings/Endpoints/BookingEndpoints.cs
public sealed class BookingEndpoints : IEndpointGroup
{
    public void Map(IEndpointRouteBuilder app)
    {
        var group = app
            .MapGroup("/api/bookings")
            .WithTags("Bookings")
            .WithName("BookingsEndpoints");

        group.MapPost("/", CreateBooking)
            .WithName("CreateBooking")
            .Produces<CreateBooking.Response>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .AddEndpointFilter<ValidationFilter<CreateBooking.Command>>();

        group.MapGet("/{bookingId}", GetBooking)
            .WithName("GetBooking")
            .Produces<GetBooking.Response>();
    }

    private static async Task<IResult> CreateBooking(
        CreateBooking.Command command,
        IMediator mediator,
        CancellationToken ct)
    {
        var result = await mediator.Send(command, ct);
        return result.IsSuccess
            ? TypedResults.Created($"/api/bookings/{result.Value.BookingReference}", result.Value)
            : result.ToProblemDetails();
    }

    private static async Task<IResult> GetBooking(
        string bookingId,
        IMediator mediator,
        CancellationToken ct)
    {
        var query = new GetBooking.Query(bookingId);
        var result = await mediator.Send(query, ct);
        return result.IsSuccess
            ? TypedResults.Ok(result.Value)
            : result.ToProblemDetails();
    }
}
```

## Testing Convention

Each module has its own test project with a module-scoped fixture:

```csharp
// Tests/Modules/FlightOperation.Modules.Bookings.Tests/Fixtures/BookingsFixture.cs
public sealed class BookingsFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16")
        .Build();

    public HttpClient Client { get; private set; } = null!;
    public IMediator Mediator { get; private set; } = null!;
    public IBookingDbContext DbContext { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        var builder = WebApplicationBuilder.CreateBuilder();
        builder.Configuration["ConnectionStrings:BookingsDb"] = _container.GetConnectionString();

        builder.Services.AddBookingsModule(builder.Configuration);

        var app = builder.Build();
        app.MapBookingsModule();

        var server = new TestServer(app);
        Client = server.CreateClient();
        Mediator = app.Services.GetRequiredService<IMediator>();
        DbContext = app.Services.GetRequiredService<IBookingDbContext>();
    }

    public async Task DisposeAsync()
    {
        await _container.StopAsync();
    }
}

// Tests/Modules/FlightOperation.Modules.Bookings.Tests/Features/CreateBooking/CreateBookingHandlerTests.cs
public sealed class CreateBookingHandlerTests : IAsyncLifetime
{
    private BookingsFixture _fixture = null!;

    public async Task InitializeAsync() => _fixture = new();

    public async Task CreateBooking_ValidRequest_ReturnsBookingReference()
    {
        // Arrange
        var command = new CreateBooking.Command(
            FlightId: Guid.NewGuid().ToString(),
            Passengers: new() { new PassengerDto("John", "Doe") },
            CancellationToken: CancellationToken.None);

        // Act
        var result = await _fixture.Mediator.Send(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.BookingReference.Should().NotBeNullOrEmpty();
    }

    public async Task DisposeAsync() => await _fixture.DisposeAsync();
}
```

## Verification Checklist

Before committing features, run:

```bash
/verify          # 7-phase verification
/code-review     # Multi-dimensional review
/health-check    # Graded codebase health
```

## Key Skills to Load

- **clean-architecture** — Dependency inversion, layers, entity behavior
- **modular-monolith** — Module boundaries, integration events, cross-module messaging
- **ef-core** — DbContext per module, query optimization, migrations
- **minimal-api** — Endpoint groups, TypedResults, OpenAPI metadata
- **error-handling** — Result pattern for expected failures
- **testing** — WebApplicationFactory + Testcontainers integration tests
- **messaging** — Wolverine/MassTransit patterns, outbox, consumers

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/scaffold` | Generate complete feature (Command + Handler + Validator + Endpoint + Tests) across all modules |
| `/verify` | 7-phase verification: build → tests → security → format |
| `/health-check` | Graded module health (per-module analysis) |
| `/code-review` | Multi-dimensional review (anti-patterns, diagnostics, architecture compliance) |
| `/tdd` | Red-green-refactor with Testcontainers |
| `/plan` | Architecture-aware planning |

## Quick Start: Scaffold a Feature

```bash
# In Claude Code chat:
/scaffold

# Then answer prompts:
# → Module: Bookings
# → Feature: CreateBooking
# → Handler type: Command
```

Claude will generate:
- ✅ Command + Handler + Validator (single file)
- ✅ IEndpointGroup with mappings
- ✅ Integration tests with fixture
- ✅ Result pattern error handling
- ✅ FluentValidation setup
- ✅ CancellationToken throughout
- ✅ TimeProvider injection
- ✅ OpenAPI metadata

---

**Customization Notes:**
- Replace `FlightOperation` with your project name
- Replace module names (Bookings, Payments, Flights, etc.) with yours
- Update connection strings in `appsettings.json`
- Choose Wolverine or MassTransit for messaging (default: Wolverine)
- Database provider: PostgreSQL (shown) or SQL Server (change `UseNpgsql` to `UseSqlServer`)
