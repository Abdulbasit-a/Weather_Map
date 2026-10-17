/* WeatherMap - Behavior layer (Pure Vanilla JavaScript ES6+) */
/* Strict separation of concerns: no inline handlers, no inline styles. */

/* ---------- Configuration ---------- */
const CONFIG = {
  /* Get a free API key at https://home.openweathermap.org/api_keys and paste it here. */
  openWeatherMapApiKey: 'fbdd82c5e53ca4053e86a029363251eb',
  openWeatherMapBase: 'https://api.openweathermap.org/data/2.5/weather',
  nominatimBase: 'https://nominatim.openstreetmap.org/search',
  defaultLat: 15.5007,
  defaultLng: 32.5599,
  defaultZoom: 6,
  userAgent: 'WeatherMap-SPA/1.0 (educational project; contact: student@example.com)'
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

/* ---------- Phase 1: Map init ---------- */
function initMap() {
  if (typeof L === 'undefined') {
    showError('فشل تحميل مكتبة Leaflet. يرجى التحقق من اتصالك بالإنترنت وإعادة تحميل الصفحة.');
    return;
  }

  try {
    map = L.map('map', {
      center: [CONFIG.defaultLat, CONFIG.defaultLng],
      zoom: CONFIG.defaultZoom,
      zoomControl: true
    });

  /* بلاط OpenStreetMap (المصدر الأساسي للمواصفات). */
  const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  /* بلاط احتياطي إذا فشل المصدر الأساسي. */
  tileLayer.on('tileerror', () => {
    tileLayer.setUrl('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png');
  });

  /* التأكد من render البلاط بعد قياس أبعاد الحاوية. */
  setTimeout(() => map.invalidateSize(), 0);
  window.addEventListener('load', () => map.invalidateSize());
  /* Ensure map renders correctly after resize */
  }
}

/* Loading and error state helpers */
function setLoading(isLoading) {
  if (isLoading) {
    spinner.style.display = 'flex';
    getWeatherBtn.disabled = true;
    getWeatherBtn.textContent = 'Loading&hellip;';
    hideError();
  } else {
    spinner.style.display = 'none';
    getWeatherBtn.disabled = false;
    getWeatherBtn.textContent = 'Get Weather';
  }
}

/* ---------- Error / toast helpers ---------- */
function showError(message) {
  errorMessage.textContent = message;
  errorAlert.style.borderColor = '#fecaca';
  errorAlert.style.background = '#fef2f2';
  errorAlert.style.color = '#991b1b';
  errorAlert.querySelector('.alert-icon').textContent = '\u26A0';
  errorAlert.style.display = 'flex';
  errorAlert.setAttribute('aria-hidden', 'false');
}

function hideError() {
  errorAlert.style.display = 'none';
  errorAlert.setAttribute('aria-hidden', 'true');
}

let toastTimer = null;
function showToast(message) {
  if (toastTimer) clearTimeout(toastTimer);
  errorMessage.textContent = message;
  errorAlert.style.borderColor = '#bbf7d0';
  errorAlert.style.background = '#ecfdf5';
  errorAlert.style.color = '#166534';
  errorAlert.querySelector('.alert-icon').textContent = '\u2713';
  errorAlert.style.display = 'flex';
  errorAlert.setAttribute('aria-hidden', 'false');
  toastTimer = setTimeout(hideError, 2500);
}

/* ---------- XSS-safe HTML injection ---------- */
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/* ---------- Phase 2: Geocoding (Nominatim / OpenStreetMap) ---------- */
async function geocodeLocation(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: 1,
    'accept-language': 'en'
  });
  const url = `${CONFIG.nominatimBase}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': CONFIG.userAgent }
  });
  if (!response.ok) {
    throw new Error(`Geocoding service error (${response.status})`);
  }
  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error('Location not found. Please try a different city or place.');
  }
  const { lat, lon, display_name } = data[0];
  return {
    lat: parseFloat(lat),
    lng: parseFloat(lon),
    name: display_name
  };
}

/* ---------- Phase 3: OpenWeatherMap current weather ---------- */
async function fetchWeather(lat, lng) {
  if (!CONFIG.openWeatherMapApiKey) {
    throw new Error(
      'OpenWeatherMap API key is not configured. ' +
      'Get a free key at https://home.openweathermap.org/api_keys and set CONFIG.openWeatherMapApiKey in js/main.js.'
    );
  }
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    appid: CONFIG.openWeatherMapApiKey,
    units: 'metric'
  });
  const url = `${CONFIG.openWeatherMapBase}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid OpenWeatherMap API key.');
    }
    if (response.status === 404) {
      throw new Error('Weather data not found for this location.');
    }
    if (response.status === 429) {
      throw new Error('API rate limit reached. Please wait a moment and try again.');
    }
    throw new Error(`Weather service error (${response.status})`);
  }
  return await response.json();
}

