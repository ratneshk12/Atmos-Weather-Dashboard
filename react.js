const { useEffect, useMemo, useState } = React;

async function parseApiResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Server returned an invalid response. Please restart the app and try again.");
  }
}
const starterForecast = {
  city: "New Delhi",
  country: "IN",
  current: {
    date: "Today",
    temp: 31.4,
    feelsLike: 33.2,
    wind: 3.8,
    humidity: 46,
    description: "clear sky",
    icon: "01d"
  },
  airQuality: {
    index: 2,
    label: "Fair",
    advice: "Acceptable outdoor air",
    pm25: 28.4,
    pm10: 65.2,
    co: 440.6
  },
  forecast: [
    { date: "Mon", temp: 31.4, wind: 3.8, humidity: 46, description: "clear sky", icon: "01d" },
    { date: "Tue", temp: 29.6, wind: 4.1, humidity: 52, description: "few clouds", icon: "02d" },
    { date: "Wed", temp: 28.9, wind: 3.4, humidity: 57, description: "light rain", icon: "10d" },
    { date: "Thu", temp: 30.1, wind: 3.1, humidity: 49, description: "scattered clouds", icon: "03d" },
    { date: "Fri", temp: 32.2, wind: 4.5, humidity: 43, description: "sunny", icon: "01d" }
  ]
};

function App() {
  const [city, setCity] = useState("New Delhi");
  const [weather, setWeather] = useState(starterForecast);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [searchOpen, setSearchOpen] = useState(true);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!navigator.geolocation) {
      loadWeather("New Delhi", true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        loadWeatherByCoords(latitude, longitude, true);
      },
      () => loadWeather("New Delhi", true),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 }
    );
  }, []);

  const mood = useMemo(() => getWeatherMood(weather.current.description), [weather]);

  async function loadWeather(nextCity = city, silent = false) {
    const cleanCity = nextCity.trim();
    if (!cleanCity) {
      setError("Please enter a city name.");
      return;
    }

    if (!silent) setBusy(true);
    if (!silent) setError("");
    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(cleanCity)}`);
      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Weather service failed.");
      setWeather(data);
      setCity(data.city);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function loadWeatherByCoords(latitude, longitude, silent = false) {
    if (!silent) setBusy(true);
    if (!silent) setError("");
    try {
      const response = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Unable to load your location weather.");
      setWeather(data);
      setCity(data.city);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function useLocation() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }

    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        loadWeatherByCoords(latitude, longitude);
      },
      () => {
        setError("Location permission blocked. Search by city instead.");
        setBusy(false);
      }
    );
  }

  function submitSearch(event) {
    event.preventDefault();
    loadWeather();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => loadWeather(weather.city)}>
          <span className="brand-mark" aria-hidden="true">
            <span className="logo-sun"></span>
            <span className="logo-cloud"></span>
            <span className="logo-rain"></span>
          </span>
          <span><strong>Atmos</strong> Weather</span>
        </button>

        <div className="toolbar">
          <button className={`icon-btn ${searchOpen ? "active" : ""}`} type="button" onClick={() => setSearchOpen(!searchOpen)} aria-label="Toggle search">
            {searchOpen ? "x" : "Search"}
          </button>
          <button className="toggle-switch" type="button" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode">
            <span className={darkMode ? "on" : ""}></span>
            {darkMode ? "Dark" : "Light"}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Weather Intelligence</span>
          <h1>Live forecast, air quality, and location weather in one dashboard.</h1>
          <p>Atmos automatically detects your city when permission is allowed, then shows 5-day weather, AQI, wind, humidity, and clean animated cards.</p>
        </div>
        <div className={`weather-orb ${mood}`}>
          <span className="orb-cloud"></span>
          <span className="orb-ray"></span>
        </div>
      </section>

      <section className={`search-panel ${searchOpen ? "open" : ""}`}>
        <form className="search-card" onSubmit={submitSearch}>
          <label htmlFor="city">Search city</label>
          <div className="search-row">
            <input id="city" value={city} onChange={event => setCity(event.target.value)} placeholder="Enter city name" />
            <button className="primary-btn" type="submit" disabled={busy}>{busy ? "Loading" : "Search"}</button>
          </div>
          <div className="actions-row">
            <button className="secondary-btn" type="button" onClick={useLocation} disabled={busy}>Use current location</button>
            <button className="ghost-btn" type="button" onClick={() => loadWeather("Mumbai")} disabled={busy}>Try Mumbai</button>
            <button className="ghost-btn" type="button" onClick={() => loadWeather("London")} disabled={busy}>Try London</button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </form>
      </section>

      <section className="dashboard">
        <CurrentWeather weather={weather} mood={mood} />
        <StatsPanel weather={weather} />
        <AirQualityPanel air={weather.airQuality} />
      </section>

      <section className="forecast-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Forecast</span>
            <h2>5-Day Outlook</h2>
          </div>
          <span className="updated-pill">{weather.country ? `${weather.city}, ${weather.country}` : weather.city}</span>
        </div>
        <div className="forecast-grid">
          {weather.forecast.map((item, index) => <ForecastCard item={item} index={index} key={`${item.date}-${index}`} />)}
        </div>
      </section>
    </main>
  );
}

function AirQualityPanel({ air }) {
  const level = air?.index || 1;
  const meters = [
    ["PM2.5", `${air?.pm25 || 0} ug/m3`],
    ["PM10", `${air?.pm10 || 0} ug/m3`],
    ["CO", `${air?.co || 0} ug/m3`]
  ];

  return (
    <section className={`air-panel level-${level}`}>
      <div className="air-main">
        <span className="eyebrow">Air Quality</span>
        <h2>{air?.label || "Good"}</h2>
        <p>{air?.advice || "Air quality data will appear here."}</p>
      </div>
      <div className="aqi-ring">
        <span>{level}</span>
        <small>AQI</small>
      </div>
      <div className="air-meters">
        {meters.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CurrentWeather({ weather, mood }) {
  const iconUrl = `https://openweathermap.org/img/wn/${weather.current.icon}@4x.png`;
  return (
    <article className="current-card">
      <div>
        <span className="status-pill">{weather.current.date}</span>
        <h2>{weather.city}</h2>
        <p className="condition">{weather.current.description}</p>
        <div className="temperature">{Math.round(weather.current.temp)}<span>deg C</span></div>
      </div>
      <div className={`icon-stage ${mood}`}>
        <img src={iconUrl} alt={weather.current.description} />
      </div>
    </article>
  );
}

