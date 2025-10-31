# 🚀 Deploy to Vercel - Step-by-Step Guide

**Time needed:** 10-15 minutes
**Cost:** FREE
**Difficulty:** Easy

---

## ✅ Before You Start - Checklist

Make sure you have:

- [ ] **GitHub account** (free) - Sign up at https://github.com
- [ ] **Vercel account** (free) - Sign up at https://vercel.com
- [ ] **Gemini API key** (free) - Get at https://ai.google.dev/
- [ ] **Git installed** on your computer
- [ ] **App tested locally** (`npm run dev` works)

---

## 📋 Complete Deployment Process

### STEP 1: Get Your Gemini API Key (2 minutes)

1. **Go to:** https://ai.google.dev/

2. **Click:** "Get API Key" button (blue button, top right)

3. **Sign in** with your Google/Gmail account

4. **Click:** "Create API Key" button

5. **Select:** Create API key in new project (or select existing project)

6. **Copy the key** - It looks like: `AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXX`

7. **Save it** somewhere safe - You'll need it in Step 4

**✅ Done!** Keep this tab open, you'll need this key later.

---

### STEP 2: Push Your Code to GitHub (3 minutes)

#### Option A: Using GitHub Desktop (Easiest - Recommended)

1. **Download GitHub Desktop:**
   - Go to: https://desktop.github.com/
   - Install and sign in with your GitHub account

2. **Add your project:**
   - Click: File → Add Local Repository
   - Browse to: `c:\Users\Dule\Downloads\talent-sonar-job+candidate-more-details`
   - Click: Add Repository

3. **If it says "not a git repository":**
   - Click: "Create a repository"
   - Name: `talent-sonar-ai`
   - Description: `AI-Powered Recruitment Matching Platform`
   - Keep this code private: (uncheck for public, check for private)
   - Click: Create Repository

4. **Commit your files:**
   - You'll see all your files listed
   - Summary: `Initial commit - Ready for Vercel`
   - Click: "Commit to main"

5. **Publish to GitHub:**
   - Click: "Publish repository" button (top)
   - Uncheck "Keep this code private" (or keep checked if you want)
   - Click: "Publish Repository"

**✅ Done!** Your code is now on GitHub.

---

#### Option B: Using Command Line (For Git Users)

```bash
# Navigate to your project
cd "c:\Users\Dule\Downloads\talent-sonar-job+candidate-more-details"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - Ready for Vercel"

# Create repository on GitHub:
# Go to https://github.com/new
# Repository name: talent-sonar-ai
# Description: AI-Powered Recruitment Matching Platform
# Choose Public or Private
# DO NOT initialize with README
# Click "Create repository"

# Push to GitHub (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/talent-sonar-ai.git
git branch -M main
git push -u origin main
```

**✅ Done!** Your code is now on GitHub.

---

### STEP 3: Import Project to Vercel (2 minutes)

1. **Go to:** https://vercel.com

2. **Sign up / Log in:**
   - Click: "Sign Up" (or "Log In" if you have account)
   - Choose: "Continue with GitHub"
   - Authorize Vercel to access your GitHub

3. **Import your project:**
   - Click: "Add New..." button (top right)
   - Click: "Project"
   - You'll see a list of your GitHub repositories
   - Find: `talent-sonar-ai`
   - Click: "Import" button next to it

4. **Configure project:**

   Vercel will auto-detect most settings:

   ```
   Framework Preset: Vite ✅ (auto-detected)
   Root Directory: ./ ✅ (leave as default)
   Build Command: npm run build ✅ (auto-filled)
   Output Directory: dist ✅ (auto-filled)
   Install Command: npm install ✅ (auto-filled)
   ```

   **→ Don't click Deploy yet!** First, add your API key (next step).

**✅ Ready** for Step 4.

---

### STEP 4: Add Environment Variable (1 minute)

**IMPORTANT:** This is the most critical step!

1. **On the same page** (Configure Project), scroll down

2. **Find:** "Environment Variables" section

3. **Click:** to expand it (if collapsed)

