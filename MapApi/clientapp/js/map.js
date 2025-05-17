const apiUrl = '/GetSocialMapObject';
var control = null;

// Массив для рекомендаций
let recommendationsArray = [];
let objects = [];
let current = [];

const map = L.map('map').setView([51.533557, 46.034257], 15);
const markersMap = new Map();

// Карта категорий и их типов
const categoryMap = {
    Красота: ["Парикмахерская", "Салон красоты"],
    Культура: [
        "Библиотека", "Выставочный комплекс", "Галерея", "Дом культуры",
        "Кинотеатр", "Клуб", "Концертный зал", "Музей", "Театр", "Цирк"
    ],
    Еда: ["Бистро", "Заведение быстрого питания", "Кофейня", "Ресторан"],
    Шопинг: [
        "Гипермаркет", "Минимаркет", "Рынок вещевой", "Рынок продуктовый",
        "Супермаркет", "Торговый центр"
    ],
    Туризм: [
        "Горнолыжные трассы и лыжные базы", "Гостиница",
        "Пляж", "Туристическая база"
    ],
};

const categoryUser = {
    "Г": "Для людей с нарушением слуха",
    "К": "Для инвалидов, передвигающихся на коляске",
    "О": "Для людей с нарушением опорно-двигательного аппарата",
    "С": "Для людей с нарушением зрения",
    "У": "Для людей с нарушением умственного развития"
};

const searchInput = document.getElementById('search');
const searchResultsContainer = document.getElementById('search-results');

// Градиенты для категорий
const categoryGradients = {
    Красота: { 0.4: 'Red', 0.65: 'Red', 1: 'Red' },
    Культура: { 0.4: 'LawnGreen', 0.65: 'LawnGreen', 1: 'LawnGreen' },
    Еда: { 0.4: 'Violet', 0.65: 'Violet', 1: 'Violet' },
    Шопинг: { 0.4: 'SlateBlue', 0.65: 'SlateBlue', 1: 'SlateBlue' },
    Туризм: { 0.4: 'RoyalBlue', 0.65: 'RoyalBlue', 1: 'RoyalBlue' },
};

// Переменные для слоев
let heatLayers = {};
let markerLayers = {};
let allMarkersLayer = null;
let recommendationLayer = L.layerGroup();

//Переменные для флагов
let flagClick = false;
let isHeatmapActive = false;
var flag;

/*
    ! Основная логика генерации точек !
*/

fetch(apiUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        objects = data;
        recommendationsArray = data;
        objects = data;
        const markers = data.map(obj => {
            delete obj.$id;

            const marker = L.circleMarker([obj.x, obj.y], {
                radius: 10,
                color: '#3388ff',
                fillColor: '#3388ff',
                fillOpacity: 0.5,
            });

            markersMap.set(obj.id, marker);

            marker.on('click', async () => {
                let popupContent = `
          <div class="popup-content">
            <div class="comment-header">
                <div class="comment-rating" id="rate-${obj.id}">
                    ${generateStars(obj.id, obj.rating)}
                </div>
            </div>`;

                if (typeof userId !== 'undefined' && userId !== null) {
                    const isFavorite = await checkIfFavorite(obj.id, userId);
                    const heartClass = isFavorite ? 'heart-filled' : 'heart-outline';
                    popupContent += `
            <span class="heart-icon ${heartClass}" onclick="toggleFavorite(${obj.id}, ${userId}, this)"></span>`;
                }

                popupContent += `
            <strong>${obj.display_name}</strong><br>
            ${obj.type}<br>
            <div class="buttons"><button onclick="showDetails(${obj.id})">Подробнее</button></div>
          </div>
        `;

                marker.bindPopup(popupContent).openPopup();
            });

            return marker;
        });

        allMarkersLayer = L.layerGroup(markers).addTo(map);
    })
    .catch(error => {
        console.error('Ошибка загрузки данных из API:', error);
    });

