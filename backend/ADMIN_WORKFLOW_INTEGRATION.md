# Admin Workflow Integration with Purchase System

## Overview

This document describes the integration between the existing admin review workflow and the new purchase system for article backlink placements.

## Changes Made

### 1. Modified `approveBacklink` Function

**Location**: `backend/services/articles/dbCrud.js`

**Changes**:
- Added `orders` relation to the include clause when updating article versions
- Added logic to update associated order status to `COMPLETED` when backlinks are approved
- Added error handling to ensure approval process continues even if notification fails

**Behavior**:
- When an admin approves a backlink, any associated purchase orders are marked as `COMPLETED`
- Customers will be notified when the article is actually published (in `approveAndPublish`)

### 2. Modified `rejectBacklink` Function

**Location**: `backend/services/articles/dbCrud.js`

**Changes**:
- Added `orders` relation to the include clause when updating article versions
- Added integration with `StripeService` to process refunds for rejected orders
- Added integration with `EmailService` to send refund notifications to customers
- Added logic to update article availability status back to `AVAILABLE`
- Added comprehensive error handling to continue with rejection even if refund processing fails

**Behavior**:
- When an admin rejects a backlink, the system automatically:
  - Processes a full refund through Stripe
  - Sends a refund notification email to the customer
  - Updates the article availability status back to `AVAILABLE`
  - Logs all actions for monitoring

### 3. Modified `approveAndPublish` Function

**Location**: `backend/services/articles/dbCrud.js`

**Changes**:
- Added `orders` relation to the include clause when updating article versions
- Added order completion logic with `completed_at` timestamp
- Added integration with `EmailService` to send completion notifications
- Added logic to update article availability status to `AVAILABLE` after publishing
- Added comprehensive error handling to ensure publishing continues even if notifications fail

**Behavior**:
- When an admin approves and publishes an article, the system:
  - Marks all associated orders as `COMPLETED` with completion timestamp
  - Sends completion notification emails to customers with article details
  - Updates article availability status to `AVAILABLE` for new purchases
  - Provides article URL and backlink details in the notification

## Integration Points

### EmailService Integration

The admin workflow now uses the `EmailService` for:
- **Completion Notifications**: Sent when articles are published after approval
- **Refund Notifications**: Sent when backlinks are rejected and refunds are processed

### StripeService Integration

The admin workflow now uses the `StripeService` for:
- **Refund Processing**: Automatic refunds when backlinks are rejected
- **Payment Tracking**: Links orders to payment data for refund processing

### Database Updates

The workflow now updates:
- **Order Status**: Changes from `ADMIN_REVIEW` to `COMPLETED` or `REFUNDED`
- **Order Completion**: Sets `completed_at` timestamp for completed orders
- **Article Availability**: Updates `availability_status` based on admin actions

## Error Handling

All integrations include comprehensive error handling:
- **Non-blocking**: Admin actions continue even if notifications or refunds fail
- **Logging**: All errors are logged for monitoring and debugging
- **Graceful Degradation**: Core admin functionality remains intact if external services fail

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **1.11**: "WHEN all quality checks pass THEN the system SHALL queue the article for admin review before final publication"
- **1.12**: "WHEN an admin approves the article THEN the system SHALL publish the article with the backlink and send a completion notification with article details to the customer"
- **1.13**: "WHEN an article is published after admin review THEN the system SHALL make it available for purchase again on the homepage"

## Testing

The integration has been tested for:
- ✅ Function availability and syntax correctness
- ✅ Service import compatibility
- ✅ Database schema compatibility
- ✅ Error handling and graceful degradation

## Usage

The existing admin endpoints continue to work as before:
- `POST /api/v1/articles/approveBacklink/:versionId`
- `POST /api/v1/articles/rejectBacklink/:versionId`
- `POST /api/v1/articles/approveAndPublish/:versionId`

No changes are required to the frontend admin interface - the purchase integration happens automatically in the background.