4. **Add your API key:**

   ```
   Key:   VITE_GEMINI_API_KEY
   Value: [Paste your API key from Step 1]
   ```

   Example:
   ```
   Key:   VITE_GEMINI_API_KEY
   Value: AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

5. **Select environments:**
   - ☑ Production (check)
   - ☑ Preview (check)
   - ☑ Development (check)

   **→ All three should be checked!**

6. **Click:** "Add" button

7. **Verify:** You should see your variable listed:
   ```
   VITE_GEMINI_API_KEY: AIzaSy... (visible)
   ```

**✅ Done!** API key added.

---

### STEP 5: Deploy! (2-3 minutes)

1. **Click:** "Deploy" button (big blue button at bottom)

2. **Wait** while Vercel builds your app:

   You'll see:
   ```
   🔨 Building...
   ⚙️ Running "npm install"
   ⚙️ Running "npm run build"
   ✓ Build successful
   🚀 Deploying...
   ✓ Deployment ready
   ```

   This takes about 2-3 minutes.

3. **Success!** 🎉

   You'll see:
   ```
   🎉 Congratulations!
   Your project is live at:
   https://talent-sonar-ai.vercel.app
   ```

4. **Click:** "Visit" or "Go to Dashboard"

**✅ Your app is now LIVE on the internet!**

---

### STEP 6: Verify Deployment (2 minutes)

1. **Open your live URL:**
   ```
   https://talent-sonar-ai.vercel.app
   ```
   (Your actual URL will be shown in Vercel dashboard)

2. **Test basic features:**
   - [ ] App loads (you see the UI)
   - [ ] Can select different jobs in sidebar
   - [ ] Candidates appear on right side
   - [ ] "Best Matches" tab is active
   - [ ] Match scores are visible

3. **Test AI features:**
   - [ ] Click "AI Analyze Top 10 Best Matches"
   - [ ] Progress bar appears
   - [ ] Success notification after ~45 seconds
   - [ ] Click "Detailed AI Fit Analysis" on a candidate
   - [ ] Analysis modal opens with results

4. **Check for errors:**
   - Press F12 (open browser console)
   - Look for red errors
   - If you see "API_KEY not set" → Go back to Step 4

**✅ If everything works: You're done!** 🎉

---

## 🎯 After Deployment - Next Steps

### Share with Stakeholders

**Send this email:**

```
Subject: Talent Sonar AI - Live Demo Ready

Hi [Name],

Our AI recruitment matching tool is now live and ready for testing:

🔗 https://talent-sonar-ai.vercel.app

What to try:
1. Click any job in the left sidebar
2. See the "Best Matches" tab (top 15 candidates)
3. Click "AI Analyze Top 10 Best Matches" button
4. Watch the AI analyze candidates in real-time
5. Click on any candidate → "Detailed AI Fit Analysis"

Current data:
- 23 job requisitions
- 55 candidates (internal, past, uploaded)
- All automatically scored

Let me know your feedback!
```

---

### Make Updates

When you want to update the app:

```bash
# 1. Make your changes in the code

# 2. Commit and push to GitHub
git add .
git commit -m "Describe your changes"
git push

