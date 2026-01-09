# Debugging Application Startup Issues

The nginx error "Connection refused" means your Node.js app isn't running on port 8080. Here's how to diagnose:

## 1. Check Application Logs

Get the actual application startup logs:

```bash
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1 | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d | \
  grep -A 50 -B 5 "error\|Error\|failed\|Failed\|start\|Start"
```

## 2. Check Recent Events

See what happened during deployment:

```bash
aws elasticbeanstalk describe-events \
  --environment-name autovista-api-prod \
  --max-items 20 \
  --region us-east-1 \
  --output table
```

## 3. Common Startup Issues

### A. Missing Environment Variables

The app requires:
- `MONGODB_PROD_URI` (or `MONGODB_DEV_URI` as fallback)
- `SENDGRID_API_KEY` (if email is enabled)
- `JWT_SECRET`
- Other required vars

Check if they're set:

```bash
aws elasticbeanstalk describe-configuration-settings \
  --environment-name autovista-api-prod \
  --application-name autovista-api-prod \
  --region us-east-1 | \
  jq '.ConfigurationSettings[0].OptionSettings[] | select(.Namespace == "aws:elasticbeanstalk:application:environment") | {OptionName, Value}'
```

### B. MongoDB Connection Failure

If MongoDB connection fails, the app will exit. Check logs for:
- "Failed to connect to MongoDB"
- "MongoServerError"
- Connection timeout errors

### C. Notification Manager Initialization

If `SENDGRID_API_KEY` is missing and email is enabled, the app will crash. The error would be:
- "SendGrid API key is required"

### D. Build Issues

Check if the build completed successfully:

```bash
aws elasticbeanstalk describe-events \
  --environment-name autovista-api-prod \
  --max-items 50 \
  --region us-east-1 | \
  grep -i "build\|compile\|error"
```

## 4. Check Process Status

If you have SSH access, check if the process is running:

```bash
# Get instance ID
INSTANCE_ID=$(aws elasticbeanstalk describe-environment-resources \
  --environment-name autovista-api-prod \
  --region us-east-1 \
  --query 'EnvironmentResources.Instances[0].Id' \
  --output text)

# SSH and check (if key pair configured)
ssh ec2-user@<instance-ip> "ps aux | grep node"
ssh ec2-user@<instance-ip> "netstat -tlnp | grep 8080"
```

## 5. Check Health Status

```bash
aws elasticbeanstalk describe-environments \
  --environment-names autovista-api-prod \
  --region us-east-1 \
  --query 'Environments[0].[Status,Health,HealthStatus]' \
  --output table
```

## Quick Diagnostic Script

```bash
#!/bin/bash
ENV_NAME="autovista-api-prod"
REGION="us-east-1"

echo "=== Environment Status ==="
aws elasticbeanstalk describe-environments \
  --environment-names $ENV_NAME \
  --region $REGION \
  --query 'Environments[0].[Status,Health,HealthStatus]' \
  --output table

echo -e "\n=== Recent Events ==="
aws elasticbeanstalk describe-events \
  --environment-name $ENV_NAME \
  --max-items 10 \
  --region $REGION \
  --output table

echo -e "\n=== Application Logs (Last 100 lines) ==="
aws elasticbeanstalk retrieve-environment-info \
  --environment-name $ENV_NAME \
  --info-type tail \
  --region $REGION | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d | \
  tail -100
```

Save as `check-app-status.sh`, make executable, and run:
```bash
chmod +x check-app-status.sh
./check-app-status.sh
```
