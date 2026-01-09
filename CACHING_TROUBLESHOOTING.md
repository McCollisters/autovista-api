# Caching Troubleshooting Guide

If your route changes work locally but not on AWS, here are all the places caching could be happening:

## 1. CloudFront (Most Common)

**Status:** ✅ Addressed with cache invalidation and no-cache headers

**Check:**

- Are you testing via CloudFront URL or directly hitting Elastic Beanstalk?
- Check response headers for `X-Cache: Hit from cloudfront` or `X-Cache: Miss from cloudfront`

**Solution:**

- Cache invalidation is automatic after deployments
- No-cache headers are set for all `/api/*` routes
- Verify CloudFront cache policy respects `Cache-Control: no-cache`

## 2. Elastic Beanstalk / Nginx

**Possible Issue:** Nginx reverse proxy might be caching responses

**Check:**

```bash
# SSH into your EB instance and check nginx config
sudo cat /etc/nginx/nginx.conf | grep -i cache
```

**Solution:** Add nginx configuration to disable caching for API routes:

Create `.ebextensions/03_nginx_cache.config`:

```yaml
files:
  "/etc/nginx/conf.d/api_no_cache.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      location /api {
        proxy_cache off;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
      }
```

## 3. Application Load Balancer (ALB)

**Possible Issue:** ALB might have response caching enabled

**Check:**

```bash
# Check ALB attributes
aws elbv2 describe-load-balancer-attributes \
  --load-balancer-arn YOUR_ALB_ARN \
  --query 'Attributes[?Key==`routing.http.drop_invalid_header_fields.enabled`]'
```

**Solution:**

- ALB doesn't cache by default, but check if any caching is configured
- Go to EC2 Console → Load Balancers → Your ALB → Attributes

## 4. Node.js Module Caching

**Possible Issue:** Old route handlers might be cached in memory

**Check:**

- Restart the application after deployment
- Check if PM2 or process manager is running old code

**Solution:**

- Elastic Beanstalk should restart the app on deployment
- Verify the deployment actually restarted: Check EB logs for "Server started successfully"

## 5. Build/Deployment Issues

**Possible Issue:** Old code might not be getting deployed

**Check:**

```bash
# Verify the deployed code
aws elasticbeanstalk describe-environments \
  --environment-names autovista-api-prod \
  --query 'Environments[0].VersionLabel'

# Check if build actually ran
# Look in GitHub Actions logs for "Build successful"
```

**Solution:**

- Verify `dist/index.js` exists after build
- Check that routes file is included in deployment package
- Ensure `.ebignore` isn't excluding route files

## 6. Browser Cache

**Possible Issue:** Your browser is caching the old API response

**Check:**

- Open DevTools → Network tab
- Check "Disable cache" checkbox
- Look for `(from disk cache)` or `(from memory cache)` in network requests

**Solution:**

- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Use incognito/private mode
- Clear browser cache
- Use a different browser or tool (Postman, curl)

## 7. Postman / API Client Cache

**Possible Issue:** Postman or other API clients might cache responses

**Solution:**

- Disable cache in Postman settings
- Use a new request instead of reusing old ones
- Add a query parameter: `?t=${Date.now()}` to bypass cache

## 8. CloudFront Cache Policy

**Possible Issue:** CloudFront cache policy ignores `Cache-Control` headers

**Check:**

```bash
# Get cache policy for your distribution
aws cloudfront get-distribution-config \
  --id YOUR_DISTRIBUTION_ID \
  --query 'DistributionConfig.DefaultCacheBehavior.CachePolicyId'

# Check if it respects Cache-Control
aws cloudfront get-cache-policy \
  --id YOUR_CACHE_POLICY_ID
```

**Solution:**

- Create a custom cache policy that respects `Cache-Control: no-cache`
- Or use "CachingDisabled" policy for `/api/*` paths
- See CloudFront console → Policies → Cache policies

## Diagnostic Steps

### Step 1: Verify Code is Deployed

```bash
# Check deployment version
aws elasticbeanstalk describe-environments \
  --environment-names autovista-api-prod \
  --query 'Environments[0].VersionLabel' \
  --output text

# Check application logs for route registration
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d | \
  grep -i "route\|server started"
```

### Step 2: Test Directly Against EB (Bypass CloudFront)

```bash
# Get EB URL
EB_URL=$(aws elasticbeanstalk describe-environments \
  --environment-names autovista-api-prod \
  --query 'Environments[0].CNAME' \
  --output text)

# Test directly (bypasses CloudFront)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://${EB_URL}/api/v1/user"
```

### Step 3: Check Response Headers

```bash
# Check what headers are being sent
curl -I -H "Authorization: Bearer YOUR_TOKEN" \
  "https://YOUR_CLOUDFRONT_URL/api/v1/user"

# Look for:
# - Cache-Control: no-cache, no-store, must-revalidate
# - X-Cache: Hit from cloudfront (means it's cached)
# - X-Cache: Miss from cloudfront (means it's not cached)
```

### Step 4: Verify Route Registration

Add logging to verify routes are registered:

```typescript
// In src/index.ts after routes are mounted
app._router.stack.forEach((r: any) => {
  if (r.route) {
    logger.info("Route registered", {
      method: Object.keys(r.route.methods)[0],
      path: r.route.path,
    });
  }
});
```

## Quick Fix Checklist

- [ ] CloudFront cache invalidated (automatic after deployment)
- [ ] No-cache headers are set (already added to middleware)
- [ ] Testing via CloudFront URL, not EB URL directly
- [ ] Browser cache cleared / using incognito
- [ ] Postman cache disabled
- [ ] Code actually deployed (check version label)
- [ ] Application restarted after deployment
- [ ] CloudFront cache policy respects Cache-Control headers

## Most Likely Causes (in order)

1. **CloudFront caching** - Even with no-cache headers, if cache policy ignores them
2. **Browser/Client cache** - Most common for developers testing
3. **Code not actually deployed** - Build or deployment failed silently
4. **Application not restarted** - Old code still running in memory
5. **Nginx caching** - Less common but possible

## Force Clear Everything

If nothing else works:

```bash
# 1. Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

# 2. Restart EB environment
aws elasticbeanstalk restart-app-server \
  --environment-name autovista-api-prod

# 3. Wait for restart
aws elasticbeanstalk wait environment-updated \
  --environment-names autovista-api-prod

# 4. Test with curl (bypasses browser cache)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Cache-Control: no-cache" \
  "https://YOUR_CLOUDFRONT_URL/api/v1/user?v=$(date +%s)"
```