map.on('zoomend', () => {
    if (isHeatmapActive) {
        const currentCategory = document.currentCategory;
        updateHeatmap(currentCategory);
    }
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

/*
    ! Обработчики событий !
*/

document.addEventListener("DOMContentLoaded", () => {
    const leafletBottomRight = document.querySelector('.leaflet-bottom.leaflet-right');
    if (leafletBottomRight) leafletBottomRight.remove();
});

// Поиск объектов по названию и адресу
document.getElementById("load-comments-of-search").addEventListener("click", function (event) {
    event.preventDefault();
    const query = document.getElementById("search").value.trim();
    performSearch(query);
});

// Чтобы не мешалось меню
document.addEventListener('click', function (event) {
    const menu = document.querySelector('.slide-menu');
    const menuIcon = document.querySelector('.menu-icon');

    if (!menu) return;

    if (!menu.contains(event.target) && !menuIcon.contains(event.target)) {
        if (menu.style.display === 'block') {
            closeMenu();
        }
    }
});

// Для прокладки маршрута
document.addEventListener("DOMContentLoaded", () => {
    const resultsContainer = document.getElementById("search-results");

    if (resultsContainer) {
        resultsContainer.addEventListener("click", function (event) {
            const button = event.target.closest("button.test");
            if (button) {
                const objectId = button.getAttribute("data-id");
                console.log("Нажата кнопка с ID:", objectId);
            }
        });
    }
});

searchInput.addEventListener('input', function () {
    const query = this.value.trim();
    searchResultsContainer.innerHTML = '';
    if (!query) return;

    const results = searchObjects(query);

    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<p>Ничего не найдено</p>';
        return;
    }

    results.forEach(result => {
        const item = document.createElement('div');
        item.classList.add('search-result');
        item.textContent = `${result.display_name} (${result.adress})`;

        item.addEventListener('click', () => {
            searchInput.value = result.display_name;
            searchResultsContainer.innerHTML = '';
            performSearch(result.display_name);
        });

        searchResultsContainer.appendChild(item);
    });
});

// Загрузка комментариев по объекту
document.addEventListener('click', event => {
    if (event.target.classList.contains('show-comments-button')) {
        const button = event.target;
        const idObj = button.getAttribute('data-id');
        const container = document.getElementById('comments-container');
        const containerComment = document.getElementById('commentForm');
        containerComment.innerHTML = '';

        if (button.innerText === 'Показать комментарии') {
            axios.get(`/api/comment/GetCommentsByMapObject/${idObj}`)
                .then(response => {
                    container.innerHTML = '';
                    const comments = response.data;
                    if (comments.length === 0) {
                        container.innerHTML = "<p>Комментариев пока нет...</p>";
                        return;
                    }

                    comments.forEach(comment => {
                        container.innerHTML += `
                            <div class="comment" id="comment-${comment.id}">
                                <div class="comment-header">
                                    <p class="comment-date">Дата добавления: ${formatDate(comment.date)}</p>
                                    <p class="comment-user"><strong>${comment.user.name}</strong></p>
                                    <div class="comment-rating" id="rate-${comment.id}">
                                        ${generateStars(comment.id, comment.rate)}
                                    </div>
                                </div>
                                <label for="text-${comment.id}">Текст:</label>
                                <p>${comment.text}</p>
                            </div>
                        `;
                    });

                    button.innerText = 'Скрыть комментарии';
                })
                .catch(error => {
                    console.error(error);
                });
        } else {
            container.innerHTML = '';
            button.innerText = 'Показать комментарии';
        }
    }
});

// Обновление рейтинга
async function updateAllRatingsForObject(objectId) {
    try {
        const response = await fetch(`/api/SocialMapObject/GetSocialMapObjectById/${objectId}`);
        if (!response.ok) {
            throw new Error(`Ошибка при получении обновленного объекта: ${response.status}`);
        }

        const updatedObject = await response.json();
        const newRating = updatedObject.rating;
        const ratingElements = document.querySelectorAll(`#rate-${objectId}`);
        ratingElements.forEach(el => {
            el.innerHTML = generateStars(objectId, newRating);
        });

        const index = objects.findIndex(o => o.id === objectId);
        if (index !== -1) {
            objects[index].rating = newRating;
        }

    } catch (error) {
        console.error("Ошибка при обновлении рейтингов:", error);
    }
}

// Написать комментарий
document.addEventListener('click', async event => {
    if (event.target.classList.contains('write-comments-button')) {
        const button = event.target;
        const idObj = button.getAttribute('data-id');
        const container = document.getElementById('commentForm');
        const containerComments = document.getElementById('comments-container');
        containerComments.innerHTML = '';
        container.innerHTML = '';

        const button2 = document.querySelector('.show-comments-button');
        if (button2 && button2.innerText === 'Скрыть комментарии') {
            button2.innerText = 'Показать комментарии';
        }

        let commentText = '';
        let rate = 0;
        let isExistingComment = false;
        let commentId = null;
        const uniqueId = `new-${Date.now()}`;

        try {
            const response = await axios.get(`/api/comment/GetCommentsByMapObject?mapObjectId=${idObj}&userId=${userId}`);

            if (response.status === 200 && response.data) {
                const comment = response.data;
                commentText = comment.text;
                rate = comment.rate;
                commentId = comment.id;
                isExistingComment = true;
            }
        } catch (error) {
            console.warn('Комментарий отсутствует или ошибка при загрузке:', error);
        }

        const newCommentHTML = `
        <div class="comment" id="comment-${uniqueId}">
            <div class="comment-header">
                <div class="comment-rating" id="rate-${uniqueId}">
                    ${generateStars(uniqueId, rate)}
                </div>
            </div>
            <label for="text-${uniqueId}">Текст:</label>
            <textarea id="text-${uniqueId}" placeholder="Введите ваш комментарий...">${commentText}</textarea>
            <input type="hidden" id="rate-hidden-${uniqueId}" value="${rate}">
            <div class="buttons"><button class="submitNewComment" data-unique-id="${uniqueId}" data-id="${idObj}" data-comment-id="${commentId || ''}">
                ${isExistingComment ? 'Обновить' : 'Отправить'}
            </button></div>
        </div>
        `;

        container.innerHTML = newCommentHTML;
        const newCommentContainer = document.getElementById(`comment-${uniqueId}`);
        initializeStarRatingEvents(newCommentContainer);
    }

    if (event.target.classList.contains('submitNewComment')) {
        event.preventDefault();

        const button = event.target;
        const uniqueId = button.getAttribute('data-unique-id');
        const mapObjectId = button.getAttribute('data-id');
        const commentId = button.getAttribute('data-comment-id');

        const commentText = document.getElementById(`text-${uniqueId}`).value;
        const rate = document.getElementById(`rate-hidden-${uniqueId}`).value;

        if (!commentText || rate === "0") {
            alert('Пожалуйста, заполните текст комментария и выберите рейтинг!');
            return;
        }

        const data = {
            NewText: commentText,
            NewRate: rate,
        };

        if (commentId) {
            axios.put(`/api/comment/EditComment/${commentId}`, data)
                .then(response => {
                    alert('Комментарий успешно обновлен!');
                    button.innerText = 'Обновить';
                    console.log(response.data);
                })
                .catch(error => {
                    alert('Ошибка при обновлении комментария!');
                    console.error(error);
                });
            setTimeout(() => {
                updateAllRatingsForObject(Number(mapObjectId));
            }, 300);
        } else {
            sendComment(userId, mapObjectId, commentText, rate)
                .then(() => {
                    button.innerText = 'Обновить';
                    setTimeout(() => {
                        updateAllRatingsForObject(Number(mapObjectId));
                    }, 300);
                });
        }
    }
});

// Подгрузка элементов доступной среды из онтологии 
document.addEventListener("DOMContentLoaded", function () {
    fetch('/api/SocialMapObject/get/accessibility')
        .then(response => response.json())
        .then(data => {

            const items = Array.isArray(data) ? data : data;

            if (Array.isArray(items)) {
                const container = document.getElementById('accessibilityContainer');
                items.forEach(item => {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.name = 'accessibility';
                    item_ = item.replace(/ /g, '_');
                    checkbox.value = '<http://www.semanticweb.org/алексей/ontologies/2023/8/untitled-ontology-44#' + item_ + '>';

                    const label = document.createElement('label');
                    label.textContent = item;
                    label.prepend(checkbox);

                    container.appendChild(label);
                    container.appendChild(document.createElement('br'));
                });
            } else {
                console.error("Получен не массив данных для элементов доступной среды:", data);
            }
        })
        .catch(error => console.error("Ошибка при загрузке элементов доступной среды:", error));
});

// Переключатель для очагов категорий
document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.categoriesButton');
    Object.values(heatLayers).forEach(layer => map.removeLayer(layer));
    Object.values(markerLayers).forEach(layer => map.removeLayer(layer));
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const category = button.value;
            const activeButton = document.querySelector('.categoriesButton.active');

            if (activeButton === button) {
                buttons.forEach(btn => btn.classList.remove('active'));
                Object.values(heatLayers).forEach(layer => map.removeLayer(layer));
                Object.values(markerLayers).forEach(layer => map.removeLayer(layer));
            }

            else {
                if (activeButton) {
                    activeButton.classList.remove('active');
                }

                Object.values(heatLayers).forEach(layer => map.removeLayer(layer));
                Object.values(markerLayers).forEach(layer => map.removeLayer(layer));
                createLayersAndDisplay(recommendationsArray, category);

                buttons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            }
        });
    });
});


