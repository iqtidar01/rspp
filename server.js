require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

let otpStore = {};

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.SMTP_EMAIL,
//     pass: process.env.SMTP_PASSWORD
//   }
// });

// SMTP Configuration
// Helper to safely get password (handles special characters)
const getSMTPPassword = () => {
  const password = process.env.SMTP_PASSWORD;
  if (!password) {
    console.warn("⚠️  SMTP_PASSWORD is not set in .env");
    return "";
  }
  const cleanedPassword = password.trim();
  
  console.log(`🔐 Password length: ${cleanedPassword.length}`);
  console.log(`🔐 Password first char: ${cleanedPassword.charAt(0)}`);
  console.log(`🔐 Password last char: ${cleanedPassword.charAt(cleanedPassword.length - 1)}`);
  console.log(`🔐 Password has special chars: ${/[^a-zA-Z0-9]/.test(cleanedPassword)}`);
  
  return cleanedPassword;
};

// SMTP Configuration - Cloud-friendly settings
// For cloud deployments (like Render), prefer port 587 (TLS) over 465 (SSL)
const smtpPort = Number(process.env.SMTP_PORT) || (process.env.NODE_ENV === 'production' ? 587 : 465);
const isSecure = smtpPort === 465 || process.env.SMTP_SECURE === "true";

// Get credentials
const smtpEmail = process.env.SMTP_EMAIL;
const smtpPassword = getSMTPPassword();

// Log credentials (safely) for debugging
console.log("\n📧 SMTP Configuration:");
console.log(`   Email: ${smtpEmail}`);
console.log(`   Password set: ${smtpPassword ? "YES (length: " + smtpPassword.length + ")" : "NO"}`);
if (smtpPassword) {
  console.log(`   Password preview: ${smtpPassword.substring(0, 3)}...${smtpPassword.substring(smtpPassword.length - 2)}`);
  console.log(`   Password contains special chars: ${/[^a-zA-Z0-9]/.test(smtpPassword)}`);
}
console.log(`   Host: ${process.env.SMTP_HOST}`);
console.log(`   Port: ${smtpPort}`);
console.log(`   Secure: ${isSecure}`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);

// Create transporter helper function
const createTransporter = (port, secure) => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: secure,
    auth: {
      user: smtpEmail,
      pass: smtpPassword,
      method: 'LOGIN',
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3',
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    pool: true,
    maxConnections: 1,
    maxMessages: 3,
    debug: process.env.SMTP_DEBUG === "true",
    logger: process.env.SMTP_DEBUG === "true",
  });
};

// Create initial transporter with cloud-optimized settings
let transporter = createTransporter(smtpPort, isSecure);

// Verify SMTP connection on startup with fallback
const verifySMTPConnection = async () => {
  const portsToTry = [
    { port: smtpPort, secure: isSecure },
    // Fallback: Try port 587 (TLS) if 465 fails (common for cloud deployments)
    { port: 587, secure: false },
    // Fallback: Try port 465 (SSL) if 587 fails
    { port: 465, secure: true },
  ];

  // Remove duplicates
  const uniquePorts = portsToTry.filter((p, index, self) => 
    index === self.findIndex(t => t.port === p.port && t.secure === p.secure)
  );

  for (const config of uniquePorts) {
    try {
      console.log(`🔍 Verifying SMTP connection on port ${config.port} (secure: ${config.secure})...`);
      const testTransporter = createTransporter(config.port, config.secure);
      await testTransporter.verify();
      console.log(`✅ SMTP server connection verified successfully on port ${config.port}`);
      
      // Update the main transporter if we found a working port
      if (config.port !== smtpPort || config.secure !== isSecure) {
        console.log(`⚠️  Using fallback port ${config.port} instead of configured port ${smtpPort}`);
        // Note: We'll recreate transporter in send-otp if needed
      }
      
      return { success: true, port: config.port, secure: config.secure };
    } catch (error) {
      console.error(`❌ Port ${config.port} failed:`, error.message);
      if (config === uniquePorts[uniquePorts.length - 1]) {
        // Last attempt failed
        console.error("\n⚠️  All SMTP port attempts failed. Common issues:");
        console.error("   1. Check SMTP_HOST is correct");
        console.error("   2. Verify SMTP_EMAIL and SMTP_PASSWORD are correct");
        console.error("   3. For cloud deployments (Render, Heroku, etc.), try port 587 (TLS)");
        console.error("   4. Check if SMTP server allows connections from cloud IPs");
        console.error("   5. Verify firewall/network allows SMTP connections");
        
        if (error.code === "ETIMEDOUT" || error.code === "ECONNECTION") {
          console.error("\n💡 TIP: For Render deployments, set in environment variables:");
          console.error("   SMTP_PORT=587");
          console.error("   SMTP_SECURE=false");
        }
      }
    }
  }
  
  return { success: false, port: null, secure: null };
};

