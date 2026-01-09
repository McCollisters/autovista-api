# Verify Deployment - Troubleshooting Guide

If changes work locally but not on EB (even bypassing CloudFront), the code might not be deployed.

## Step 1: Check Deployment Status

```bash
# Check if deployment completed
aws elasticbeanstalk describe-environments \
  --environment-names autovista-api-prod \
  --query 'Environments[0].[Status,Health,VersionLabel,DateUpdated]' \
  --output table

# Check recent deployments
aws elasticbeanstalk describe-events \
  --environment-name autovista-api-prod \
  --max-items 10 \
  --query 'Events[*].[EventDate,Severity,Message]' \
  --output table
```

## Step 2: Verify Code is Actually Deployed

### Option A: Check Application Logs

```bash
# Get application logs
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1 | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d | \
  grep -i "server started\|route\|user"

# Look for:
# - "Server started successfully"
# - Route registration logs
# - Any errors about routes
```

### Option B: Check Build Logs

```bash
# Get build logs
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type bundle \
  --region us-east-1

# This returns a URL to download full logs
# Check for:
# - "Build successful"
# - "dist/index.js exists"
# - Any build errors
```

### Option C: Verify Routes File is in Deployment

Check if the routes file was included in the deployment package:

```bash
# Check what files are in the deployment
# Look at GitHub Actions logs for the deployment step
# Or check .ebignore to ensure routes aren't excluded
```

## Step 3: Check .ebignore

Make sure routes files aren't being excluded:

```bash
cat .ebignore

# Routes should NOT be in .ebignore
# If you see:
# - src/**/*.ts (this would exclude routes)
# - routes.ts
# Then routes won't be deployed
```

## Step 4: Verify Build Output

Check if the build actually created the routes:

```bash
# In GitHub Actions, check the build step logs
# Look for:
# - "Build successful - dist/index.js exists"
# - Check if dist/user/routes.js exists
```

## Step 5: Force Redeploy

If deployment seems stuck or incomplete:

```bash
# Get the latest application version
LATEST_VERSION=$(aws elasticbeanstalk describe-application-versions \
  --application-name autovista-api \
  --max-items 1 \
  --query 'ApplicationVersions[0].VersionLabel' \
  --output text)

# Redeploy the latest version
aws elasticbeanstalk update-environment \
  --environment-name autovista-api-prod \
  --version-label "$LATEST_VERSION" \
  --region us-east-1
```

## Step 6: Check Application is Running

```bash
# Check if the app is actually running
aws elasticbeanstalk describe-environments \
  --environment-names autovista-api-prod \
  --query 'Environments[0].Health' \
  --output text

# Should be "Ok" or "Warning", not "Severe" or "Degraded"
```

## Step 7: Test Directly Against EB

```bash
# Get EB URL
EB_URL=$(aws elasticbeanstalk describe-environments \
  --environment-names autovista-api-prod \
  --query 'Environments[0].CNAME' \
  --output text)

echo "EB URL: http://${EB_URL}"

# Test health endpoint (should work)
curl "http://${EB_URL}/health"

# Test user endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://${EB_URL}/api/v1/user"

# Check response headers
curl -I -H "Authorization: Bearer YOUR_TOKEN" \
  "http://${EB_URL}/api/v1/user"
```

## Step 8: Check GitHub Actions Deployment Logs

1. Go to your GitHub repository
2. Click **Actions** tab
3. Find the latest deployment workflow run
4. Check:
   - ✅ Build step completed successfully
   - ✅ Deployment step completed
   - ✅ No errors in logs
   - ✅ Version label matches your commit

## Step 9: Verify Routes File in Deployment Package

The routes file should be in the deployment. Check:

```bash
# In GitHub Actions, the deployment package is created with:
zip -r autovista-api.zip . -x "node_modules/*" ...

# Check if src/user/routes.ts is included
# It should be, unless .ebignore excludes it
```

## Step 10: Check for Route Conflicts

Verify the route order is correct in the deployed code:

```bash
# In application logs, look for route registration
# Or add logging to verify routes are loaded
```

## Common Issues

### Issue 1: Build Failed Silently

**Check:**

- GitHub Actions build logs
- EB build logs
- Look for TypeScript compilation errors

**Fix:**

- Fix build errors
- Redeploy

### Issue 2: Routes File Not in Deployment

**Check:**

- `.ebignore` file
- Deployment package contents

**Fix:**

- Remove routes from `.ebignore` if present
- Ensure `src/user/routes.ts` is in the zip

### Issue 3: Application Not Restarted

**Check:**

- EB logs for "Server started successfully"
- Environment status

**Fix:**

- Restart the environment:
  ```bash
  aws elasticbeanstalk restart-app-server \
    --environment-name autovista-api-prod
  ```

### Issue 4: Old Code Still Running

**Check:**

- Version label in EB
- Compare with GitHub commit

**Fix:**

- Force redeploy latest version
- Or trigger a new deployment

### Issue 5: Routes Not Registered

**Check:**

- Application logs for route registration
- Verify routes file is being imported

**Fix:**

- Check for import errors in logs
- Verify route file syntax

## Quick Diagnostic Script

```bash
#!/bin/bash
ENV_NAME="autovista-api-prod"
REGION="us-east-1"

echo "=== Deployment Status ==="
aws elasticbeanstalk describe-environments \
  --environment-names $ENV_NAME \
  --region $REGION \
  --query 'Environments[0].[Status,Health,VersionLabel,DateUpdated]' \
  --output table

echo -e "\n=== Recent Events ==="
aws elasticbeanstalk describe-events \
  --environment-name $ENV_NAME \
  --region $REGION \
  --max-items 5 \
  --query 'Events[*].[EventDate,Severity,Message]' \
  --output table

echo -e "\n=== Application Logs (Last 50 lines) ==="
aws elasticbeanstalk retrieve-environment-info \
  --environment-name $ENV_NAME \
  --info-type tail \
  --region $REGION | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d | \
  tail -50

echo -e "\n=== EB URL ==="
EB_URL=$(aws elasticbeanstalk describe-environments \
  --environment-names $ENV_NAME \
  --region $REGION \
  --query 'Environments[0].CNAME' \
  --output text)
echo "http://${EB_URL}"
```

Save as `check-deployment.sh`, make executable, and run:

```bash
chmod +x check-deployment.sh
./check-deployment.sh
```

## Most Likely Causes

1. **Build failed** - Check GitHub Actions logs
2. **Routes file excluded** - Check `.ebignore`
3. **App didn't restart** - Check EB logs for "Server started"
4. **Old version deployed** - Check version label
5. **Routes not in dist/** - Check build output
