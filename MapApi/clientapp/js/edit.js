let typeObject;
let addressObject;
let idObject;

const checkbox = document.getElementById('addressCheckbox');
const mapForAddress = document.getElementById('mapForAddress');

const provider = new GeoSearch.OpenStreetMapProvider();
const addressInput = document.getElementById('addressInput');
const suggestionsContainer = document.getElementById('suggestions');

$(document).ready(function () {
    const addressContainer = $('#addressContainer');
    let map;
    let currentLocationMarker = null;

    fetch('/api/SocialMapObject/get/accessibility')
        .then(response => response.json())
        .then(data => {
            const items = Array.isArray(data) ? data : [];
            const container = $('#accessibilityContainer');
            items.forEach(item => {
                const checkbox = $('<input>').attr('type', 'checkbox').attr('name', 'accessibility').attr('value', item);
                const label = $('<label>').text(item).prepend(checkbox);
                container.append(label).append('<br>');
            });
        })
        .catch(error => console.error("Ошибка при загрузке элементов доступной среды:", error));

    function getSocialAddressTemplate() {
        return `
            <h4 for="address">Объект переехал? Вы знаете его новый адрес?</h4>
            <div style="margin-bottom: 15px;">
                <input type="checkbox" id="addressCheckbox">
                <label for="addressCheckbox">Да</label>
            </div>
            <div id="mapForAddress" style="display: none;">
                <h4 for="address">Адрес:</h4>
                <div class="search-container">
                    <input type="text" id="addressInput" class="search-input" placeholder="Введите адрес">
                    <div id="suggestions" class="search-suggestions"></div>
                </div>
                <div id="map"></div>
                <input type="hidden" id="address" name="address" required>
                <input type="hidden" id="latitude" name="latitude">
                <input type="hidden" id="longitude" name="longitude">
            </div>
        `;
    }

    function getTransportRoadAddressTemplate() {
        return `
            <div id="mapForAddress">
                <h4 for="address">Адрес:</h4>
                <input type="checkbox" id="useCurrentLocation">
                <label for="useCurrentLocation">Использовать текущее местоположение</label>
                <div class="search-container">
                    <input type="text" id="addressInput" class="search-input" placeholder="Введите адрес">
                    <div id="suggestions" class="search-suggestions"></div>
                </div>
                <div id="map"></div>
                <input type="hidden" id="address" name="address" required>
                <input type="hidden" id="latitude" name="latitude">
                <input type="hidden" id="longitude" name="longitude">
            </div>
        `;
    }

    function initializeMap() {
        if ($('#map').length) {
            map = L.map('map', {
                attributionControl: false
            }).setView([51.533557, 46.034257], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

            const provider = new GeoSearch.OpenStreetMapProvider();
            const addressInput = document.getElementById('addressInput');
            const suggestionsContainer = document.getElementById('suggestions');

            if (addressInput) {
                addressInput.addEventListener('input', async () => {
                    const query = addressInput.value.trim();
                    if (query.length >= 1) {
                        const results = await provider.search({ query });
                        suggestionsContainer.innerHTML = '';
                        results.forEach(result => {
                            const suggestion = document.createElement('div');
                            suggestion.classList.add('search-suggestion');
                            suggestion.textContent = result.label;
                            suggestion.addEventListener('click', () => {
                                addressInput.value = result.label;
                                $('#address').val(result.label);
                                $('#latitude').val(result.y);
                                $('#longitude').val(result.x);

                                map.setView([result.y, result.x], 16);
                                L.marker([result.y, result.x]).addTo(map);

                                suggestionsContainer.innerHTML = '';
                            });
                            suggestionsContainer.appendChild(suggestion);
                        });
                    } else {
                        suggestionsContainer.innerHTML = '';
                    }
                });
            }

            const useCurrentLocationCheckbox = document.getElementById('useCurrentLocation');
            if (useCurrentLocationCheckbox) {
                const latitudeInput = document.getElementById('latitude');
                const longitudeInput = document.getElementById('longitude');
                const addressInput = document.getElementById('addressInput');

                useCurrentLocationCheckbox.addEventListener('change', async () => {
                    if (useCurrentLocationCheckbox.checked) {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(async (position) => {
                                const { latitude, longitude } = position.coords;

                                latitudeInput.value = latitude;
                                longitudeInput.value = longitude;

                                const address = await reverseGeocode(latitude, longitude);
                                if (address) {
                                    addressInput.value = address;
                                    $('#address').val(address);

                                    if (currentLocationMarker) {
                                        map.removeLayer(currentLocationMarker);
                                    }
                                    currentLocationMarker = L.marker([latitude, longitude]).addTo(map);
                                    map.setView([latitude, longitude], 15);
                                } else {
                                    alert('Не удалось определить адрес.');
                                    useCurrentLocationCheckbox.checked = false;
                                    useCurrentLocationCheckbox.disabled = true;
                                }
                            }, (error) => {
                                console.error('Ошибка при получении местоположения:', error);
                                alert('Не удалось получить доступ к местоположению.');
                                useCurrentLocationCheckbox.checked = false;
                                useCurrentLocationCheckbox.disabled = true;
                            });
                        } else {
                            alert('Геолокация не поддерживается вашим браузером.');
                            useCurrentLocationCheckbox.checked = false;
                            useCurrentLocationCheckbox.disabled = true;
                        }
                    } else {
                        addressInput.value = '';
                        latitudeInput.value = '';
                        longitudeInput.value = '';
                    }
                });
            }
        }
    }

    async function reverseGeocode(lat, lon) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const data = await response.json();
            return data.display_name || '';
        } catch (error) {
            console.error('Ошибка при обратном геокодировании:', error);
            return '';
        }
    }

    function updateFormStructure() {
        const selectedType = $('#type').val();

        if (selectedType === "Социальная инфраструктура") {
            addressContainer.html(getSocialAddressTemplate());

            $('#socialInfrastructureFields').show();

            $('#addressCheckbox').on('change', function () {
                $('#mapForAddress').toggle(this.checked);
                if (this.checked) initializeMap();
            });

            setTimeout(() => {
                $('#isExcluded').prop('checked', false).prop('disabled', false);
            }, 100);
        } else {
            addressContainer.html(getTransportRoadAddressTemplate());

            setTimeout(() => {
                $('#isExcluded').prop('checked', true).prop('disabled', true);
                initializeMap();
            }, 100);

            $('#socialInfrastructureFields').hide();
        }
    }
    const attributionControl = document.querySelector('.leaflet-control-attribution');
    if (attributionControl) {
        attributionControl.remove();
    }
    $('#type').on('change', updateFormStructure);
    updateFormStructure();
});

