using MapApi.Context;
using MapApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using System.Web;
using VDS.RDF;
using VDS.RDF.Parsing;
using VDS.RDF.Query;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using static Lucene.Net.Analysis.Synonym.SynonymMap;
using VDS.RDF.Ontology;

namespace MapApi.Controllers
{
    [Route("api/SocialMapObject")]
    [ApiController]
    public class SocialMapObjectController : Controller
    {
        private readonly ApplicationContext _context;

        private readonly HttpClient _httpClient;

        public SocialMapObjectController(ApplicationContext context, HttpClient httpClient)
        {
            _context = context;
            _httpClient = httpClient;
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "C# App");
        }

        // Метод для подгрузки объектов городской среды из онтологии в БД
        [HttpGet]
        [Route("/GetOntologyObjects")]
        public async Task<ActionResult<IEnumerable<MapObject>>> GetOntologyObjects()
        {
            IGraph g = new Graph();
            g.LoadFromFile("Ontology_Social_objects_new.rdf");

            SparqlQueryParser parser = new SparqlQueryParser();
            SparqlQuery q = parser.ParseFromString("PREFIX obj: <http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#>" +
                "SELECT ?object ?x ?y ?type ?categoryG ?categoryK ?categoryO ?categoryS ?categoryU WHERE { " +
                "?object obj:X ?x . ?object obj:Y ?y . ?object obj:является ?type . " +
                "OPTIONAL { ?object obj:категория_Г ?categoryG . } " +
                "OPTIONAL { ?object obj:категория_К ?categoryK . } " +
                "OPTIONAL { ?object obj:категория_О ?categoryO . } " +
                "OPTIONAL { ?object obj:категория_С ?categoryS . } " +
                "OPTIONAL { ?object obj:категория_У ?categoryU . } }");

            Object results = g.ExecuteQuery(q);
            if (results is SparqlResultSet rset)
            {
                int addedCount = 0;
                int updatedCount = 0;
                int skippedCount = 0;

                foreach (SparqlResult result in rset)
                {
                    if (!result.HasValue("x") || !result.HasValue("y") || !result.HasValue("type"))
                    {
                        skippedCount++;
                        continue;
                    }

                    string iri = HttpUtility.UrlDecode(result["object"].ToString());
                    string type = HttpUtility.UrlDecode(result["type"].ToString()).Split('#').Last().Replace("_", " ");
                    string displayName = HttpUtility.UrlDecode(result["object"].ToString()).Split('#').Last().Replace("_", " ");

                    string xString = result["x"].ToString().Split('^')[0];
                    string yString = result["y"].ToString().Split('^')[0];

                    if (!double.TryParse(xString, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double xValue) ||
                        !double.TryParse(yString, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double yValue))
                    {
                        skippedCount++;
                        continue;
                    }

                    var existingEntity = await _context.MapObject
                        .AsNoTracking()
                        .FirstOrDefaultAsync(e => e.IRI == iri);

                    int mapObjectId;

                    if (existingEntity != null)
                    {
                        existingEntity.X = xValue;
                        existingEntity.Y = yValue;
                        existingEntity.Type = type;

                        _context.MapObject.Update(existingEntity);
                        mapObjectId = existingEntity.Id;
                        updatedCount++;
                    }
                    else
                    {
                        var socialMapObject = new MapObject
                        {
                            Display_name = displayName,
                            X = xValue,
                            Y = yValue,
                            Type = type,
                            IRI = iri
                        };

                        _context.MapObject.Add(socialMapObject);
                        await _context.SaveChangesAsync();
                        mapObjectId = socialMapObject.Id;
                        addedCount++;
                    }

                }

                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    Console.WriteLine($"Ошибка при сохранении изменений");
                }
            }