/*
    ! Основные функции для взаимодействия с меню !
*/

// Открыть меню
function openMenu() {
    const menu = document.querySelector(".slide-menu");
    menu.style.display = "block";
    setTimeout(() => {
        menu.classList.add("active");
    }, 10);
}

// Закрыть меню
function closeMenu() {
    const menu = document.querySelector(".slide-menu");
    menu.classList.remove("active");
    setTimeout(() => {
        menu.style.display = "none";
    }, 400);
}

// Переключатель пунктов меню
function showBlock(blockId) {
    const categoryContainer = document.getElementById('categoriesButton');
    categoryContainer.style.display = 'none';

    disableHeatmap();

    const blocks = document.querySelectorAll('.toolbar-content');
    blocks.forEach(block => block.classList.add('hidden'));

    const selectedBlock = document.getElementById(blockId);
    if (selectedBlock) {
        selectedBlock.classList.remove('hidden');
    }

    const buttons = document.querySelectorAll('.categoriesButton');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (blockId == "toolbar-content") {
        if (control) {
            map.removeControl(control);
        }
        switchLayer('allMarkers');
        closeFilter();
    }
    if (blockId == "toolbar-content-2") {
        if (control) {
            map.removeControl(control);
        }
        switchLayer('allMarkers');
        closeFilter();
    }
    if (blockId == "toolbar-content-3") {
        if (control) {
            map.removeControl(control);
        }
        fetchRecommendationsByUserId();
        switchLayer('recommendations');
        const button = document.querySelector("#filterButton");
        button.textContent = "Применить фильтр";
        document.querySelectorAll('input[name="categories"]:checked, input[name="accessibility"]:checked')
            .forEach(el => el.checked = false);
    }

    if (blockId == "toolbar-content-4") {
        if (control) {
            map.removeControl(control);
        }
        fetchPopularRecommendations();
        switchLayer('recommendations');
        const button = document.querySelector("#filterButton");
        button.textContent = "Применить фильтр";
        document.querySelectorAll('input[name="categories"]:checked, input[name="accessibility"]:checked')
            .forEach(el => el.checked = false);
    }

    if (blockId == "toolbar-content-5") {
        if (control) {
            map.removeControl(control);
        }
        fetchLikes();
        switchLayer('recommendations');
        closeFilter();
    }

    closeMenu();
}

// Функция, осуществляющая переход на карте по клику
async function focusOnMap(objectId) {
    const marker = markersMap.get(Number(objectId));
    const foundObject = objects.find(obj => obj.id === objectId);

    if (!foundObject || !marker) {
        console.error('Объект или маркер не найден:', objectId);
        return;
    }

    const { lat, lng } = marker.getLatLng();
    map.setView([lat, lng], 19);

    if (!marker.getPopup()) {
        let popupContent = `
            <div class="popup-content">
                <div class="comment-header">
                    <div class="comment-rating" id="rate-${foundObject.id}">
                        ${generateStars(foundObject.id, foundObject.rating)}
                    </div>
                </div>`;

        if (typeof userId !== 'undefined' && userId !== null) {
            try {
                const isFavorite = await checkIfFavorite(foundObject.id, userId);
                const heartClass = isFavorite ? 'heart-filled' : 'heart-outline';
                popupContent += `
                    <span class="heart-icon ${heartClass}" onclick="toggleFavorite(${foundObject.id}, ${userId}, this)"></span>`;
            } catch (error) {
                console.error('Ошибка при проверке статуса фаворита:', error);
            }
        }

        popupContent += `
                <h3>${foundObject.display_name}</h3>
                <p>${foundObject.adress}</p>
                <div class="buttons"><button onclick="showDetails(${objectId})">Подробнее</button></div>
            </div>`;

        marker.bindPopup(popupContent);
    }

    try {
        marker.openPopup();
    } catch (error) {
        console.error('Ошибка при открытии окна:', error);
    }
}

// Поиск объектов
async function performSearch(query) {
    const resultsContainer = document.getElementById("search-results");
    if (!query) {
        resultsContainer.innerHTML = "<p>Введите текст для поиска.</p>";
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
            resultsContainer.innerHTML = "<p>Объекты не найдены.</p>";
            return;
        }
        resultsContainer.innerHTML = data
            .map(obj => ` <div class="comment" onclick="focusOnMap(${obj.id})">
                <h3>${obj.display_name}</h3>
                <p>${obj.type}</p>
                <p>${obj.adress}</p>
                <div class="buttons"><button class="buildRouteToObject" data-id="${obj.id}" data-x="${obj.x}" data-y="${obj.y}">Маршрут до точки</button></div>
		</div>`)
            .join("");

    } catch (error) {
        console.error(error);
        resultsContainer.innerHTML = "<p>Произошла ошибка. Попробуйте позже.</p>";
    }
}



/*
    ! Основные функции для взаимодействия с всплывающими панелями (Детали/Фильтры) !
*/

