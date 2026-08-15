# Talent Sonar Standalone: Deployment Guide

This standalone version of Talent Sonar is designed to be deployed as a **Stateless Google Apps Script Web App** and embedded into a **Google Site**.

## 🚀 How to Deploy

### 1. Build the Bundle
Run the following command to generate the browser-ready bundle:
```bash
npx vite build -c vite.standalone.config.ts
```
This will create a `dist-standalone/sonar-standalone.iife.js` file.

### 2. Create the Google Apps Script
1.  Go to [script.google.com](https://script.google.com).
2.  Create a "New Project".
3.  Add a file named `Code.gs` and paste the following:
    ```javascript
    function doGet() {
      return HtmlService.createHtmlOutputFromFile('index')
          .setTitle('Talent Sonar Rediscovery')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    ```
4.  Create a file named `index.html` and paste the contents of your built bundle wrapped in a `<script>` tag.

### 3. Publish as Web App
1.  Click **Deploy** -> **New Deployment**.
2.  Select **Type: Web App**.
3.  Set **Execute as: Me**.
4.  Set **Who has access: Anyone within [Your Company]**.
5.  Copy the **Web App URL**.

### 4. Embed in Google Sites
1.  Open your **Google Site**.
2.  Click **Embed** in the sidebar.
3.  Paste the **Web App URL**.
4.  Publish the Site.

## 🔒 GDPR & Security
- **No Database**: This tool does not have a `save` button for candidate data. All processing happens in-memory and is purged when the tab closes.
- **Identity**: Since it runs as a Web App in your domain, Google handles authentication automatically.
- **Audit**: Every CRM query is performed under the active user's session if configured with OAuth.
