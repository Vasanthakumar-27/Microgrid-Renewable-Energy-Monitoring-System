# Heroku Deployment Guide - Microgrid City System

## Overview
This guide walks you through deploying the Microgrid City System to Heroku for live hosting.

## Prerequisites
- GitHub account with repository pushed (✅ Done)
- Heroku account (free or paid)
- Heroku CLI installed

---

## Step 1: Install Heroku CLI

### Option A: Direct Download (Recommended for Windows)
1. Visit: https://devcenter.heroku.com/articles/heroku-cli
2. Download Heroku CLI for Windows
3. Run the installer
4. Verify installation: `heroku --version`

### Option B: Using npm
```powershell
npm install -g heroku
# Wait for installation to complete
heroku --version
```

---

## Step 2: Login to Heroku

```powershell
heroku login
```

This will:
- Open browser to Heroku login page
- Authenticate your Heroku account
- Store credentials locally

---

## Step 3: Create Heroku Application

```powershell
heroku create your-app-name
```

Replace `your-app-name` with your preferred app name (e.g., `microgrid-city-prod`)

Example:
```powershell
heroku create microgrid-city-prod
```

This will:
- Create a new app on Heroku
- Add a git remote named `heroku`
- Assign a unique URL

---

## Step 4: Configure Environment Variables

```powershell
heroku config:set MONGODB_URI="your-mongodb-connection-string"
heroku config:set JWT_SECRET="your-jwt-secret"
heroku config:set ENCRYPTION_KEY="your-encryption-key"
heroku config:set NODE_ENV="production"
heroku config:set HMAC_SECRET="your-hmac-secret"
```

View all settings:
```powershell
heroku config
```

---

## Step 5: Add-ons (Optional but Recommended)

### MongoDB Addon
```powershell
heroku addons:create mongolab:sandbox
```

### Redis Addon (Optional)
```powershell
heroku addons:create heroku-redis:premium-0
```

---

## Step 6: Deploy to Heroku

### Option A: Deploy from main branch
```powershell
git push heroku main
```

### Option B: Deploy from different branch
```powershell
git push heroku your-branch:main
```

---

## Step 7: View Application

Your app is now live at: `https://your-app-name.herokuapp.com`

Check logs:
```powershell
heroku logs --tail
```

View app in browser:
```powershell
heroku open
```

---

## Step 8: Monitor & Manage

### View app status
```powershell
heroku apps:info
```

### Scale web processes (if needed)
```powershell
heroku ps:scale web=1
```

### View running processes
```powershell
heroku ps
```

### Restart app
```powershell
heroku restart
```

---

## Troubleshooting

### App crashes on startup
```powershell
heroku logs --tail
```
Check logs for errors

### Database connection fails
- Verify `MONGODB_URI` is set correctly
- Check MongoDB connection string format
- Ensure MongoDB server is accessible

### npm install fails
- Check package.json format
- Verify all dependencies are in npm registry
- Use `heroku logs` for details

### Port issues
- Heroku assigns PORT via environment variable
- server.js should use `process.env.PORT || 5000`
- Check server.js listens on correct port

---

## Alternative Deployment Options

### DigitalOcean App Platform
- Connect GitHub repo directly
- Auto-deploy on push
- Cost: ~$12/month

### AWS
- EC2 instances
- More control, more complex
- Various pricing tiers

### Azure
- App Service
- Integrated with GitHub
- Pay-as-you-go pricing

---

## Post-Deployment Checklist

- [ ] App deployed and running
- [ ] Environment variables configured
- [ ] Database connected
- [ ] API endpoints responding
- [ ] Tests passing in logs
- [ ] Monitoring/alerts active
- [ ] SSL certificate active (automatic on Heroku)
- [ ] Custom domain configured (optional)

---

## Quick Commands Reference

```powershell
# Login
heroku login

# Create app
heroku create app-name

# Set environment variables
heroku config:set KEY=VALUE

# Deploy
git push heroku main

# View logs
heroku logs --tail

# Open app
heroku open

# View config
heroku config

# Restart
heroku restart

# Scale
heroku ps:scale web=1

# Destroy app
heroku apps:destroy --app app-name
```

---

## Support

- Heroku Docs: https://devcenter.heroku.com
- GitHub Issues: Check repository issues
- Status: https://status.heroku.com