// Открыть детали
async function showDetails(id) {
    let categoriesInfo = '<p><strong>Данные о доступности:</strong> ';
    let accessibilityElementsInfo = '<p><strong>Элементы доступной среды:</strong> ';

    try {
        const response = await fetch(`/api/SocialMapObject/GetSocialMapObjectById/${id}`);
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        const object = await response.json();

        const ontologyResponse = await fetch('/client/getOntologyInfo', {
            method: 'POST',
            body: new URLSearchParams({ iri: object.iri }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const data = await ontologyResponse.json();

        const categories = data.categories || [];
        if (categories.length > 0) {
            categories.forEach(category => {
                const categoryLetter = category.split('^^')[0];
                const categoryDescription = categoryUser[categoryLetter];
                categoriesInfo += categoryDescription + ', ';
            });
            categoriesInfo = categoriesInfo.slice(0, -2);
        } else {
            categoriesInfo += 'нет информации';
        }

        categoriesInfo += '</p>';

        const accessibilityElements = data.accessibilityElements || [];
        if (accessibilityElements.length > 0) {
            accessibilityElementsInfo += accessibilityElements.join(', ');
        } else {
            accessibilityElementsInfo += 'нет информации';
        }
        accessibilityElementsInfo += '</p>';

        const detailsContent = document.getElementById("details-content");


        let imageContent = '';

        if (object.images !== "Нет изображения") {
            console.log("изображение");
            imageContent = `
                <div id="image-container" style="display: block; text-align: center;">
                    <img src="${object.images}" alt="Изображение" style="max-width: 200px; height: auto;" />
                </div>
            `;
        } else {
            console.log("нет изображение");
            imageContent = `
                <div id="image-container" style=" display: block;  text-align: center;">
                    Нет изображения
                </div>
            `;
        }

        const isUserLoggedIn = typeof userId !== 'undefined' && userId !== null;

        detailsContent.innerHTML = `
            ${imageContent}
            <div class="comment-rating" id="rate-${object.id}">
                ${generateStars(object.id, object.rating)}
            </div>
            <h3>${object.display_name}</h3>
            <p>${object.type}</p>
            <p>${object.adress}</p>
            <p>${object.description}</p>
            <p>${object.workingHours}</p>
            <br>
            ${categoriesInfo}
            ${accessibilityElementsInfo}
            <div class="buttons">
                ${isUserLoggedIn ?
                `<button class="write-comments-button" data-id="${object.id}">Оставить комментарий</button>` :
                ''
            }
                <button class="show-comments-button" data-id="${object.id}">Показать комментарии</button>
            </div>
            <div id="commentForm"></div>
            <div id="loading-spinner" style="display: none;">
                <div class="spinner"></div>
                <p>Отправка комментария...</p>
            </div>
            <div id="comments-container"></div>
        `;


        const detailsContainer = document.getElementById("details-container");
        detailsContainer.classList.remove("hidden");
        detailsContainer.classList.add("show");

    } catch (error) {
        console.error("Ошибка получения данных объекта:", error);
    }
}

// Закрыть контейнер для деталей
function closeDetails() {
    const detailsContainer = document.getElementById("details-container");
    detailsContainer.classList.add("hidden");
    detailsContainer.classList.remove("show");
}

// Переключатель видимости блока для фильтров
function toggleFilter() {
    const filterContainer = document.getElementById('toolbar-filter');
    filterContainer.classList.toggle('hidden');
}

// Закрыть блок для фильтров
function closeFilter() {
    const filterContainer = document.getElementById('toolbar-filter');
    filterContainer.classList.add('hidden');
}


/*
    ! Функции, связанные с рейтингом !
*/

// Функция для генерации звезд
function generateStars(commentId, currentRating) {
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
        const activeClass = i <= currentRating ? 'active-star' : '';
        starsHTML += `
            <span class="star ${activeClass}" data-rating="${i}" data-comment-id="${commentId}">
                ★
            </span>
        `;
    }
    return starsHTML;
}

// Обработчики событий для рейтинга
function initializeStarRatingEvents(container) {
    container.querySelectorAll('.star').forEach(star => {

        star.addEventListener('click', function () {
            const rating = parseInt(this.getAttribute('data-rating'));
            const commentId = this.getAttribute('data-comment-id');
            setRating(commentId, rating);
        });

        star.addEventListener('mouseover', function () {
            const rating = parseInt(this.getAttribute('data-rating'));
            const commentId = this.getAttribute('data-comment-id');
            highlightStars(commentId, rating);
        });

        star.addEventListener('mouseout', function () {
            const commentId = this.getAttribute('data-comment-id');
            const savedRating = parseInt(document.getElementById(`rate-hidden-${commentId}`).value) || 0;
            highlightStars(commentId, savedRating);
        });
    });
}

// Установка рейтинга
function setRating(commentId, rating) {
    const hiddenInput = document.getElementById(`rate-hidden-${commentId}`);
    hiddenInput.value = rating;
    highlightStars(commentId, rating);
}

// Функция для подсветки звезд
function highlightStars(commentId, rating) {
    document.querySelectorAll(`#rate-${commentId} .star`).forEach(star => {
        const starRating = parseInt(star.getAttribute('data-rating'));
        star.style.color = starRating <= rating ? '#f0c808' : '#ccc';
    });
}


/*
    ! Функции, связанные с рекомендациями !
*/

// Загрузка рекомендаций для всех пользователей
function fetchPopularRecommendations() {
    const categoryContainer = document.getElementById('categoriesButton');
    axios.get(`/api/recommendation/GetPopularRecommendations`)
        .then(response => {
            const recommendations = response.data.map(rec => {
                return Object.fromEntries(
                    Object.entries(rec).filter(([key]) => !key.startsWith('$'))
                );
            });

            recommendationsArray = recommendations.map((rec, index) => ({
                id: rec.id !== undefined ? rec.id : `${index}`,
                mapObject: rec,
                distance: rec.distance || 0
            }));
            current = recommendationsArray;
            switchLayer('recommendations');
            updateRecommendationLayer(recommendationsArray);
            recommendationLayer.addTo(map);
            flag = false;
            const container = document.getElementById('recommendations-container-pop');
            container.innerHTML = '';

            if (Array.isArray(recommendationsArray) && recommendationsArray.length > 0) {
                recommendationsArray.forEach(rec => {
                    container.innerHTML += `
                        <div class="comment" onclick="focusOnMap(${rec.mapObject.id})">
                          <h3>${rec.mapObject.display_name}</h3>
                          <p>Категория: ${rec.mapObject.type}</p>
                          <p>Адрес: ${rec.mapObject.adress}</p>
                       </div>
                    `;
                });
                if (permission)
                    categoryContainer.style.display = 'flex';
            } else {
                container.innerHTML = '<p>Нет доступных рекомендаций.</p>';
            }
        })

        .catch(error => {
            console.error(error);
            const container = document.getElementById('recommendations-container-pop');
            container.innerHTML = '';
            container.innerHTML += '<p>Нет доступных рекомендаций.</p>';
        });
}

// Загрузка рекомендаций по конкретному пользователю
function fetchRecommendationsByUserId() {
    const categoryContainer = document.getElementById('categoriesButton');
    const block = document.getElementById('toolbar-content-3');
    if (typeof userId === 'undefined' || userId === null) {

        block.innerHTML = '';
        block.innerHTML = '<p>Доступно только для зарегистрированных пользователей!</p>';
        const buttons = document.createElement('div');
        buttons.classList.add('buttons');

        const button = document.createElement('button');
        button.textContent = 'Войти';
        button.onclick = function (e) {
            e.preventDefault();
            window.location.replace('/clientapp/authorization.html');
        };

        buttons.appendChild(button);
        block.appendChild(buttons);
        return;
    }
    axios.get(`/api/recommendation/GetRecommendationsByUserId/${userId}`)
        .then(response => {
            const recommendations = response.data.map(rec => {
                return Object.fromEntries(
                    Object.entries(rec).filter(([key]) => !key.startsWith('$'))
                );
            });

            recommendationsArray = recommendations.map((rec, index) => ({
                id: rec.id !== undefined ? rec.id : `${index}`,
                mapObject: rec,
                distance: rec.distance || 0
            }));
            current = recommendationsArray;
            switchLayer('recommendations');
            updateRecommendationLayer(recommendationsArray);
            recommendationLayer.addTo(map);
            flag = true;
            const container = document.getElementById('recommendations-container');
            container.innerHTML = '';

            if (Array.isArray(recommendationsArray) && recommendationsArray.length > 0) {
                recommendationsArray.forEach(rec => {
                    container.innerHTML += `
                        <div class="comment" onclick="focusOnMap(${rec.mapObject.id})">
                          <h3>${rec.mapObject.display_name}</h3>
                          <p>Категория: ${rec.mapObject.type}</p>
                          <p>Адрес: ${rec.mapObject.adress}</p>
                          <div class="buttons">
                            <button onclick="removeRecommendation(${rec.mapObject.id}, ${userId})">Не рекомендовать</button>
                          </div>
                       </div>`;
                });
                if (permission)
                    categoryContainer.style.display = 'flex';
            } else {
                container.innerHTML += '<p>Нет доступных рекомендаций.</p>';
            }
        })
        .catch(error => {
            console.error(error);
            const container = document.getElementById('recommendations-container');
            container.innerHTML = '';
            container.innerHTML += '<p>Нет доступных рекомендаций.</p>';
        });
}

// Удаление рекомендации из списка
function removeRecommendation(mapObjectId, userId) {
    axios.delete(`/api/recommendation/RemoveRecommendation/${mapObjectId}/${userId}`)
        .then(() => fetchRecommendationsByUserId())
        .catch(error => console.error(error));
}

// Загрузка отфильтрованных рекомендаций
function fetchRecommendationsFiltering(event) {
    let user = userId;

    const button = document.querySelector("#filterButton");
    const isFiltering = (button.textContent.trim() === "Применить фильтр");

    const container = document.getElementById(
        flag ? 'recommendations-container' : 'recommendations-container-pop'
    );

    if (typeof user === 'undefined' || user === null)
        user = 1;

    if (isFiltering) {
        button.textContent = "Сбросить";
        switchLayer('recommendations');
        const selectedCategories = [];
        document.querySelectorAll('input[name="categories"]:checked').forEach(el => {
            selectedCategories.push(el.value);
        });

        const selectedAccessibility = [];
        document.querySelectorAll('input[name="accessibility"]:checked').forEach(el => {
            selectedAccessibility.push(el.value);
        });

        function buildQueryString(params) {
            const esc = encodeURIComponent;
            return Object.keys(params)
                .map(k => {
                    const val = params[k];
                    if (Array.isArray(val)) {
                        return val.map(v => `${esc(k)}=${esc(v)}`).join('&');
                    }
                    return `${esc(k)}=${esc(val)}`;
                })
                .join('&');
        }
        const filterOptions = {
            user,
            Categories: selectedCategories,
            AccessibilityElements: selectedAccessibility
        };

        const queryString = buildQueryString(filterOptions);
        const API = flag
            ? `/api/recommendation/GetFilteringIntersectedData?${queryString}`
            : `/api/recommendation/GetFilteringPopularData?${queryString}`;

        sendRequestWithFilter(API, filterOptions, container);
    }

    else {
        button.textContent = "Применить фильтр";

        document.querySelectorAll('input[name="categories"]:checked, input[name="accessibility"]:checked')
            .forEach(el => el.checked = false);

        container.innerHTML = '';
        current = recommendationsArray;
        loadRecommendations(current, container);

        switchLayer('recommendations');
        updateRecommendationLayer(current);
        recommendationLayer.addTo(map);
    }
    user = userId;
}

function loadRecommendations(recommendations, container) {
    container.innerHTML = '';

    if (!recommendations || recommendations.length === 0) {
        container.innerHTML = '<p>Нет доступных рекомендаций.</p>';
        return;
    }

    recommendations.forEach(rec => {
        const comment = document.createElement('div');
        comment.classList.add('comment');
        comment.setAttribute('onclick', `focusOnMap(${rec.mapObject.id})`);

        const title = document.createElement('h3');
        title.textContent = rec.mapObject.display_name;

        const category = document.createElement('p');
        category.textContent = `Категория: ${rec.mapObject.type}`;

        const address = document.createElement('p');
        address.textContent = `Адрес: ${rec.mapObject.adress}`;

        comment.appendChild(title);
        comment.appendChild(category);
        comment.appendChild(address);

        if (flag) {
            const buttons = document.createElement('div');
            buttons.classList.add('buttons');

            const removeButton = document.createElement('button');
            removeButton.textContent = 'Не рекомендовать';
            removeButton.setAttribute('onclick', `removeRecommendation(${rec.mapObject.id}, ${userId})`);

            buttons.appendChild(removeButton);
            comment.appendChild(buttons);
        }

        container.appendChild(comment);
    });
}

function sendRequestWithFilter(API, filterOptions, container) {
    axios.get(API, {
        params: filterOptions,
        paramsSerializer: params => {
            const queryString = Object.entries(params)
                .map(([key, value]) => {
                    if (Array.isArray(value)) {
                        return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
                    }
                    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
                })
                .join('&');
            return queryString;
        }
    })
        .then(response => {
            const recommendations = response.data.map((rec, index) => ({
                id: rec.mapObject?.id !== undefined ? rec.mapObject.id : `${index}`,
                mapObject: rec.mapObject,
                distance: rec.distance || 0
            }));

            current = recommendations;
            container.innerHTML = '';

            switchLayer('recommendations');
            updateRecommendationLayer(current);
            recommendationLayer.addTo(map);

            if (Array.isArray(recommendations) && recommendations.length > 0) {
                recommendations.forEach(rec => {
                    const comment = document.createElement('div');
                    comment.classList.add('comment');
                    comment.setAttribute('onclick', `focusOnMap(${rec.mapObject.id})`);

                    const title = document.createElement('h3');
                    title.textContent = rec.mapObject.display_name;

                    const category = document.createElement('p');
                    category.textContent = `Категория: ${rec.mapObject.type}`;

                    const address = document.createElement('p');
                    address.textContent = `Адрес: ${rec.mapObject.adress}`;

                    comment.appendChild(title);
                    comment.appendChild(category);
                    comment.appendChild(address);

                    if (flag) {
                        const buttons = document.createElement('div');
                        buttons.classList.add('buttons');

                        const removeButton = document.createElement('button');
                        removeButton.textContent = 'Не рекомендовать';
                        removeButton.setAttribute('onclick', `removeRecommendation(${rec.mapObject.id}, ${userId})`);

                        buttons.appendChild(removeButton);
                        comment.appendChild(buttons);
                    }

                    container.appendChild(comment);
                });
            } else {
                container.innerHTML = '<p>Нет доступных рекомендаций по выбранным фильтрам.</p>';
            }
        })
        .catch(error => {
            console.error(error);
            container.innerHTML = '<p>Произошла ошибка при загрузке фильтрованных рекомендаций.</p>';
        });
}

// Загрузка отсортированных по удаленности рекомендаций
async function sortRecommendationsByDistance() {
    try {
        const userLocation = await getUserLocation();
        const response = await fetch(`/api/recommendation/SortRecommendations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Recommendations: current,
                UserLatitude: userLocation.latitude,
                UserLongitude: userLocation.longitude
            })
        });
        const sortedRecommendations = await response.json();
        renderRecommendations(sortedRecommendations);
    } catch (error) {
        console.error(error);
        document.getElementById('recommendations-container').innerHTML = '<p>Произошла ошибка при сортировке рекомендаций.</p>';
    }
}

// Сортировка рекомендаций
function renderRecommendations(recommendations) {
    var container;
    if (flag) {
        container = document.getElementById('recommendations-container');
    } else {
        container = document.getElementById('recommendations-container-pop');
    }
    container.innerHTML = '';

    if (recommendations.length > 0) {
        recommendations.forEach(rec => {
            const comment = document.createElement('div');
            comment.classList.add('comment');
            comment.setAttribute('onclick', `focusOnMap(${rec.mapObject.id})`);

            comment.innerHTML = `
                <h3>${rec.mapObject.display_name}</h3>
                <p>Категория: ${rec.mapObject.type}</p>
                <p>Адрес: ${rec.mapObject.adress}</p>
                <p>От Вас находится на расстоянии: ${rec.distance ? rec.distance.toFixed(2) + ' км' : 'Неизвестно'}</p>
            `;

            if (flag) {
                const buttons = document.createElement('div');
                buttons.classList.add('buttons');
                buttons.innerHTML = `
                    <button onclick="removeRecommendation(${rec.mapObject.id}, ${userId})">Не рекомендовать</button>
                `;
                comment.appendChild(buttons);
            }

            container.appendChild(comment);
        });
    } else {
        container.innerHTML = '<p>Нет доступных рекомендаций по выбранным фильтрам.</p>';
    }
}

// Обновление слоя с заданными объектами
async function updateRecommendationLayer(recommendationsArray) {
    for (const recM of recommendationsArray) {
        const rec = recM.mapObject;

        if (typeof userId === 'undefined' || userId === null) {
            const marker = L.circleMarker([rec.x, rec.y], {
                radius: 8,
                color: '#3388ff',
                fillColor: '#3388ff',
                fillOpacity: 0.7
            });
            markersMap.set(rec.id, marker);
            marker.bindPopup(`
              <div class="popup-content">
                <div class="comment-header">
                    <div class="comment-rating" id="rate-${rec.id}">
                        ${generateStars(rec.id, rec.rating)}
                    </div>
                </div>
                <strong>${rec.display_name}</strong><br>
                ${rec.type}<br>
                ${rec.adress || "Адрес не указан"}<br>
                <div class="buttons">
                  <button onclick="showDetails(${rec.id})">Подробнее</button>
                </div>
              </div>
            `);

            recommendationLayer.addLayer(marker);
        }
        else {
            const isFavorite = await checkIfFavorite(rec.id, userId);
            const heartClass = isFavorite ? 'heart-filled' : 'heart-outline';

            const marker = L.circleMarker([rec.x, rec.y], {
                radius: 8,
                color: '#3388ff',
                fillColor: '#3388ff',
                fillOpacity: 0.7
            });
            markersMap.set(rec.id, marker);

            marker.bindPopup(`
              <div class="popup-content">
                <div class="comment-header">
                    <div class="comment-rating" id="rate-${rec.id}">
                        ${generateStars(rec.id, rec.rating)}
                    </div>
                </div>
                <span class="heart-icon ${heartClass}" onclick="toggleFavorite(${rec.id}, ${userId}, this)"></span>
                <strong>${rec.display_name}</strong><br>
                ${rec.type}<br>
                ${rec.adress || "Адрес не указан"}<br>
                <div class="buttons">
                  <button onclick="showDetails(${rec.id})">Подробнее</button>
                </div>
              </div>
            `);

            recommendationLayer.addLayer(marker);
        }
    }
}

/*
    ! Функции, связанные с комментариями !
*/

// Функция для отправки комментария на сервер
async function sendComment(userId, mapObjectId, newText, newRate) {
    const loadingSpinner = document.getElementById('loading-spinner');
    loadingSpinner.style.display = 'flex';

    const data = {
        User: userId,
        MapObject: mapObjectId,
        NewText: newText,
        NewRate: newRate
    };

    try {
        const response = await fetch('/api/comment/AddComment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.status === 409) {
            try {
                const getComment = await axios.get(`/api/comment/GetCommentsByMapObject?mapObjectId=${mapObjectId}&userId=${userId}`);

                if (getComment.status === 200 && getComment.data) {
                    const commentId = getComment.data.id;

                    const updateData = {
                        NewText: newText,
                        NewRate: newRate
                    };

                    await axios.put(`/api/comment/EditComment/${commentId}`, updateData);

                    alert('Комментарий успешно обновлён!');
                    return true;
                } else {
                    throw new Error('Не удалось получить существующий комментарий для обновления.');
                }
            } catch (error) {
                console.error('Ошибка при обновлении существующего комментария:', error);
                alert('Не удалось обновить комментарий. Попробуйте позже.');
                return false;
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка при добавлении комментария: ${errorText}`);
        }

        alert('Комментарий успешно добавлен!');
        return await response.json();
    } catch (error) {
        console.error('Ошибка при добавлении комментария:', error);
        alert('Не удалось добавить комментарий. Попробуйте позже.');
    } finally {
        loadingSpinner.style.display = 'none';
    }
}


/*
    ! Функции для отображения очагов !
*/

// Создание слоев и отображение
async function createLayersAndDisplay(data, category) {
    heatLayers = {};
    markerLayers = {};

    for (const cat of Object.keys(categoryMap)) {
        const types = categoryMap[cat];

        const array = [];
        recommendationsArray.forEach(el => array.push(el.mapObject));

        const filteredPoints = array.filter(item => types.includes(item.type));

        const heatPoints = filteredPoints.map(item => [item.x, item.y, 1]);

        heatLayers[cat] = L.heatLayer(heatPoints, {
            radius: 30,
            blur: 35,
            gradient: categoryGradients[cat],
            maxZoom: 12,
            minOpacity: 0.3,
            opacity: 0.5,
        });

        const markers = [];
        for (const item of filteredPoints) {
            const isFavorite = await checkIfFavorite(item.id, 1);
            const heartClass = isFavorite ? 'heart-filled' : 'heart-outline';

            const marker = L.circleMarker([item.x, item.y], {
                radius: 8,
                color: categoryGradients[cat][1],
                fillColor: categoryGradients[cat][1],
                fillOpacity: 0.7,
            });

            marker.bindPopup(`
          <div class="popup-content">
            <div class="comment-header">
                <div class="comment-rating" id="rate-${item.id}">
                    ${generateStars(item.id, item.rating)}
                </div>
            </div>
            <span class="heart-icon ${heartClass}" onclick="toggleFavorite(${item.id}, ${userId}, this)"></span>
            <strong>${item.display_name}</strong><br>
            ${item.type}<br>
            ${item.adress || "Адрес не указан"}<br>
            <div class="buttons">
              <button onclick="showDetails(${item.id})">Подробнее</button>
            </div>
          </div>
        `);

            markers.push(marker);
        }

        markerLayers[cat] = L.layerGroup(markers);
    }

    setCategory(category);
}

// Функция переключения между слоями в зуме
function updateHeatmap(category) {
    isHeatmapActive = true;
    markerLayers[category]?.addTo(map);

    if (map.getZoom() > 15) {
    }
    else {
        heatLayers[category]?.addTo(map);
    }
}

// Выбор категории
function setCategory(category) {
    document.currentCategory = category;
    updateHeatmap(category);
}

// Отключение тепловой карты
function disableHeatmap() {
    isHeatmapActive = false;
    Object.values(heatLayers).forEach(layer => map.removeLayer(layer));
    map.addLayer(allMarkersLayer);
}

// Переключатель для слоев
function switchLayer(layerKey) {
    if (allMarkersLayer)
        map.removeLayer(allMarkersLayer);

    recommendationLayer.clearLayers();
    Object.values(heatLayers).forEach(layer => map.removeLayer(layer));
    Object.values(markerLayers).forEach(layer => map.removeLayer(layer));

    switch (layerKey) {
        case 'allMarkers':
            if (allMarkersLayer) map.addLayer(allMarkersLayer);
            break;

        case 'recommendations':
            recommendationLayer.addTo(map);
            break;

        case 'heatmap':
            const currentCategory = document.currentCategory;
            if (heatLayers[currentCategory]) heatLayers[currentCategory].addTo(map);
            break;

        case 'categoryMarkers':
            const category = document.currentCategory;
            if (markerLayers[category]) markerLayers[category].addTo(map);
            break;

        default:
            console.error('Неизвестный слой:', layerKey);
            break;
    }
}


/*
    ! Функции, связанные с избранными объектами !
*/

// Проверка объекта находится ли он в Избранном
async function checkIfFavorite(mapObjectId, userId) {
    try {
        const response = await fetch(`/api/users/GetLikesByUserId/${userId}`);
        if (!response.ok) return false;

        const favorites = await response.json();
        return favorites.some(obj => obj.id === mapObjectId);
    } catch (error) {
        console.error('Ошибка при проверке статуса фаворита:', error);
        return false;
    }
}

// Загрузка объектов из "Избранного"
function fetchLikes() {
    const block = document.getElementById('toolbar-content-5');
    if (typeof userId === 'undefined' || userId === null) {

        block.innerHTML = '';
        block.innerHTML = '<p>Доступно только для зарегистрированных пользователей!</p>';
        const buttons = document.createElement('div');
        buttons.classList.add('buttons');

        const button = document.createElement('button');
        button.textContent = 'Войти';
        button.onclick = function (e) {
            e.preventDefault();
            window.location.replace('/clientapp/authorization.html');
        };

        buttons.appendChild(button);
        block.appendChild(buttons);
        return;
    }
    axios.get(`/api/users/GetLikesByUserId/${userId}`)
        .then(response => {
            const recommendations = response.data.map(rec => {
                return Object.fromEntries(
                    Object.entries(rec).filter(([key]) => !key.startsWith('$'))
                );
            });

            recommendationsArray = recommendations.map((rec, index) => ({
                id: rec.id !== undefined ? rec.id : `${index}`,
                mapObject: rec,
                distance: rec.distance || 0
            }));
            switchLayer('recommendations');
            updateRecommendationLayer(recommendationsArray);
            recommendationLayer.addTo(map);

            flag = true;
            const container = document.getElementById('likes-container');
            container.innerHTML = '';

            if (Array.isArray(recommendationsArray) && recommendationsArray.length > 0) {
                recommendationsArray.forEach(rec => {
                    container.innerHTML += `
                        <div class="comment" onclick="focusOnMap(${rec.mapObject.id})">
                          <h3>${rec.mapObject.display_name}</h3>
                          <p>Категория: ${rec.mapObject.type}</p>
                          <p>Адрес: ${rec.mapObject.adress}</p>
                          <div class="buttons">
                            <button onclick="removeLike(${rec.mapObject.id}, ${userId})">Удалить из избранного</button>
                          </div>
                       </div>

                    `;
                });
            } else {
                container.innerHTML += '<p>Нет сохраненных объектов</p>';
            }
        })
        .catch(error => {
            console.error(error);
            const container = document.getElementById('likes-container');
            container.innerHTML = '';
            container.innerHTML += '<p>Нет сохраненных объектов</p>';
        });
}

// Удалить объект из "Избранного"
async function removeLike(mapObjectId, userId) {
    const endpoint = '/api/users/RemoveFavorite';

    try {
        const formData = new FormData();
        formData.append('userID', userId);
        formData.append('mapObjectID', mapObjectId);

        const response = await fetch(endpoint, {
            method: 'DELETE',
            body: formData
        });

        if (response.ok) {
            fetchLikes();
            const popupHeart = document.querySelector(`.popup-content .heart-icon`);
            if (popupHeart) {
                popupHeart.classList.remove('heart-filled');
                popupHeart.classList.add('heart-outline');
            }
        } else {
            const error = await response.text();
            console.error('Ошибка при обновлении статуса фаворита:', error);
        }
    } catch (error) {
        console.error('Ошибка при переключении статуса фаворита:', error);
    }
}

// Переключатель лайка
async function toggleFavorite(mapObjectId, userId, element) {
    const isFavorite = element.classList.contains('heart-filled');
    const endpoint = isFavorite ? '/api/users/RemoveFavorite' : '/api/users/AddFavorite';

    try {
        const formData = new FormData();
        formData.append('userID', userId);
        formData.append('mapObjectID', mapObjectId);

        const response = await fetch(endpoint, {
            method: isFavorite ? 'DELETE' : 'POST',
            body: formData
        });

        if (response.ok) {
            element.classList.toggle('heart-filled', !isFavorite);
            element.classList.toggle('heart-outline', isFavorite);
        } else {
            const error = await response.text();
            console.error('Ошибка при обновлении статуса фаворита:', error);
        }
    } catch (error) {
        console.error('Ошибка при переключении статуса фаворита:', error);
    }
}


/*
    ! Вспомогательные функции !
*/

// Получение координат Пользователя
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                }
            );
        } else {
            reject(new Error('Geolocation не поддерживается вашим браузером'));
        }
    });
}

