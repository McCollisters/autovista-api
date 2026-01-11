# Autovista API - Complete Endpoint Reference

This document provides a comprehensive list of all available API endpoints in the Autovista API.

**Base URL:** `/api/v1` (unless otherwise specified)

---

## Health Check

| Method | Endpoint           | Description                                | Auth Required |
| ------ | ------------------ | ------------------------------------------ | ------------- |
| `GET`  | `/health`          | Basic health check                         | No            |
| `GET`  | `/health/detailed` | Detailed health check with database status | No            |

---

## Authentication (`/api/v1/auth`)

| Method | Endpoint                        | Description                                  | Auth Required   |
| ------ | ------------------------------- | -------------------------------------------- | --------------- |
| `GET`  | `/api/v1/auth/public/auth`      | Authenticate API user using Basic Auth       | No (Basic Auth) |
| `POST` | `/api/v1/auth/verify-email-2fa` | Request verification code (step 1 of 2FA)    | No              |
| `POST` | `/api/v1/auth/login-email-2fa`  | Login with verification code (step 2 of 2FA) | No              |
| `POST` | `/api/v1/auth/login-social`     | Social login using Google OAuth2             | No              |
| `POST` | `/api/v1/auth/forgotpassword`   | Request password reset email                 | No              |
| `POST` | `/api/v1/auth/resetpassword`    | Reset user password with token               | No (JWT token)  |

---

## Users (`/api/v1/user`)

| Method   | Endpoint                              | Description                 | Auth Required |
| -------- | ------------------------------------- | --------------------------- | ------------- |
| `GET`    | `/api/v1/user`                        | Get current authorized user | Yes           |
| `GET`    | `/api/v1/users`                       | List all users              | Yes           |
| `GET`    | `/api/v1/user/users/portal/:portalId` | Get users by portal         | Yes           |
| `POST`   | `/api/v1/user/admin/user`             | Create user (admin only)    | Yes (Admin)   |
| `POST`   | `/api/v1/user`                        | Create user                 | Yes           |
| `GET`    | `/api/v1/user/:userId`                | Get user by ID              | Yes           |
| `PATCH`  | `/api/v1/user/:userId`                | Update user                 | Yes           |
| `DELETE` | `/api/v1/user/:userId`                | Delete user                 | Yes           |

---

## Portals (`/api/v1/portal`)

| Method   | Endpoint                  | Description      | Auth Required |
| -------- | ------------------------- | ---------------- | ------------- |
| `GET`    | `/api/v1/portals`         | List all portals | Yes           |
| `POST`   | `/api/v1/portal`          | Create portal    | Yes           |
| `GET`    | `/api/v1/portal/:quoteId` | Get portal by ID | Yes           |
| `PATCH`  | `/api/v1/portal/:quoteId` | Update portal    | Yes           |
| `DELETE` | `/api/v1/portal/:quoteId` | Delete portal    | Yes           |

---

## Quotes (`/api/v1/quote`)

| Method   | Endpoint                      | Description               | Auth Required |
| -------- | ----------------------------- | ------------------------- | ------------- |
| `GET`    | `/api/v1/quotes`              | List all quotes           | Yes           |
| `POST`   | `/api/v1/quote`               | Create new quote          | Yes           |
| `GET`    | `/api/v1/quote/:quoteId`      | Get quote by ID           | Yes           |
| `PATCH`  | `/api/v1/quote/:quoteId`      | Update quote              | Yes           |
| `DELETE` | `/api/v1/quote/:quoteId`      | Delete quote              | Yes           |
| `POST`   | `/api/v1/quote/transport`     | Update transport options  | Yes           |
| `POST`   | `/api/v1/quote/customer/find` | Find customer             | Yes           |
| `POST`   | `/api/v1/quote/customer`      | Create customer for quote | Yes           |
| `PUT`    | `/api/v1/quote`               | Update quote alternative  | Yes           |

---

## Orders (`/api/v1/order`)

