# APK Saver — Firebase Backend Setup

This folder contains the Firebase Cloud Function that emails the password-reset OTP, plus Firestore and Storage security rules.

## What you'll deploy

1. **`sendOtp`** — Callable Cloud Function. Emails a 6-digit OTP to `mdromjan9522@gmail.com` using Gmail SMTP.
2. **`firestore.rules`** — Lets the app read/write its own data, but only the Cloud Function can write the OTP doc.
3. **`storage.rules`** — Allows uploads/downloads of APK + image files.

---

## Prerequisites

- **Firebase Blaze (pay-as-you-go) plan** — Cloud Functions require it. You'll only pay for what you use; the free tier covers personal use easily.
- **Node.js 20+** installed locally.
- **Firebase CLI**: `npm install -g firebase-tools`
- **A Gmail App Password** (not your regular Gmail password):
  1. Enable 2-Step Verification on your Google account: https://myaccount.google.com/security
  2. Go to https://myaccount.google.com/apppasswords
  3. Create a new App Password (name it "APK Saver"), copy the 16-character password.

---

## Deploy steps (run from this `firebase-functions/` folder)

```bash
# 1) Login & select your project
firebase login
firebase use apk-saver-89b42

# 2) Install function dependencies
cd functions
npm install
cd ..

# 3) Set the Gmail secrets (CLI will prompt you to paste each value)
firebase functions:secrets:set GMAIL_USER
# Enter: mdromjan9522@gmail.com

firebase functions:secrets:set GMAIL_APP_PASSWORD
# Enter: <the 16-char App Password from above, no spaces>

# 4) Deploy everything
firebase deploy --only functions,firestore:rules,storage
```

After deploy completes, the Forgot Password flow on the website will work end-to-end.

---

## Updating later

- **Change Gmail address or App Password**: re-run the `firebase functions:secrets:set ...` command, then `firebase deploy --only functions`.
- **Change rules only**: `firebase deploy --only firestore:rules,storage`.

---

## Troubleshooting

- **"Function failed: secret GMAIL_USER not found"** → you forgot step 3. Re-run the secrets commands.
- **OTP email not arriving** → check spam. Verify the App Password is correct (regenerate if unsure). Check the Cloud Function logs: `firebase functions:log`.
- **"This email is not authorized"** → the function only sends to `mdromjan9522@gmail.com`. Edit `ALLOWED_EMAIL` in `functions/index.js` if you ever change it, then redeploy.
