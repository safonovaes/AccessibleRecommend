using MapApi.Context;
using MapApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MapApi.Controllers
{
    [Route("api/routes")]
    [ApiController]
    public class RouteController : Controller
    {


        private readonly string _connectionString = "Host=db;Port=5432;Username=postgres;Password=12345;Database=map";
        private readonly ApplicationContext _context;
        public RouteController(ApplicationContext context)
        {
            _context = context;
        }

        // Метод для извлечения списка маршрутов
        [HttpGet("GetRoutes")]
        public async Task<ActionResult<IEnumerable<Models.Route>>> GetRoutes()
        {
            if (_context.Route == null)
            {
                return NotFound();
            }
            return await _context.Route.ToListAsync();
        }

        [HttpPost("AddRoute")]
        public async Task<IActionResult> AddRoute([FromBody] AddRouteDto dto)
        {
            if (dto == null || dto.UserId <= 0 || dto.MapObjectId <= 0)
            {
                return BadRequest(new { message = "Некорректные данные." });
            }

            var formattedDate = dto.Date.ToString("yyyy-MM-dd");

            var route = new Models.Route
            {
                UserId = dto.UserId,
                Date = formattedDate
            };

            _context.Route.Add(route);
            await _context.SaveChangesAsync();

            await using (var connection = new Npgsql.NpgsqlConnection(_connectionString))
            {
                await connection.OpenAsync();

                var sql = @"INSERT INTO public.""RouteMapObject"" (""ListObjectsId"", ""RouteId"") 
                    VALUES (@listObjectId, @routeId);";

                using (var cmd = new Npgsql.NpgsqlCommand(sql, connection))
                {
                    cmd.Parameters.AddWithValue("listObjectId", dto.MapObjectId);
                    cmd.Parameters.AddWithValue("routeId", route.Id);

                    await cmd.ExecuteNonQueryAsync();
                }
            }

            return Ok(new { message = "Маршрут добавлен успешно!" });
        }


        // Метод для извлечения списка маршрутов по ID 
        [HttpGet("GetRouteById/{id}")]
        public async Task<ActionResult<Models.Route>> GetRouteById(int id)
        {
            var route = await _context.Route.FindAsync(id);
            if (route == null)
            {
                return NotFound();
            }
            return route;
        }

        // Метод для удаления маршрута по ID
        [HttpDelete("Delete/{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var route = await _context.Route.FindAsync(id);

            if (route == null)
            {
                return NotFound();
            }

            _context.Route.Remove(route);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Метод для добавления маршрута в БД
        [HttpPut("Put/{id}")]
        public async Task<ActionResult> Put(int id, Models.Route route)
        {
            if (id != route.Id)
            {
                return BadRequest();
            }

            _context.Entry(route).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!RouteExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // Метод для определения существования маршрута
        private bool RouteExists(int id)
        {
            return (_context.Route?.Any(e => e.Id == id)).GetValueOrDefault();
        }

        public class AddRouteDto
        {
            public int UserId { get; set; }
            public DateTime Date { get; set; }
            public int MapObjectId { get; set; }
        }
    }
}