| Method   | Endpoint                              | Description                 | Auth Required |
| -------- | ------------------------------------- | --------------------------- | ------------- |
| `GET`    | `/api/v1/orders`                      | List all orders             | Yes           |
| `POST`   | `/api/v1/order`                       | Create new order            | Yes           |
| `GET`    | `/api/v1/order/:orderId`              | Get order by ID             | Yes           |
| `PATCH`  | `/api/v1/order/:orderId`              | Update order                | Yes           |
| `DELETE` | `/api/v1/order/:orderId`              | Delete order                | Yes           |
| `GET`    | `/api/v1/order/:orderId/activities`   | Get order activities        | Yes           |
| `POST`   | `/api/v1/order/:orderId/track`        | Request order tracking      | Yes           |
| `POST`   | `/api/v1/order/:orderId/status`       | Get order status            | Yes           |
| `POST`   | `/api/v1/order/:orderId/location`     | Request driver location     | Yes           |
| `PUT`    | `/api/v1/order/:orderId/files`        | Upload order files          | Yes           |
| `PUT`    | `/api/v1/order/mcadmin/:orderId/file` | Remove order file (admin)   | Yes (Admin)   |
| `POST`   | `/api/v1/order/export`                | Export orders to CSV        | Yes           |
| `GET`    | `/api/v1/order/analytics`             | Get order analytics         | Yes           |
| `POST`   | `/api/v1/order/reports/commission`    | Generate commission reports | Yes           |
| `POST`   | `/api/v1/order/terms`                 | Accept order terms          | Yes           |
| `POST`   | `/api/v1/order/customer`              | Create customer for order   | Yes           |

---

## Notifications (`/api/v1/notifications`)

| Method | Endpoint                     | Description                         | Auth Required |
| ------ | ---------------------------- | ----------------------------------- | ------------- |
| `POST` | `/api/v1/notifications/send` | Manually trigger email notification | Yes           |

---

## Integration (`/api/v1/integration`)

| Method | Endpoint                                  | Description                               | Auth Required |
| ------ | ----------------------------------------- | ----------------------------------------- | ------------- |
| `POST` | `/api/v1/integration/sign_s3`             | Sign S3 upload URL                        | Yes           |
| `GET`  | `/api/v1/integration/get_file/:fileKey`   | Get file from S3                          | Yes           |
| `POST` | `/api/v1/integration/captivated/callback` | Captivated SMS location tracking callback | No            |

### Legacy Integration Routes (for backward compatibility)

| Method | Endpoint               | Description                  | Auth Required |
| ------ | ---------------------- | ---------------------------- | ------------- |
| `POST` | `/sign_s3`             | Sign S3 upload URL (legacy)  | Yes           |
| `GET`  | `/get_file/:fileKey`   | Get file from S3 (legacy)    | Yes           |
| `POST` | `/captivated/callback` | Captivated callback (legacy) | No            |

---

## Settings (`/api/v1/settings`)

| Method | Endpoint                    | Description           | Auth Required |
| ------ | --------------------------- | --------------------- | ------------- |
| `GET`  | `/api/v1/settings`          | Get settings          | Yes           |
| `PUT`  | `/api/v1/settings`          | Update settings       | Yes           |
| `GET`  | `/api/v1/settings/customer` | Get customer settings | Yes           |

---

## Surveys (`/api/v1/surveys`)

| Method | Endpoint                           | Description               | Auth Required |
| ------ | ---------------------------------- | ------------------------- | ------------- |
| `POST` | `/api/v1/surveys`                  | Create survey (public)    | No            |
| `GET`  | `/api/v1/surveys`                  | List all surveys          | Yes           |
| `GET`  | `/api/v1/surveys/:portalId`        | Get surveys by portal     | Yes           |
| `GET`  | `/api/v1/surveys/portal/:portalId` | Get survey portal results | Yes           |
| `GET`  | `/api/v1/surveys/export/:portalId` | Export surveys            | Yes           |

---

## Email Templates (`/api/v1/emails`)

| Method | Endpoint                     | Description              | Auth Required |
| ------ | ---------------------------- | ------------------------ | ------------- |
| `GET`  | `/api/v1/emails`             | List all email templates | Yes           |
| `GET`  | `/api/v1/emails/:templateId` | Get email template by ID | Yes           |
| `PUT`  | `/api/v1/emails/:templateId` | Update email template    | Yes           |

---

## Brands (`/api/v1/brand`)

| Method | Endpoint         | Description          | Auth Required |
| ------ | ---------------- | -------------------- | ------------- |
| `GET`  | `/api/v1/brands` | Get all makes/brands | Yes           |
| `POST` | `/api/v1/brand`  | Create brand         | Yes           |

