# Admin Management System Documentation

## Overview

The Admin Management System provides secure authentication and CRUD operations for administrator accounts. It includes JWT-based authentication, password strength validation, email validation, and automatic default admin creation.

## Features

- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **Admin CRUD Operations**: Create, read, update, and delete admin accounts
- **Input Validation**: Email format and password strength validation
- **Duplicate Prevention**: Prevents creation of admins with duplicate emails
- **Default Admin Setup**: Automatically creates default admin from environment variables
- **Self-Protection**: Prevents admins from deleting their own accounts

## API Endpoints

### Authentication Routes (Unprotected)

#### POST /api/v1/auth/login
Login with admin credentials.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "admin": {
    "id": "uuid",
    "email": "admin@example.com",
    "name": "Admin Name"
  }
}
```

### Admin Management Routes (Protected)

All admin management routes require authentication via `Authorization: Bearer <token>` header.

#### GET /api/v1/auth/admins
Get all admin users.

**Response:**
```json
{
  "success": true,
  "admins": [
    {
      "id": "uuid",
      "email": "admin@example.com",
      "name": "Admin Name",
      "created_at": "2024-01-01T00:00:00Z",
      "last_login": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/v1/auth/admins
Create a new admin user.

**Request Body:**
```json
{
  "email": "newadmin@example.com",
  "password": "SecurePassword123!",
  "name": "New Admin"
}
```

**Response:**
```json
{
  "success": true,
  "admin": {
    "id": "uuid",
    "email": "newadmin@example.com",
    "name": "New Admin",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "Admin created successfully"
}
```

#### PUT /api/v1/auth/admins/:id
Update an existing admin user.

**Request Body:**
```json
{
  "email": "updated@example.com",
  "name": "Updated Name",
  "password": "NewPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "admin": {
    "id": "uuid",
    "email": "updated@example.com",
    "name": "Updated Name",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "message": "Admin updated successfully"
}
```

#### DELETE /api/v1/auth/admins/:id
Delete an admin user.

**Response:**
```json
{
  "success": true,
  "message": "Admin deleted successfully"
}
```

#### POST /api/v1/auth/logout
Logout (client-side token invalidation).

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Validation Rules

### Email Validation
- Must be a valid email format (contains @ and domain)
- Case-insensitive (automatically converted to lowercase)
- Must be unique across all admin accounts

### Password Validation
- Minimum 8 characters
- Must contain at least one uppercase letter
- Must contain at least one lowercase letter
- Must contain at least one number
- Must contain at least one special character (@$!%*?&)

## Environment Variables

Add these variables to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Default Admin Configuration
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=SecureAdmin123!@#
ADMIN_NAME=System Administrator
```

## Startup Service

The `StartupService` automatically:
1. Checks if any admin users exist on server startup
2. Creates a default admin from environment variables if none exist
3. Validates environment variables and uses secure defaults if needed
4. Logs warnings for security issues

## Error Codes

| Code | Description |
|------|-------------|
| `NO_TOKEN` | No authentication token provided |
| `INVALID_TOKEN_FORMAT` | Token format is invalid |
| `TOKEN_EXPIRED` | JWT token has expired |
| `INVALID_TOKEN` | JWT token is invalid |
| `ADMIN_NOT_FOUND` | Admin user not found |
| `MISSING_CREDENTIALS` | Email or password missing |
| `INVALID_EMAIL` | Email format is invalid |
| `WEAK_PASSWORD` | Password doesn't meet strength requirements |
| `EMAIL_ALREADY_EXISTS` | Email is already taken |
| `CANNOT_DELETE_SELF` | Cannot delete own admin account |
| `INVALID_CREDENTIALS` | Login credentials are incorrect |

## Security Features

1. **Password Hashing**: Uses bcrypt with configurable salt rounds
2. **JWT Security**: Tokens include expiration and are validated on each request
3. **Input Validation**: All inputs are validated before processing
4. **Error Handling**: Secure error messages that don't expose sensitive information
5. **Self-Protection**: Prevents admins from deleting their own accounts
6. **Environment Security**: Warns about weak or default credentials

## Testing

Run the admin management test suite:

```bash
node test-admin-management.js
```

This will test:
- Login functionality
- Admin creation, reading, updating, and deletion
- Input validation
- Error handling
- Authentication flow

## Usage Example

```javascript
// Login
const loginResponse = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'SecurePassword123!'
  })
});

const { token } = await loginResponse.json();

// Create new admin
const createResponse = await fetch('/api/v1/auth/admins', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    email: 'newadmin@example.com',
    password: 'NewPassword123!',
    name: 'New Administrator'
  })
});
```