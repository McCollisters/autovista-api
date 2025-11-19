# Environment Variables Guide

This guide explains how to update and manage environment variables for the Autovista API, including local development and AWS deployment.

## Table of Contents

- [Overview](#overview)
- [Local Development](#local-development)
- [AWS Deployment Methods](#aws-deployment-methods)
- [Complete Environment Variables List](#complete-environment-variables-list)
- [Quick Reference](#quick-reference)

---

## Overview

The Autovista API uses environment variables for configuration. These variables are loaded using `dotenv` in development and must be set in your deployment environment for production.

**Key Points:**

- Environment variables are loaded from `.env` file in development
- Production deployments require variables to be set in AWS
- Some variables are required, others are optional with defaults
- Never commit `.env` files to version control

---

## Local Development

### Setting Up Local Environment Variables

1. **Create a `.env` file** in the project root (if it doesn't exist):

   ```bash
   touch .env
   ```

2. **Add your environment variables** to the `.env` file:

   ```env
   # Database
   MONGODB_DEV_URI=mongodb://localhost:27017/autovista-api

   # Server
   PORT=8080
   NODE_ENV=development

   # Super Dispatch
   SD_USER=your_super_dispatch_client_id
   SD_PASS=your_super_dispatch_client_secret

   # SendGrid (Email)
   SENDGRID_API_KEY=your_sendgrid_api_key
   EMAIL_FROM_ADDRESS=noreply@example.com
   EMAIL_FROM_NAME=Autovista API

   # Twilio (SMS)
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_FROM_NUMBER=+1234567890

   # AWS
   AWS_REGION=us-east-1
   SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/your-account/queue-name

   # Base URL (for webhooks)
   BASE_URL=http://localhost:8080
   ```

3. **The `.env` file is automatically loaded** when you run:
   ```bash
   npm run dev
   ```

### Important Notes for Local Development

- The `.env` file is in `.gitignore` and should never be committed
- Use different values for development vs production
- Keep sensitive keys secure and never share them

---

## AWS Deployment Methods

There are several ways to set environment variables in AWS depending on your deployment method:

### Method 1: AWS Systems Manager Parameter Store (Recommended)

**Best for:** EC2 instances, ECS tasks, Lambda functions

**Steps:**

1. **Navigate to AWS Systems Manager:**
   - Go to AWS Console → Systems Manager → Parameter Store

2. **Create Parameters:**
   - Click "Create parameter"
   - For each environment variable:
     - **Name**: `/autovista-api/PRODUCTION/MONGODB_DEV_URI` (or `/autovista-api/STAGING/...`)
     - **Type**: `String` (or `SecureString` for sensitive values)
     - **Value**: Your actual value
     - Click "Create parameter"

3. **Use SecureString for sensitive values:**
   - Select `SecureString` type for passwords, API keys, secrets
   - These are encrypted using AWS KMS

4. **Access in your application:**

   ```typescript
   // Install AWS SDK
   npm install @aws-sdk/client-ssm

   // Load parameters at startup
   import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

   const ssm = new SSMClient({ region: "us-east-1" });
   const params = await ssm.send(new GetParametersCommand({
     Names: [
       "/autovista-api/PRODUCTION/MONGODB_DEV_URI",
       "/autovista-api/PRODUCTION/SD_USER",
       // ... other parameters
     ],
     WithDecryption: true
   }));
   ```

**Benefits:**

- Centralized configuration management
- Version history
- Encryption for sensitive values
- Easy to update without redeploying code

---

### Method 2: AWS Secrets Manager

**Best for:** Highly sensitive data (passwords, API keys, database credentials)

**Steps:**

1. **Navigate to AWS Secrets Manager:**
   - Go to AWS Console → Secrets Manager → Store a new secret

2. **Create Secret:**
   - Select "Other type of secret"
   - Choose "Plaintext" or "JSON"
   - For JSON (recommended):
     ```json
     {
       "MONGODB_DEV_URI": "mongodb+srv://...",
       "SD_USER": "your_client_id",
       "SD_PASS": "your_client_secret",
       "SENDGRID_API_KEY": "your_api_key"
     }
     ```
   - Click "Next"
   - **Secret name**: `autovista-api/production/secrets`
   - Click "Store"

3. **Access in your application:**

   ```typescript
   import {
     SecretsManagerClient,
     GetSecretValueCommand,
   } from "@aws-sdk/client-secrets-manager";

   const secretsClient = new SecretsManagerClient({ region: "us-east-1" });
   const secret = await secretsClient.send(
     new GetSecretValueCommand({
       SecretId: "autovista-api/production/secrets",
     }),
   );

   const secrets = JSON.parse(secret.SecretString);
   // Use secrets.MONGODB_DEV_URI, secrets.SD_USER, etc.
   ```

**Benefits:**

- Automatic rotation support
- Fine-grained access control
- Audit logging
- Best for highly sensitive data

---

### Method 3: EC2 Instance User Data / Launch Template

**Best for:** EC2 instances deployed via Auto Scaling Groups or Launch Templates

**Steps:**

1. **In EC2 Launch Template or User Data:**

   ```bash
   #!/bin/bash
   export MONGODB_DEV_URI="mongodb+srv://..."
   export SD_USER="your_client_id"
   export SD_PASS="your_client_secret"
   export SENDGRID_API_KEY="your_api_key"
   # ... other variables

   # Start your application
   cd /opt/autovista-api
   npm start
   ```

2. **Or use a systemd service file** (`/etc/systemd/system/autovista-api.service`):

   ```ini
   [Unit]
   Description=Autovista API
   After=network.target

   [Service]
   Type=simple
   User=ec2-user
   WorkingDirectory=/opt/autovista-api
   Environment="MONGODB_DEV_URI=mongodb+srv://..."
   Environment="SD_USER=your_client_id"
   Environment="SD_PASS=your_client_secret"
   Environment="SENDGRID_API_KEY=your_api_key"
   # ... other variables
   ExecStart=/usr/bin/npm start
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

**Note:** This method is less secure as values are visible in user data scripts.

---

### Method 4: Elastic Beanstalk Environment Properties

**Best for:** AWS Elastic Beanstalk deployments

**Steps:**

1. **Via AWS Console:**
   - Go to Elastic Beanstalk → Your Environment → Configuration
   - Click "Edit" on "Software"
   - Scroll to "Environment properties"
   - Add each variable:
     - **Name**: `MONGODB_DEV_URI`
     - **Value**: `mongodb+srv://...`
   - Click "Apply"

2. **Via EB CLI:**

   ```bash
   eb setenv MONGODB_DEV_URI="mongodb+srv://..." \
            SD_USER="your_client_id" \
            SD_PASS="your_client_secret" \
            SENDGRID_API_KEY="your_api_key"
   ```

3. **Via `.ebextensions` config file:**
   Create `.ebextensions/environment.config`:
   ```yaml
   option_settings:
     aws:elasticbeanstalk:application:environment:
       MONGODB_DEV_URI: "mongodb+srv://..."
       SD_USER: "your_client_id"
       SD_PASS: "your_client_secret"
       SENDGRID_API_KEY: "your_api_key"
   ```

---

### Method 5: ECS Task Definition

**Best for:** Containerized deployments on ECS

**Steps:**

1. **In ECS Task Definition:**
   - Go to ECS → Task Definitions → Your Task Definition
   - Click "Create new revision"
   - Scroll to "Environment variables"
   - Add each variable:
     - **Key**: `MONGODB_DEV_URI`
     - **Value**: `mongodb+srv://...`
   - Click "Create"

2. **Or use Secrets from Secrets Manager:**
   - In Task Definition, go to "Secrets"
   - Click "Add secret"
   - **Name**: `MONGODB_DEV_URI`
   - **Value from**: Select from Secrets Manager
   - Choose your secret ARN

**Benefits:**

- Secrets are encrypted
- Can reference Secrets Manager or Parameter Store
- Easy to update without rebuilding images

---

### Method 6: CodeDeploy / Deployment Scripts

**Best for:** Custom deployment pipelines

**Steps:**

1. **Create a deployment script** that sets environment variables:

   ```bash
   #!/bin/bash
   # deploy.sh

   # Load from Parameter Store or Secrets Manager
   export MONGODB_DEV_URI=$(aws ssm get-parameter --name "/autovista-api/PRODUCTION/MONGODB_DEV_URI" --with-decryption --query Parameter.Value --output text)
   export SD_USER=$(aws ssm get-parameter --name "/autovista-api/PRODUCTION/SD_USER" --with-decryption --query Parameter.Value --output text)
   # ... other variables

   # Start application
   pm2 restart autovista-api
   ```

2. **Or use a `.env` file on the server:**
   ```bash
   # On your EC2 instance, create /opt/autovista-api/.env
   # Load it in your application startup script
   ```

---

## Complete Environment Variables List

### Required Variables

These variables must be set or the application will fail to start:

| Variable          | Description               | Example                                              |
| ----------------- | ------------------------- | ---------------------------------------------------- |
| `MONGODB_DEV_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |

### Database Variables

| Variable           | Description                                          | Default | Required |
| ------------------ | ---------------------------------------------------- | ------- | -------- |
| `MONGODB_DEV_URI`  | MongoDB connection string for development/production | -       | ✅ Yes   |
| `MONGODB_TEST_URI` | MongoDB connection string for tests                  | -       | No       |

### Server Configuration

| Variable          | Description                                  | Default                 | Required |
| ----------------- | -------------------------------------------- | ----------------------- | -------- |
| `PORT`            | Server port                                  | `8080`                  | No       |
| `NODE_ENV`        | Environment (development/production/test)    | `development`           | No       |
| `BASE_URL`        | Base URL for webhooks and callbacks          | `http://localhost:3000` | No       |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000` | No       |

### Super Dispatch Integration

| Variable                | Description                        | Default                                           | Required                 |
| ----------------------- | ---------------------------------- | ------------------------------------------------- | ------------------------ |
| `SD_USER`               | Super Dispatch OAuth client ID     | -                                                 | Yes (for SD integration) |
| `SD_PASS`               | Super Dispatch OAuth client secret | -                                                 | Yes (for SD integration) |
| `SD_PRICING_API_KEY`    | Super Dispatch pricing API key     | -                                                 | No                       |
| `SUPERDISPATCH_API_URL` | Super Dispatch API URL             | `https://api.shipper.superdispatch.com/v1/public` | No                       |

### Email Configuration (SendGrid)

| Variable             | Description                                | Default    | Required        |
| -------------------- | ------------------------------------------ | ---------- | --------------- |
| `SENDGRID_API_KEY`   | SendGrid API key                           | -          | Yes (for email) |
| `EMAIL_FROM_ADDRESS` | Default from email address                 | -          | No              |
| `EMAIL_FROM_NAME`    | Default from name                          | -          | No              |
| `EMAIL_REPLY_TO`     | Default reply-to address                   | -          | No              |
| `EMAIL_ENABLED`      | Enable/disable email                       | `true`     | No              |
| `EMAIL_PROVIDER`     | Email provider (only "sendgrid" supported) | `sendgrid` | No              |

### SMS Configuration (Twilio)

| Variable             | Description                          | Default  | Required      |
| -------------------- | ------------------------------------ | -------- | ------------- |
| `TWILIO_ACCOUNT_SID` | Twilio account SID                   | -        | Yes (for SMS) |
| `TWILIO_AUTH_TOKEN`  | Twilio auth token                    | -        | Yes (for SMS) |
| `TWILIO_FROM_NUMBER` | Twilio phone number                  | -        | Yes (for SMS) |
| `SMS_ENABLED`        | Enable/disable SMS                   | `true`   | No            |
| `SMS_PROVIDER`       | SMS provider ("twilio" or "aws-sns") | `twilio` | No            |

### SMS Configuration (AWS SNS - Alternative)

| Variable                | Description                            | Default     | Required |
| ----------------------- | -------------------------------------- | ----------- | -------- |
| `SMS_PROVIDER`          | Set to `aws-sns` to use AWS SNS        | `twilio`    | No       |
| `AWS_REGION`            | AWS region for SNS                     | `us-east-1` | No       |
| `SMS_FROM_NUMBER`       | Default from phone number              | -           | No       |
| `AWS_ACCESS_KEY_ID`     | AWS access key (if not using IAM role) | -           | No       |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (if not using IAM role) | -           | No       |

### AWS Configuration

| Variable                | Description                     | Default           | Required               |
| ----------------------- | ------------------------------- | ----------------- | ---------------------- |
| `AWS_REGION`            | AWS region                      | `us-east-1`       | No                     |
| `AWS_ACCESS_KEY_ID`     | AWS access key ID               | -                 | No (if using IAM role) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key           | -                 | No (if using IAM role) |
| `SQS_QUEUE_URL`         | SQS queue URL for notifications | Default queue URL | No                     |

### Acertus Integration (Autonation Portal)

| Variable                             | Description                     | Default                    | Required |
| ------------------------------------ | ------------------------------- | -------------------------- | -------- |
| `ACERTUS_AUTONATION_PORTAL_ID`       | Autonation portal ID            | `62b89733d996a00046fe815e` | No       |
| `ACERTUS_API_URL`                    | Acertus API endpoint            | Staging URL                | No       |
| `ACERTUS_API_KEY`                    | Acertus API key                 | -                          | No       |
| `ACERTUS_BASE_URL`                   | Acertus base URL                | Staging URL                | No       |
| `ACERTUS_CONNECT_UID`                | Acertus connect UID             | -                          | No       |
| `ACERTUS_CARRIER_NAME`               | Default carrier name            | `ACERTUS`                  | No       |
| `ACERTUS_CARRIER_SCAC`               | Default carrier SCAC            | -                          | No       |
| `ACERTUS_CARRIER_IDENTIFIER`         | Default carrier identifier      | `default`                  | No       |
| `ACERTUS_VEHICLE_CONNECT_UID_PREFIX` | Vehicle connect UID prefix      | `autonation`               | No       |
| `ACERTUS_TIMEOUT_MS`                 | Request timeout in milliseconds | `15000`                    | No       |

### Location Services

| Variable         | Description                  | Default | Required |
| ---------------- | ---------------------------- | ------- | -------- |
| `MAPBOX_API_KEY` | Mapbox API key for geocoding | -       | No       |

### JWT / Authentication

| Variable     | Description                  | Default | Required       |
| ------------ | ---------------------------- | ------- | -------------- |
| `JWT_SECRET` | JWT secret for token signing | -       | Yes (for auth) |
| `SECRET_KEY` | General secret key           | -       | No             |

### Captivated SMS Integration

| Variable         | Description            | Default | Required |
| ---------------- | ---------------------- | ------- | -------- |
| `CAPTIVATED_KEY` | Captivated SMS API key | -       | No       |

---

## Quick Reference

### Minimum Required for Production

```env
# Database (Required)
MONGODB_DEV_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Super Dispatch (Required if using SD)
SD_USER=your_client_id
SD_PASS=your_client_secret

# Email (Required if sending emails)
SENDGRID_API_KEY=your_sendgrid_api_key

# Server
NODE_ENV=production
PORT=8080
BASE_URL=https://api.yourdomain.com
```

### Updating Environment Variables in AWS

**Option 1: AWS Systems Manager Parameter Store (Recommended)**

```bash
# Set a parameter
aws ssm put-parameter \
  --name "/autovista-api/PRODUCTION/MONGODB_DEV_URI" \
  --value "mongodb+srv://..." \
  --type "SecureString" \
  --overwrite

# Get a parameter
aws ssm get-parameter \
  --name "/autovista-api/PRODUCTION/MONGODB_DEV_URI" \
  --with-decryption \
  --query Parameter.Value \
  --output text
```

**Option 2: Elastic Beanstalk**

```bash
eb setenv MONGODB_DEV_URI="mongodb+srv://..." SD_USER="..." SD_PASS="..."
```

**Option 3: ECS Task Definition**

- Update task definition via console or CLI
- Update service to use new task definition revision

### Verifying Environment Variables

**On EC2 Instance:**

```bash
# SSH into your instance
ssh ec2-user@your-instance-ip

# Check environment variables
printenv | grep MONGODB
printenv | grep SD_
printenv | grep SENDGRID

# Or check your application logs
tail -f /var/log/autovista-api/app.log
```

**In Application:**

```typescript
// Add to src/index.ts temporarily for debugging
console.log("Environment check:", {
  hasMongo: !!process.env.MONGODB_DEV_URI,
  hasSD: !!process.env.SD_USER,
  hasSendGrid: !!process.env.SENDGRID_API_KEY,
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
});
```

### Common Issues

**Issue: Application fails to start with "Missing required environment variables"**

- **Solution**: Ensure `MONGODB_DEV_URI` is set
- Check your deployment method is correctly loading variables
- Verify variable names match exactly (case-sensitive)

**Issue: Super Dispatch integration not working**

- **Solution**: Verify `SD_USER` and `SD_PASS` are set correctly
- Check they're not expired or revoked
- Ensure they have correct permissions

**Issue: Emails not sending**

- **Solution**: Verify `SENDGRID_API_KEY` is set and valid
- Check SendGrid account status
- Verify `EMAIL_ENABLED=true` (or not set, defaults to true)

**Issue: Variables not loading in production**

- **Solution**:
  - Check your deployment method (Parameter Store, Secrets Manager, etc.)
  - Verify IAM permissions for accessing Parameter Store/Secrets Manager
  - Check application startup logs for errors
  - Ensure variables are set before application starts

---

## Best Practices

1. **Use Parameter Store or Secrets Manager** for production (not hardcoded values)
2. **Use SecureString** for sensitive values (passwords, API keys)
3. **Separate environments** (use different parameter paths: `/autovista-api/PRODUCTION/...` vs `/autovista-api/STAGING/...`)
4. **Never commit secrets** to version control
5. **Rotate secrets regularly** (especially API keys and passwords)
6. **Use IAM roles** instead of access keys when possible (for EC2, ECS, Lambda)
7. **Document all variables** in this file when adding new ones
8. **Test changes** in staging before production

---

## Security Notes

- **Never log environment variables** in application logs
- **Use least privilege** IAM policies for accessing Parameter Store/Secrets Manager
- **Enable encryption** for sensitive parameters
- **Audit access** to secrets regularly
- **Rotate credentials** when team members leave or credentials are compromised

---

## Need Help?

If you're unsure which method to use:

- **EC2 instances**: Use Parameter Store or systemd service file
- **Elastic Beanstalk**: Use EB environment properties
- **ECS**: Use task definition environment variables or secrets
- **Lambda**: Use environment variables or Parameter Store

For questions or issues, check:

- AWS CloudWatch logs for application errors
- Application startup logs for missing variable warnings
- AWS Systems Manager Parameter Store for parameter values
- IAM policies for access permissions
