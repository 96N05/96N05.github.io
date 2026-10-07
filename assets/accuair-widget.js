/**
 * AccuAir Standalone Web Widget
 * Minimal AQI + Health & Activities Forecast
 */
(function() {
  const ONE_HOUR_MS = 60 * 60 * 1000;

  function getAQICategory(aqi) {
    if (aqi <= 50) return { label: 'Good', color: '#047857', bg: 'rgba(16, 185, 129, 0.08)' };
    if (aqi <= 100) return { label: 'Moderate', color: '#b45309', bg: 'rgba(245, 158, 11, 0.08)' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#c2410c', bg: 'rgba(249, 115, 22, 0.08)' };
    if (aqi <= 200) return { label: 'Unhealthy', color: '#b91c1c', bg: 'rgba(239, 68, 68, 0.08)' };
    if (aqi <= 300) return { label: 'Very Unhealthy', color: '#7e22ce', bg: 'rgba(168, 85, 247, 0.08)' };
    return { label: 'Hazardous', color: '#881337', bg: 'rgba(159, 18, 57, 0.08)' };
  }

  function getRatingColor(cat) {
    if (cat === 'Ideal' || cat === 'Very Good') return '#047857';
    if (cat === 'Good') return '#0f766e';
    if (cat === 'Fair') return '#b45309';
    return '#be123c';
  }

  function calculateHealthIndices(aqi, tempC, humidity, uvIndex) {
    const running = aqi > 100 || tempC > 28 ? (aqi > 150 ? 'Poor' : 'Fair') : (aqi <= 40 ? 'Ideal' : 'Very Good');
    const cycling = aqi > 100 ? 'Fair' : (aqi <= 45 ? 'Ideal' : 'Very Good');
    const hiking = aqi > 100 || tempC > 32 ? 'Poor' : (aqi <= 45 ? 'Ideal' : 'Very Good');
    const asthma = aqi > 100 ? (aqi > 150 ? 'Poor' : 'Fair') : (aqi <= 35 ? 'Ideal' : 'Very Good');
    const sinus = (humidity > 75 || aqi > 90) ? 'Fair' : 'Very Good';
    const uvCat = uvIndex >= 8 ? 'Poor' : (uvIndex >= 6 ? 'Fair' : (uvIndex <= 2 ? 'Ideal' : 'Good'));
    const dust = aqi > 80 ? 'Fair' : 'Very Good';
    const arthritis = (humidity > 80 && tempC < 12) ? 'Poor' : 'Very Good';
    const lawn = (tempC > 32 || aqi > 120) ? 'Fair' : (tempC >= 15 && aqi <= 60 ? 'Ideal' : 'Very Good');

    return [
      { name: 'Running', cat: running, score: running === 'Ideal' ? 10 : (running === 'Very Good' ? 8 : 5), text: 'Air conditions for running' },
      { name: 'Cycling', cat: cycling, score: cycling === 'Ideal' ? 10 : 8, text: 'Road conditions and air flow' },
      { name: 'Hiking & Walking', cat: hiking, score: hiking === 'Ideal' ? 10 : 8, text: 'Visibility and trail conditions' },
      { name: 'Asthma Forecast', cat: asthma, score: asthma === 'Ideal' ? 10 : 5, text: 'Low respiratory irritant levels' },
      { name: 'Sinus Pressure', cat: sinus, score: 8, text: 'Stable barometric comfort' },
      { name: 'UV Index', cat: uvCat, score: uvIndex, text: `UV Index: ${uvIndex}` },
      { name: 'Dust & Dander', cat: dust, score: 8, text: 'Low airborne dust particulates' },
      { name: 'Arthritis Index', cat: arthritis, score: 8, text: 'Favorable joint comfort conditions' },
      { name: 'Lawn & Garden', cat: lawn, score: 9, text: 'Dry conditions for yard care' }
    ];
  }

  function initWidget(container) {
    const defaultCity = container.getAttribute('data-city') || 'New York';
    let lat = parseFloat(container.getAttribute('data-lat') || '40.7128');
    let lon = parseFloat(container.getAttribute('data-lon') || '-74.006');
    const unit = (container.getAttribute('data-unit') || 'F').toUpperCase();
    let cityName = defaultCity;

    const cacheKey = `accuair_${cityName.replace(/\s+/g, '_')}`;

    function renderWidget(data, isOffline) {
      const aqiCat = getAQICategory(data.aqi);
      const tempDisplay = unit === 'C' ? `${Math.round(data.tempC)}°C` : `${Math.round(data.tempC * 9/5 + 32)}°F`;

      container.innerHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #171717; border: 1px solid #e5e5e5; border-radius: 16px; padding: 22px; max-width: 440px; box-sizing: border-box; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <!-- Header with Clickable Location Search -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <button id="aa-loc-btn" style="background: none; border: none; cursor: pointer; text-align: left; padding: 0; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 16px;">📍</span>
                <span style="font-weight: 700; font-size: 16px; color: #0a0a0a;">${cityName}</span>
                <span style="font-size: 11px; font-weight: 600; background: #f5f5f5; border: 1px solid #e5e5e5; padding: 2px 6px; border-radius: 4px; color: #525252;">Change</span>
              </button>
              <div style="font-size: 12px; color: #737373; margin-top: 4px;">
                ${tempDisplay} · Humidity ${data.humidity}%
              </div>
            </div>
            <button id="aa-refresh-btn" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #737373; padding: 4px;" title="Refresh forecast">↻</button>
          </div>

          <!-- Air Quality: strictly AQI value and simple descriptive label -->
          <div style="background: ${aqiCat.bg}; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; margin-bottom: 18px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: #525252; letter-spacing: 0.05em; margin-bottom: 6px;">
              Air Quality
            </div>
            <div style="display: flex; align-items: baseline; gap: 12px;">
              <div style="font-size: 46px; font-weight: 700; font-family: monospace; line-height: 1; color: #0a0a0a;">
                ${data.aqi}
              </div>
              <div>
                <div style="font-size: 10px; text-transform: uppercase; color: #737373; font-weight: 600;">Index Value</div>
                <div style="font-size: 16px; font-weight: 600; color: ${aqiCat.color}; line-height: 1.2;">
                  ${aqiCat.label}
                </div>
              </div>
            </div>
          </div>

          <!-- Health & Activities Forecast (Standard View: All 9 activities) -->
          <div style="border-top: 1px solid #f0f0f0; padding-top: 12px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #525252; margin-bottom: 8px;">
              Health & Activities
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${data.indices.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 5px 0; border-bottom: 1px solid #fafafa;">
                  <span style="color: #333333; font-weight: 500;">${item.name}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 600; font-size: 12px; color: ${getRatingColor(item.cat)};">${item.cat}</span>
                    <span style="font-family: monospace; color: #888888; font-size: 12px;">${item.score}/10</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Footer with Hourly Auto-Sync and Offline Cache Status -->
          <div style="border-top: 1px solid #f0f0f0; margin-top: 16px; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #888888;">
            <span>${isOffline ? '⚡ Offline (cached)' : '⏱ Hourly auto-update'}</span>
            <span style="font-family: monospace;">Updated ${data.updatedTime}</span>
          </div>
        </div>
      `;

      // Change Location Button Listener
      container.querySelector('#aa-loc-btn').onclick = async () => {
        const query = prompt('Enter a city name to forecast (e.g. London, Tokyo, San Francisco):', cityName);
        if (query && query.trim() && query.trim().toLowerCase() !== cityName.toLowerCase()) {
          try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=1&language=en&format=json`);
            const json = await res.json();
            if (json?.results?.[0]) {
              cityName = json.results[0].name;
              lat = json.results[0].latitude;
              lon = json.results[0].longitude;
              fetchData(true);
            } else {
              alert('City not found. Please try another name.');
            }
          } catch(e) {
            alert('Could not search location. Check your internet connection.');
          }
        }
      };

      // Refresh Button Listener
      container.querySelector('#aa-refresh-btn').onclick = () => fetchData(true);
    }

    async function fetchData(forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!forceRefresh && (Date.now() - parsed.timestamp < ONE_HOUR_MS)) {
          renderWidget(parsed.data, false);
          return;
        }
        if (!navigator.onLine) {
          renderWidget(parsed.data, true);
          return;
        }
      }

      try {
        const [aqRes, wRes] = await Promise.all([
          fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`),
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,uv_index`)
        ]);

        const aqData = await aqRes.json();
        const wData = await wRes.json();

        const aqi = Math.round(aqData?.current?.us_aqi || 42);
        const tempC = wData?.current?.temperature_2m || 20;
        const humidity = Math.round(wData?.current?.relative_humidity_2m || 50);
        const uvIndex = Math.round(wData?.current?.uv_index || 3);

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const payload = {
          aqi,
          tempC,
          humidity,
          uvIndex,
          indices: calculateHealthIndices(aqi, tempC, humidity, uvIndex),
          updatedTime: timeStr
        };

        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: payload }));
        renderWidget(payload, false);
      } catch (err) {
        if (cached) {
          renderWidget(JSON.parse(cached).data, true);
        }
      }
    }

    fetchData(false);
    setInterval(() => fetchData(true), ONE_HOUR_MS);
    window.addEventListener('online', () => fetchData(true));
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#accuair-widget, .accuair-widget').forEach(initWidget);
  });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    document.querySelectorAll('#accuair-widget, .accuair-widget').forEach(initWidget);
  }
})();
