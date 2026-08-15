# ⚡ Quick Start Guide - Talent Sonar AI

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies
```bash
cd "c:\Users\Dule\Downloads\talent-sonar-job+candidate-more-details"
npm install
```

### 2. Get API Key (Optional but Recommended)
1. Go to https://ai.google.dev/
2. Click "Get API Key"
3. Sign in with Google
4. Create API key
5. Copy the key (starts with `AIza...`)

### 3. Add API Key to `.env.local`
```bash
# Open the file:
notepad .env.local

# Replace with:
GEMINI_API_KEY=AIzaSy...your-actual-key-here

# Save (Ctrl+S) and close
```

### 4. Start the Server
```bash
npm run dev
```

### 5. Open Browser
Navigate to: **http://localhost:3000**

---

## 🎯 5-Minute Demo Script

### Step 1: Explore the Interface (30 seconds)
- See 23 jobs in left sidebar
- Notice match score badges (green/yellow)
- Click different jobs → candidates update instantly

### Step 2: Test Auto-Matching (30 seconds)
- Click "Senior React Developer" job
- See candidates sorted by match score
- Notice: 87%, 85%, 82%... (high matches at top)
- Check "Best Matches" tab → Top 15 across all pools

### Step 3: Batch AI Analysis (2 minutes) 🔑 **REQUIRES API KEY**
- Click big gradient button: "⚡ AI Analyze Top 10 Best Matches"
- Watch purple progress bar: "Candidate 1 of 10... 2 of 10..."
- Wait ~30-50 seconds
- See success: "Successfully analyzed 10 top candidates!"

### Step 4: View AI Analysis (30 seconds)
- Click any of the top 10 candidates
- Click "Detailed AI Fit Analysis"
- See comprehensive breakdown:
  - Overall match score
  - 5-dimensional analysis
  - Skill gaps
  - Future potential

### Step 5: Add a New Job (1 minute)
- (If Add Job button available) OR skip this
- Fill in: "Senior Full-Stack Developer"
- Skills: "React, Node.js, TypeScript"
- Click "Add Job"
- See green notification: "Found 8 strong matches from 55 candidates"
- Job appears with match badges

**Total Time: ~5 minutes**

---

## 🔥 Key Features to Showcase

### 1. Automatic Matching (Works WITHOUT API Key)
✅ Add job → All 55 candidates scored instantly
✅ Success notification with match statistics
✅ Job cards show "🟢 8 strong 🟡 12 good"

### 2. Best Matches Tab (Works WITHOUT API Key)
✅ Trophy icon tab
✅ Shows top 15 across all pools
✅ No more tab switching!

### 3. Batch AI Analysis (REQUIRES API Key)
✅ One-click "Analyze Top 10"
✅ Real-time progress bar
✅ 5-dimensional fit assessment
✅ Skill gap analysis

### 4. Smart Notifications (Works WITHOUT API Key)
✅ Green: Success messages
✅ Blue: Processing indicator
✅ Purple: AI analysis progress
✅ Red: Errors

---

## 📱 Browser Tips

### Open Developer Console
- **Windows:** Press `F12`
- **Mac:** Press `Cmd+Option+I`

**Why?** See detailed logs of what's happening behind the scenes

### Responsive Testing
- Press `F12` → Click device toolbar icon
- Test mobile, tablet, desktop layouts

---

## 🎓 What Each Feature Tests

| Feature | Tests | Needs API? |
|---------|-------|------------|
| Job Selection | UI, sorting | ❌ No |
| Add Job | Auto-scoring | ❌ No |
| Best Matches Tab | Aggregation | ❌ No |
| Match Badges | Calculation | ❌ No |
| Analyze Top 10 | Batch AI | ✅ Yes |
| Individual Analysis | Single AI | ✅ Yes |
| Job Analysis | AI parsing | ✅ Yes |
| CV Upload | AI parsing | ✅ Yes |

---

## 🐛 Quick Fixes

### App won't start?
```bash
# Clear everything and reinstall:
rmdir /s /q node_modules
npm install
npm run dev
```

### API key not working?
```bash
# 1. Check .env.local has correct key
# 2. Restart server:
# Press Ctrl+C in terminal
npm run dev
```

### Page is blank?
```bash
# Hard refresh:
# Press Ctrl+F5 in browser
```

### Port 3000 in use?
```bash
# Use different port:
npm run dev -- --port 3001
```

---

## 📊 What to Expect

### With API Key:
- ✅ Full AI analysis features
- ✅ Deep candidate insights
- ✅ Job description parsing
- ✅ CV parsing and extraction
- ⚠️ Rate limits: 15 requests/minute (free tier)

### Without API Key:
- ✅ Basic matching (keyword-based)
- ✅ UI and navigation
- ✅ Match score display
- ✅ Best Matches tab
- ❌ AI analysis features disabled

---

## 🎯 Success Checklist

Run through this quick checklist:

- [ ] App loads at localhost:3000
- [ ] Can click different jobs
- [ ] Candidates update when job changes
- [ ] "Best Matches" tab shows top 15
- [ ] Match badges visible on job cards
- [ ] (With API) "Analyze Top 10" button works
- [ ] (With API) Progress bar shows
- [ ] (With API) Success notification appears
- [ ] (With API) Analysis modal shows detailed results

**If all checked → You're ready to demo! 🎉**

---

## 🚀 Next Steps

### For Demo/Presentation:
1. Practice the 5-minute demo script above
2. Have 2-3 jobs ready to showcase
3. Pre-analyze top candidates so demo is fast
4. Focus on "Best Matches" tab and match badges

### For Development:
1. Read `TESTING_GUIDE.md` for comprehensive tests
2. Check `README.md` for architecture details
3. Explore `App.tsx` for main logic
4. Look at `geminiService.ts` for AI integration

### For Production:
1. Get production Gemini API key
2. Set up database (PostgreSQL recommended)
3. Implement backend API
4. Add authentication
5. Deploy to cloud (Vercel, Netlify, AWS)

---

## 📞 Need Help?

**Common Issues:**
1. Port in use → Use `--port 3001`
2. Dependencies failed → Run `npm cache clean --force`
3. API errors → Check key in `.env.local`
4. Blank screen → Hard refresh (Ctrl+F5)

**Still stuck?**
- Check `TESTING_GUIDE.md` for detailed troubleshooting
- Look at browser console (F12) for errors
- Verify Node.js version: `node --version` (should be 18+)

---

## 🎉 Ready to Go!

Your matching machine is ready to impress!

**The best way to learn: Just start clicking around and exploring!**

🚀 **Let's revolutionize recruitment!**
