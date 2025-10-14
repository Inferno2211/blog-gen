# Article Backlink Purchase System - Frontend

This frontend implementation provides a public-facing interface for customers to browse and purchase backlinks in published articles.

## Features Implemented

### 1. Homepage and Article Browsing
- **Article Grid**: Responsive grid layout displaying available articles
- **Article Cards**: Individual article previews with availability status
- **Availability Indicators**: Real-time status showing "Available", "Sold Out", or "Processing"
- **Responsive Design**: Mobile-first design that works on all screen sizes

### 2. Purchase Flow Components
- **Purchase Modal**: Form for collecting backlink details (keyword, URL, notes, email)
- **Email Authentication**: Magic link flow for secure authentication
- **Form Validation**: Client-side validation for URLs, emails, and required fields
- **Loading States**: User feedback during API calls

### 3. Payment Integration (Ready for Stripe)
- **Session Verification**: Handles magic link verification
- **Payment Success**: Confirmation page after successful payment
- **Error Handling**: Graceful error handling with retry options

### 4. Technical Implementation
- **TypeScript**: Full type safety with custom interfaces
- **React Router**: Public and admin route separation
- **Tailwind CSS**: Utility-first styling with responsive design
- **Service Layer**: Clean API abstraction with mock data support

## File Structure

```
src/
├── components/
│   ├── ArticleGrid.tsx          # Grid layout for articles
│   ├── ArticleCard.tsx          # Individual article display
│   ├── PurchaseModal.tsx        # Purchase form modal
│   ├── LoadingSpinner.tsx       # Loading indicator
│   └── ErrorMessage.tsx         # Error display component
├── pages/
│   ├── Homepage.tsx             # Main public homepage
│   ├── VerifySession.tsx        # Magic link verification
│   └── PaymentSuccess.tsx       # Payment confirmation
├── services/
│   └── purchaseService.ts       # API service layer
├── types/
│   └── purchase.ts              # TypeScript interfaces
└── utils/
    └── mockData.ts              # Mock data for development
```

## API Integration

The frontend is designed to work with the following API endpoints:

### Public Endpoints
- `GET /api/v1/articles/browse` - Get available articles
- `GET /api/v1/articles/:id/availability` - Check article availability
- `POST /api/v1/purchase/initiate` - Start purchase process
- `POST /api/v1/purchase/verify-session` - Verify magic link
- `POST /api/v1/purchase/complete` - Complete payment
- `GET /api/v1/purchase/status/:orderId` - Get order status

## Configuration

### Mock Data Mode
Set `USE_MOCK_DATA = true` in `purchaseService.ts` for development without backend.

### Route Structure
- `/` - Public homepage (article browsing)
- `/verify?token=...` - Magic link verification
- `/payment/success?session_id=...` - Payment confirmation
- `/admin/*` - Admin interface (existing functionality)

## Responsive Design

The interface is fully responsive with:
- **Mobile**: Single column layout, touch-friendly buttons
- **Tablet**: 2-column grid, optimized spacing
- **Desktop**: 3-column grid, hover effects

## Requirements Satisfied

✅ **Requirement 1.1**: Homepage displays browsing page with available articles
✅ **Requirement 1.2**: Articles show "sold out" status and prevent additional purchases
✅ **Requirement 1.2**: Article previews are displayed on homepage

## Next Steps

1. **Backend Integration**: Replace mock data with actual API calls
2. **Stripe Integration**: Complete payment flow implementation
3. **Article Previews**: Add full article preview functionality
4. **Order Tracking**: Implement order status tracking page
5. **Email Templates**: Design and implement email notification templates

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Testing

The implementation includes:
- Mock data for development testing
- Error boundary handling
- Loading state management
- Form validation
- Responsive design testing

To test the purchase flow:
1. Visit the homepage
2. Click "Purchase" on an available article
3. Fill out the purchase form
4. Submit to see the email confirmation flow