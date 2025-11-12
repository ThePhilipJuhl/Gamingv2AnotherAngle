# GitHub Pages Setup Guide

## ✅ What I've Done

1. **Created `index.html` in root** - GitHub Pages will now serve this instead of README.md
2. **Created `.nojekyll` file** - Prevents Jekyll from processing your site
3. **Updated `app.js`** - Made API base URL configurable for different environments

## 🚨 Important: Backend Deployment Required

**GitHub Pages only serves static files** - it cannot run your Flask backend. You need to deploy the backend separately.

### Option 1: Deploy Backend to Render (Recommended - Free)

1. Go to [render.com](https://render.com) and sign up
2. Create a new "Web Service"
3. Connect your GitHub repository
4. Set these build settings:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
5. Add environment variables in Render dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `GOOGLE_CLIENT_ID` (optional)
   - `GOOGLE_CLIENT_SECRET` (optional)
   - `GOOGLE_REDIRECT_URI` (should be your Render URL + `/auth/callback`)
   - `DISCORD_WEBHOOK_URL` (optional)
   - `PORT` (Render sets this automatically)
6. Copy your Render URL (e.g., `https://your-app.onrender.com`)

### Option 2: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and sign up
2. Create a new project from GitHub
3. Add environment variables
4. Railway will auto-detect Python and deploy

### Option 3: Deploy Backend to Heroku

1. Install Heroku CLI
2. Run: `heroku create your-app-name`
3. Set environment variables: `heroku config:set SUPABASE_URL=...`
4. Deploy: `git push heroku main`

## 🔧 Update API URL

After deploying your backend, update the API URL in `static/app.js`:

1. Open `static/app.js`
2. Find the line: `return 'https://your-backend-url.herokuapp.com/api';`
3. Replace with your actual backend URL (e.g., `https://your-app.onrender.com/api`)

Or, you can set it dynamically by adding this to `index.html` before the app.js script:

```html
<script>
    window.API_BASE_URL = 'https://your-backend-url.onrender.com/api';
</script>
<script src="static/app.js"></script>
```

## 📝 Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under "Source", select **Deploy from a branch**
4. Choose **main** branch and **/ (root)** folder
5. Click **Save**
6. Your site will be available at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME`

## ✅ Verify It Works

1. Visit your GitHub Pages URL
2. You should see the app interface (not README.md)
3. Try creating a user - if you see API errors, make sure:
   - Your backend is deployed and running
   - The API URL in `app.js` is correct
   - CORS is enabled on your backend (already done in `app.py`)

## 🔍 Troubleshooting

- **Still seeing README.md?** - Wait a few minutes for GitHub Pages to rebuild, or check that `index.html` is in the root
- **API errors?** - Check browser console, verify backend URL is correct
- **CORS errors?** - Make sure `CORS(app)` is in your `app.py` (it already is)
- **404 on static files?** - Make sure `static/` folder is committed to git

