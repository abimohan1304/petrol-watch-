# ⛽ PetrolWatch Tauranga

A free website that shows real-time petrol prices across Tauranga, NZ — with daily email alerts when cheap fuel is found.

**Live Demo:** `https://YOUR_USERNAME.github.io/petrol-watch`

---

## 🚀 Setup Guide (takes ~15 minutes, all free)

### Step 1 — Fork & Deploy to GitHub Pages

1. Create a [GitHub account](https://github.com) if you don't have one
2. Create a **new repository** named `petrol-watch` (must be public for free Pages)
3. Upload all files from this folder to the repo
4. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**
5. Your site will be live at: `https://YOUR_USERNAME.github.io/petrol-watch`

---

### Step 2 — Enable Email Notifications (Gmail)

This uses **Gmail + GitHub Actions** (both free). The script runs every morning at 7:30 AM NZT.

#### A) Create a Gmail App Password

> ⚠️ You need 2-Factor Authentication enabled on your Gmail first.

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select app: **Mail** → Device: **Other** → Name: `PetrolWatch`
3. Copy the 16-character password shown

#### B) Add GitHub Secrets

In your GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

| Secret Name | Value |
|---|---|
| `GMAIL_USER` | your Gmail address, e.g. `you@gmail.com` |
| `GMAIL_APP_PASSWORD` | the 16-char app password from step above |
| `ALERT_EMAIL` | email to send alerts to (can be same as above) |
| `PRICE_THRESHOLD` | price in cents to trigger alert, e.g. `215` |

#### C) Enable GitHub Actions

1. Go to the **Actions** tab in your repo
2. Click **"I understand my workflows, go ahead and enable them"**
3. The workflow runs daily at 7:30 AM NZT automatically
4. To test it manually: Actions → **Daily Petrol Price Alert** → **Run workflow**

---

### Step 3 — Enable In-Browser Email Alerts (Optional)

For the subscribe form on the website to work, set up **EmailJS** (free — 200 emails/month):

1. Sign up at [emailjs.com](https://www.emailjs.com/) (free)
2. Create an **Email Service** (connect Gmail)
3. Create an **Email Template** with these variables:
   - `{{to_email}}` — recipient
   - `{{region}}` — e.g. Tauranga
   - `{{cheapest_station}}` — station name
   - `{{cheapest_price}}` — price in cents
   - `{{fuel_type}}` — 91, 95, or diesel
   - `{{threshold}}` — user's target price
4. In `index.html`, replace at the top:
   ```js
   const EMAILJS_SERVICE_ID  = 'service_xxxxxxx';  // from EmailJS dashboard
   const EMAILJS_TEMPLATE_ID = 'template_xxxxxxx'; // your template ID
   const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';  // Account → API Keys
   ```

---

## 📊 Data Sources

| Source | Type | Coverage |
|---|---|---|
| [Gaspy NZ](https://www.gaspy.nz) | Live crowd-sourced prices | All NZ stations |
| [AA Petrol Watch](https://www.aa.co.nz/cars/motoring-blog/fuel-prices/) | Regional weekly averages | Bay of Plenty |

Gaspy is NZ's most popular petrol price app. Their public API provides live station-level prices without authentication.

---

## 📁 File Structure

```
petrol-watch/
├── index.html                    ← Main website (GitHub Pages serves this)
├── scripts/
│   └── check-prices.js           ← Node.js email alert script
├── .github/
│   └── workflows/
│       └── daily-alert.yml       ← GitHub Actions cron schedule
└── README.md
```

---

## 💰 Cost Summary

| Service | Cost |
|---|---|
| GitHub Pages (website hosting) | **Free** |
| GitHub Actions (scheduled emails) | **Free** (2000 min/month) |
| EmailJS (subscribe form emails) | **Free** (200/month) |
| Gaspy API | **Free** (public) |
| AA price feed | **Free** (public) |
| **Total** | **$0/month** |

---

## 🔧 Customisation

**Change the region:** Edit `TAURANGA_LAT`, `TAURANGA_LNG`, `RADIUS_KM` in both `index.html` and `scripts/check-prices.js`

**Change alert time:** Edit the cron in `.github/workflows/daily-alert.yml`
- Format: `mm HH * * *` in UTC
- 7:30 AM NZST = `30 19 * * *`
- 8:00 AM NZST = `00 20 * * *`

**Add more fuel types:** Gaspy fuel type IDs:
- 1 = 87 Unleaded, 2 = 91, 3 = 95, 4 = 98, 5 = Diesel, 6 = LPG

---

## 🐛 Troubleshooting

**Prices not loading?**
- The site falls back to demo data if Gaspy API is unavailable
- Check browser console for API errors
- CORS proxy (`allorigins.win`) may occasionally be slow

**Emails not sending?**
- Check GitHub Actions logs (Actions tab → workflow run → logs)
- Verify all 4 secrets are set correctly
- Make sure Gmail 2FA is enabled before generating App Password
- Try running the workflow manually first

**Gaspy API changes?**
- If Gaspy updates their API, check [gaspy.nz](https://www.gaspy.nz) or open a GitHub Issue
- Alternative: use the [GasBuddy API](https://www.gasbuddy.com) or scrape [pricewatch.co.nz](https://www.pricewatch.co.nz)