function StatsPanel({ weather }) {
  const stats = [
    ["Feels like", `${Math.round(weather.current.feelsLike)} deg C`],
    ["Humidity", `${weather.current.humidity}%`],
    ["Wind", `${weather.current.wind} M/S`]
  ];

  return (
    <aside className="stats-panel">
      {stats.map(([label, value]) => (
        <div className="stat-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </aside>
  );
}

function ForecastCard({ item, index }) {
  const iconUrl = `https://openweathermap.org/img/wn/${item.icon}@2x.png`;
  return (
    <article className="forecast-card" style={{ animationDelay: `${index * 90}ms` }}>
      <div className="forecast-top">
        <h3>{item.date}</h3>
        <img src={iconUrl} alt={item.description} />
      </div>
      <strong>{Math.round(item.temp)} deg C</strong>
      <p>{item.description}</p>
      <div className="mini-stats">
        <span>Wind {item.wind}</span>
        <span>Humidity {item.humidity}%</span>
      </div>
    </article>
  );
}

function getWeatherMood(description) {
  const value = description.toLowerCase();
  if (value.includes("rain")) return "rain";
  if (value.includes("cloud")) return "cloud";
  if (value.includes("snow")) return "snow";
  if (value.includes("storm") || value.includes("thunder")) return "storm";
  return "sun";
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
