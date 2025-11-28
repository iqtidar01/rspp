# Alternative Email Services for Cloud Deployments

If SiteGround SMTP is blocking connections from Render (or other cloud platforms), here are better alternatives:

## Option 1: SendGrid (Recommended - Free Tier Available)

SendGrid is designed for cloud deployments and offers a free tier.

### Setup Steps:

1. **Sign up**: https://sendgrid.com (Free tier: 100 emails/day)

2. **Create API Key**:
   - Go to Settings → API Keys
   - Create a new API Key with "Mail Send" permissions
   - Copy the API key

3. **Update Environment Variables in Render**:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_EMAIL=apikey
   SMTP_PASSWORD=your-sendgrid-api-key-here
   ```

4. **Verify Sender Identity**:
   - Go to Settings → Sender Authentication
   - Verify your domain or single sender email

### Benefits:
- ✅ Works perfectly on cloud platforms
- ✅ Free tier: 100 emails/day
- ✅ Excellent deliverability
- ✅ Detailed analytics
- ✅ Easy to set up

---

## Option 2: Mailgun (Great for High Volume)

Mailgun offers a generous free tier and excellent cloud compatibility.

### Setup Steps:

1. **Sign up**: https://www.mailgun.com (Free tier: 5,000 emails/month)

2. **Get SMTP Credentials**:
   - Go to Sending → Domain Settings
   - Copy SMTP credentials (username and password)

3. **Update Environment Variables in Render**:
   ```env
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_EMAIL=postmaster@your-domain.mailgun.org
   SMTP_PASSWORD=your-mailgun-password
   ```

### Benefits:
- ✅ Excellent cloud compatibility
- ✅ Free tier: 5,000 emails/month
- ✅ Great for transactional emails
- ✅ API and SMTP support

---

## Option 3: AWS SES (Most Cost-Effective)

Amazon SES is very affordable and reliable for production use.

### Setup Steps:

1. **Create AWS Account**: https://aws.amazon.com

2. **Set up SES**:
   - Go to AWS SES Console
   - Verify your email address or domain
   - Move out of sandbox mode (request production access)

3. **Get SMTP Credentials**:
   - Go to SMTP Settings
   - Create SMTP credentials
   - Note the SMTP endpoint (varies by region)

4. **Update Environment Variables in Render**:
   ```env
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Use your region's endpoint
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_EMAIL=your-smtp-username
   SMTP_PASSWORD=your-smtp-password
   ```

### Benefits:
- ✅ Very affordable ($0.10 per 1,000 emails)
- ✅ Highly reliable
- ✅ Excellent for production
- ✅ Scales automatically

---

## Option 4: Gmail SMTP (Quick Fix)

If you need a quick solution, Gmail SMTP works well with cloud platforms.

### Setup Steps:

1. **Enable 2-Step Verification** on your Gmail account

2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Power BI Backend"
   - Copy the 16-character password

3. **Update Environment Variables in Render**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_EMAIL=your-email@gmail.com
   SMTP_PASSWORD=your-16-character-app-password
   ```

### Benefits:
- ✅ Free
- ✅ Works on cloud platforms
- ✅ Easy to set up
- ⚠️ Limited to 500 emails/day
- ⚠️ Not ideal for production

---

## Quick Migration Guide

### Step 1: Choose Your Service
- **Free & Simple**: SendGrid or Mailgun
- **Production & Scale**: AWS SES
- **Quick Fix**: Gmail

### Step 2: Update Render Environment Variables
1. Go to your Render service dashboard
2. Navigate to Environment
3. Update SMTP variables:
   - `SMTP_HOST`
   - `SMTP_PORT` (usually 587)
   - `SMTP_SECURE` (usually false)
   - `SMTP_EMAIL`
   - `SMTP_PASSWORD`

### Step 3: Test
```bash
POST https://your-app.onrender.com/api/send-otp
Content-Type: application/json

{
  "email": "your-email@example.com"
}
```

### Step 4: Monitor Logs
Check Render logs to confirm which port successfully connected.

---

## Why SiteGround Fails on Cloud Platforms

SiteGround (and many shared hosting providers) often block SMTP connections from:
- Cloud platform IPs (Render, Heroku, AWS, etc.)
- Dynamic IP addresses
- IP ranges they don't recognize

This is a security measure to prevent spam, but it makes cloud deployments difficult.

**Solution**: Use email services designed for cloud platforms (SendGrid, Mailgun, AWS SES) which:
- ✅ Allow connections from any IP
- ✅ Provide better deliverability
- ✅ Offer detailed analytics
- ✅ Scale automatically
- ✅ Have better uptime

---

## Recommendation

For your Power BI Backend on Render:

1. **Start with SendGrid** (free tier, easy setup)
2. **Move to AWS SES** when you need more volume
3. **Keep SiteGround** only for local development

This gives you:
- ✅ Reliable email delivery on Render
- ✅ Better error handling
- ✅ Production-ready setup
- ✅ Cost-effective scaling