---

## Modifier Sets (`/api/v1/modifierSet`)

| Method   | Endpoint                      | Description            | Auth Required |
| -------- | ----------------------------- | ---------------------- | ------------- |
| `GET`    | `/api/v1/modifierSets`        | List all modifier sets | Yes           |
| `POST`   | `/api/v1/modifierSet`         | Create modifier set    | Yes           |
| `GET`    | `/api/v1/modifierSet/:ruleId` | Get modifier set by ID | Yes           |
| `PUT`    | `/api/v1/modifierSet/:ruleId` | Update modifier set    | Yes           |
| `DELETE` | `/api/v1/modifierSet/:ruleId` | Delete modifier set    | Yes           |

---

## Webhooks (`/api/v1/webhooks`)

| Method | Endpoint                         | Description             | Auth Required |
| ------ | -------------------------------- | ----------------------- | ------------- |
| `POST` | `/api/v1/webhooks`               | Generic webhook handler | No            |
| `POST` | `/api/v1/webhooks/superdispatch` | Super Dispatch webhook  | No            |
| `POST` | `/api/v1/webhooks/carrier`       | Carrier webhook         | No            |
| `GET`  | `/api/v1/webhooks/status`        | Webhook status          | No            |

---

## Callbacks (`/callback`)

Super Dispatch callback routes (for backward compatibility):

| Method | Endpoint                     | Description                 | Auth Required |
| ------ | ---------------------------- | --------------------------- | ------------- |
| `POST` | `/callback/order-cancel`     | Order cancellation callback | No            |
| `POST` | `/callback/order-picked-up`  | Order picked up callback    | No            |
| `POST` | `/callback/order-delivered`  | Order delivered callback    | No            |
| `POST` | `/callback/order-invoiced`   | Order invoiced callback     | No            |
| `POST` | `/callback/order-removed`    | Order removed callback      | No            |
| `POST` | `/callback/order-modified`   | Order modified callback     | No            |
| `POST` | `/callback/vehicle-modified` | Vehicle modified callback   | No            |
| `POST` | `/callback/accepted-carrier` | Accepted carrier callback   | No            |
| `POST` | `/callback/carrier-accepted` | Carrier accepted callback   | No            |
| `POST` | `/callback/carrier-canceled` | Carrier canceled callback   | No            |
| `POST` | `/callback/offer-sent`       | Offer sent callback         | No            |
| `POST` | `/callback/vehicle-haul`     | Vehicle haul callback       | No            |

---

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

or

```
Authorization: jwt <token>
```

### Public Endpoints (No Auth Required)

- `/health`
- `/health/detailed`
- `/api/v1/auth/public/auth` (uses Basic Auth)
- `/api/v1/auth/verify-email-2fa`
- `/api/v1/auth/login-email-2fa`
- `/api/v1/auth/login-social`
- `/api/v1/auth/forgotpassword`
- `/api/v1/auth/resetpassword` (uses JWT token in Authorization header)
- `/api/v1/surveys` (POST only - for survey submission)
- `/api/v1/integration/captivated/callback`
- `/captivated/callback` (legacy)
- `/api/v1/webhooks/*` (all webhook endpoints)
- `/callback/*` (all callback endpoints)

---

## Notes

1. **Route Ordering**: Some routes are defined with specific paths before parameterized routes (e.g., `/quote/transport` before `/quote/:quoteId`) to ensure correct matching.

2. **Legacy Routes**: Some routes exist at both `/api/v1/integration/*` and root level (e.g., `/sign_s3`) for backward compatibility.

3. **Admin Routes**: Some routes require admin privileges (indicated in the table).

4. **Portal ID Parameter**: Note that the portal routes use `:quoteId` as the parameter name, but this is likely a typo and should be `:portalId`.

5. **File Uploads**: File operations use S3 for storage. Use `/api/v1/integration/sign_s3` to get a signed URL for uploads.

---

## Response Formats

All endpoints return JSON responses. Error responses follow this format:

```json
{
  "error": "Error message",
  "statusCode": 400
}
```

Success responses vary by endpoint but typically return the requested resource data.

---

## Version

This API is version 1 (`/api/v1`). All endpoints are prefixed with this version unless otherwise noted.