            return await _context.MapObject.AsNoTracking().ToListAsync();
        }

        // Метод для извлечения объекта из БД
        [HttpGet("/GetSocialMapObject")]
        public async Task<ActionResult<IEnumerable<MapObject>>> GetSocialMapObject()
        {
            if (_context.MapObject == null)
            {
                return NotFound();
            }
            return await _context.MapObject.ToListAsync();
        }

        // Метод для извлечения координат по адресу
        [HttpGet("api/SocialMapObject/coordinates")]
        public async Task<IActionResult> GetCoordinatesAsync(string address)
        {

            if (string.IsNullOrEmpty(address))
            {
                return BadRequest("Адрес не должен быть пустым");
            }

            try
            {
                string url = $"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(address)}&format=json";

                HttpResponseMessage response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return StatusCode((int)response.StatusCode, "Ошибка соединения");
                }

                string responseData = await response.Content.ReadAsStringAsync();
                JArray jsonData = JArray.Parse(responseData);

                if (jsonData.Count > 0)
                {
                    var firstResult = jsonData[0];
                    double latitude = Convert.ToDouble(firstResult["lat"]);
                    double longitude = Convert.ToDouble(firstResult["lon"]);

                    return Ok(new { Latitude = latitude, Longitude = longitude });
                }
                else
                {
                    return NotFound("Координаты не найдены");
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Ошибка при получении данных: {ex.Message}");
            }
        }

        // Метод для добавления данных об оъекте со стороны клиента
        [HttpPost("/client/AddMapObject")]
        public async Task<IActionResult> AddMapObject(
            [FromForm] string name,
            [FromForm] string address,
            [FromForm] string type,
            [FromForm] string? description, 
            [FromForm] List<string>? disabilityCategory,
            [FromForm] string? workingHours,
            [FromForm] List<IFormFile>? images, 
            [FromForm] List<string>? accessibility,
            [FromForm] bool excluded,
            [FromForm] int mapObjectId,
            [FromForm] int userId
        )
        {
            var result = await GetCoordinatesAsync(address);
            double? latitude = null;
            double? longitude = null;

            if (result is OkObjectResult okResult)
            {
                var coordinates = okResult.Value as dynamic;
                latitude = coordinates?.Latitude;
                longitude = coordinates?.Longitude;
            }

            List<string> imagePaths = new List<string>();
            if (images != null)
            {
                foreach (var image in images)
                {
                    var imagesDirectory = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/images");

                    if (!Directory.Exists(imagesDirectory))
                    {
                        Directory.CreateDirectory(imagesDirectory);
                    }

                    var filePath = Path.Combine(imagesDirectory, image.FileName);
                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await image.CopyToAsync(stream);
                    }
                    imagePaths.Add(image.FileName);
                }
            }

            var user = await _context.User.FindAsync(userId);

            var mapObject = new PendingSocialMapObject
            {
                DisplayName = name,
                Address = address,
                X = latitude,
                Y = longitude,
                Type = type,
                Description = description,
                DisabilityCategory = disabilityCategory != null ? string.Join(',', disabilityCategory) : null,
                WorkingHours = workingHours,
                Accessibility = accessibility != null ? string.Join(',', accessibility) : null,
                Images = imagePaths.Count > 0 ? string.Join(',', imagePaths) : null,
                DateAdded = DateTime.UtcNow,
                Status = "Pending",
                MapObjectID = mapObjectId,
                Excluded = excluded,
                User = user
            };

            _context.PendingSocialMapObject.Add(mapObject);
            await _context.SaveChangesAsync();

            return Ok();
        }

        // Поиск информации об объекте по IRI
        [HttpPost("/client/getOntologyInfo")]
        public async Task<IActionResult> GetOntologyInfo([FromForm] string iri)
        {
            try
            {
                IGraph g = new Graph();
                g.LoadFromFile("Ontology_Social_objects_new.rdf");  

                SparqlQueryParser parser = new SparqlQueryParser();

                string queryStr1 = $@"
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX obj: <http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#>
                SELECT ?accessibilityElement WHERE {{
                    BIND(<{iri}> AS ?individual)
                    ?individual obj:имеет ?accessibilityElement .
                }}";

                string queryStr2 = $@"
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX obj: <http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#>
                SELECT ?category WHERE {{
                    BIND(<{iri}> AS ?individual)
                    VALUES (?property ?categoryLabel) {{
                        (obj:категория_Г ""Г"")
                        (obj:категория_К ""К"")
                        (obj:категория_С ""С"")
                        (obj:категория_У ""У"")
                        (obj:категория_О ""О"")
                    }}
                    ?individual ?property true .
                    BIND(?categoryLabel AS ?category)
                }}";

                SparqlQuery query1 = parser.ParseFromString(queryStr1);
                Object results1 = g.ExecuteQuery(query1);
                List<string> accessibilityElements = new List<string>();

                if (results1 is SparqlResultSet rset1)
                {
                    foreach (SparqlResult result in rset1)
                    {
                        foreach (var variable in result.Variables)
                        {
                            string elementUri = result[variable].ToString();
                            string decodedString = HttpUtility.UrlDecode(elementUri);
                            string elementName = decodedString.Replace("http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#", "").Replace("_", " ");
                            accessibilityElements.Add(elementName);
                        }
                    }
                }

                SparqlQuery query2 = parser.ParseFromString(queryStr2);
                Object results2 = g.ExecuteQuery(query2);
                List<string> categories = new List<string>();

                if (results2 is SparqlResultSet rset2)
                {
                    foreach (SparqlResult result in rset2)
                    {
                        foreach (var variable in result.Variables)
                        {
                            string category = result[variable].ToString();
                            string decodedCategory = HttpUtility.UrlDecode(category);
                            string categoryName = decodedCategory.Replace("http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#", "").Replace("_", " ");
                            categories.Add(categoryName);
                        }
                    }
                }

                return Ok(new { AccessibilityElements = accessibilityElements, Categories = categories });
            }
            catch (Exception ex)
            {
                return BadRequest($"Ошибка при выполнении запроса: {ex.Message}");
            }
        }

        // Метод для извлечения списка элементов доступной среды из онтологии
        [HttpGet("get/accessibility")]
        public async Task<ActionResult<IEnumerable<string>>> GetAccessibilityElements()
        {
            try
            {
                IGraph g = new Graph();
                g.LoadFromFile("Ontology_Social_objects_new.rdf");

                SparqlQueryParser parser = new SparqlQueryParser();

                string queryStr = @"
                    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                    PREFIX obj: <http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#>
                    SELECT ?subject WHERE { ?subject rdf:type obj:Элемент_доступной_среды . }";

                SparqlQuery query = parser.ParseFromString(queryStr);

                Object results = g.ExecuteQuery(query);
                List<string> accessibilityElements = new List<string>();

                if (results is SparqlResultSet rset)
                {
                    foreach (SparqlResult result in rset)
                    {
                        foreach (var variable in result.Variables)
                        {
                            string elementUri = result[variable].ToString();
                            string decodedString = HttpUtility.UrlDecode(elementUri);
                            string elementName = decodedString.Replace("http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#", "").Replace("_", " ");
                            accessibilityElements.Add(elementName);
                        }
                    }
                }

                return Ok(accessibilityElements);
            }
            catch (Exception ex)
            {
                return BadRequest($"Ошибка при выполнении запроса: {ex.Message}");
            }
        }

        // Метод для извлечения типов объектов социальной инфраструктуры
        [HttpGet("get/socialInfrastructureTypes")]
        public async Task<ActionResult<IEnumerable<string>>> GetSocialInfrastructureTypes()
        {
            try
            {
                IGraph g = new Graph();
                g.LoadFromFile("Ontology_Social_objects_new.rdf");

                SparqlQueryParser parser = new SparqlQueryParser();

                string queryStr = @"
                    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                    PREFIX owl: <http://www.w3.org/2002/07/owl#>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                    PREFIX obj: <http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#>
                    SELECT ?type
                    WHERE { 
                        ?type rdfs:subClassOf obj:Объект_социальной_инфраструктуры 
                    }";

                SparqlQuery query = parser.ParseFromString(queryStr);

                Object results = g.ExecuteQuery(query);
                List<string> socialInfrastructureTypes = new List<string>();

                if (results is SparqlResultSet rset)
                {
                    foreach (SparqlResult result in rset)
                    {
                        foreach (var variable in result.Variables)
                        {
                            string typeUri = result[variable].ToString();
                            string decodedString = HttpUtility.UrlDecode(typeUri);
                            string typeName = decodedString.Replace("http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#", "").Replace("_", " ");
                            socialInfrastructureTypes.Add(typeName);
                        }
                    }
                }

                return Ok(socialInfrastructureTypes);
            }
            catch (Exception ex)
            {
                return BadRequest($"Ошибка при выполнении запроса: {ex.Message}");
            }
        }

        // Метод извлечения объекта из БД по ID
        [HttpGet("GetSocialMapObjectById/{id}")]
        public async Task<ActionResult<MapObject>> GetSocialMapObjectById(int id)
        {
            var socialMapObject = await _context.MapObject.FindAsync(id);
            if (socialMapObject == null)
            {
                return NotFound();
            }
            return socialMapObject;
        }

        // Метод для осуществления поиска объекта
        [HttpGet("SearchBy")]
        public async Task<ActionResult<IEnumerable<MapObject>>> SearchBy(string search)
        {
            if (string.IsNullOrWhiteSpace(search))
            {
                return await _context.MapObject.ToListAsync();
            }

            search = search.ToLower();
            return await _context.MapObject
                .Where(x => EF.Functions.Like(x.Display_name.ToLower(), $"%{search}%") ||
                            EF.Functions.Like(x.Adress.ToLower(), $"%{search}%"))
                .ToListAsync();
        }

        // Метод для удаления объекта по ID 
        [HttpDelete("DeleteById/{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var socialMapObject = await _context.MapObject.FindAsync(id);

            if (socialMapObject == null)
            {
                return NotFound();
            }

            _context.MapObject.Remove(socialMapObject);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Метод для добавления объекта
        [HttpPut("PutById/{id}")]
        public async Task<ActionResult> Put(int id, MapObject socialMapObject)
        {
            if (id != socialMapObject.Id)
            {
                return BadRequest();
            }

            _context.Entry(socialMapObject).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SocialMapObjectExists(id))
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

        // Метод для определения существования объекта
        private bool SocialMapObjectExists(int id)
        {
            return (_context.MapObject?.Any(e => e.Id == id)).GetValueOrDefault();
        }
    }
}
