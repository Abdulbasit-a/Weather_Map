/* WeatherMap - JavaScript ES6+ */

/* ---------- Configuration ---------- */
const CONFIG = {
  openWeatherMapApiKey: 'ضع_مفتاح_API_الخاص_بك_هنا',
  openWeatherMapBase: 'https://api.openweathermap.org/data/2.5/weather',
  nominatimBase: 'https://nominatim.openstreetmap.org/search',
  defaultLat: 15.5007,
  defaultLng: 32.5599,
  defaultZoom: 6
};

/* ---------- DOM references ---------- */
const form = document.getElementById('weather-form');
const locationInput = document.getElementById('location-input');
const getWeatherBtn = document.getElementById('get-weather-btn');
const spinner = document.getElementById('spinner');
const errorAlert = document.getElementById('error-alert');
const errorMessage = document.getElementById('error-message');
const closeAlert = document.getElementById('close-alert');
const mapContainer = document.getElementById('map');

/* ---------- Map state ---------- */
let map = null;
let marker = null;
let toastTimer = null;
let requestController = null;

/* ---------- Safe HTML helper ---------- */
function escapeHtml(value) {
  if (value == null) return '';

  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

/* ---------- Error and loading helpers ---------- */
function hideError() {
  if (!errorAlert) return;

  errorAlert.style.display = 'none';
  errorAlert.setAttribute('aria-hidden', 'true');

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

function showError(message) {
  if (!errorAlert || !errorMessage) {
    console.error(message);
    return;
  }

  errorMessage.textContent = String(message);
  errorAlert.style.borderColor = '#fecaca';
  errorAlert.style.background = '#fef2f2';
  errorAlert.style.color = '#991b1b';

  const icon = errorAlert.querySelector('.alert-icon');
  if (icon) icon.textContent = '\u26A0';

  errorAlert.style.display = 'flex';
  errorAlert.setAttribute('aria-hidden', 'false');
}

function showToast(message) {
  if (!errorAlert || !errorMessage) return;

  if (toastTimer) clearTimeout(toastTimer);

  errorMessage.textContent = String(message);
  errorAlert.style.borderColor = '#bbf7d0';
  errorAlert.style.background = '#ecfdf5';
  errorAlert.style.color = '#166534';

  const icon = errorAlert.querySelector('.alert-icon');
  if (icon) icon.textContent = '\u2713';

  errorAlert.style.display = 'flex';
  errorAlert.setAttribute('aria-hidden', 'false');

  toastTimer = setTimeout(hideError, 2500);
}

function setLoading(isLoading) {
  if (spinner) {
    spinner.style.display = isLoading ? 'flex' : 'none';
  }

  if (getWeatherBtn) {
    getWeatherBtn.disabled = isLoading;
    getWeatherBtn.textContent = isLoading
      ? 'Loading…'
      : 'Get Weather';
  }

  if (isLoading) hideError();
}

/* ---------- Phase 1: Initialize map ---------- */
function initMap() {
  if (!mapContainer) {
    showError('لم يتم العثور على عنصر الخريطة #map في ملف HTML.');
    return;
  }

  if (typeof L === 'undefined') {
    showError(
      'تعذر تحميل Leaflet. تحقق من الإنترنت وروابط المكتبة في HTML.'
    );
    return;
  }

  try {
    map = L.map(mapContainer, {
      center: [CONFIG.defaultLat, CONFIG.defaultLng],
      zoom: CONFIG.defaultZoom,
      zoomControl: true
    });

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    ).addTo(map);

    requestAnimationFrame(() => {
      if (map) map.invalidateSize();
    });

    window.addEventListener('resize', () => {
      if (map) map.invalidateSize();
    });

  } catch (err) {
    showError('فشل تهيئة الخريطة: ' + err.message);
    console.error(err);
  }
}

/* ---------- Phase 2: Geocoding ---------- */
async function geocodeLocation(query, signal) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'en'
  });

  const response = await fetch(
    `${CONFIG.nominatimBase}?${params.toString()}`,
    {
      signal,
      headers: {
        Accept: 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `خطأ في خدمة تحديد الموقع (${response.status}).`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      'لم يتم العثور على الموقع. جرّب اسم مدينة أو مكان آخر.'
    );
  }

  const lat = Number.parseFloat(data[0].lat);
  const lng = Number.parseFloat(data[0].lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('إحداثيات الموقع غير صالحة.');
  }

  return {
    lat,
    lng,
    name: data[0].display_name || query
  };
}

