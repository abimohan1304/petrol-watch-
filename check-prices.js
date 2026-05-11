/**
 * PetrolWatch — Daily Price Check & Email Alert
 * Runs via GitHub Actions cron job (free)
 *
 * Data source: Gaspy NZ public API + AA NZ fuel price data
 * Email: Gmail SMTP via nodemailer (free)
 */

const nodemailer = require('nodemailer');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  region: 'Tauranga',
  lat: -37.6878,
  lng: 176.1651,
  radiusKm: 15,
  fuelTypes: ['91', '95', 'diesel'],
  alertEmail: process.env.ALERT_EMAIL,
  gmailUser: process.env.GMAIL_USER,
  gmailPass: process.env.GMAIL_APP_PASSWORD,
  priceThresholdCents: parseInt(process.env.PRICE_THRESHOLD || '999'),
};

// ─── FETCH GASPY DATA ─────────────────────────────────────────────────────────
// Gaspy (gaspy.nz) is the main NZ crowd-sourced petrol price app.
// Their public API does not require auth for basic station data.
async function fetchGaspyStations(fuelTypeId) {
  const { default: fetch } = await import('node-fetch');

  // Gaspy API - public endpoint
  const url = `https://www.gaspy.nz/api/v6/stations?lat=${CONFIG.lat}&lng=${CONFIG.lng}&radius=${CONFIG.radiusKm}&fuelType=${fuelTypeId}&limit=30`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PetrolWatchNZ/1.0 (community price tracker)',
        'Accept': 'application/json',
      },
      timeout: 8000,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.stations || data || [];
  } catch (e) {
    console.warn(`Gaspy fetch failed for fuelType ${fuelTypeId}:`, e.message);
    return [];
  }
}

// ─── FETCH AA PETROL PRICE INDEX ──────────────────────────────────────────────
// AA NZ publishes weekly regional average prices
async function fetchAARegionalPrice() {
  const { default: fetch } = await import('node-fetch');

  try {
    // AA's fuel price JSON feed (public)
    const res = await fetch('https://www.aa.co.nz/assets/json/fuel-prices.json', {
      headers: { 'User-Agent': 'PetrolWatchNZ/1.0' },
      timeout: 8000,
    });
    if (!res.ok) throw new Error(`AA feed HTTP ${res.status}`);
    const data = await res.json();

    // Find Tauranga / Bay of Plenty regional data
    const region = data.find(r =>
      r.region && (
        r.region.toLowerCase().includes('bay of plenty') ||
        r.region.toLowerCase().includes('tauranga')
      )
    );
    return region || null;
  } catch (e) {
    console.warn('AA price feed unavailable:', e.message);
    return null;
  }
}

// ─── NORMALISE STATION DATA ───────────────────────────────────────────────────
function normaliseStations(raw) {
  if (!Array.isArray(raw) || !raw.length) return [];

  return raw.map(s => ({
    name: s.name || s.station_name || 'Unknown Station',
    brand: s.brand || s.company || '',
    address: s.address || s.full_address || '',
    price: parseFloat(s.price || s.fuel_price || 0) * 100, // $ → cents
    lastUpdated: s.updated || s.last_updated || 'recently',
    distance: parseFloat(s.distance || 0).toFixed(1),
  })).filter(s => s.price > 0).sort((a, b) => a.price - b.price);
}