const map = L.map('map').setView([51.533557, 46.034257], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

// Вспомогательная функция для проверки типа объекта
function checkType() {
    const selectedType = $('#type').val();

    if (selectedType === "Социальная инфраструктура") {
        return typeObject;

    } else {
        return selectedType;
    }
}

// Отправка формы
function submitForm() {
    const formData = new FormData();
    const categoryRadios = document.querySelectorAll('input[type="radio"]:checked');
    const form = document.getElementById('addObjectForm');
    const name = document.getElementById("search").value;
    const address = document.getElementById("address").value;
    const isOpen = document.getElementById("isExcluded").checked;

    formData.append("name", name);
    formData.append("address", typeof address !== 'undefined' ? address : addressObject);
    formData.append("excluded", isOpen.toString());
    if (idObject) formData.append("mapObjectId", idObject);
    formData.append("userId", userId);
    formData.append("type", checkType());

    const description = document.getElementById("description").value;
    if (description) formData.append("description", description);

    const workingHours = document.getElementById("workingHours").value;
    if (workingHours) formData.append("workingHours", workingHours);

    const images = document.getElementById("images").files;
    for (let i = 0; i < images.length; i++) {
        formData.append("images", images[i]);
    }

    const accessibilityCheckboxes = document.querySelectorAll('input[name="accessibility"]:checked');
    if (accessibilityCheckboxes.length > 0) {
        accessibilityCheckboxes.forEach(checkbox => { formData.append("accessibility", checkbox.value); console.log(checkbox.value); });
    }

    const disabilityCategoryCheckboxes = document.querySelectorAll('input[name="disabilityCategory"]:checked');
    if (disabilityCategoryCheckboxes.length > 0) {
        disabilityCategoryCheckboxes.forEach(checkbox => { formData.append("disabilityCategory", checkbox.value); console.log(checkbox.value); });
    }

    console.log(formData.type);

    fetch("/client/AddMapObject", {
        method: "POST",
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(`Ошибка при отправке формы: ${text}`); });
            }

            return response.json();
        })
        .catch(error => console.error("Ошибка:", error));
    alert('Форма успешно отправлена!');
    location.reload();
}

// Вспомогательная функция для сортировки объектов
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Функция для перевода координат в адресс
async function reverseGeocode(latitude, longitude, radiusInMeters = 500) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Ошибка при обращении к сервису геокодирования.');
        }
        const data = await response.json();
        console.log(data);

        const resultLat = parseFloat(data.lat);
        const resultLon = parseFloat(data.lon);
        const distance = calculateDistance(latitude, longitude, resultLat, resultLon) * 1000;

        if (distance <= radiusInMeters) {
            const addr = data.address;
            let address = '';
            if (addr.road) address += addr.road + ', ';
            if (addr.city) address += addr.city + ', ';
            else if (addr.village) address += addr.village + ', ';
            if (addr.state) address += addr.state + ', ';
            if (addr.country) address += addr.country;
            return address.trim();
        } else {
            console.error(`Адрес найден, но находится дальше чем ${radiusInMeters} м.`);
            return null;
        }
    } catch (error) {
        console.error('Ошибка при геокодировании:', error);
        return null;
    }
}