/* ---------- Phase 3: Fetch current weather ---------- */
async function fetchWeather(lat, lng, signal) {
  const apiKey = CONFIG.openWeatherMapApiKey.trim();

  if (
    !apiKey ||
    apiKey === 'dfe09a79bcbb22cdf0435671eb238ac4'
  ) {
    throw new Error(
      'يرجى وضع مفتاح OpenWeatherMap API في إعدادات CONFIG.'
    );
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    appid: apiKey,
    units: 'metric'
  });

  const response = await fetch(
    `${CONFIG.openWeatherMapBase}?${params.toString()}`,
    { signal }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'مفتاح OpenWeatherMap غير صالح أو لم يتم تفعيله.'
      );
    }

    if (response.status === 404) {
      throw new Error(
        'لم يتم العثور على بيانات الطقس لهذا الموقع.'
      );
    }

    if (response.status === 429) {
      throw new Error(
        'تم تجاوز حد الطلبات. انتظر قليلًا ثم حاول مجددًا.'
      );
    }

    throw new Error(
      `خطأ في خدمة الطقس (${response.status}).`
    );
  }

  return await response.json();
}

/* ---------- Phase 4 & 5: Render weather on map ---------- */
function renderWeather(lat, lng, weather, placeName) {
  if (!map) {
    throw new Error(
      'الخريطة غير جاهزة. تحقق من تحميل Leaflet.'
    );
  }

  map.setView([lat, lng], 10, {
    animate: true,
    duration: 1
  });

  map.invalidateSize();

  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }

  const weatherInfo =
    weather.weather && weather.weather[0]
      ? weather.weather[0]
      : {};

  const iconCode = weatherInfo.icon || '01d';
  const weatherDesc = escapeHtml(
    weatherInfo.description || 'Clear'
  );

  const temp =
    weather.main && Number.isFinite(weather.main.temp)
      ? Math.round(weather.main.temp)
      : '—';

  const cityName = escapeHtml(
    placeName || weather.name || 'Unknown location'
  );

  const country = escapeHtml(
    weather.sys && weather.sys.country
      ? weather.sys.country
      : ''
  );

  const clouds =
    weather.clouds && weather.clouds.all != null
      ? weather.clouds.all
      : '—';

  const humidity =
    weather.main && weather.main.humidity != null
      ? weather.main.humidity
      : '—';

  const wind =
    weather.wind && weather.wind.speed != null
      ? weather.wind.speed
      : '—';

  const iconUrl =
    `https://openweathermap.org/img/wn/${encodeURIComponent(iconCode)}@2x.png`;

  const shareText =
    `Weather in ${cityName}` +
    `${country ? ', ' + country : ''}: ` +
    `${temp}°C, ${weatherDesc}. ` +
    `Humidity ${humidity}%, Wind ${wind} m/s, ` +
    `Clouds ${clouds}%.`;

  const facebookUrl =
    'https://www.facebook.com/sharer/sharer.php?u=' +
    encodeURIComponent(window.location.href) +
    '&quote=' +
    encodeURIComponent(shareText);

  /* Create the map marker without inline styles. */
  const markerIcon = L.divIcon({
    className: 'weather-marker',
    html:
      '<div class="weather-marker-emoji" ' +
      'aria-hidden="true">🌤️</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  marker = L.marker([lat, lng], {
    icon: markerIcon,
    title: placeName || weather.name || 'Weather location'
  }).addTo(map);

  /* Build the weather popup. */
  const popupContent = `
    <div class="weather-card">
      <div class="city">
        ${cityName}
        ${
          country
            ? `<span class="country-name">, ${country}</span>`
            : ''
        }
      </div>

      <div class="weather-row">
        <img
          src="${iconUrl}"
          alt="${weatherDesc}"
          class="icon-img"
          width="48"
          height="48"
        >

        <div>
          <div class="temp">${temp}°C</div>
          <div class="weather-description">
            ${weatherDesc}
          </div>
        </div>
      </div>

      <div class="detail">
        <span>Clouds</span>
        <span>${clouds}%</span>
      </div>

      <div class="detail">
        <span>Humidity</span>
        <span>${humidity}%</span>
      </div>

      <div class="detail">
        <span>Wind</span>
        <span>${wind} m/s</span>
      </div>

      <div class="share-group">
        <button
          type="button"
          class="share-btn"
          data-action="copy-weather"
        >
          Copy
        </button>

        <a
          href="${facebookUrl}"
          target="_blank"
          rel="noopener noreferrer"
          class="share-btn"
        >
          Facebook
        </a>
      </div>
    </div>
  `;

  const popup = L.popup({
    className: 'weather-popup',
    offset: [0, -16]
  })
    .setLatLng([lat, lng])
    .setContent(popupContent)
    .openOn(map);

  /* Attach the Copy event after the popup is added. */
  popup.once('add', () => {
    const popupElement = popup.getElement();

    const copyButton = popupElement
      ? popupElement.querySelector(
          '[data-action="copy-weather"]'
        )
      : null;

    if (copyButton) {
      copyButton.addEventListener('click', () => {
        handleShare(shareText);
      });
    }
  });

  return popup;
}