// Environment variables
const { AAD_TENANT_ID, SP_CLIENT_ID, SP_CLIENT_SECRET, PBI_WORKSPACE_ID } =
  process.env;

// Datasets that have RLS configured (from client specification)
const RLS_ENABLED_DATASETS = [
  "a48db15f-a2b5-41a9-a46d-67991ae69283", // Report 1: For users via RLS
  "1ca5fa8b-d1a9-4ce5-b740-d9f0a148ad62", // Report 2: For project team with school filter
  "7a7aa6bd-d65c-4a4c-9859-b9533f3cb974", // Report 3: New test report (524708e1-dfba-4d89-ab9b-40a520be203f)
];

// RLS Role name (from client: "Role in pbi report: RLS[Gebruiker]")
const RLS_ROLE_NAME = "Gebruiker"; // Dutch for "User"

// Validate environment variables
const validateEnvVars = () => {
  const required = {
    AAD_TENANT_ID,
    SP_CLIENT_ID,
    SP_CLIENT_SECRET,
    PBI_WORKSPACE_ID,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

// Get Azure AD access token
const getAccessToken = async () => {
  const url = `https://login.microsoftonline.com/${AAD_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: SP_CLIENT_ID,
    client_secret: SP_CLIENT_SECRET,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });

  try {
    console.log("🔐 Requesting Azure AD access token...");
    const response = await axios.post(url, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log("✅ Access token obtained successfully");
    return response.data.access_token;
  } catch (error) {
    console.error("❌ ERROR getting access token:");
    console.error("Status:", error.response?.status);
    console.error(
      "Error Details:",
      JSON.stringify(error.response?.data, null, 2)
    );
    console.error("Tenant ID:", AAD_TENANT_ID);
    console.error("Client ID:", SP_CLIENT_ID);
    console.error(
      "Client Secret:",
      SP_CLIENT_SECRET
        ? "PROVIDED (length: " + SP_CLIENT_SECRET.length + ")"
        : "MISSING"
    );
    throw new Error(
      `Failed to obtain access token: ${
        error.response?.data?.error_description || error.message
      }`
    );
  }
};

// Email validation helper
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// SendGrid API configuration (works on Render free tier - no SMTP ports needed)
const sendGridApiKey = process.env.SENDGRID_API_KEY;
const sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_EMAIL;

if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
  console.log("✅ SendGrid API configured (bypasses SMTP port restrictions)");
} else {
  console.log("ℹ️  SendGrid API not configured - using SMTP");
}

// Send email via SendGrid API (works on Render free tier)
const sendEmailViaSendGrid = async (to, subject, html) => {
  if (!sendGridApiKey) {
    throw new Error("SendGrid API key not configured");
  }

  const msg = {
    to: to,
    from: sendGridFromEmail,
    subject: subject,
    html: html,
  };

  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error("SendGrid API Error:", error.response?.body || error.message);
    throw error;
  }
};

// ---- SEND OTP ----
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;

  // Validate email presence
  if (!email) {
    return res.status(400).json({ success: false, error: "Email required" });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: "Invalid email format" });
  }

  // Normalize email (lowercase for consistency)
  const normalizedEmail = email.toLowerCase().trim();

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP with expiration (5 minutes)
  otpStore[normalizedEmail] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  // Try SendGrid API first (works on Render free tier - no SMTP ports needed)
  if (sendGridApiKey) {
    try {
      console.log(`📧 Sending OTP via SendGrid API to: ${normalizedEmail}`);
      
      await sendEmailViaSendGrid(
        normalizedEmail,
        "Your Verification Code",
        `
          <h2>Your OTP Code</h2>
          <p>Your verification code is:</p>
          <h1>${otp}</h1>
          <p>This code expires in 5 minutes.</p>
        `
      );

      console.log(`✅ OTP sent successfully via SendGrid API to: ${normalizedEmail}`);
      return res.json({ success: true, message: "OTP sent to email" });
    } catch (err) {
      console.error("❌ SendGrid API failed, falling back to SMTP:", err.message);
      // Fall through to SMTP retry logic below
    }
  }

  // Fallback to SMTP (may not work on Render free tier due to port restrictions)
  // Try sending with retry logic for different ports
  // For cloud deployments, prioritize port 587 (TLS) first
  const isCloudEnvironment = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.HEROKU;
  
  const portsToTry = isCloudEnvironment
    ? [
        // Cloud-friendly ports first
        { port: 587, secure: false, name: '587 (TLS)' },
        { port: smtpPort, secure: isSecure, name: `${smtpPort} (configured)` },
        { port: 465, secure: true, name: '465 (SSL)' },
      ]
    : [
        // Local development - try configured port first
        { port: smtpPort, secure: isSecure, name: `${smtpPort} (configured)` },
        { port: 587, secure: false, name: '587 (TLS)' },
        { port: 465, secure: true, name: '465 (SSL)' },
      ];

  // Remove duplicates
  const uniquePorts = portsToTry.filter((p, index, self) => 
    index === self.findIndex(t => t.port === p.port && t.secure === p.secure)
  );

  let lastError = null;
  let emailSent = false;
  const attemptedPorts = [];

  for (let i = 0; i < uniquePorts.length; i++) {
    const config = uniquePorts[i];
    attemptedPorts.push(`${config.name}`);
    
    try {
      console.log(`📧 Attempt ${i + 1}/${uniquePorts.length}: Sending OTP to ${normalizedEmail} via port ${config.name}`);
      
      // Create transporter for this attempt with shorter timeout for faster retries
      const attemptTransporter = createTransporter(config.port, config.secure);
      
      // Use Promise.race to add a timeout wrapper
      const sendPromise = attemptTransporter.sendMail({
        from: process.env.SMTP_EMAIL,
        to: normalizedEmail,
        subject: "Your Verification Code",
        html: `
          <h2>Your OTP Code</h2>
          <p>Your verification code is:</p>
          <h1>${otp}</h1>
          <p>This code expires in 5 minutes.</p>
        `,
      });

      await sendPromise;

      console.log(`✅ OTP sent successfully to: ${normalizedEmail} via port ${config.name}`);
      
      // Update main transporter if we used a different port
      if (config.port !== smtpPort || config.secure !== isSecure) {
        transporter = attemptTransporter;
        console.log(`ℹ️  Updated transporter to use port ${config.port}`);
      }
      
      emailSent = true;
      break; // Success, exit loop
    } catch (err) {
      lastError = err;
      console.error(`❌ Port ${config.name} failed:`, err.message);
      console.error(`   Error code: ${err.code || 'N/A'}`);
      
      // If this is not the last attempt, wait a bit before retrying
      if (i < uniquePorts.length - 1) {
        const delay = 1000; // 1 second delay between retries
        console.log(`🔄 Waiting ${delay}ms before trying next port...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (emailSent) {
    res.json({ success: true, message: "OTP sent to email" });
    return;
  }

  // All attempts failed
  if (lastError) {
    const err = lastError;
    console.error("\n❌ ERROR sending OTP - All ports failed:");
    console.error("   Email:", normalizedEmail);
    console.error("   Ports attempted:", attemptedPorts.join(", "));
    console.error("   Last error:", err.message);
    console.error("   Error code:", err.code);
    console.error("   Command:", err.command);
    console.error("   Response:", err.response);
    console.error("   ResponseCode:", err.responseCode);
    
    // Provide more specific error messages
    let errorMessage = err.message;
    let statusCode = 503; // Default to service unavailable for timeout/connection issues
    
    // Check for authentication errors (535 is the SMTP error code for auth failure)
    if (err.code === "EAUTH" || err.responseCode === 535 || err.response?.includes?.("535") || err.message?.includes?.("535")) {
      statusCode = 401;
      console.error("\n🔍 DEBUGGING AUTH FAILURE:");
      console.error("   SMTP Email:", smtpEmail);
      console.error("   Password length:", smtpPassword?.length || 0);
      console.error("   Password first 3 chars:", smtpPassword?.substring(0, 3) || "N/A");
      console.error("   Password last 3 chars:", smtpPassword?.substring(smtpPassword?.length - 3) || "N/A");
      console.error("\n💡 TROUBLESHOOTING STEPS:");
      console.error("   1. Verify password in SiteGround cPanel");
      console.error("   2. Try logging into webmail: https://gukm1074.siteground.biz:2096");
      console.error("   3. Check environment variables are set correctly");
      console.error("   4. Make sure no extra spaces in password");
      console.error("   5. Try resetting password in SiteGround if still failing");
      
      errorMessage = "SMTP authentication failed (535). Please verify your SMTP_EMAIL and SMTP_PASSWORD. Check server logs for detailed debugging info.";
    } else if (err.code === "ECONNECTION") {
      statusCode = 503;
      errorMessage = `Could not connect to SMTP server. Tried ports: ${attemptedPorts.join(", ")}. SiteGround may be blocking connections from cloud platforms. Consider using a cloud-friendly email service like SendGrid or Mailgun.`;
      console.error("\n💡 SITEGROUND BLOCKING ISSUE:");
      console.error("   SiteGround often blocks SMTP connections from cloud platforms (Render, Heroku, etc.)");
      console.error("   Solutions:");
      console.error("   1. Contact SiteGround support to whitelist Render IPs");
      console.error("   2. Use a cloud-friendly email service (SendGrid, Mailgun, AWS SES)");
      console.error("   3. Use Gmail SMTP with App Password");
    } else if (err.code === "ETIMEDOUT") {
      statusCode = 503;
      const isRenderFreeTier = process.env.RENDER && !process.env.RENDER_PAID;
      if (isRenderFreeTier) {
        errorMessage = `SMTP connection timed out. Render's FREE tier blocks SMTP ports (25, 465, 587). Use SendGrid API instead - it works on Render free tier! Set SENDGRID_API_KEY in environment variables. See SENDGRID-QUICK-SETUP.md for instructions.`;
        console.error("\n🚨 RENDER FREE TIER RESTRICTION:");
        console.error("   Render's free tier BLOCKS all SMTP ports (25, 465, 587)");
        console.error("   SMTP will NEVER work on Render free tier");
        console.error("   ✅ SOLUTION: Use SendGrid API (works on free tier)");
        console.error("   1. Sign up: https://sendgrid.com (free: 100 emails/day)");
        console.error("   2. Create API key");
        console.error("   3. Set SENDGRID_API_KEY in Render environment variables");
        console.error("   4. Set SENDGRID_FROM_EMAIL (or use SMTP_EMAIL)");
      } else {
        errorMessage = `SMTP connection timed out. Tried ports: ${attemptedPorts.join(", ")}. SiteGround may be blocking connections from cloud platforms. For Render, ensure SMTP_PORT=587 and SMTP_SECURE=false are set. Consider using SendGrid API for better cloud compatibility.`;
        console.error("\n💡 TIMEOUT ISSUE - LIKELY SITEGROUND BLOCKING:");
        console.error("   SiteGround SMTP servers often block connections from cloud platforms");
        console.error("   Even with correct settings, connections may timeout");
        console.error("   Recommended solutions:");
        console.error("   1. Use SendGrid API (free tier: 100 emails/day) - works on Render free tier");
        console.error("   2. Use Mailgun API (free tier: 5,000 emails/month)");
        console.error("   3. Use AWS SES (very affordable)");
        console.error("   4. Upgrade Render to paid plan ($7/month) to unblock SMTP ports");
      }
    } else if (err.code === "EENVELOPE") {
      statusCode = 400;
      errorMessage = "Invalid email address format.";
    } else if (err.message?.includes?.("535") || err.message?.includes?.("Invalid login")) {
      statusCode = 401;
      errorMessage = "Invalid login credentials (535). Check your SMTP_EMAIL and SMTP_PASSWORD. For SiteGround: Verify credentials in cPanel.";
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      attemptedPorts: attemptedPorts,
      suggestion: isCloudEnvironment 
        ? "Consider using a cloud-friendly email service like SendGrid, Mailgun, or AWS SES for better reliability on cloud platforms."
        : "Check your SMTP settings and network connectivity."
    });
  } else {
    res.status(500).json({ success: false, error: "Failed to send OTP. Unknown error." });
  }
});

