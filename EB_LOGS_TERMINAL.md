# Accessing Elastic Beanstalk Logs from Terminal

This guide shows how to access and view your Elastic Beanstalk application logs directly from the terminal using AWS CLI.

## Prerequisites

1. **AWS CLI installed:**
   ```bash
   aws --version
   ```
   If not installed: `brew install awscli` (macOS) or follow [AWS CLI installation guide](https://aws.amazon.com/cli/)

2. **AWS credentials configured:**
   ```bash
   aws configure
   ```
   Or set environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=your_key
   export AWS_SECRET_ACCESS_KEY=your_secret
   export AWS_DEFAULT_REGION=us-east-1
   ```

## Quick Commands

### 1. Get Recent Application Logs (Last 100 Lines)

```bash
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1
```

### 2. Get Full Log Bundle (All Log Files)

```bash
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type bundle \
  --region us-east-1
```

This downloads a zip file with all logs. The command returns a URL to download the bundle.

### 3. Stream Application Logs (Real-time)

```bash
# Get the log stream URL first
aws elasticbeanstalk describe-environments \
  --environment-names autovista-api-prod \
  --region us-east-1 \
  --query 'Environments[0].CNAME'

# Then tail the logs (if you have SSH access)
# Or use CloudWatch Logs (see below)
```

### 4. View Recent Events

```bash
aws elasticbeanstalk describe-events \
  --environment-name autovista-api-prod \
  --max-items 20 \
  --region us-east-1
```

### 5. Get Specific Log File

```bash
# List available log files
aws elasticbeanstalk request-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1

# Wait a moment, then retrieve
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1
```

## Using CloudWatch Logs (If Enabled)

**Note:** CloudWatch Logs must be enabled first. If you get "log group does not exist", use Method 1 above or enable CloudWatch Logs (see below).

If your EB environment has CloudWatch Logs enabled, you can stream logs directly:

### 1. Install CloudWatch Logs CLI Plugin

```bash
# macOS
brew install awslogs

# Or use AWS CLI with CloudWatch Logs
```

### 2. Stream Logs in Real-time

```bash
# Get log group name (usually: /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log)
aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --follow \
  --region us-east-1
```

### 3. View Recent Logs

```bash
aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --since 1h \
  --region us-east-1
```

### 4. Filter Logs

```bash
# Filter for errors
aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --filter-pattern "error" \
  --since 1h \
  --region us-east-1

# Filter for specific text
aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --filter-pattern "verification" \
  --since 1h \
  --region us-east-1
```

## Common Log Files

Your application logs are typically in:

- `/var/log/web.stdout.log` - Application stdout (your Node.js logs)
- `/var/log/web.stderr.log` - Application stderr (errors)
- `/var/log/eb-engine.log` - Elastic Beanstalk engine logs
- `/var/log/eb-hooks.log` - Deployment hooks logs

## Quick Reference Scripts

### View Application Logs (Last 100 Lines)

```bash
#!/bin/bash
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1 | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d
```

### Watch Logs (Real-time with CloudWatch)

```bash
#!/bin/bash
aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --follow \
  --region us-east-1 \
  --format short
```

### Search Logs for Errors

```bash
#!/bin/bash
aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --since 1h \
  --region us-east-1 \
  --filter-pattern "error" \
  --format short
```

## Enable CloudWatch Logs (Required First)

**If you get "log group does not exist" error, CloudWatch Logs aren't enabled yet.** Enable them first:

1. **Via AWS Console:**
   - EB Console → Your Environment → Configuration → Logs
   - Enable "Log streaming" or "CloudWatch Logs"
   - Select log retention period

2. **Via EB CLI:**
   ```bash
   eb logs --cloudwatch-logs enable
   ```

3. **Via AWS CLI:**
   ```bash
   aws elasticbeanstalk update-environment \
     --environment-name autovista-api-prod \
     --option-settings \
       Namespace=aws:elasticbeanstalk:cloudwatch:logs,OptionName=StreamLogs,Value=true \
       Namespace=aws:elasticbeanstalk:cloudwatch:logs,OptionName=DeleteOnTerminate,Value=false \
       Namespace=aws:elasticbeanstalk:cloudwatch:logs,OptionName=RetentionInDays,Value=7 \
     --region us-east-1
   ```

## Using EB CLI (Alternative)

If you have EB CLI installed:

```bash
# Install EB CLI
pip install awsebcli

# Initialize (if not already)
eb init

# View logs
eb logs autovista-api-prod

# Stream logs
eb logs autovista-api-prod --stream

# Download logs
eb logs autovista-api-prod --all
```

## Direct SSH Access (If Enabled)

If SSH is enabled on your EB instances:

```bash
# Get instance ID
aws elasticbeanstalk describe-environment-resources \
  --environment-name autovista-api-prod \
  --region us-east-1 \
  --query 'EnvironmentResources.Instances[0].Id'

# SSH into instance (if key pair configured)
ssh ec2-user@<instance-ip>

# Then view logs directly
tail -f /var/log/web.stdout.log
tail -f /var/log/web.stderr.log
```

## Useful One-Liners

### Get Last 50 Lines of Application Logs

```bash
aws elasticbeanstalk retrieve-environment-info \
  --environment-name autovista-api-prod \
  --info-type tail \
  --region us-east-1 | \
  jq -r '.EnvironmentInfo[0].Message' | \
  base64 -d | \
  tail -50
```

### Search for Specific Error

```bash
aws logs filter-log-events \
  --log-group-name /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --filter-pattern "verification" \
  --start-time $(($(date +%s) - 3600))000 \
  --region us-east-1 | \
  jq -r '.events[].message'
```

### Get Logs from Last Hour

```bash
aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --since 1h \
  --region us-east-1 \
  --format short
```

### Export Logs to File

```bash
aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log \
  --since 24h \
  --region us-east-1 > app-logs-$(date +%Y%m%d).log
```

## Troubleshooting

### "Log group not found"

CloudWatch Logs might not be enabled. Enable it using the steps above.

### "Access Denied"

Check your AWS credentials and IAM permissions:
```bash
aws sts get-caller-identity
```

Required permissions:
- `elasticbeanstalk:RetrieveEnvironmentInfo`
- `logs:DescribeLogGroups`
- `logs:DescribeLogStreams`
- `logs:GetLogEvents`
- `logs:FilterLogEvents`
- `logs:TailLog`

### "Environment not found"

Verify the environment name:
```bash
aws elasticbeanstalk describe-environments \
  --region us-east-1 \
  --query 'Environments[*].[ApplicationName,EnvironmentName,Status]' \
  --output table
```

## Quick Setup Alias

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Elastic Beanstalk log shortcuts
alias eblogs='aws elasticbeanstalk retrieve-environment-info --environment-name autovista-api-prod --info-type tail --region us-east-1'
alias ebevents='aws elasticbeanstalk describe-events --environment-name autovista-api-prod --max-items 20 --region us-east-1'
alias ebtail='aws logs tail /aws/elasticbeanstalk/autovista-api-prod/var/log/web.stdout.log --follow --region us-east-1'
```

Then use:
```bash
eblogs      # Get recent logs
ebevents    # Get recent events
ebtail      # Stream logs in real-time
```
