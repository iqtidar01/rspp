# Environment Variables Setup Guide

## Quick Setup for SiteGround Email

### For Local Development

Create a `.env` file in the `powerbi-backend` directory with the following content:

```env
# Server Configuration
PORT=3001

# SMTP Email Configuration (SiteGround - Local)
SMTP_HOST=gukm1074.siteground.biz
SMTP_PORT=465
SMTP_SECURE=true
SMTP_EMAIL=powerbi-admin@rspponderwijs.nl
SMTP_PASSWORD=(@D`#l%lk^l#

# Power BI Configuration
AAD_TENANT_ID=your-azure-ad-tenant-id
SP_CLIENT_ID=your-service-principal-client-id
SP_CLIENT_SECRET=your-service-principal-client-secret
PBI_WORKSPACE_ID=your-power-bi-workspace-id
```

### For Render/Cloud Deployment

**⚠️ Important**: SiteGround may block connections from cloud platforms. If you encounter timeout errors, consider using SendGrid, Mailgun, or AWS SES (see `ALTERNATIVE-EMAIL-SERVICES.md`).

For Render, use these settings (though SiteGround may still block):

```env
# Server Configuration
PORT=3001

# SMTP Email Configuration (SiteGround - Render/Cloud)
SMTP_HOST=gukm1074.siteground.biz
SMTP_PORT=587
SMTP_SECURE=false
SMTP_EMAIL=powerbi-admin@rspponderwijs.nl
SMTP_PASSWORD=(@D`#l%lk^l#

# Power BI Configuration
AAD_TENANT_ID=your-azure-ad-tenant-id
SP_CLIENT_ID=your-service-principal-client-id
SP_CLIENT_SECRET=your-service-principal-client-secret
PBI_WORKSPACE_ID=your-power-bi-workspace-id
```

## SiteGround SMTP Settings

### Local Development:
- **SMTP Host**: `gukm1074.siteground.biz`
- **SMTP Port**: `465` (SSL)
- **SMTP Secure**: `true` (required for port 465)
- **Email**: `powerbi-admin@rspponderwijs.nl`
- **Password**: `(@D`#l%lk^l#`

### Render/Cloud Deployment:
- **SMTP Host**: `gukm1074.siteground.biz`
- **SMTP Port**: `587` (TLS) - recommended for cloud platforms
- **SMTP Secure**: `false` (TLS/STARTTLS)
- **Email**: `powerbi-admin@rspponderwijs.nl`
- **Password**: `(@D`#l%lk^l#`

## Important Notes

1. **Port 465 requires SSL**: Make sure `SMTP_SECURE=true` when using port 465
2. **Port 587 uses TLS**: Use `SMTP_SECURE=false` when using port 587
3. **Cloud Deployments**: For Render/Heroku, prefer port 587 (TLS) over 465 (SSL)
4. **SiteGround Blocking**: SiteGround may block connections from cloud platforms. If timeouts persist, use SendGrid, Mailgun, or AWS SES
5. **Password**: The password contains special characters - make sure to copy it exactly
6. **Security**: Never commit your `.env` file to version control

## Testing

After setting up your `.env` file:

1. Restart your server
2. Test SMTP connection:
   ```bash
   GET http://localhost:3001/api/test-smtp
   ```
3. Send a test OTP:
   ```bash
   POST http://localhost:3001/api/send-otp
   Content-Type: application/json
   
   {
     "email": "sameerkhan.devpro@gmail.com"
   }
   ```

## Troubleshooting

### Error: "535 Incorrect authentication data"
- ✅ Verify email and password are correct
- ✅ Check password doesn't have extra spaces
- ✅ Ensure `SMTP_SECURE=true` for port 465

### Error: "ECONNECTION"
- ✅ Check `SMTP_HOST` is correct
- ✅ Verify port 465 is not blocked by firewall
- ✅ Try connecting from your server to the SMTP host

### Email Not Sending
- ✅ Check server logs for detailed error messages
- ✅ Verify email account is active
- ✅ Test SMTP connection using the test endpoint