// Переводчик категорий из символа в полное название
function transform(char) {
    const mapping = {
        "Г": "Для людей с нарушением слуха",
        "К": "Для инвалидов, передвигающихся на коляске",
        "О": "Для людей с нарушением опорнодвигательного аппарата",
        "С": "Для людей с нарушением зрения",
        "У": "Для людей с нарушением умственного развития"
    };

    return mapping[char] || char;
}

// Перевод даты в заданный формат
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    };
    return date.toLocaleString('ru-RU', options);
}

// Генерация маршрута
function searchObjects(query) {
    query = query.toLowerCase();
    console.log(objects);

    return objects.filter(obj => {
        const name = obj.display_name ? obj.display_name.toLowerCase() : "";
        const address = obj.address ? obj.address.toLowerCase() : "";
        return name.includes(query) || address.includes(query);
    });
}

function setupAddressAutocomplete(inputId, suggestionsId) {
    const addressInput = document.getElementById(inputId);
    const suggestionsContainer = document.getElementById(suggestionsId);

    addressInput.addEventListener('input', function () {
        const query = this.value.trim();
        suggestionsContainer.innerHTML = '';
        if (!query) return;

        const results = searchObjects(query);

        results.forEach(result => {
            const suggestion = document.createElement('div');
            suggestion.classList.add('search-suggestion');
            suggestion.textContent = `${result.display_name} (${result.adress})`;

            suggestion.addEventListener('click', () => {
                addressInput.value = result.display_name + ", " + result.adress;
                suggestionsContainer.innerHTML = '';
            });

            suggestionsContainer.appendChild(suggestion);
        });
    });

    document.addEventListener('click', (event) => {
        if (!suggestionsContainer.contains(event.target) && event.target !== addressInput) {
            suggestionsContainer.innerHTML = '';
        }
    });
}

