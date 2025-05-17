using MapApi.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Npgsql;
using MapApi.Controllers;
using Quartz;
using Quartz.Impl.Matchers;
using Quartz.Impl.Triggers;
using MapApi.Models;
using MapApi.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient();

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(80); 
});

var connection = "Host=db;Port=5432;Username=postgres;Password=12345;Database=map";
builder.Services.AddDbContext<ApplicationContext>(options =>
{
    options.UseNpgsql(connection);
});

// Миграция и добавление строки по умолчанию
using (var scope = builder.Services.BuildServiceProvider().CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationContext>();
    db.Database.Migrate();

    // Если в таблице нет настроек, создаем дефолтную запись
    if (!db.AdminSettings.Any())
    {
        db.AdminSettings.Add(new AdminSetting
        {
            CronExpression = "0 */5 * * * ?" // Значение по умолчанию
        });
        db.SaveChanges();
    }
}

// Извлечение cron-выражения из базы данных
string cronExpression = "0 */5 * * * ?"; 
using (var dbConnection = new NpgsqlConnection(connection))
{
    dbConnection.Open();
    using (var command = new NpgsqlCommand("SELECT \"CronExpression\" FROM public.\"AdminSettings\" LIMIT 1", dbConnection))
    {
        var result = command.ExecuteScalar();
        if (result != null && IsValidCronExpression(result.ToString()))
        {
            cronExpression = result.ToString();
        }
    }
}

// Настройка Quartz
builder.Services.AddQuartz(q =>
{
    q.UseMicrosoftDependencyInjectionJobFactory();

    var jobKey = new JobKey("IntersectedDataJob");

    q.AddJob<IntersectedDataJob>(opts => opts
        .WithIdentity(jobKey)
        .StoreDurably());

    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithIdentity("IntersectedDataJob-trigger")
        .WithCronSchedule(cronExpression));
});

builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

// Регистрация контроллеров и сервисов
builder.Services.AddScoped<RecommendationController>();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddSingleton<ICronService, CronService>();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

//app.UseHttpsRedirection();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "clientapp")),
    RequestPath = "/clientapp"
});

app.UseSession();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Проверка валидности cron-выражения
bool IsValidCronExpression(string cronExpression)
{
    try
    {
        CronExpression expression = new CronExpression(cronExpression);
        return true;
    }
    catch
    {
        return false;
    }
}
