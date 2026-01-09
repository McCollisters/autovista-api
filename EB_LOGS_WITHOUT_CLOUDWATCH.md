# Accessing EB Logs Without CloudWatch Logs

If CloudWatch Logs streaming isn't enabled, use these methods to access logs.

## Method 1: Retrieve Environment Info (Works Without CloudWatch)

### Get Recent Application Logs

```bash
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1
```

This returns base64-encoded log data. To decode and view:

```bash
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1 | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d
```

### Get Full Log Bundle

```bash
# Request log bundle
aws elasticbeanstalk request-environment-info \
  --environment-name autovista-api-prod \
  --info-type bundle \
  --region us-east-1

# Wait 30-60 seconds, then retrieve
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type bundle \
  --region us-east-1
```

This returns a URL to download a zip file with all logs.

## Method 2: Enable CloudWatch Logs (Recommended)

Enable CloudWatch Logs streaming for easier log access:

### Option A: Via AWS Console

1. Go to [Elastic Beanstalk Console](https://console.aws.amazon.com/elasticbeanstalk)
2. Select environment: `autovista-api-prod`
3. Configuration → Logs → Edit
4. Enable "Log streaming" or "CloudWatch Logs"
5. Set retention (e.g., 7 days)
6. Apply

### Option B: Via AWS CLI

```bash
aws elasticbeanstalk update-environment \
  --environment-name autovista-api-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:cloudwatch:logs,OptionName=StreamLogs,Value=true \
    Namespace=aws:elasticbeanstalk:cloudwatch:logs,OptionName=DeleteOnTerminate,Value=false \
    Namespace=aws:elasticbeanstalk:cloudwatch:logs,OptionName=RetentionInDays,Value=7 \
  --region us-east-1
```

Wait 5-10 minutes for the environment to update, then CloudWatch Logs will be available.

## Method 3: View Recent Events

Get recent environment events (deployments, errors, etc.):

```bash
aws elasticbeanstalk describe-events \
  --environment-name autovista-api-prod \
  --max-items 50 \
  --region us-east-1 \
  --output table
```

## Quick Script to View Logs

Create a script `view-eb-logs.sh`:

```bash
#!/bin/bash
ENV_NAME="autovista-api-prod"
REGION="us-east-1"

echo "=== Retrieving recent logs ==="
aws elasticbeanstalk retrieve-environment-info \
  --environment-name $ENV_NAME \
  --info-type tail \
  --region $REGION | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d | \
  tail -100
```

Make it executable:
```bash
chmod +x view-eb-logs.sh
./view-eb-logs.sh
```

## For Your Current Issue

To debug the template error, use:

```bash
# Get recent application logs
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1 | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d | \
  grep -A 10 -B 10 "template\|error\|verification"
```

This will show logs related to templates and errors.