// ---- VERIFY OTP ----
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, error: "Email and OTP are required" });
  }

  // Normalize email (lowercase for consistency)
  const normalizedEmail = email.toLowerCase().trim();

  const record = otpStore[normalizedEmail];

  if (!record) {
    return res.status(400).json({ success: false, error: "No OTP found for this email" });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[normalizedEmail]; // Clean up expired OTP
    return res.status(400).json({ success: false, error: "OTP expired" });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ success: false, error: "Invalid OTP" });
  }

  // OTP verified successfully - remove from store
  delete otpStore[normalizedEmail];
  console.log(`✅ OTP verified successfully for: ${normalizedEmail}`);

  res.json({ success: true, message: "OTP Verified" });
});

// Get all reports in workspace
const getReportsInWorkspace = async (accessToken) => {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${PBI_WORKSPACE_ID}/reports`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data.value;
  } catch (error) {
    console.error(
      "Error getting reports:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch reports");
  }
};

// Get embed token for a specific report
const getEmbedToken = async (
  accessToken,
  reportId,
  datasetIds,
  userIdentity = null
) => {
  const url = `https://api.powerbi.com/v1.0/myorg/GenerateToken`;

  const requestBody = {
    datasets: datasetIds.map((id) => ({ id })),
    reports: [{ id: reportId }],
  };

  // Add RLS (Row-Level Security) ONLY for datasets that have RLS configured
  if (userIdentity && userIdentity.username) {
    // Filter to only include datasets that have RLS enabled
    const rlsDatasets = datasetIds.filter((id) =>
      RLS_ENABLED_DATASETS.includes(id)
    );

    // Only add identities if there are RLS-enabled datasets
    if (rlsDatasets.length > 0) {
      // Use provided roles or default to RLS_ROLE_NAME
      const roles =
        userIdentity.roles && userIdentity.roles.length > 0
          ? userIdentity.roles
          : [RLS_ROLE_NAME];

      requestBody.identities = [
        {
          username: userIdentity.username,
          roles: roles, // Use role name from Power BI RLS configuration
          datasets: rlsDatasets, // Only RLS-enabled datasets
        },
      ];
      console.log(
        `🔒 RLS applied to ${rlsDatasets.length}/${datasetIds.length} datasets with roles:`,
        roles
      );
    } else {
      console.log(
        `ℹ️  No RLS-enabled datasets in this request (${datasetIds.length} total)`
      );
    }
  }

  try {
    console.log("🔑 Requesting embed token with:", {
      reportId,
      datasetIds,
      hasUserIdentity: !!userIdentity,
      username: userIdentity?.username,
    });

    const response = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("❌ ERROR generating embed token:");
    console.error("Status:", error.response?.status);
    console.error(
      "Error Details:",
      JSON.stringify(error.response?.data, null, 2)
    );
    console.error("Request Body:", JSON.stringify(requestBody, null, 2));
    throw new Error(
      `Failed to generate embed token: ${
        error.response?.data?.error?.message || error.message
      }`
    );
  }
};

