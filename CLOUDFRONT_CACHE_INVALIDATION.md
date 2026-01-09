# CloudFront Cache Invalidation

If your code changes work locally but not on AWS, CloudFront is likely caching the old responses.

## Automatic Invalidation (Recommended)

The GitHub Actions workflow now automatically invalidates CloudFront cache after each deployment.

### Setup

1. Get your CloudFront Distribution ID:

   ```bash
   aws cloudfront list-distributions \
     --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, 'elasticbeanstalk')].[Id,DomainName]" \
     --output table
   ```

2. Add it to GitHub Secrets:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CLOUDFRONT_DISTRIBUTION_ID`
   - Value: Your CloudFront distribution ID (e.g., `E1234567890ABC`)
   - Click "Add secret"

3. That's it! Every deployment will now automatically invalidate the cache.

### What Gets Invalidated

The workflow invalidates these paths after each deployment:

- `/api/v1/user`
- `/api/v1/users`
- `/api/v1/user/*`
- `/api/*` (all API endpoints)

---

## Manual Invalidation

If you need to manually invalidate the cache:

## Quick Fix: Invalidate CloudFront Cache

### Option 1: AWS Console (Easiest)

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Select your distribution (the one pointing to your Elastic Beanstalk)
3. Click the **Invalidations** tab
4. Click **Create invalidation**
5. Enter the paths to invalidate:
   ```
   /api/v1/user
   /api/v1/users
   /api/v1/user/*
   ```
   Or use `/*` to invalidate everything (slower but ensures all changes are reflected)
6. Click **Create invalidation**
7. Wait 1-5 minutes for the invalidation to complete

### Option 2: AWS CLI

```bash
# Get your CloudFront distribution ID
aws cloudfront list-distributions --query "DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName]" --output table

# Invalidate specific paths
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/api/v1/user" "/api/v1/users" "/api/v1/user/*"

# Or invalidate everything
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Option 3: Add Cache Headers to Prevent Caching

You can also modify your Express app to send cache-control headers for API endpoints:

```typescript
// In your middleware or route handlers
res.set("Cache-Control", "no-cache, no-store, must-revalidate");
res.set("Pragma", "no-cache");
res.set("Expires", "0");
```

## Check CloudFront Distribution ID

If you don't know your CloudFront distribution ID:

```bash
# List all distributions
aws cloudfront list-distributions \
  --query "DistributionList.Items[*].[Id,DomainName,Comment,Status]" \
  --output table

# Or find by domain name
aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, 'elasticbeanstalk')].[Id,DomainName]" \
  --output table
```

## Verify the Fix

After invalidating:

1. Wait 2-5 minutes for the invalidation to complete
2. Test the endpoint: `GET /api/v1/user` should return the current user
3. Test the endpoint: `GET /api/v1/users` should return all users

## Prevent Future Caching Issues

### Option 1: Disable Caching for API Endpoints

In CloudFront, create a cache behavior for `/api/*` paths with:

- **Cache Policy**: CachingDisabled
- **Origin Request Policy**: AllViewer

### Option 2: Use Query String Parameters

Add a version or timestamp query parameter to bypass cache:

```
GET /api/v1/user?v=2
```

### Option 3: Set Cache-Control Headers

Add middleware to set no-cache headers for API routes:

```typescript
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});
```

## Check Current Cache Settings

```bash
# Get distribution config
aws cloudfront get-distribution-config \
  --id YOUR_DISTRIBUTION_ID \
  --query "DistributionConfig.CacheBehaviors.Items[*].[PathPattern,CachePolicyId]" \
  --output table
```

## Troubleshooting

### Still seeing old responses?

1. **Check invalidation status:**

   ```bash
   aws cloudfront list-invalidations \
     --distribution-id YOUR_DISTRIBUTION_ID \
     --max-items 5
   ```

2. **Verify the code is actually deployed:**
   - Check Elastic Beanstalk logs
   - SSH into the instance and check the code
   - Verify the deployment version

3. **Clear browser cache:**
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Use incognito/private mode
   - Clear browser cache

4. **Check if you're hitting CloudFront or directly hitting EB:**
   - CloudFront URL: `https://your-distribution-id.cloudfront.net`
   - EB URL: `http://autovista.us-east-1.elasticbeanstalk.com`
   - Make sure you're testing the CloudFront URL

## Quick Invalidation Script

Save this as `invalidate-cache.sh`:

```bash
#!/bin/bash
DISTRIBUTION_ID="YOUR_DISTRIBUTION_ID"  # Replace with your actual ID

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/api/v1/user" "/api/v1/users" "/api/v1/user/*" \
  --output json

echo "Invalidation created. Waiting for completion..."
aws cloudfront wait invalidation-completed \
  --distribution-id $DISTRIBUTION_ID \
  --id $(aws cloudfront list-invalidations \
    --distribution-id $DISTRIBUTION_ID \
    --max-items 1 \
    --query "InvalidationList.Items[0].Id" \
    --output text)

echo "Cache invalidation complete!"
```

Make it executable and run:

```bash
chmod +x invalidate-cache.sh
./invalidate-cache.sh
```
