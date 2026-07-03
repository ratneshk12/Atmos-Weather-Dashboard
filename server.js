const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENWEATHER_API_KEY || "cf42bb8943dd0b0b2acc8491a88daba7";
const root = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host}`);

      if (requestUrl.pathname === "/api/weather") {
        const payload = await getWeather(requestUrl.searchParams);
        sendJson(res, 200, payload);
        return;
      }

      serveStatic(req, res, requestUrl.pathname);
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message || "Server error" });
    }
  });
}

async function getWeather(params) {
  const city = params.get("city");
  const lat = params.get("lat");
  const lon = params.get("lon");
  let coordinates;

  if (city) {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
    const geoData = await fetchJson(geoUrl);
    if (!geoData.length) throw Object.assign(new Error(`No weather found for ${city}.`), { status: 404 });
    coordinates = {
      city: geoData[0].name,
      country: geoData[0].country,
      lat: geoData[0].lat,
      lon: geoData[0].lon
    };
  } else if (lat && lon) {
    const reverseUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;
    const reverseData = await fetchJson(reverseUrl);
    coordinates = {
      city: reverseData[0]?.name || "Current Location",
      country: reverseData[0]?.country || "",
      lat,
      lon
    };
  } else {
    throw Object.assign(new Error("City or coordinates are required."), { status: 400 });
  }

  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coordinates.lat}&lon=${coordinates.lon}&units=metric&appid=${API_KEY}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${coordinates.lat}&lon=${coordinates.lon}&units=metric&appid=${API_KEY}`;
  const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${API_KEY}`;
  const [currentData, forecastData, airData] = await Promise.all([
    fetchJson(currentUrl),
    fetchJson(forecastUrl),
    fetchJson(airUrl)
  ]);
  if (!forecastData.list?.length) throw Object.assign(new Error("Forecast data is unavailable."), { status: 502 });

  const daily = uniqueDailyForecast(forecastData.list).slice(0, 5);
  const air = airData.list?.[0];

  return {
    city: currentData.name || coordinates.city,
    country: currentData.sys?.country || coordinates.country,
    current: mapCurrentWeather(currentData),
    airQuality: mapAirQuality(air),
    forecast: daily.map(item => mapForecast(item, formatDay(item.dt_txt), false))
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error("Weather service returned an invalid response. Please try again."), { status: 502 });
  }

  if (!response.ok) {
    throw Object.assign(new Error(data.message || "Weather API request failed."), { status: response.status });
  }
  return data;
}

function uniqueDailyForecast(items) {
  const seen = new Set();
  return items.filter(item => {
    const day = item.dt_txt.split(" ")[0];
    if (seen.has(day)) return false;
    seen.add(day);
    return true;
  });
}

function mapCurrentWeather(item) {
  return {
    date: "Live now",
    temp: Math.round(item.main.temp * 10) / 10,
    feelsLike: Math.round(item.main.feels_like * 10) / 10,
    wind: item.wind.speed,
    humidity: item.main.humidity,
    description: item.weather[0].description,
    icon: item.weather[0].icon
  };
}

function mapForecast(item, date, includeFeelsLike) {
  return {
    date,
    temp: Math.round(item.main.temp * 10) / 10,
    feelsLike: Math.round((includeFeelsLike ? item.main.feels_like : item.main.temp) * 10) / 10,
    wind: item.wind.speed,
    humidity: item.main.humidity,
    description: item.weather[0].description,
    icon: item.weather[0].icon
  };
}

function mapAirQuality(item) {
  const index = item?.main?.aqi || 1;
  const labels = {
    1: ["Good", "Fresh air, low pollution"],
    2: ["Fair", "Acceptable outdoor air"],
    3: ["Moderate", "Sensitive people should take care"],
    4: ["Poor", "Limit long outdoor activity"],
    5: ["Very Poor", "Avoid unnecessary outdoor activity"]
  };
  const components = item?.components || {};

  return {
    index,
    label: labels[index][0],
    advice: labels[index][1],
    pm25: roundAir(components.pm2_5),
    pm10: roundAir(components.pm10),
    co: roundAir(components.co)
  };
}

function roundAir(value) {
  return Math.round((value || 0) * 10) / 10;
}

function formatDay(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }

    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function startServer(port = PORT) {
  const server = createServer();

  server.once("error", error => {
    if (error.code === "EADDRINUSE") {
      const nextPort = Number(port) + 1;
      console.log(`Port ${port} is busy. Trying ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`Atmos Weather running at http://localhost:${port}`);
  });
}

startServer(PORT);
