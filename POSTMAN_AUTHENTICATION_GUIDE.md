# Postman Authentication Guide

This guide explains how to authenticate and test API endpoints in Postman.

## Authentication Methods

The API supports **JWT-based authentication**. You'll need to get a JWT token first, then use it in subsequent API calls.

## Getting a JWT Token

### Method 1: Email 2FA Authentication (Recommended)

This is a two-step process:

#### Step 1: Request Verification Code

**Endpoint:** `POST /api/v1/auth/verify-email-2fa`

**Request:**

```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response:**

```json
{
  "email": "your-email@example.com",
  "codeExpires": "2024-01-08T23:30:00.000Z"
}
```

**Postman Setup:**

1. Method: `POST`
2. URL: `http://localhost:8080/api/v1/auth/verify-email-2fa` (or your production URL)
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "email": "your-email@example.com",
     "password": "your-password"
   }
   ```

**Note:** A verification code will be sent to your email. Check your inbox for the code.

#### Step 2: Login with Verification Code

**Endpoint:** `POST /api/v1/auth/login-email-2fa`

**Request:**

```json
{
  "email": "your-email@example.com",
  "code": "123456"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "user",
  "userId": "507f1f77bcf86cd799439011",
  "portalId": "507f1f77bcf86cd799439012"
}
```

**Postman Setup:**

1. Method: `POST`
2. URL: `http://localhost:8080/api/v1/auth/login-email-2fa`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "email": "your-email@example.com",
     "code": "123456"
   }
   ```

**Save the `token` from the response** - you'll need it for authenticated requests.

### Method 2: Social Login (Google OAuth)

**Endpoint:** `POST /api/v1/auth/login-social`

**Request:**

```json
{
  "clientId": "your-google-client-id",
  "token": "google-id-token"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "user",
  "userId": "507f1f77bcf86cd799439011",
  "portalId": "507f1f77bcf86cd799439012"
}
```

### Method 3: Basic Auth (Validation Only)

**Note:** This endpoint only validates credentials - it does NOT return a JWT token. It's mainly for credential validation.

**Endpoint:** `GET /api/v1/auth/public/auth`

**Postman Setup:**

1. Method: `GET`
2. URL: `http://localhost:8080/api/v1/auth/public/auth`
3. Go to **Authorization** tab
4. Type: **Basic Auth**
5. Username: Your email
6. Password: Your password

**Response:**

```json
{
  "message": "Authorization successful."
}
```

## Using JWT Token in Requests

Once you have a JWT token, use it in the `Authorization` header for all authenticated requests.

### Option 1: Bearer Token (Recommended)

**Postman Setup:**

1. Go to **Authorization** tab
2. Type: **Bearer Token**
3. Token: Paste your JWT token (the value from the login response)

This will automatically set the header as:

```
Authorization: Bearer <your-token>
```

### Option 2: Manual Header

Alternatively, you can manually set the header:

1. Go to **Headers** tab
2. Add header:
   - Key: `Authorization`
   - Value: `Bearer <your-token>`

Or use the alternative format:

- Key: `Authorization`
- Value: `jwt <your-token>`

Or just the token (some endpoints accept this):

- Key: `Authorization`
- Value: `<your-token>`

## Postman Environment Variables (Recommended)

To make testing easier, set up Postman environment variables:

1. Click the **eye icon** (👁) in the top right of Postman
2. Click **Add** to create a new environment
3. Add variables:
   - `base_url`: `http://localhost:8080` (or your production URL)
   - `auth_token`: (leave empty, will be set after login)
   - `user_email`: `your-email@example.com`
   - `user_password`: `your-password`

4. Use variables in your requests:
   - URL: `{{base_url}}/api/v1/auth/login-email-2fa`
   - Authorization token: `{{auth_token}}`

5. After login, save the token:
   - Add a **Tests** tab to your login request
   - Add this script:
   ```javascript
   if (pm.response.code === 200) {
     const jsonData = pm.response.json();
     if (jsonData.token) {
       pm.environment.set("auth_token", jsonData.token);
       console.log("Token saved to environment");
     }
   }
   ```

## Testing Authenticated Endpoints

### Example: Get Quotes

**Endpoint:** `GET /api/v1/quote`

**Postman Setup:**

1. Method: `GET`
2. URL: `{{base_url}}/api/v1/quote`
3. Authorization: Bearer Token → `{{auth_token}}`
4. Send request

