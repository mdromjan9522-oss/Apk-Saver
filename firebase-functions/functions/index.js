/**
 * APK Saver — sendOtp Callable Cloud Function
 *
 * Generates a 6-digit OTP, stores its SHA-256 hash + 10-min expiry in
 * Firestore at config/otp, and emails the OTP to the allowed Gmail.
 *
 * Allowed email is hardcoded — any other email is rejected.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

admin.initializeApp();

const ALLOWED_EMAIL = "mdromjan9522@gmail.com";

// Secrets — set via:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_APP_PASSWORD
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

exports.sendOtp = onCall(
  { secrets: [GMAIL_USER, GMAIL_APP_PASSWORD], region: "us-central1" },
  async (request) => {
    const email = (request.data?.email || "").toString().trim().toLowerCase();
    if (email !== ALLOWED_EMAIL) {
      throw new HttpsError("permission-denied", "This email is not authorized.");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = sha256(otp);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await admin.firestore().collection("config").doc("otp").set({
      hash,
      expiresAt,
      createdAt: Date.now(),
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER.value(),
        pass: GMAIL_APP_PASSWORD.value(),
      },
    });

    await transporter.sendMail({
      from: `"APK Saver" <${GMAIL_USER.value()}>`,
      to: ALLOWED_EMAIL,
      subject: `Your APK Saver password reset code: ${otp}`,
      text: `Your 6-digit OTP is: ${otp}\n\nIt expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; background: #f8f8fb; border-radius: 12px;">
          <h2 style="color: #6b46f1; margin: 0 0 12px;">APK Saver</h2>
          <p style="color: #333; font-size: 14px;">Your password reset code:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: white; border-radius: 8px; color: #1a1a2e;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 16px;">This code expires in 10 minutes.</p>
        </div>
      `,
    });

    return { ok: true };
  }
);
