# WeatherMap — Asynchronous Client-Side WeatherMap SPA

Advanced Web Technologies — Course Project 2

A pure front-end Single Page Application that resolves a user-specified location to coordinates,
centers a map on it, fetches current weather from OpenWeatherMap, and renders the data inside an
interactive map popup (InfoWindow). Built with semantic HTML5, CSS3, and vanilla ES6+ JavaScript.

## Live Demo
- [Live Demo](https://Abdulbasit-a.github.io/Weather_Map/) — enable GitHub Pages after pushing to view the deployed app.
- **Note:** When opening the HTML file directly from disk (`file://`), OpenStreetMap tiles may be blocked by its usage policy. It's recommended to run a local static server (e.g., Live Server in VS Code) or deploy to GitHub Pages.

## APIs Used
- **Leaflet.js + OpenStreetMap** — interactive map and tiles (no API key required).
- **Nominatim (OpenStreetMap)** — geocoding: city/address string → latitude & longitude.
- **OpenWeatherMap Current Weather API** — temperature, humidity, wind, clouds, conditions, icon.

## Setup
1. Clone or download the repository.
2. Get a free OpenWeatherMap API key at https://home.openweathermap.org/api_keys
3. Open `js/main.js` and set `CONFIG.openWeatherMapApiKey` to your key.
4. Open `index.html` in a browser, or serve with any static server (e.g. Live Server, `python -m http.server`).
5. Type a city/place and click **Get Weather**. The map centers on the location and shows a weather popup.

## Architecture Constraints Satisfied
- Strict separation of concerns: HTML in `index.html`, styles in `css/style.css`, behavior in `js/main.js`. No inline handlers or inline styles.
- Pure vanilla JavaScript: no React/Angular/Vue/Svelte, no jQuery/d3.
- No full-page redraws: form submission uses `event.preventDefault()` + Fetch/async-await.
- Robust `try/catch` error handling with user-friendly alert cards and a loading spinner.
- Map container fixed at 70% viewport height with a charcoal round border and shadow.
- Custom Google Fonts (Roboto), responsive design.

## Bonus Features (Novelty)
- **Share button**: copies a formatted weather message to the clipboard, or uses the Web Share API on supported devices.
- **Facebook button**: opens the Facebook sharer to post the weather.
- Animated marker and smooth map-centering transition.

## File Structure
```
WeatherMap/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
└── README.md
```

## Grading Alignment
- Asynchronous flow: Fetch API + ES6 Promises + async/await, page never reloads.
- Multi-API logic: Nominatim geocoding → OpenWeatherMap JSON parsing → Leaflet map init.
- Dynamic DOM: marker placement, smooth centering animation, HTML InfoWindow with data + icons.
- Responsive UI: 70vh map, styled inputs with focus/hover transitions, Google Font, mobile-friendly.
- Loading & errors: spinner during requests, friendly alert cards on geocoding/weather failures.
- Repository: organized structure, descriptive commits, README with setup + live demo link.
