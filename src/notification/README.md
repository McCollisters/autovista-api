/\*\*

- Notification System Documentation
-
- This directory contains the infrastructure for sending email and SMS notifications.
-
- Default Providers:
- - Email: SendGrid (default)
- - SMS: Twilio (default)
    \*/

/\*\*

- Usage Examples
-
- 1.  Basic Email Sending:
- ```typescript

  ```

- import { getNotificationManager } from "@/notification";
-
- const notificationManager = getNotificationManager();
-
- await notificationManager.sendEmail({
- to: "customer@example.com",
- subject: "Order Confirmation",
- html: "<h1>Your order has been confirmed</h1>",
- text: "Your order has been confirmed"
- });
- ```

  ```

-
- 2.  Basic SMS Sending:
- ```typescript

  ```

- await notificationManager.sendSMS({
- to: "+1234567890",
- message: "Your order has been confirmed!"
- });
- ```

  ```

-
- 3.  Combined Email and SMS:
- ```typescript

  ```

- await notificationManager.send({
- email: {
-     to: "customer@example.com",
-     subject: "Order Update",
-     html: "<p>Your order status has been updated</p>"
- },
- sms: {
-     to: "+1234567890",
-     message: "Your order status has been updated"
- },
- metadata: {
-     type: "email",
-     channel: "customerConfirmation",
-     orderId: "order123"
- }
- });
- ```

  ```

-
- 4.  Order-Specific Notifications:
- ```typescript

  ```

- import { sendOrderCustomerEmail } from "@/notification/orderNotifications";
-
- await sendOrderCustomerEmail(
- orderId,
- "customerConfirmation",
- "Order Confirmation",
- "<h1>Your order has been confirmed</h1>",
- "Your order has been confirmed"
- );
- ```

  ```

-
- Required Packages:
-
- For SendGrid:
- - @sendgrid/mail
-
- For Twilio:
- - twilio
-
- Install with:
- ```bash

  ```

- npm install @sendgrid/mail twilio
- ```

  ```

-
- Environment Variables:
-
- SendGrid Email Configuration (DEFAULT):
- - SENDGRID_API_KEY: SendGrid API key (REQUIRED)
- - EMAIL_FROM_ADDRESS: Default from address
- - EMAIL_FROM_NAME: Default from name
- - EMAIL_REPLY_TO: Default reply-to address
- - EMAIL_ENABLED: "true" | "false" (default: "true")
- - EMAIL_PROVIDER: "sendgrid" (default: "sendgrid", only SendGrid is supported)
-
- Twilio SMS Configuration (DEFAULT):
- - TWILIO_ACCOUNT_SID: Twilio account SID (REQUIRED)
- - TWILIO_AUTH_TOKEN: Twilio auth token (REQUIRED)
- - TWILIO_FROM_NUMBER: Twilio phone number (REQUIRED)
- - SMS_ENABLED: "true" | "false" (default: "true")
- - SMS_PROVIDER: "twilio" | "aws-sns" (default: "twilio")
-
- Alternative Providers:
-
- AWS SNS SMS (if SMS_PROVIDER=aws-sns):
- - AWS_REGION: AWS region (default: "us-east-1")
- - SMS_FROM_NUMBER: Default from phone number
- - AWS_ACCESS_KEY_ID: AWS access key (if not using IAM role)
- - AWS_SECRET_ACCESS_KEY: AWS secret key (if not using IAM role)
    \*/