/* ---------- Bonus: Share and copy weather ---------- */
async function handleShare(text) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'WeatherMap',
        text,
        url: window.location.href
      });

      return;
    } catch (err) {
      /* Do not copy if the user cancelled sharing. */
      if (err && err.name === 'AbortError') return;
    }
  }

  await copyToClipboard(text);
}

async function copyToClipboard(text) {
  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
      return;
    }

    throw new Error('Clipboard API unavailable');
  } catch (err) {
    const textarea = document.createElement('textarea');

    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.className = 'clipboard-fallback';

    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } catch (_) {
      copied = false;
    }

    textarea.remove();

    if (copied) {
      showToast('Copied to clipboard!');
    } else {
      showError(
        'تعذر النسخ تلقائيًا. انسخ النص يدويًا: ' + text
      );
    }
  }
}

/* ---------- Search orchestration ---------- */
async function handleFormSubmit(event) {
  event.preventDefault();

  if (!locationInput) {
    showError(
      'لم يتم العثور على حقل البحث #location-input في HTML.'
    );
    return;
  }

  const query = locationInput.value.trim();

  if (!query) {
    showError('Please enter a city, address, or place.');
    locationInput.focus();
    return;
  }

  /* Cancel any previous search. */
  if (requestController) {
    requestController.abort();
  }

  requestController = new AbortController();

  const controller = requestController;
  const signal = controller.signal;

  setLoading(true);

  try {
    /* Phase 2: Find the location coordinates. */
    const geo = await geocodeLocation(query, signal);

    /* Phase 3: Retrieve current weather. */
    const weather = await fetchWeather(
      geo.lat,
      geo.lng,
      signal
    );

    /* Phases 4 and 5: Update the map and popup. */
    renderWeather(
      geo.lat,
      geo.lng,
      weather,
      geo.name
    );

  } catch (err) {
    if (err && err.name === 'AbortError') {
      return;
    }

    showError(
      err && err.message
        ? err.message
        : 'حدث خطأ غير متوقع. حاول مرة أخرى.'
    );

    console.error(err);

  } finally {
    /* Do not reset loading for a newer request. */
    if (requestController === controller) {
      requestController = null;
      setLoading(false);
    }
  }
}

/* ---------- Register event listeners ---------- */
if (form) {
  form.addEventListener(
    'submit',
    handleFormSubmit
  );
} else {
  showError(
    'لم يتم العثور على نموذج البحث #weather-form في HTML.'
  );
}

if (closeAlert) {
  closeAlert.addEventListener(
    'click',
    hideError
  );
}

/* ---------- Initialize the map ---------- */
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initMap,
    { once: true }
  );
} else {
  initMap();
}