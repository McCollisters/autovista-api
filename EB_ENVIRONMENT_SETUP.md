# Elastic Beanstalk Environment Variables Setup

## Current Issue
The application is failing to start because `MONGODB_PROD_URI` (or `MONGODB_DEV_URI` as fallback) and potentially other environment variables are not set in the Elastic Beanstalk environment.

## Quick Fix: Set Environment Variables

### Option 1: AWS Console (Recommended - Easiest)

1. Go to [AWS Elastic Beanstalk Console](https://console.aws.amazon.com/elasticbeanstalk)
2. Select your application: `autovista-api`
3. Select your environment: `autovista-api-prod`
4. Click **Configuration** in the left sidebar
5. Scroll down and click **Edit** on the **Software** card
6. Scroll to **Environment properties**
7. Add the following environment variables:

   **Required:**
   - `MONGODB_PROD_URI` = `mongodb+srv://your-connection-string` (preferred for production)
   - OR `MONGODB_DEV_URI` = `mongodb+srv://your-connection-string` (fallback)
   
   **Recommended (if using these features):**
   - `SD_USER` = Your Super Dispatch client ID
   - `SD_PASS` = Your Super Dispatch client secret
   - `SENDGRID_API_KEY` = Your SendGrid API key
   - `JWT_SECRET` = Your JWT secret key
   - `BASE_URL` = Your production API URL (e.g., `https://api.yourdomain.com`)
   
   **Optional:**
   - `EMAIL_FROM_ADDRESS` = Email address for sending emails
   - `EMAIL_FROM_NAME` = Name for sending emails
   - `ALLOWED_ORIGINS` = Comma-separated list of allowed CORS origins
   - `TWILIO_ACCOUNT_SID` = If using Twilio for SMS
   - `TWILIO_AUTH_TOKEN` = If using Twilio for SMS
   - `TWILIO_FROM_NUMBER` = If using Twilio for SMS

8. Click **Apply** at the bottom
9. Wait for the environment to update (this will trigger a restart)

### Option 2: EB CLI

If you have the EB CLI installed:

```bash
eb setenv \
  MONGODB_PROD_URI="mongodb+srv://your-connection-string" \
  SD_USER="your_client_id" \
  SD_PASS="your_client_secret" \
  SENDGRID_API_KEY="your_sendgrid_api_key" \
  JWT_SECRET="your_jwt_secret" \
  BASE_URL="https://api.yourdomain.com" \
  NODE_ENV="production"
```

**Note:** You can use `MONGODB_DEV_URI` instead of `MONGODB_PROD_URI` if preferred, but `MONGODB_PROD_URI` is recommended for production.

This will update the environment and trigger a restart.

### Option 3: AWS CLI

```bash
aws elasticbeanstalk update-environment \
  --environment-name autovista-api-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=MONGODB_DEV_URI,Value="mongodb+srv://your-connection-string" \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=SD_USER,Value="your_client_id" \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=SD_PASS,Value="your_client_secret" \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=SENDGRID_API_KEY,Value="your_sendgrid_api_key"
```

## Verify Environment Variables Are Set

After setting the variables, verify they're loaded:

1. Go to Elastic Beanstalk → Your Environment → Configuration → Software
2. Scroll to **Environment properties** and verify all variables are listed
3. Check the application logs to ensure the application starts successfully

## Required vs Optional Variables

### Required (Application won't start without these):
- `MONGODB_PROD_URI` - MongoDB connection string for production (preferred)
- OR `MONGODB_DEV_URI` - MongoDB connection string (fallback, but recommended for production to use `MONGODB_PROD_URI`)

### Highly Recommended (Needed for core functionality):
- `SD_USER` - Super Dispatch client ID (if using Super Dispatch)
- `SD_PASS` - Super Dispatch client secret (if using Super Dispatch)
- `SENDGRID_API_KEY` - SendGrid API key (if sending emails)
- `JWT_SECRET` - JWT secret for authentication (if using auth)

### Optional (Have defaults or only needed for specific features):
- `PORT` - Server port (defaults to 8080)
- `NODE_ENV` - Already set to "production" in build config
- `AWS_REGION` - Defaults to "us-east-1"
- `BASE_URL` - For webhooks and callbacks
- `ALLOWED_ORIGINS` - CORS origins
- `EMAIL_FROM_ADDRESS` - Email sender address
- `EMAIL_FROM_NAME` - Email sender name
- `TWILIO_*` - Only if using Twilio for SMS

## After Setting Variables

1. The environment will automatically restart
2. Monitor the logs: Elastic Beanstalk → Your Environment → Logs → Request Logs → Last 100 Lines
3. Check `/var/log/web.stdout.log` for application startup messages
4. The application should start successfully once `MONGODB_PROD_URI` (or `MONGODB_DEV_URI`) is set

## Troubleshooting

If the application still fails after setting variables:

1. **Check variable names**: They are case-sensitive. Ensure exact match (`MONGODB_PROD_URI` or `MONGODB_DEV_URI`)
2. **Check for typos**: Verify the MongoDB connection string is correct
3. **Check production vs dev**: In production, `MONGODB_PROD_URI` is preferred over `MONGODB_DEV_URI`
3. **Check logs**: Look for specific error messages in `/var/log/web.stdout.log`
4. **Verify environment update**: Ensure the environment finished updating (status should be "Ready")
5. **Check IAM permissions**: Ensure the EB environment has permissions to access any AWS services you're using

## Security Notes

- Never commit actual environment variable values to git
- Use AWS Secrets Manager or Parameter Store for sensitive values if possible
- Rotate secrets regularly
- Use different values for staging vs production environments