setupAddressAutocomplete('addressX', 'suggestionsX');
setupAddressAutocomplete('addressY', 'suggestionsY');

document.getElementById("route").addEventListener("click", function () {
    if (control) {
        map.removeControl(control);
    }

    control = L.Routing.control({
        waypoints: [
            L.latLng(51.523269, 46.01523),
            L.latLng(51.476963, 45.904558)
        ],
        routeWhileDragging: true,
        language: 'ru',
        createMarker: function (i, waypoint, n) {
            return L.marker(waypoint.latLng, {
                draggable: false
            }).bindPopup(i === 0 ? "Начало маршрута" : "Конец маршрута");
        },
        show: false
    }).addTo(map);
});

document.addEventListener("click", async function (event) {
    if (event.target.classList.contains("buildRouteToObject")) {
        const button = event.target;

        const objectID = button.dataset.id;
        const endX = button.dataset.x; // координата x конца маршрута, получаем из атрибута data-x кнопки
        const endY = button.dataset.y; // координата y конца маршрута, получаем из атрибута data-y кнопки

        const now = new Date();
        const formattedDate = now.toISOString().split('T')[0];

        if (typeof userId !== 'undefined' && userId !== null) {
            try {
                const response = await fetch('/api/routes/AddRoute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: parseInt(userId),
                        mapObjectId: parseInt(objectID),
                        date: formattedDate
                    })
                });

                const result = await response.json();
            }

            catch (error) {
                console.error("Ошибка при обращении к API:", error);
            }
        }

        const userLocation = await getUserLocation();

        const startX = userLocation.latitude; // координата x начала маршрута
        const startY = userLocation.longitude; //координата y начала маршрута
        var transportType = 'На машине'; //тип маршрута, по умолчанию на машине

        // Удаляем предыдущий контрол маршрута, если он существует
        if (control) {
            map.removeControl(control);
        }

        //Тип маршрута зависит от transportType
        let serviceURL;
        if (transportType === 'Пешком') {
            serviceURL = 'https://routing.openstreetmap.de/routed-foot/route/v1';
        } else {
            serviceURL = 'https://routing.openstreetmap.de/routed-car/route/v1';
        }

        // Создаём новый контрол маршрута с полученными координатами
        control = L.Routing.control({
            waypoints: [
                L.latLng(startX, startY),
                L.latLng(endX, endY)
            ],
            routeWhileDragging: true,
            language: 'ru',
            createMarker: function (i, waypoint, n) {
                return L.marker(waypoint.latLng, {
                    draggable: true
                }).bindPopup(i === 0 ? "Начало маршрута" : "Конец маршрута");
            },
            router: L.Routing.osrmv1({
                serviceUrl: serviceURL,
                profile: 'driving'
            }),
            show: false
        }).addTo(map);

        //подставляем название маршрута
        document.getElementById("routeName").value = startAddress + " - " + endAddress;
    }
});