# 3. Vercel automatically deploys
# Wait 2-3 minutes
# Your live site is updated!
```

**That's it!** Automatic deployment on every push.

---

## 🆘 Troubleshooting

### Problem 1: "API_KEY not set" error on live site

**Symptoms:** You see error in console or AI features don't work

**Solution:**
1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Click your project: `talent-sonar-ai`
3. Click: Settings (top tabs)
4. Click: Environment Variables (left sidebar)
5. Check if `VITE_GEMINI_API_KEY` exists
6. If NOT there:
   - Click "Add New"
   - Key: `VITE_GEMINI_API_KEY`
   - Value: Your API key
   - Environments: All three ✓
   - Click "Save"
7. **IMPORTANT: Redeploy**
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"
   - Wait 2-3 minutes

---

### Problem 2: Build Failed

**Symptoms:** Deployment says "Build failed"

**Solution:**
1. Click on the failed deployment
2. Click "View Build Logs"
3. Look for the error message
4. Common fixes:
   - **Missing dependencies:** Run `npm install` locally
   - **TypeScript errors:** Fix errors in code
   - **Build command wrong:** Should be `npm run build`

---

### Problem 3: 404 Error when refreshing page

**Symptoms:** Going directly to a URL gives 404

**Solution:**
This should NOT happen (we have `vercel.json` with rewrites).

If it does:
1. Check `vercel.json` exists in root folder
2. Check it has this content:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
3. Redeploy

---

### Problem 4: Slow Loading

**Symptoms:** Site takes >5 seconds to load

**Solution:**
1. Check your internet connection
2. Try from different location/device
3. Check Vercel status: https://www.vercel-status.com/
4. Usually first visit is slower, cached visits are faster

---

### Problem 5: Can't Find Repository in Vercel

**Symptoms:** Repository doesn't show up when importing

**Solution:**
1. Click "Adjust GitHub App Permissions"
2. Grant Vercel access to your repository
3. Refresh the import page

---

## 📊 What You Get (FREE Tier)

### Vercel Free Plan Includes:

- ✅ **100GB bandwidth** per month (plenty for PoC)
- ✅ **Unlimited deployments**
- ✅ **HTTPS/SSL** certificate (automatic)
- ✅ **Global CDN** (100+ locations worldwide)
- ✅ **Automatic deployments** on Git push
- ✅ **Preview deployments** for branches
- ✅ **Analytics** (basic, free)
- ✅ **99.99% uptime** SLA

### Gemini API Free Tier:

- ✅ **15 requests per minute**
- ✅ **1,500 requests per day**
- ✅ **No credit card** required

**Total cost: $0/month** ✅

---

## 🎨 Optional: Custom Domain

Want `talent.yourcompany.com` instead of `talent-sonar-ai.vercel.app`?

### Quick Setup:

1. **Vercel Dashboard** → Your Project
2. **Settings** → **Domains**
3. **Add Domain:** Enter your domain
4. **Add DNS records** shown by Vercel
5. **Wait 5-60 minutes** for DNS propagation
6. **Done!** HTTPS automatically enabled

---

## 📱 Mobile Access

Your app is fully responsive and works on:

- ✅ iPhone / Android phones
- ✅ iPad / Android tablets
- ✅ Desktop browsers
- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)

**Test it:** Open your Vercel URL on your phone!

---

## 🔒 Security

Your deployment is secure:

- ✅ **HTTPS** enforced (encrypted traffic)
- ✅ **API keys** stored securely (not in code)
- ✅ **Environment variables** encrypted
- ✅ **DDoS protection** included
- ✅ **Automatic backups** of deployments

---

## 📈 Monitor Your App

### View Analytics:

1. **Vercel Dashboard** → Your Project
2. **Analytics** tab
3. See:
   - Page views
   - Unique visitors
   - Top pages
   - Geographic distribution
   - Performance metrics

### View Logs:

1. **Deployments** tab
2. Click any deployment
3. **Runtime Logs** - See real-time activity
4. **Build Logs** - See build process

---

## ✅ Final Checklist

After completing all steps:

- [ ] ✅ GitHub repository created
- [ ] ✅ Code pushed to GitHub
- [ ] ✅ Vercel project created
- [ ] ✅ Environment variable `VITE_GEMINI_API_KEY` added
- [ ] ✅ Deployment successful (green checkmark)
- [ ] ✅ Live URL working: `https://talent-sonar-ai.vercel.app`
- [ ] ✅ Basic features tested
- [ ] ✅ AI features tested (Analyze Top 10)
- [ ] ✅ No console errors
- [ ] ✅ Tested on mobile

**All checked?** 🎉 **You're live and ready to share!**

---

## 🎯 Quick Summary

### What You Did:

1. ✅ Got Gemini API key (free)
2. ✅ Pushed code to GitHub
3. ✅ Imported to Vercel
4. ✅ Added API key as environment variable
5. ✅ Deployed to production

### What You Got:

- ✅ Live URL: `https://talent-sonar-ai.vercel.app`
- ✅ Automatic updates on git push
- ✅ HTTPS security
- ✅ Global CDN (fast worldwide)
- ✅ Free hosting

### Time Spent: 10-15 minutes
### Cost: $0
### Result: Professional production deployment! 🚀

---

## 📞 Need Help?

**Documentation:**
- Full deployment guide: [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)
- Testing guide: [TESTING_GUIDE.md](TESTING_GUIDE.md)
- Implementation status: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)

**External Resources:**
- Vercel Docs: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- Gemini API Docs: https://ai.google.dev/docs

**Common Issues:** See Troubleshooting section above

---

**🎉 Congratulations! Your AI recruitment tool is now live on the internet!**

Share it with your team and show them the power of AI-driven recruitment matching.

**Built for GBS Hungary Recruitment Team** ❤️