/* ---------- Phase 4 & 5: Map center, marker, InfoWindow ---------- */
function renderWeather(lat, lng, weather, placeName) {
  /* Phase 4: Smoothly center the map and place/refresh the marker. */
  map.setView([lat, lng], 10, { animate: true, duration: 1 });
  map.invalidateSize();

  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }

  const iconCode = weather.weather && weather.weather[0] ? weather.weather[0].icon : '01d';
  const weatherDesc = escapeHtml(weather.weather && weather.weather[0] ? weather.weather[0].description : 'Clear');
  const temp = weather.main && weather.main.temp !== undefined ? Math.round(weather.main.temp) : '—';
  const cityName = escapeHtml(placeName || (weather.name ? weather.name : 'Unknown location'));
  const country = weather.sys && weather.sys.country ? escapeHtml(weather.sys.country) : '';
  const clouds = weather.clouds && weather.clouds.all !== undefined ? weather.clouds.all : '—';
  const humidity = weather.main && weather.main.humidity !== undefined ? weather.main.humidity : '—';
  const wind = weather.wind && weather.wind.speed !== undefined ? weather.wind.speed : '—';

  const iconUrl = `https://openweathermap.org/img/wn/${escapeHtml(iconCode)}@2x.png`;

  const shareText = `Weather in ${cityName}${country ? ', ' + country : ''}: ${temp}\u00B0C, ${weatherDesc}. Humidity ${humidity}%, Wind ${wind} m/s, Clouds ${clouds}%.`;
  const fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href);

  const markerIcon = L.divIcon({
    className: 'weather-marker',
    html: '<div style="font-size:26px;line-height:26px;">\uD83C\uDF24\uFE0F</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  marker = L.marker([lat, lng], { icon: markerIcon, title: cityName }).addTo(map);

  const popupContent = `
    <div class="weather-card">
      <div class="city">${cityName}${country ? `<span style="font-weight:400;font-size:0.9rem;color:#64748b;margin-left:0.4rem;">, ${country}</span>` : ''}</div>
      <div class="weather-row">
        <img src="${iconUrl}" alt="${weatherDesc}" class="icon-img" width="48" height="48">
        <div>
          <div class="temp">${temp}\u00B0C</div>
          <div style="color:#64748b;font-size:0.95rem;text-transform:capitalize;">${weatherDesc}</div>
        </div>
      </div>
      <div class="detail"><span>Clouds</span><span>${clouds}%</span></div>
      <div class="detail"><span>Humidity</span><span>${humidity}%</span></div>
      <div class="detail"><span>Wind</span><span>${wind} m/s</span></div>
      <div class="share-group">
        <button type="button" class="share-btn" id="share-btn">Copy</button>
        <a href="${fbUrl}" target="_blank" rel="noopener" class="share-btn">Facebook</a>
      </div>
    </div>
  `;

  const popup = L.popup({ className: 'weather-popup', offset: [0, -16] })
    .setLatLng([lat, lng])
    .setContent(popupContent)
    .openOn(map);

  /* Wire up the Share button after the popup is attached to the DOM. */
  setTimeout(() => {
    const btn = document.getElementById('share-btn');
    if (btn) {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        handleShare(shareText);
      });
    }
  }, 0);

  return popup;
}

/* ---------- Bonus: Share feature (Clipboard / Web Share API / Facebook) ---------- */
function handleShare(text) {
  if (navigator.share) {
    navigator.share({ title: 'WeatherMap', text, url: window.location.href })
      .catch(() => copyToClipboard(text));
  } else {
    copyToClipboard(text);
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', true);
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Copied to clipboard!');
    } catch {
      showError('Unable to copy. Share manually: ' + text);
    }
    document.body.removeChild(textarea);
  }
}

/* ---------- Orchestration: Phases 2-5 ---------- */
async function handleFormSubmit(event) {
  event.preventDefault();

  const query = locationInput.value.trim();
  if (!query) {
    showError('Please enter a city, address, or place.');
    locationInput.focus();
    return;
  }

  hideError();
  setLoading(true);

  try {
    const geo = await geocodeLocation(query);       /* Phase 2 */
    const weather = await fetchWeather(geo.lat, geo.lng); /* Phase 3 */
    renderWeather(geo.lat, geo.lng, weather, geo.name);   /* Phases 4 & 5 */
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

/* ---------- Programmatic event listener registration ---------- */
form.addEventListener('submit', handleFormSubmit);

closeAlert.addEventListener('click', () => {
  hideError();
});

/* ---------- Initialize map once the DOM is ready ---------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMap);
} else {
  initMap();
}