### Example: Create Quote

**Endpoint:** `POST /api/v1/quote`

**Postman Setup:**

1. Method: `POST`
2. URL: `{{base_url}}/api/v1/quote`
3. Authorization: Bearer Token → `{{auth_token}}`
4. Headers: `Content-Type: application/json`
5. Body (raw JSON):
   ```json
   {
     "origin": {
       "street": "123 Main St",
       "city": "New York",
       "state": "NY",
       "zip": "10001"
     },
     "destination": {
       "street": "456 Oak Ave",
       "city": "Los Angeles",
       "state": "CA",
       "zip": "90001"
     },
     "vehicles": [
       {
         "year": 2020,
         "make": "Toyota",
         "model": "Camry",
         "isRunning": true,
         "isOperable": true
       }
     ]
   }
   ```

### Example: Get Current User

**Endpoint:** `GET /api/v1/user`

**Postman Setup:**

1. Method: `GET`
2. URL: `{{base_url}}/api/v1/user`
3. Authorization: Bearer Token → `{{auth_token}}`
4. Send request

## Token Expiration

JWT tokens expire after **24 hours**. If you get a `401 Unauthorized` response:

1. Check if your token has expired
2. Login again to get a new token
3. Update your Postman environment variable with the new token

## Quick Reference

### Authentication Endpoints

| Method | Endpoint                        | Description                           |
| ------ | ------------------------------- | ------------------------------------- |
| POST   | `/api/v1/auth/verify-email-2fa` | Request verification code (Step 1)    |
| POST   | `/api/v1/auth/login-email-2fa`  | Login with verification code (Step 2) |
| POST   | `/api/v1/auth/login-social`     | Social login (Google)                 |
| GET    | `/api/v1/auth/public/auth`      | Validate credentials (Basic Auth)     |

### Common Headers

```
Content-Type: application/json
Authorization: Bearer <your-jwt-token>
```

### Authorization Formats Supported

- `Bearer <token>` (recommended)
- `jwt <token>`
- `<token>` (bare token, some endpoints)

## Troubleshooting

### 401 Unauthorized

- **Token expired**: Login again to get a new token
- **Invalid token**: Check that you copied the entire token
- **Missing header**: Ensure `Authorization` header is set
- **Wrong format**: Use `Bearer <token>` format

### 400 Bad Request (Login)

- Check that email and password are correct
- Verify the verification code is correct (check email)
- Code may have expired (codes expire after a set time)

### Email Not Received (Verification Code)

- Check spam folder
- Verify email address is correct
- Check that SendGrid is configured (if in production)
- In development, check server logs for the code

## Special Cases

### Mesamoving Email Bypass

If your email contains "mesamoving", the 2FA verification code step is skipped:

- Step 1 (`verify-email-2fa`): Returns `skipVerification: true`
- Step 2 (`login-email-2fa`): Can be called without a code for mesamoving emails

### Test Environment

In test environment (`NODE_ENV=test`), the verification code is returned in the response:

```json
{
  "email": "your-email@example.com",
  "code": "123456",
  "codeExpires": "2024-01-08T23:30:00.000Z"
}
```

## Example Postman Collection Structure

```
📁 Autovista API
  📁 Authentication
    📄 Verify Email 2FA (Step 1)
    📄 Login Email 2FA (Step 2)
    📄 Social Login
    📄 Basic Auth Test
  📁 Quotes
    📄 Get Quotes
    📄 Create Quote
    📄 Get Quote by ID
    📄 Update Quote
    📄 Delete Quote
  📁 Orders
    📄 Get Orders
    📄 Create Order
    📄 Get Order by ID
    📄 Update Order
  📁 Users
    📄 Get Current User
    📄 Get Users
    📄 Get User by ID
```

## Environment Setup Summary

1. **Create Environment** with variables:
   - `base_url`
   - `auth_token`
   - `user_email`
   - `user_password`

2. **Login Flow**:
   - Request verification code
   - Check email for code
   - Login with code
   - Save token to environment variable

3. **Use Token**:
   - Set Authorization header to Bearer Token
   - Reference `{{auth_token}}` variable
   - Token auto-updates after login with Test script

## Security Notes

- **Never commit tokens** to version control
- **Use environment variables** to store sensitive data
- **Rotate tokens** regularly (they expire after 24 hours)
- **Use HTTPS** in production (never send tokens over HTTP)
- **Token is sensitive**: Treat it like a password
