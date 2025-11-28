# SendGrid Quick Setup - Fix Render Free Tier SMTP Issue

## 🚨 Problem: Render Free Tier Blocks SMTP Ports

Render's **FREE tier blocks all SMTP ports** (25, 465, 587) as of September 2024. This means:
- ❌ SMTP will NEVER work on Render free tier
- ❌ SiteGround SMTP won't work
- ❌ Gmail SMTP won't work
- ❌ Any SMTP service won't work

## ✅ Solution: Use SendGrid API

SendGrid API uses HTTP (not SMTP), so it works perfectly on Render's free tier!

---

## Quick Setup (5 minutes)

### Step 1: Sign Up for SendGrid (Free)

1. Go to: https://sendgrid.com
2. Click "Start for Free"
3. Sign up (free tier: **100 emails/day**)
4. Verify your email address

### Step 2: Create API Key

1. Go to: **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Name it: `Power BI Backend`
4. Select **"Full Access"** (or at least "Mail Send" permission)
5. Click **"Create & View"**
6. **COPY THE API KEY** (you won't see it again!)

### Step 3: Verify Sender Email (Required)

1. Go to: **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Enter your email (e.g., `powerbi-admin@rspponderwijs.nl`)
4. Fill in the form
5. Check your email and click the verification link

**OR** verify your domain (better for production)

### Step 4: Update Render Environment Variables

In your Render dashboard:

1. Go to your service → **Environment**
2. Add/Update these variables:

```env
# SendGrid API (works on Render free tier!)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=powerbi-admin@rspponderwijs.nl

# Optional: Keep SMTP for local development
SMTP_HOST=gukm1074.siteground.biz
SMTP_PORT=465
SMTP_SECURE=true
SMTP_EMAIL=powerbi-admin@rspponderwijs.nl
SMTP_PASSWORD=(@D`#l%lk^l#
```

**Important:**
- `SENDGRID_API_KEY` is required (starts with `SG.`)
- `SENDGRID_FROM_EMAIL` should be your verified sender email
- SMTP variables are optional (only for local dev)

### Step 5: Install Dependencies

The code already includes `@sendgrid/mail`, but if you need to install:

```bash
npm install @sendgrid/mail
```

### Step 6: Redeploy

1. Commit your changes (if any)
2. Render will auto-deploy
3. Or manually redeploy from Render dashboard

### Step 7: Test

```bash
POST https://your-app.onrender.com/api/send-otp
Content-Type: application/json

{
  "email": "your-email@example.com"
}
```

---

## How It Works

The backend automatically:
1. ✅ Checks for `SENDGRID_API_KEY` first
2. ✅ Uses SendGrid API if available (works on Render free tier)
3. ✅ Falls back to SMTP if SendGrid not configured (for local dev)

---

## Benefits

- ✅ **Works on Render free tier** (no SMTP ports needed)
- ✅ **Free tier**: 100 emails/day
- ✅ **Reliable**: Better deliverability than SMTP
- ✅ **Fast**: API is faster than SMTP
- ✅ **Analytics**: Track email opens, clicks, etc.

---

## Troubleshooting

### Error: "Unauthorized"
- Check your `SENDGRID_API_KEY` is correct
- Make sure API key has "Mail Send" permission

### Error: "Forbidden"
- Verify your sender email in SendGrid dashboard
- Check "Sender Authentication" → "Verified Senders"

### Error: "Invalid email"
- Make sure `SENDGRID_FROM_EMAIL` matches your verified sender

---

## Cost

- **Free**: 100 emails/day forever
- **Paid**: Starts at $19.95/month for 50,000 emails

For OTP emails, the free tier is usually enough!

---

## Alternative: Upgrade Render Plan

If you prefer to keep using SMTP:
- Upgrade Render to **Paid Plan** ($7/month minimum)
- This unblocks SMTP ports
- Then SiteGround/Gmail SMTP will work

But SendGrid API is still recommended for better reliability!