// ─── BUILD EMAIL HTML ─────────────────────────────────────────────────────────
function buildEmailHTML(results, aaData, date) {
  const { stations91, stations95, stationsDiesel } = results;

  const stationRows = (stations) => {
    if (!stations.length) return '<tr><td colspan="4" style="color:#666;padding:8px;">No data available</td></tr>';
    return stations.slice(0, 8).map((s, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#fff'}">
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">
          ${i === 0 ? '🏆 ' : i === 1 ? '🥈 ' : ''}<strong>${s.name}</strong><br>
          <span style="color:#888;font-size:12px;">${s.address}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:18px;color:${i === 0 ? '#16a34a' : '#333'};">
          ${Math.round(s.price)}¢
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">${s.distance} km</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:12px;">${s.lastUpdated}</td>
      </tr>
    `).join('');
  };

  const cheapest91 = stations91[0];
  const threshold = CONFIG.priceThresholdCents;
  const belowThreshold = cheapest91 && cheapest91.price <= threshold;

  const aaSection = aaData ? `
    <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:20px 0;">
      <strong>📊 AA Regional Average (${aaData.region || 'Bay of Plenty'})</strong><br>
      91: ${aaData['91'] || 'N/A'}¢/L &nbsp;|&nbsp; 95: ${aaData['95'] || 'N/A'}¢/L &nbsp;|&nbsp; Diesel: ${aaData['diesel'] || 'N/A'}¢/L
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:#0a0a0f;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
      <div style="font-size:32px;letter-spacing:4px;color:#f5c518;font-weight:900;">⛽ PETROLWATCH</div>
      <div style="color:#8888aa;font-size:12px;letter-spacing:3px;margin-top:6px;">TAURANGA DAILY DIGEST — ${date}</div>
    </div>

    <!-- Alert Banner -->
    ${belowThreshold ? `
    <div style="background:#16a34a;padding:16px 32px;text-align:center;color:#fff;">
      🎉 <strong>PRICE ALERT!</strong> Cheapest 91 is ${Math.round(cheapest91.price)}¢/L — below your ${threshold}¢ target!
    </div>
    ` : ''}

    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">

      <!-- Cheapest summary box -->
      ${cheapest91 ? `
      <div style="background:linear-gradient(135deg,#fef9c3,#fef3c7);border:2px solid #f5c518;border-radius:10px;padding:20px;margin-bottom:28px;">
        <div style="font-size:11px;letter-spacing:3px;color:#92400e;text-transform:uppercase;margin-bottom:8px;">🏆 Today's Best Price — 91 Unleaded</div>
        <div style="font-size:28px;font-weight:900;color:#0a0a0f;">${cheapest91.name}</div>
        <div style="color:#666;font-size:14px;margin-bottom:12px;">📍 ${cheapest91.address}</div>
        <div style="font-size:44px;font-weight:900;color:#16a34a;font-family:monospace;">${Math.round(cheapest91.price)}<span style="font-size:18px;color:#666;">¢/L</span></div>
        <div style="font-size:13px;color:#888;margin-top:6px;">💰 Save ~${Math.max(0, Math.round((stations91[stations91.length-1]?.price || 0) - cheapest91.price))}¢/L vs most expensive nearby</div>
      </div>
      ` : ''}

      ${aaSection}

      <!-- 91 Unleaded Table -->
      <h3 style="margin:0 0 12px;color:#0a0a0f;font-size:15px;letter-spacing:1px;text-transform:uppercase;">⛽ 91 Unleaded</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">
        <thead>
          <tr style="background:#f4f4f5;">
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Station</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Price</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Distance</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Updated</th>
          </tr>
        </thead>
        <tbody>${stationRows(stations91)}</tbody>
      </table>

      <!-- 95 Premium Table -->
      <h3 style="margin:0 0 12px;color:#0a0a0f;font-size:15px;letter-spacing:1px;text-transform:uppercase;">⭐ 95 Premium</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">
        <thead>
          <tr style="background:#f4f4f5;">
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Station</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Price</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Distance</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Updated</th>
          </tr>
        </thead>
        <tbody>${stationRows(stations95)}</tbody>
      </table>

      <!-- Diesel Table -->
      <h3 style="margin:0 0 12px;color:#0a0a0f;font-size:15px;letter-spacing:1px;text-transform:uppercase;">🚛 Diesel</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">
        <thead>
          <tr style="background:#f4f4f5;">
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Station</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Price</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Distance</th>
            <th style="text-align:left;padding:10px 12px;color:#666;font-weight:600;font-size:12px;">Updated</th>
          </tr>
        </thead>
        <tbody>${stationRows(stationsDiesel)}</tbody>
      </table>

      <!-- Footer note -->
      <div style="border-top:1px solid #eee;padding-top:20px;text-align:center;color:#aaa;font-size:12px;">
        Data from Gaspy NZ &amp; AA Petrol Watch &nbsp;·&nbsp; Prices in NZD cents per litre<br>
        <a href="YOUR_GITHUB_PAGES_URL" style="color:#f5c518;">View Live Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// ─── SEND EMAIL VIA GMAIL ─────────────────────────────────────────────────────
async function sendEmail(html, subject) {
  if (!CONFIG.gmailUser || !CONFIG.gmailPass || !CONFIG.alertEmail) {
    console.log('Email config missing — printing report to console instead:\n');
    console.log(subject);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: CONFIG.gmailUser,
      pass: CONFIG.gmailPass, // Use Gmail App Password (not your real password)
    },
  });

  const info = await transporter.sendMail({
    from: `"⛽ PetrolWatch Tauranga" <${CONFIG.gmailUser}>`,
    to: CONFIG.alertEmail,
    subject,
    html,
  });

  console.log('Email sent:', info.messageId);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔍 PetrolWatch — Checking prices for ${CONFIG.region}...`);

  // Gaspy fuel type IDs: 2=91, 3=95, 5=Diesel
  const [raw91, raw95, rawDiesel, aaData] = await Promise.all([
    fetchGaspyStations(2),
    fetchGaspyStations(3),
    fetchGaspyStations(5),
    fetchAARegionalPrice(),
  ]);

  const stations91     = normaliseStations(raw91);
  const stations95     = normaliseStations(raw95);
  const stationsDiesel = normaliseStations(rawDiesel);

  console.log(`Found: ${stations91.length} 91 stations, ${stations95.length} 95 stations, ${stationsDiesel.length} diesel stations`);

  if (stations91.length > 0) {
    const cheapest = stations91[0];
    console.log(`Cheapest 91: ${cheapest.name} @ ${Math.round(cheapest.price)}¢/L`);
  }

  const date = new Date().toLocaleDateString('en-NZ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Pacific/Auckland'
  });

  const html = buildEmailHTML({ stations91, stations95, stationsDiesel }, aaData, date);

  const cheapest91 = stations91[0];
  const belowThreshold = cheapest91 && cheapest91.price <= CONFIG.priceThresholdCents;
  const subject = belowThreshold
    ? `🎉 Price Alert! ${Math.round(cheapest91.price)}¢/L at ${cheapest91.name} — PetrolWatch Tauranga`
    : `⛽ Tauranga Petrol Prices — ${date} | Best: ${cheapest91 ? Math.round(cheapest91.price) + '¢' : 'N/A'}`;

  await sendEmail(html, subject);
  console.log('✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