// Filter reports based on user roles and permissions
const filterReportsByUser = (reports, userIdentity) => {
  const { email, roles = [] } = userIdentity;

  // Report access control configuration
  // You can customize this based on your requirements
  const reportAccessControl = {
    // Example: Map report names to allowed roles
    // Leave empty array [] to allow all users
    // Add specific report names and their allowed roles:
    // 'Report Usage Metrics Report': ['Admin'],
    // 'RSPP onderwijsregio': ['Sales', 'Manager'],
    // 'RSPP onderwijsregio - ALL': ['Admin', 'Manager']
  };

  return reports.filter((report) => {
    const allowedRoles = reportAccessControl[report.name];

    // If no specific roles defined, allow all authenticated users
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    // Check if user has any of the allowed roles
    const hasAccess = roles.some((userRole) => allowedRoles.includes(userRole));

    // Store allowed roles in report object for frontend reference
    report.allowedRoles = allowedRoles;

    return hasAccess;
  });
};

// API Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Power BI Backend API is running" });
});

// Get reports for a specific user (filtered by permissions)
app.post("/api/reports", async (req, res) => {
  try {
    const { userIdentity } = req.body;

    if (!userIdentity || !userIdentity.email) {
      return res.status(400).json({
        success: false,
        error: "User identity is required",
      });
    }

    const accessToken = await getAccessToken();
    const allReports = await getReportsInWorkspace(accessToken);

    // Filter reports based on user roles/permissions
    const filteredReports = filterReportsByUser(allReports, userIdentity);

    res.json({
      success: true,
      reports: filteredReports.map((report) => ({
        id: report.id,
        name: report.name,
        embedUrl: report.embedUrl,
        datasetId: report.datasetId,
        allowedRoles: report.allowedRoles || [],
      })),
      userInfo: {
        email: userIdentity.email,
        roles: userIdentity.roles,
      },
    });
  } catch (error) {
    console.error("Error in /api/reports:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get embed token for a specific report
app.post("/api/embed-token", async (req, res) => {
  try {
    const { reportId, datasetId, userIdentity, bypassRLS } = req.body;

    if (!reportId || !datasetId) {
      return res.status(400).json({
        success: false,
        error: "reportId and datasetId are required",
      });
    }

    const accessToken = await getAccessToken();

    // Option to bypass RLS for testing (pass userIdentity only if NOT bypassing)
    const embedTokenData = await getEmbedToken(
      accessToken,
      reportId,
      [datasetId],
      bypassRLS ? null : userIdentity // Pass null to bypass RLS
    );

    res.json({
      success: true,
      embedToken: embedTokenData.token,
      tokenId: embedTokenData.tokenId,
      expiration: embedTokenData.expiration,
      rlsBypassed: bypassRLS || false,
    });
  } catch (error) {
    console.error("Error in /api/embed-token:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get embed config for a specific report (combines report info + embed token)
app.post("/api/embed-config/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userIdentity } = req.body; // Optional RLS

    const accessToken = await getAccessToken();
    const reports = await getReportsInWorkspace(accessToken);

    const report = reports.find((r) => r.id === reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    const embedTokenData = await getEmbedToken(
      accessToken,
      report.id,
      [report.datasetId],
      userIdentity
    );

    res.json({
      success: true,
      reportId: report.id,
      reportName: report.name,
      embedUrl: report.embedUrl,
      embedToken: embedTokenData.token,
      tokenId: embedTokenData.tokenId,
      expiration: embedTokenData.expiration,
    });
  } catch (error) {
    console.error("Error in /api/embed-config:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test SMTP connection endpoint
app.get("/api/test-smtp", async (req, res) => {
  try {
    const isVerified = await verifySMTPConnection();
    if (isVerified) {
      res.json({ success: true, message: "SMTP connection verified successfully" });
    } else {
      res.status(500).json({ success: false, error: "SMTP connection verification failed. Check server logs for details." });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
const startServer = async () => {
  try {
    validateEnvVars();

    // Verify SMTP connection (non-blocking)
    verifySMTPConnection().then((result) => {
      if (result.success) {
        // Update transporter if verification found a better port
        if (result.port !== smtpPort || result.secure !== isSecure) {
          transporter = createTransporter(result.port, result.secure);
          console.log(`✅ Updated transporter to use verified port ${result.port}`);
        }
      } else {
        console.warn("⚠️  SMTP verification failed, but server will continue. Emails may not work.");
        console.warn("💡 For Render deployments, try setting: SMTP_PORT=587 and SMTP_SECURE=false");
      }
    }).catch(() => {
      console.warn("⚠️  SMTP verification failed, but server will continue. Emails may not work.");
    });

    app.listen(PORT, () => {
      console.log(
        `🚀 Power BI Backend API running on http://localhost:${PORT}`
      );
      console.log(`📊 Workspace ID: ${PBI_WORKSPACE_ID}`);
      console.log(`🔐 Using Service Principal authentication`);
      console.log(`📧 SMTP Host: ${process.env.SMTP_HOST || "Not configured"}`);
      console.log(`📧 SMTP Email: ${process.env.SMTP_EMAIL || "Not configured"}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
