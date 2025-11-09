# Google Drive Integration Setup Guide

## Overview

Your Talent Sonar AI application now supports **dual-mode Google Drive integration**:
- **Demo Mode**: Uses 3 pre-populated mock CVs (no setup required)
- **Production Mode**: Connects to real Google Drive with OAuth authentication

The app automatically detects which mode to use based on your environment configuration.

---

## Current Status: Demo Mode ✅

Your app is currently running in **Demo Mode** because no Google Client ID is configured. This allows you to test all features with sample data.

---

## Switch to Production Mode (Real Google Drive)

To enable real Google Drive integration, follow these steps:

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name (e.g., "Talent Sonar AI")
4. Click **"Create"**

### Step 2: Enable Google Drive API

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Drive API"**
3. Click on it and press **"Enable"**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (for testing)
   - App name: **Talent Sonar AI**
   - User support email: Your email
   - Developer contact: Your email
   - Add scopes: **../auth/drive.readonly**
   - Add test users: Your Gmail address
4. Choose Application type: **Web application**
5. Add **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   http://localhost:3001
   ```
6. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000
   http://localhost:3001
   ```
7. Click **"Create"**
8. **Copy the Client ID** (looks like: `xxxxx.apps.googleusercontent.com`)

### Step 4: Configure Environment Variables

1. Open the `.env` file in your project root
2. Add your Google Client ID:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
   VITE_GEMINI_API_KEY=your-gemini-api-key-here
   ```
3. Save the file

### Step 5: Restart the Development Server

The Vite dev server should automatically restart when you save `.env`. If not:

```bash
# Stop the server (Ctrl+C) and restart:
npm run dev
```

---

## How It Works

### Demo Mode
- Automatically uses 3 hardcoded CVs (John Smith, Maria Garcia, Ahmed Hassan)
- No authentication required
- Perfect for testing and demonstrations
- Shows "Demo Mode" indicator in the Google Drive modal

### Production Mode
When you add your Google Client ID:
1. App switches to **Production Mode** automatically
2. Google Drive modal shows "Production Mode" indicator
3. Clicking "Connect to Drive" opens Google OAuth popup
4. You authenticate with your Google account
5. Grant read-only access to your Drive files
6. App scans your Drive folder for PDF/DOCX files
7. Gemini AI parses each CV and extracts candidate data
8. Candidates are added to your talent pool

---

## Security Features

✅ **Read-only access**: App can only read files, never write or delete
✅ **OAuth 2.0**: Industry-standard authentication
✅ **Secure tokens**: Access tokens stored temporarily in memory
✅ **Environment variables**: Sensitive config kept out of code
✅ **No file upload**: All parsing happens locally

---

## File Support

- **PDF files** (`.pdf`) - Most common CV format
- **Word documents** (`.docx`) - Microsoft Word format

---

## Testing Production Mode

1. Add your Client ID to `.env`
2. Restart dev server
3. Open Google Drive modal
4. Verify "Production Mode" indicator is shown
5. Click "Connect to Drive"
6. Complete Google OAuth flow
7. Select a Drive folder (or use root)
8. Click "Scan & Import CVs"

---

## Troubleshooting

### "Failed to authenticate with Google"
- Verify Client ID is correct in `.env`
- Check that redirect URIs match in Google Cloud Console
- Ensure you're using `http://localhost:3000` (not `https`)

### "Access blocked: This app's request is invalid"
- Add your email as a test user in OAuth consent screen
- Verify Google Drive API is enabled

### CVs not parsing correctly
- Ensure files are PDF or DOCX format
- Check that Gemini API key is configured
- Verify files contain readable text (not just images)

### Still in Demo Mode after adding Client ID
- Ensure `.env` file is in project root
- Restart Vite dev server
- Check for typos in `VITE_GOOGLE_CLIENT_ID`

---

## Architecture Overview

### Components Modified
- [index.tsx](index.tsx:4) - Added `GoogleOAuthProvider` wrapper
- [components/modals/GoogleDriveModal.tsx](components/modals/GoogleDriveModal.tsx:2) - Integrated `useGoogleLogin` hook
- [services/googleDriveService.ts](services/googleDriveService.ts:10) - Dual-mode support with automatic detection

### Environment Detection
```typescript
const IS_DEMO_MODE = !VITE_GOOGLE_CLIENT_ID ||
                     VITE_GOOGLE_CLIENT_ID === 'your-google-client-id-here.apps.googleusercontent.com';
```

### OAuth Flow
```
User clicks "Connect"
  → useGoogleLogin() triggers popup
  → User authenticates & grants permission
  → Receives access token
  → Pass token to connectToDrive(token)
  → Google Drive API lists files
  → Download & parse each CV
  → Add candidates to app
```

---

## Next Steps

Once Production Mode is working:
1. Upload test CVs to a Google Drive folder
2. Connect the app to that folder
3. Scan and import candidates
4. Verify candidate data is parsed correctly
5. Test matching against your job requisitions

---

## Support

- Check [.env.example](.env.example) for detailed setup instructions
- Review [services/googleDriveService.ts](services/googleDriveService.ts) for implementation details
- See Google's [OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2)

---

**Current Mode**: Demo Mode (No Client ID configured)
**To Switch**: Add `VITE_GOOGLE_CLIENT_ID` to `.env` file
