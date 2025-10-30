# 🧪 Talent Sonar AI - Complete Testing Guide

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Installation Steps](#installation-steps)
4. [Getting Your API Key](#getting-your-api-key)
5. [Running the Application](#running-the-application)
6. [Test Scenarios](#test-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

```bash
# 1. Navigate to project directory
cd "c:\Users\Dule\Downloads\talent-sonar-job+candidate-more-details"

# 2. Install dependencies
npm install

# 3. Add your Gemini API key to .env.local
# (See "Getting Your API Key" section below)

# 4. Start the development server
npm run dev

# 5. Open browser to http://localhost:3000
```

---

## 📦 Prerequisites

### Required Software:
- **Node.js** (version 18.x or higher)
  - Check: `node --version`
  - Download: https://nodejs.org/

- **npm** (comes with Node.js)
  - Check: `npm --version`

- **Modern Web Browser**
  - Chrome, Edge, Firefox, or Safari
  - Latest version recommended

### Required Accounts:
- **Google AI Studio Account** (FREE)
  - Needed for Gemini API key
  - Link: https://ai.google.dev/

---

## 🔧 Installation Steps

### Step 1: Open Terminal/Command Prompt

**Windows:**
- Press `Win + R`, type `cmd`, press Enter
- OR: Open VS Code terminal

**Mac/Linux:**
- Open Terminal application

### Step 2: Navigate to Project Directory

```bash
cd "c:\Users\Dule\Downloads\talent-sonar-job+candidate-more-details"
```

### Step 3: Install Dependencies

```bash
npm install
```

**Expected output:**
```
added 234 packages, and audited 235 packages in 45s

89 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**This will install:**
- React 19.1.1
- Vite 6.2.0
- TypeScript 5.8.2
- @google/genai 1.21.0
- lucide-react 0.544.0
- All other dependencies

**Time:** 30-60 seconds (depending on internet speed)

### Step 4: Verify Installation

```bash
npm list --depth=0
```

**Expected output:**
```
talent-sonar-job+candidate-more-details@0.0.0
├── @google/genai@1.21.0
├── lucide-react@0.544.0
├── react@19.1.1
└── react-dom@19.1.1
```

---

## 🔑 Getting Your API Key

### Option 1: Get a FREE Gemini API Key (Recommended)

1. **Go to Google AI Studio**
   - Visit: https://ai.google.dev/
   - Click "Get API Key"

2. **Sign in with Google Account**
   - Use any Google/Gmail account
   - No credit card required for free tier

3. **Create API Key**
   - Click "Create API Key"
   - Select existing project or create new one
   - Copy the generated key (starts with `AIza...`)

4. **Add to .env.local**
   ```bash
   # Open the file:
   notepad .env.local

   # Replace the line with:
   GEMINI_API_KEY=AIzaSy...your-actual-key-here

   # Save and close
   ```

### Option 2: Test Without API Key (Limited)

The app will work with mock data for basic matching, but AI features won't work:
- ❌ "Analyze Job" button won't work
- ❌ "Detailed AI Fit Analysis" won't work
- ❌ "Analyze Top 10" won't work
- ✅ Basic matching will work
- ✅ UI will work
- ✅ You can test the interface

**To test without API key:**
```bash
# Just leave the placeholder in .env.local:
GEMINI_API_KEY=PLACEHOLDER_API_KEY

# The app will show errors when you try AI features
```

---

## 🏃 Running the Application

### Start Development Server

```bash
npm run dev
```

**Expected output:**
```
  VITE v6.2.0  ready in 1234 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.100:3000/
  ➜  press h + enter to show help
```

### Open in Browser

1. **Automatically** (if not opened):
   - Navigate to: http://localhost:3000

2. **You should see:**
   - "Talent Sonar AI" header with brain icon
   - Three navigation tabs: Job Requisitions, Talent Pool, Insights
   - Left sidebar with job listings
   - Right panel with candidate matches

3. **Verify it's working:**
   - Click different jobs in sidebar → Candidates should update
   - Click "Best Matches" tab → Should see top candidates
   - Colors and animations should work smoothly

---

## 🧪 Test Scenarios

### Test 1: Basic Navigation ✅ (No API Key Needed)

**Purpose:** Verify UI is working correctly

1. **Test Job Selection**
   ```
   → Click "Senior React Developer" in job list
   → Verify candidates appear on right side
   → Verify candidates are sorted by match score
   → Check match score badges (green, yellow percentages)
   ```

2. **Test Tab Navigation**
   ```
   → Click "Best Matches" tab (Trophy icon)
   → Should see top 15 candidates across all pools
   → Should see blue info banner explaining the view

   → Click "Internal Talent" tab
   → Should see only 15 internal candidates

   → Click "Past Applicants" tab
   → Should see only 20 past candidates

   → Click "Uploaded CVs" tab
   → Should see only 20 uploaded candidates
   ```

3. **Test Job Filtering**
   ```
   → Use search box to search "React"
   → Should filter jobs to React-related only

   → Use status dropdown to filter "Open"
   → Should show only open jobs

   → Clear filters
   → All jobs should return
   ```

4. **Test Match Score Badges**
   ```
   → Look at job cards in sidebar
   → Each should show match badges:
     "🟢 X strong  🟡 Y good"
   → Numbers should make sense (0-55)
   ```

**Expected Time:** 2-3 minutes

---

### Test 2: Add New Job ✅ (No API Key Needed)

**Purpose:** Verify automatic candidate scoring

**IMPORTANT:** This is the CORE feature - automatic matching!

1. **Add a Job**
   ```
   → Click "Add Job" button (if available in header)
   → OR: Use existing jobs for now
   ```

2. **Fill in Job Details**
   ```
   Title: "Senior Full-Stack Developer"
   Department: "Technology"
   Location: "Budapest, Hungary"
   Status: "Open"
   Skills: "React, Node.js, TypeScript, MongoDB"
   Description: "We are looking for a senior full-stack developer..."
   ```

3. **Submit and Verify**
   ```
   → Click "Add Job"
   → Wait 1-2 seconds

   → GREEN NOTIFICATION should appear:
     "Job 'Senior Full-Stack Developer' added!
      Found X strong matches (≥70%) and Y good matches (50-69%) from 55 candidates."

   → Job should appear at TOP of job list
   → Job should be automatically selected
   → Candidates should be sorted by match score for this job
   → Job card should show match badges
   ```

4. **Check Console Logs**
   ```
   → Open browser console (F12)
   → Look for logs:
     ✅ Job "Senior Full-Stack Developer" added successfully!
     📊 Analyzed 55 candidates from database:
        - X strong matches (≥70% score)
        - Y good matches (50-69% score)
        - Z potential matches (<50% score)
   ```

**Expected Time:** 2 minutes

---

### Test 3: CV Upload ✅ (No API Key Needed for Basic)

**Purpose:** Verify candidates are scored against all jobs

**Note:** AI parsing requires API key, but you can test the flow

1. **Click Upload CV Button**
   ```
   → Should open upload modal
   ```

2. **Without API Key:**
   ```
   → Upload will fail with error
   → This is expected
   → Skip to Test 4
   ```

3. **With API Key:**
   ```
   → Upload a PDF/DOCX resume
   → Wait 5-10 seconds for AI parsing
   → Should see success notification
   → Candidate should appear in "Uploaded CVs" tab
   → All job badges should update
   ```

**Expected Time:** 1 minute (without API) / 3 minutes (with API)

---

### Test 4: AI Analysis - "Analyze Top 10" 🔑 (REQUIRES API KEY)

**Purpose:** Test the flagship batch analysis feature

**Prerequisites:**
- ✅ Valid Gemini API key in .env.local
- ✅ At least 1 job in the system
- ✅ At least 10 candidates

**Steps:**

1. **Select a Job**
   ```
   → Click any job in sidebar (e.g., "Senior React Developer")
   → Candidates should appear
   → Make sure "Best Matches" tab is active
   ```

2. **Click the Magic Button**
   ```
   → Find the prominent gradient button:
     "⚡ AI Analyze Top 10 Best Matches"
   → Click it
   ```

3. **Watch the Progress**
   ```
   → Button should disable and show spinner
   → PURPLE notification banner should appear at top:
     "✨ AI Deep Analysis in Progress..."
     "Candidate 1 of 10"

   → Progress bar should fill gradually
   → Counter should update: 2 of 10, 3 of 10, etc.

   → Each candidate takes ~3-5 seconds
   → Total time: ~30-50 seconds for 10 candidates
   ```

4. **Check Completion**
   ```
   → Purple banner should disappear
   → GREEN success notification should appear:
     "✅ Successfully analyzed 10 top candidates!
      Check individual profiles for detailed insights."

   → Button should re-enable
   ```

5. **Verify Analysis Results**
   ```
   → Click on any of the top 10 candidate cards
   → Click "Detailed AI Fit Analysis" button

   → Analysis modal should open INSTANTLY (no loading)
   → Should show comprehensive analysis:
     ✓ Overall Match Score (large number)
     ✓ Multi-dimensional scores (5 dimensions)
     ✓ Strengths list
     ✓ Gaps list
     ✓ Skill gap chart
     ✓ Future potential projection
   ```

6. **Check Console Logs**
   ```
   → Open console (F12)
   → Should see:
     🎯 Batch Analysis Complete: 10 successful, 0 failed
   ```

**Expected Time:** 1-2 minutes

**Expected Results:**
- ✅ All 10 candidates analyzed successfully
- ✅ Progress visible and accurate
- ✅ No errors in console
- ✅ Analysis results stored (won't re-run if clicked again)

---

### Test 5: Individual AI Analysis 🔑 (REQUIRES API KEY)

**Purpose:** Test single candidate deep analysis

1. **Select a Job and Candidate**
   ```
   → Click any job
   → Find a candidate without AI analysis yet
     (one NOT in the top 10 you already analyzed)
   ```

2. **Click "Detailed AI Fit Analysis"**
   ```
   → Purple/gradient button on candidate card
   → Should show loading spinner on card
   ```

3. **Wait for Analysis**
   ```
   → Takes 3-5 seconds
   → Analysis modal should open automatically
   → Should show all analysis components
   ```

4. **Test Analysis Quality**
   ```
   → Read the match rationale - should be specific
   → Check multi-dimensional scores - should be reasonable
   → Look at skill gaps - should match candidate's skills
   → Future projection - should make sense
   ```

**Expected Time:** 30 seconds per candidate

---

### Test 6: Job Analysis 🔑 (REQUIRES API KEY)

**Purpose:** Test job description analysis

1. **Select a Job**
   ```
   → Click any job in sidebar
   ```

2. **Click "Analyze Job"**
   ```
   → Button in job details section (top right)
   → Should show spinner
   ```

3. **Wait for Analysis**
   ```
   → Takes 3-5 seconds
   → Analysis modal should open
   ```

4. **Verify Job Analysis Content**
   ```
   → Seniority Analysis section
   → Growth Pathways section
   → Skill Requirements (must-have vs nice-to-have)
   → Ideal Candidate Profile
   ```

**Expected Time:** 30 seconds

---

### Test 7: Insights View ✅ (No API Key Needed)

**Purpose:** Verify analytics dashboard

1. **Click "Insights" Tab**
   ```
   → Top navigation (lightbulb icon)
   ```

2. **Verify Content**
   ```
   → Should show department-wise skill demand
   → Bar charts showing top 5 skills per department
   → Technology department should have highest demand
   → Skills like "React", "JavaScript", "TypeScript" should be prominent
   ```

**Expected Time:** 1 minute

---

### Test 8: Feedback System ✅ (No API Key Needed)

**Purpose:** Test thumbs up/down feedback

1. **Select Job and Candidate**
   ```
   → Any job and candidate
   ```

2. **Test Feedback Buttons**
   ```
   → Click thumbs up 👍 on a candidate card
   → Should highlight green
   → Check console: Should log feedback

   → Click thumbs down 👎
   → Should highlight red

   → Click again to toggle off
   → Should return to neutral
   ```

**Expected Time:** 30 seconds

---

### Test 9: Data Persistence ✅ (No API Key Needed)

**Purpose:** Verify localStorage is working

1. **Make Some Changes**
   ```
   → Add a job
   → Analyze some candidates
   → Change job status
   → Give feedback
   ```

2. **Refresh Page**
   ```
   → Press F5 or Ctrl+R
   → Wait for page reload
   ```

3. **Verify Data Persists**
   ```
   → New job should still be there
   → Analysis results should be cached
   → Job status changes should persist
   → Feedback should be saved
   ```

**Expected Time:** 1 minute

---

### Test 10: Responsive Design ✅ (No API Key Needed)

**Purpose:** Test mobile/tablet layouts

1. **Open DevTools**
   ```
   → Press F12
   → Click device toolbar icon (phone/tablet icon)
   → OR: Press Ctrl+Shift+M
   ```

2. **Test Mobile View (375px)**
   ```
   → Select iPhone in device dropdown
   → Navigation tabs should be scrollable
   → Job list should stack vertically
   → Candidate cards should be full width
   → Buttons should be touch-friendly
   ```

3. **Test Tablet View (768px)**
   ```
   → Select iPad
   → Should see 2-column layout
   → Tabs should be visible
   → Content should be readable
   ```

4. **Test Desktop (1920px)**
   ```
   → Full layout
   → 3-column candidate grid
   → All features visible
   ```

**Expected Time:** 2 minutes

---

## 🐛 Troubleshooting

### Issue 1: `npm install` fails

**Error:**
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**Solutions:**
1. Make sure you're in the correct directory
   ```bash
   cd "c:\Users\Dule\Downloads\talent-sonar-job+candidate-more-details"
   ```

2. Delete node_modules and try again
   ```bash
   rmdir /s /q node_modules
   npm install
   ```

3. Clear npm cache
   ```bash
   npm cache clean --force
   npm install
   ```

---

### Issue 2: Port 3000 already in use

**Error:**
```
Port 3000 is in use, trying another one...
```

**Solutions:**
1. Kill the process using port 3000
   ```bash
   # Windows:
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F

   # Or just use the new port Vite assigns
   ```

2. Or specify a different port
   ```bash
   npm run dev -- --port 3001
   ```

---

### Issue 3: White screen / React errors

**Error:** Console shows React errors

**Solutions:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Check console for specific errors
4. Restart dev server

---

### Issue 4: API Key not working

**Error:**
```
Failed to analyze: API key not valid
```

**Solutions:**
1. Check .env.local file exists
2. Verify API key is correct (starts with `AIza`)
3. Make sure no extra spaces
4. Restart dev server after changing .env.local
5. Check API key hasn't expired/been disabled
6. Verify billing is enabled (if required)

---

### Issue 5: Gemini API rate limit

**Error:**
```
Failed to analyze: Rate limit exceeded
```

**Solutions:**
1. Wait 1 minute and try again
2. Free tier has limits:
   - 15 requests per minute
   - 1,500 requests per day
3. Upgrade to paid tier if needed
4. Use "Analyze Top 10" button (has built-in delays)

---

### Issue 6: Analysis modal stuck loading

**Symptoms:** Modal shows "Generating..." forever

**Solutions:**
1. Check browser console for errors
2. Verify API key is valid
3. Check internet connection
4. Refresh page and try again
5. Try a different candidate/job

---

### Issue 7: Candidates not showing

**Symptoms:** Job selected but no candidates appear

**Solutions:**
1. Check browser console for errors
2. Clear localStorage:
   ```javascript
   // In browser console:
   localStorage.clear();
   // Then refresh page
   ```
3. Verify mock data is loading
4. Check network tab for errors

---

### Issue 8: TypeScript errors

**Error:** Red squiggly lines in VS Code

**Solutions:**
1. These are just warnings, app should still run
2. Restart TypeScript server:
   - VS Code: Ctrl+Shift+P
   - Type: "TypeScript: Restart TS Server"
3. Or ignore them (won't affect runtime)

---

## 📊 Expected Performance

### Initial Load Time:
- **First visit:** 2-3 seconds
- **Subsequent visits:** <1 second (cached)

### Operations:
- **Switch jobs:** Instant
- **Switch tabs:** Instant
- **Add job:** 1-2 seconds
- **Single AI analysis:** 3-5 seconds
- **Batch analyze 10:** 30-50 seconds
- **Upload CV (with AI):** 5-10 seconds

### Browser Requirements:
- **Minimum:** Chrome 90+, Firefox 88+, Safari 14+
- **Recommended:** Latest version
- **RAM:** 2GB+ available
- **Internet:** 5+ Mbps

---

## 🎯 Success Criteria

After running all tests, you should be able to confirm:

✅ **Basic Functionality:**
- [ ] App loads without errors
- [ ] Can navigate between views
- [ ] Can select different jobs
- [ ] Candidates update based on job selection
- [ ] Match scores are visible

✅ **Core Matching:**
- [ ] Adding job triggers auto-scoring
- [ ] Success notification shows match statistics
- [ ] Job cards show match badges
- [ ] Best Matches tab shows top 15

✅ **AI Features (with API key):**
- [ ] "Analyze Top 10" button works
- [ ] Progress bar shows real-time updates
- [ ] Individual analysis works
- [ ] Job analysis works
- [ ] Results are comprehensive and accurate

✅ **User Experience:**
- [ ] Notifications are clear and helpful
- [ ] Loading states are visible
- [ ] Colors and animations work smoothly
- [ ] Responsive on mobile/tablet
- [ ] Data persists after refresh

---

## 📞 Getting Help

**If you encounter issues:**

1. **Check Console First**
   - Press F12
   - Look for red errors
   - Copy error message

2. **Check this guide**
   - Search for error message
   - Try troubleshooting steps

3. **Check Browser Compatibility**
   - Try in Chrome (most tested)
   - Update to latest version

4. **Verify Setup**
   - Node.js version: `node --version`
   - npm version: `npm --version`
   - Dependencies installed: `npm list`

---

## 🎉 You're Ready to Test!

Follow the test scenarios in order for the best experience. Start with tests that don't require an API key, then add the key for advanced features.

**Have fun testing the future of recruitment! 🚀**
