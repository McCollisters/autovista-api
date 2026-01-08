# GitHub Secrets Setup for Elastic Beanstalk Deployment

The GitHub Actions workflow automatically sets environment variables in Elastic Beanstalk from GitHub Secrets during deployment.

## Required GitHub Secrets

You **must** set these secrets in your GitHub repository:

### Required (Application won't start without this):
- **`MONGODB_PROD_URI`** - MongoDB connection string for production (preferred)
  - Example: `mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`
  
  **Note:** If `MONGODB_PROD_URI` is not set, the workflow will fallback to `MONGODB_DEV_URI`, but it's recommended to use `MONGODB_PROD_URI` for production deployments.

## Recommended GitHub Secrets

Set these if you're using the corresponding features:

### Super Dispatch Integration
- **`SD_USER`** - Super Dispatch OAuth client ID
- **`SD_PASS`** - Super Dispatch OAuth client secret

### Email (SendGrid)
- **`SENDGRID_API_KEY`** - SendGrid API key for sending emails

### Authentication
- **`JWT_SECRET`** - Secret key for JWT token signing

### Application Configuration
- **`BASE_URL`** - Base URL for webhooks and callbacks
  - Example: `https://api.yourdomain.com`
- **`ALLOWED_ORIGINS`** - Comma-separated list of allowed CORS origins
  - Example: `https://app.yourdomain.com,https://portal.yourdomain.com`

### Email Configuration (Optional)
- **`EMAIL_FROM_ADDRESS`** - Default email sender address
- **`EMAIL_FROM_NAME`** - Default email sender name

### SMS (Twilio) - Optional
- **`TWILIO_ACCOUNT_SID`** - Twilio account SID
- **`TWILIO_AUTH_TOKEN`** - Twilio auth token
- **`TWILIO_FROM_NUMBER`** - Twilio phone number

## How to Set GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the **Name** (must match exactly, case-sensitive)
5. Enter the **Value**
6. Click **Add secret**

## How It Works

When you push to `main` or manually trigger the workflow:

1. The workflow builds your application
2. Before deploying, it reads all the GitHub Secrets listed above
3. It automatically sets them as environment variables in your Elastic Beanstalk environment
4. The environment is updated and restarted with the new variables
5. Your application deploys with the environment variables already configured

## Benefits

- ✅ Secrets are stored securely in GitHub (encrypted at rest)
- ✅ No need to manually set variables in AWS Console
- ✅ Version controlled workflow (changes tracked in git)
- ✅ Automatic updates on every deployment
- ✅ Only secrets that are set will be applied (optional secrets won't cause errors)

## Important Notes

- **Secret names are case-sensitive** - Use exact names as listed above
- **Secrets are encrypted** - GitHub encrypts them and they're only decrypted during workflow execution
- **Secrets are not visible in logs** - GitHub automatically masks secret values in workflow logs
- **Update secrets anytime** - Just update the secret in GitHub and redeploy
- **Required vs Optional** - Only `MONGODB_PROD_URI` (or `MONGODB_DEV_URI` as fallback) is required. Others are optional based on your features

## Troubleshooting

### Application still fails with "Missing required environment variables"

1. **Check the secret is set**: Go to Settings → Secrets and verify `MONGODB_PROD_URI` (or `MONGODB_DEV_URI`) exists
2. **Check the secret name**: Must be exactly `MONGODB_PROD_URI` or `MONGODB_DEV_URI` (case-sensitive)
3. **Check workflow logs**: Look for the "Set environment variables" step to see if it ran successfully
4. **Verify AWS permissions**: The AWS credentials need `elasticbeanstalk:UpdateEnvironment` permission

### Environment variables not updating

1. **Check workflow logs**: The "Set environment variables" step should show which variables were set
2. **Wait for update**: The environment update can take a few minutes
3. **Check AWS Console**: Verify the variables are actually set in Elastic Beanstalk → Configuration → Software → Environment properties

### Secret value has special characters

- GitHub Secrets handle special characters automatically
- The workflow uses `jq` to properly escape JSON values
- If you have issues, try URL-encoding special characters in the secret value

## Example: Setting Up for First Time

1. Set the required secret:
   ```
   Name: MONGODB_PROD_URI
   Value: mongodb+srv://user:pass@cluster.mongodb.net/dbname
   ```
   
   **Note:** You can also use `MONGODB_DEV_URI` as a fallback, but `MONGODB_PROD_URI` is recommended for production.

2. Set recommended secrets (if using these features):
   ```
   Name: SD_USER
   Value: your_super_dispatch_client_id
   
   Name: SD_PASS
   Value: your_super_dispatch_client_secret
   
   Name: SENDGRID_API_KEY
   Value: SG.xxxxxxxxxxxxx
   
   Name: JWT_SECRET
   Value: your-secret-key-here
   
   Name: BASE_URL
   Value: https://api.yourdomain.com
   ```

3. Push to `main` or manually trigger the workflow
4. The workflow will automatically set all these as environment variables in Elastic Beanstalk
