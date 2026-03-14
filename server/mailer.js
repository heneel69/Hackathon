/**
 * server/mailer.js
 * Nodemailer transporter using Gmail SMTP with App Password.
 * Requires GMAIL_USER and GMAIL_APP_PASSWORD in .env
 */

import nodemailer from 'nodemailer';

// Load .env manually since we don't use dotenv package
// The user must set these env vars before starting the server
const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASSWORD;

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!GMAIL_USER || !GMAIL_APP_PASS) {
    console.warn('[MAILER] GMAIL_USER or GMAIL_APP_PASSWORD not set. Email sending disabled.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASS,
    },
  });

  return transporter;
}

/**
 * Send an OTP email to the given address.
 * Falls back to console log if env vars are not configured.
 * @param {string} to — recipient email
 * @param {string} otp — 6-digit code
 */
export async function sendOtpEmail(to, otp) {
  const transport = getTransporter();

  if (!transport) {
    // Fallback: log to console (demo mode)
    console.log(`\n[OTP DEMO MODE] Password reset OTP for ${to}: ${otp}\n`);
    return { demo: true };
  }

  const mailOptions = {
    from: `"HAH Inventory System" <${GMAIL_USER}>`,
    to,
    subject: 'Your Password Reset Code — HAH Inventory',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: auto; background: #f8fafc; padding: 32px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">🔐</span>
          <h2 style="color: #1e293b; margin: 8px 0;">Password Reset Request</h2>
          <p style="color: #64748b; font-size: 14px;">You requested to reset your HAH Inventory password.</p>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <p style="color: #64748b; font-size: 13px; margin-bottom: 12px;">Your one-time verification code:</p>
          <div style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #6366f1; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 12px;">Expires in <strong>10 minutes</strong></p>
        </div>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; margin-top: 16px;">
          <p style="color: #9a3412; font-size: 12px; margin: 0;">
            ⚠️ If you didn't request this, you can safely ignore this email. Your password will not change.
          </p>
        </div>

        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">
          HAH Inventory System · Automated message, do not reply
        </p>
      </div>
    `,
    text: `Your HAH Inventory password reset OTP is: ${otp}\nThis code expires in 10 minutes.`,
  };

  return await transport.sendMail(mailOptions);
}