// Обработчик для галочки "Использовать текущее положение"
async function handleUseCurrentLocation() {
    const checkbox = document.getElementById('useCurrentLocation');

    if (checkbox.checked) {
        try {
            const position = await getCurrentPosition();
            const { latitude, longitude } = position.coords;
            const address = await reverseGeocode(latitude, longitude);

            if (address) {
            } else {
                console.error('Адрес не найден.');
                checkbox.checked = false;
                checkbox.disabled = true;
                alert('Не удалось определить адрес по текущему местоположению.');
            }
        } catch (error) {
            console.error('Ошибка при получении геопозиции:', error);
            checkbox.checked = false;
            checkbox.disabled = true;
            alert('Ошибка при получении текущего местоположения.');
        }
    }
}

/*
    ! Обработчики событий !
*/

document.getElementById("search").addEventListener("input", async function (event) {
    const query = event.target.value.trim();
    const dropdown = document.getElementById("search-dropdown");

    if (!query) {
        dropdown.style.display = "none";
        return;
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`/api/SocialMapObject/SearchBy/?search=${encodedQuery}`);
        if (!response.ok) {
            throw new Error("Ошибка при получении данных.");
        }

        const data = await response.json();
        if (data.length === 0) {
            dropdown.style.display = "none";
            return;
        }

        dropdown.innerHTML = "";
        data.forEach(obj => {
            const option = document.createElement("option");
            option.value = obj.id;
            option.textContent = obj.display_name;
            option.setAttribute("data-object", JSON.stringify(obj));
            dropdown.appendChild(option);
        });

        dropdown.style.display = "block";
    } catch (error) {
        console.error(error);
        dropdown.style.display = "none";
    }
});

document.getElementById("search-dropdown").addEventListener("change", function (event) {
    const selectedOption = event.target.options[event.target.selectedIndex];

    const objectData = selectedOption.getAttribute("data-object");
    const object = JSON.parse(objectData);

    document.getElementById("search").value = object.display_name;

    const address = document.getElementById("address");
    const description = document.getElementById("description");
    const workingHours = document.getElementById("workingHours");

    address.value = object.adress;
    description.value = object.description;
    workingHours.value = object.workingHours;

    addressObject = object.adress;
    typeObject = object.type;
    idObject = object.id;
    event.target.style.display = "none";

    fetch('/client/getOntologyInfo', {
        method: 'POST',
        body: new URLSearchParams({ iri: object.iri }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
        .then(response => response.json())
        .then(data => {
            const categories = data.categories || [];
            categories.forEach(category => {
                const pureCategory = category.split('^^')[0];
                const checkbox = document.getElementById(`disabilityCategory${pureCategory}`);
                if (checkbox) {
                    checkbox.checked = true;
                } else {
                    console.warn(`Чекбокс для категории ${pureCategory} не найден.`);
                }
            });

            const accessibilityElements = data.accessibilityElements || [];
            accessibilityElements.forEach(element => {
                const checkbox = Array.from(document.querySelectorAll('input[name="accessibility"]')).find(
                    el => el.value === element
                );
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        })
        .catch(error => {
            console.error("Ошибка при запросе данных:", error);
        });
});

addressInput.addEventListener('input', async () => {
    const query = addressInput.value.trim();

    if (query.length >= 1) {
        const results = await provider.search({ query });

        const filteredResults = results.filter(result => {
            const labelContainsRussia = result.label?.toLowerCase().includes('россия');
            return labelContainsRussia;
        });

        suggestionsContainer.innerHTML = '';

        filteredResults.forEach(result => {
            const suggestion = document.createElement('div');
            suggestion.classList.add('search-suggestion');
            suggestion.textContent = result.label;

            suggestion.addEventListener('click', () => {
                addressInput.value = result.label;
                document.getElementById('address').value = result.label;
                document.getElementById('latitude').value = result.y;
                document.getElementById('longitude').value = result.x;

                map.setView([result.y, result.x], 16);
                L.marker([result.y, result.x]).addTo(map);

                suggestionsContainer.innerHTML = '';
            });

            suggestionsContainer.appendChild(suggestion);
        });
    } else {
        suggestionsContainer.innerHTML = '';
    }
});

document.addEventListener('click', (event) => {
    if (!suggestionsContainer.contains(event.target) && event.target !== addressInput) {
        suggestionsContainer.innerHTML = '';
    }
});

checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
        mapForAddress.style.display = 'block';
    } else {
        mapForAddress.style.display = 'none';
    }
});
