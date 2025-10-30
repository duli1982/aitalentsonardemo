# 🚀 Deploying Talent Sonar AI to Vercel

This guide will walk you through deploying your Talent Sonar AI application to Vercel, making it accessible online.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Prepare Your Code](#prepare-your-code)
3. [Create GitHub Repository](#create-github-repository)
4. [Deploy to Vercel](#deploy-to-vercel)
5. [Configure Environment Variables](#configure-environment-variables)
6. [Verify Deployment](#verify-deployment)
7. [Troubleshooting](#troubleshooting)
8. [Custom Domain (Optional)](#custom-domain-optional)

---

## ✅ Prerequisites

Before deploying, ensure you have:

- [x] **Vercel Account** (FREE) - Sign up at https://vercel.com
- [x] **GitHub Account** (FREE) - Sign up at https://github.com
- [x] **Gemini API Key** - Get from https://ai.google.dev/
- [x] **Git installed** on your computer
- [x] **Project working locally** (tested with `npm run dev`)

---

## 🔧 Prepare Your Code

### Step 1: Test Local Build

Before deploying, verify your build works locally:

```bash
# Navigate to project directory
cd "c:\Users\Dule\Downloads\talent-sonar-job+candidate-more-details"

# Run production build
npm run build

# Preview the production build
npm run preview
```

**Expected output:**
```
vite v6.4.1 building for production...
✓ 234 modules transformed.
dist/index.html                   0.52 kB │ gzip:  0.32 kB
dist/assets/index-abc123.js     456.78 kB │ gzip: 123.45 kB
✓ built in 3.45s
```

If this works, you're ready to deploy! ✅

### Step 2: Verify Files Are Ready

Check that these files exist:

```bash
dir
```

**Required files:**
- ✅ `vercel.json` - Vercel configuration
- ✅ `vite.config.ts` - Updated with production settings
- ✅ `.gitignore` - Prevents sensitive files from being uploaded
- ✅ `.env.example` - Template for environment variables
- ✅ `package.json` - Dependencies list

---

## 📦 Create GitHub Repository

Vercel deploys from GitHub, so you need to push your code there first.

### Option 1: Using GitHub Desktop (Easiest)

1. **Download GitHub Desktop**
   - Visit: https://desktop.github.com/
   - Install and sign in with your GitHub account

2. **Create Repository**
   - Click "File" → "New Repository"
   - Name: `talent-sonar-ai`
   - Description: `AI-Powered Recruitment Matching Platform`
   - Local Path: Browse to your project folder
   - Check "Initialize this repository with a README"
   - Click "Create Repository"

3. **Publish to GitHub**
   - Click "Publish repository" button
   - Uncheck "Keep this code private" (or keep checked if you want)
   - Click "Publish Repository"

**Done!** Your code is now on GitHub. 🎉

### Option 2: Using Command Line (For Git Users)

```bash
# Navigate to project
cd "c:\Users\Dule\Downloads\talent-sonar-job+candidate-more-details"

# Initialize git (if not already)
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: Talent Sonar AI v1.0"

# Create GitHub repository (you need GitHub CLI installed)
# OR manually create repo on github.com and follow instructions
```

**Manual GitHub Repository Creation:**

1. Go to https://github.com/new
2. Repository name: `talent-sonar-ai`
3. Description: `AI-Powered Recruitment Matching Platform`
4. Choose Public or Private
5. DO NOT initialize with README (we already have files)
6. Click "Create repository"
7. Follow the instructions shown to push your code:

```bash
git remote add origin https://github.com/YOUR_USERNAME/talent-sonar-ai.git
git branch -M main
git push -u origin main
```

---

## 🌐 Deploy to Vercel

### Step 1: Sign Up / Log In to Vercel

1. Visit https://vercel.com
2. Click "Sign Up" or "Log In"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your GitHub account

### Step 2: Import Your Project

1. **Click "Add New..."** → "Project"

2. **Import Git Repository**
   - You'll see a list of your GitHub repositories
   - Find `talent-sonar-ai`
   - Click "Import"

3. **Configure Project**
   - **Framework Preset:** Vite (should auto-detect)
   - **Root Directory:** ./ (leave as default)
   - **Build Command:** `npm run build` (auto-filled)
   - **Output Directory:** `dist` (auto-filled)
   - **Install Command:** `npm install` (auto-filled)

4. **Don't deploy yet!** First, we need to add environment variables.

### Step 3: Add Environment Variables

Before clicking "Deploy", add your API key:

1. **Expand "Environment Variables"** section

2. **Add Variable:**
   ```
   Key:   VITE_GEMINI_API_KEY
   Value: AIzaSy...your-actual-api-key-here
   ```

3. **Select Environment:** Production, Preview, Development (check all three)

4. **Click "Add"**

**IMPORTANT:**
- Use `VITE_GEMINI_API_KEY` (with VITE_ prefix) - this is required for Vite/Vercel
- Get your API key from https://ai.google.dev/

### Step 4: Deploy!

1. **Click "Deploy"** button

2. **Wait for deployment** (usually 1-3 minutes)
   - You'll see build logs in real-time
   - Vercel will:
     - Install dependencies
     - Build your project
     - Deploy to their CDN
     - Generate a URL

3. **Success! 🎉**
   - You'll see "Congratulations! Your project is live"
   - Your app URL will be shown (e.g., `talent-sonar-ai.vercel.app`)

---

## ✅ Configure Environment Variables

If you skipped adding the API key earlier, or need to update it:

### Access Environment Variables

1. Go to your Vercel Dashboard
2. Click on your project (`talent-sonar-ai`)
3. Click "Settings" tab
4. Click "Environment Variables" in left sidebar

### Add/Edit Variables

1. **Add New Variable:**
   - Key: `VITE_GEMINI_API_KEY`
   - Value: Your Gemini API key
   - Environments: Check all (Production, Preview, Development)
   - Click "Save"

2. **Redeploy After Changes:**
   - Go to "Deployments" tab
   - Click "..." menu on latest deployment
   - Click "Redeploy"
   - Wait for rebuild

**Note:** Environment variable changes require redeployment to take effect.

---

## 🧪 Verify Deployment

### Step 1: Open Your App

1. Click on your deployment URL (e.g., `https://talent-sonar-ai.vercel.app`)
2. App should load in 1-2 seconds

### Step 2: Check Basic Functionality

**Test checklist:**

- [ ] App loads without errors
- [ ] Can see job listings in sidebar
- [ ] Can select different jobs
- [ ] Candidates appear on right side
- [ ] "Best Matches" tab is active
- [ ] Match scores are visible
- [ ] Navigation works (Job Requisitions, Talent Pool, Insights)

### Step 3: Test AI Features (Requires API Key)

- [ ] Click "AI Analyze Top 10 Best Matches"
- [ ] Progress bar should appear
- [ ] Success notification after completion
- [ ] Click "Detailed AI Fit Analysis" on a candidate
- [ ] Analysis modal should open with results

### Step 4: Check Console for Errors

1. Press **F12** to open browser console
2. Check for red errors
3. If you see "API_KEY environment variable not set":
   - Go back to Vercel dashboard
   - Verify environment variable is set correctly
   - Redeploy

---

## 🐛 Troubleshooting

### Issue 1: Build Fails

**Error:** `Build failed with exit code 1`

**Solutions:**

1. **Check build logs** in Vercel deployment details
2. **Test locally first:**
   ```bash
   npm run build
   ```
3. **Common issues:**
   - TypeScript errors → Fix or disable strict mode temporarily
   - Missing dependencies → Check package.json
   - Import errors → Verify all file paths are correct

### Issue 2: White Screen / App Not Loading

**Solutions:**

1. **Check browser console** (F12) for errors
2. **Verify base URL** in vite.config.ts
3. **Check vercel.json** is present
4. **Try hard refresh:** Ctrl+F5

### Issue 3: API Key Not Working

**Error in console:** `API_KEY environment variable not set`

**Solutions:**

1. **Verify environment variable name:**
   - Must be `VITE_GEMINI_API_KEY` (with VITE_ prefix)
   - NOT just `GEMINI_API_KEY`

2. **Check Vercel dashboard:**
   - Settings → Environment Variables
   - Ensure key is added for all environments

3. **Redeploy after adding:**
   - Deployments → ... menu → Redeploy

4. **Test API key separately:**
   ```javascript
   console.log(import.meta.env.VITE_GEMINI_API_KEY);
   // Should print your key (in development only!)
   ```

### Issue 4: 404 Errors on Refresh

**Problem:** Navigating to `/candidates` directly gives 404

**Solution:** Already fixed! `vercel.json` includes rewrite rules:
```json
"rewrites": [
  { "source": "/(.*)", "destination": "/index.html" }
]
```

If still happening:
1. Verify `vercel.json` is in root directory
2. Redeploy

### Issue 5: Slow Performance

**Solutions:**

1. **Enable caching:**
   - Already configured in `vercel.json` for assets
   - Check if headers are applied

2. **Optimize images** (if you add any later)

3. **Check bundle size:**
   ```bash
   npm run build
   # Look for large chunks in output
   ```

4. **Upgrade Vercel plan** if needed (free tier is usually sufficient)

### Issue 6: Environment Variables Not Working

**Debug steps:**

1. **Check spelling:** `VITE_GEMINI_API_KEY` (exact spelling matters)
2. **Check environment selection:** All three selected?
3. **Wait for propagation:** Can take 1-2 minutes
4. **Force redeploy:** Delete and re-add variable, then redeploy

---

## 🎨 Custom Domain (Optional)

Want `talent-sonar.yourcompany.com` instead of `talent-sonar-ai.vercel.app`?

### Step 1: Add Domain in Vercel

1. Go to your project in Vercel dashboard
2. Click "Settings" tab
3. Click "Domains" in left sidebar
4. Click "Add"
5. Enter your domain (e.g., `talent-sonar.yourcompany.com`)
6. Click "Add"

### Step 2: Configure DNS

Vercel will show you DNS records to add:

**Option A: CNAME (subdomain)**
```
Type: CNAME
Name: talent-sonar
Value: cname.vercel-dns.com
```

**Option B: A Record (apex domain)**
```
Type: A
Name: @
Value: 76.76.21.21
```

### Step 3: Wait for DNS Propagation

- Usually takes 5-60 minutes
- Can take up to 48 hours in rare cases
- Vercel will auto-enable HTTPS

---

## 🔄 Continuous Deployment

**Good news:** Vercel automatically deploys on every push!

### How It Works

1. You make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update feature X"
   git push
   ```
3. Vercel automatically detects the push
4. Builds and deploys your changes
5. You get a new preview URL + production update

### Preview Deployments

Every push creates a **preview deployment**:
- Unique URL for testing
- Doesn't affect production
- Perfect for testing before merging

### Production Deployments

Pushes to `main` branch automatically deploy to production.

---

## 📊 Monitoring Your App

### Vercel Analytics (Free)

1. Go to your project dashboard
2. Click "Analytics" tab
3. See:
   - Page views
   - Unique visitors
   - Performance metrics
   - Error rates

### Vercel Logs

1. Click "Deployments" tab
2. Click on any deployment
3. Click "View Function Logs"
4. See real-time logs and errors

---

## 🔐 Security Best Practices

### 1. Never Commit API Keys

✅ API keys are in `.env.local` (git-ignored)
✅ Use Vercel environment variables
❌ Don't hardcode keys in source code

### 2. Review Vercel Access

- Only give team members necessary permissions
- Use Vercel Teams for organization deployments

### 3. Monitor Usage

- Check Gemini API usage regularly
- Set up billing alerts
- Monitor for abuse

### 4. Enable HTTPS

- Vercel enables HTTPS automatically
- Enforces secure connections

---

## 💰 Costs

### Vercel (Hosting)

**Hobby (Free) Plan:**
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ HTTPS included
- ✅ Perfect for PoC

**Pro Plan ($20/month):**
- More bandwidth
- Team features
- Advanced analytics
- Only needed if you exceed free tier

### Gemini API (AI Features)

**Free Tier:**
- ✅ 15 requests/minute
- ✅ 1,500 requests/day
- ✅ Good for small teams

**Paid Tier:**
- $0.00025 per request (gemini-2.5-flash)
- $0.00075 per request (gemini-2.5-pro)
- Example: 10,000 requests/month = ~$2.50-$7.50

**Estimated Monthly Cost (small team):**
- Hosting: $0 (free tier)
- AI: $0-10 (depends on usage)
- **Total: ~$0-10/month** for PoC

---

## 🎯 Deployment Checklist

Before going live with stakeholders:

- [ ] Local build works (`npm run build`)
- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] Environment variable `VITE_GEMINI_API_KEY` added
- [ ] Deployment successful (green checkmark)
- [ ] App loads at Vercel URL
- [ ] All tabs/navigation working
- [ ] AI features working (test with API key)
- [ ] No console errors (F12)
- [ ] Test on mobile/tablet (responsive)
- [ ] Share URL with team for feedback

---

## 🚀 Quick Reference

### Important URLs

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Your Project:** https://vercel.com/your-username/talent-sonar-ai
- **GitHub Repo:** https://github.com/your-username/talent-sonar-ai
- **Get Gemini API Key:** https://ai.google.dev/

### Commands

```bash
# Local development
npm run dev

# Test production build
npm run build
npm run preview

# Deploy via Git
git add .
git commit -m "Your message"
git push
```

### Environment Variables

```
Key: VITE_GEMINI_API_KEY
Value: Your API key from ai.google.dev
Environments: Production, Preview, Development (all checked)
```

---

## 🎉 You're Live!

Once deployed, your Talent Sonar AI application will be:

- ✅ **Accessible worldwide** at your Vercel URL
- ✅ **Auto-deployed** on every GitHub push
- ✅ **HTTPS secured** automatically
- ✅ **Fast CDN delivery** via Vercel Edge Network
- ✅ **Production-ready** for stakeholder demos

**Share your live URL with stakeholders and show them the power of AI-driven recruitment!** 🎯

---

## 📞 Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **Vercel Support:** https://vercel.com/support
- **GitHub Docs:** https://docs.github.com
- **Vite Docs:** https://vitejs.dev/guide/

---

*Generated for Talent Sonar AI - GBS Hungary*
*Last Updated: 2025-10-30*
