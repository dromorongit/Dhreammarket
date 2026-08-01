# AI Marketplace Intelligence - Architecture Report

## Overview

Dhream Market has been transformed into an intelligent marketplace by introducing AI-driven recommendation, personalization, trend prediction, and customer behavior analysis. The architecture is designed to be future-ready, allowing OpenAI or ML models to replace the rule-based recommendation engine without changing the frontend.

## Architecture

### Abstract Engine Interface

The AI system is built on an abstract engine interface (`lib/ai/types.ts`) that defines the `AIEngine` contract:

```typescript
interface AIEngine {
  getRecommendations(input: RecommendationInput): Promise<RecommendationResult[]>
  getTrending(input: TrendingInput): Promise<TrendingResult[]>
  getSimilar(input: SimilarInput): Promise<SimilarResult[]>
  getFrequentlyBought(input: CrossSellInput): Promise<CrossSellResult[]>
  getCustomerInsights(input: CustomerInsightsInput): Promise<CustomerInsightsResult>
  getVendorInsights(input: VendorInsightsInput): Promise<VendorInsightsResult>
}
```

This interface allows any implementation (rule-based, OpenAI, ML model, collaborative filtering, vector search) to be swapped in by simply implementing the `AIEngine` interface and registering it via `getAIEngine()`.

### Rule-Based Engine

The current implementation (`lib/ai/rule-based-engine.ts`) uses a rule-based approach driven by marketplace data:

- **Recommendations**: Based on recently viewed, purchased, booked items, wishlist, collections, vendor following, and category/brand affinity
- **Trending**: Scored by sales count, ratings, and review counts with configurable time windows
- **Similar Items**: Based on category matching for products/services and category matching for vendors
- **Frequently Bought Together**: Based on co-occurrence in orders/booking requests
- **Customer Insights**: Analyzes shopping preferences, service preferences, category interests, brand interests, and vendor interests
- **Vendor Insights**: Provides business intelligence including suggested products, high/low performers, price improvements, and inventory restock suggestions

### Caching Layer

The AI cache (`lib/ai/cache.ts`) provides in-memory caching with configurable TTL and max size to ensure recommendation queries don't noticeably increase page load times.

## New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/recommendations` | GET | AI-powered personalized recommendations |
| `/api/ai/trending` | GET | Trending products and services with time windows |
| `/api/ai/similar` | GET | Similar items based on category/attributes |
| `/api/ai/frequently-bought` | GET | Frequently bought/booked together items |
| `/api/ai/customer-insights` | GET | Customer shopping behavior insights |
| `/api/ai/vendor-insights` | GET | Vendor business intelligence insights |

## UI Integration Points

### Homepage
- AI Recommendations section (Recommended for You)
- AI Trending section (Trending Today)

### Marketplace
- AI Recommendations sidebar/section
- AI Trending section

### Product Detail Page
- Similar Products section (AISimilar)
- Frequently Bought Together section (AICrossSelling)

### Service Detail Page
- Similar Services section
- Frequently Booked Together section

### Vendor Profile
- AI Vendor Insights section
- Suggested products and services

### Customer Dashboard
- AI-powered "For You" recommendations tab
- Customer Insights section with shopping preferences

### Vendor Dashboard
- AI Vendor Insights section with business intelligence

### Marketplace Intelligence (Super Admin)
- New "AI Insights" tab with all AI features

## Future OpenAI Integration Points

The architecture is designed so that OpenAI or future ML models can replace the recommendation engine without changing the frontend:

1. **Create a new engine class** that implements `AIEngine` interface
2. **Register it** via `getAIEngine()` - the engine is a singleton that can be swapped
3. **No frontend changes needed** - the frontend only calls the API endpoints, which delegate to the engine

### Example: OpenAI Integration

```typescript
// lib/ai/openai-engine.ts
import { AIEngine, RecommendationInput, RecommendationResult, TrendingInput, TrendingResult, SimilarInput, SimilarResult, CrossSellInput, CrossSellResult, CustomerInsightsInput, CustomerInsightsResult, VendorInsightsInput, VendorInsightsResult } from './types'

export class OpenAIEngine implements AIEngine {
  async getRecommendations(input: RecommendationInput): Promise<RecommendationResult[]> {
    // Call OpenAI API with user context and marketplace data
    // Return structured recommendations
  }
  // ... implement other methods
}

// In the engine registry:
let globalEngine: AIEngine | null = null
export function getAIEngine(config?: AIEngineConfig): AIEngine {
  if (!globalEngine) {
    globalEngine = new OpenAIEngine(config) // Swap rule-based for OpenAI
  }
  return globalEngine
}
```

### Future Enhancement Paths

1. **Collaborative Filtering**: Implement user-user and item-item similarity matrices
2. **Vector Search**: Use embeddings for semantic similarity matching
3. **OpenAI Integration**: Use GPT models for natural language recommendation explanations
4. **ML Models**: Train custom models on marketplace data for personalized ranking
5. **Real-time Processing**: Add streaming recommendations based on live user behavior

## Files Modified

### New Files
- `lib/ai/types.ts` - AI type definitions and engine interface
- `lib/ai/cache.ts` - In-memory caching utility
- `lib/ai/rule-based-engine.ts` - Rule-based recommendation engine implementation
- `app/api/ai/recommendations/route.ts` - AI recommendations API
- `app/api/ai/trending/route.ts` - AI trending API
- `app/api/ai/similar/route.ts` - AI similar items API
- `app/api/ai/frequently-bought/route.ts` - AI frequently bought API
- `app/api/ai/customer-insights/route.ts` - AI customer insights API
- `app/api/ai/vendor-insights/route.ts` - AI vendor insights API
- `components/ai/ai-recommendations.tsx` - AI recommendations UI component
- `components/ai/ai-trending.tsx` - AI trending UI component
- `components/ai/ai-similar.tsx` - AI similar items UI component
- `components/ai/ai-cross-selling.tsx` - AI cross-selling UI component
- `components/ai/ai-customer-insights.tsx` - Customer insights UI component
- `components/ai/ai-vendor-insights.tsx` - Vendor insights UI component
- `components/ai/index.ts` - AI components barrel export

### Modified Files
- `app/api/recommendations/route.ts` - Updated to use AI engine
- `app/api/trending-products/route.ts` - Updated to use AI engine
- `app/dashboard/customer/page.client.tsx` - Added AI insights integration
- `app/dashboard/vendor/page.client.tsx` - Added AI insights integration
- `app/dashboard/super-admin/marketplace-intelligence/page.tsx` - Added AI insights tab
- `app/marketplace/marketplace-client.tsx` - Added AI recommendations and trending
- `components/ai/index.ts` - New barrel export

## Verification

- TypeScript type check: `npx tsc --noEmit` passes
- ESLint: `npm run lint` passes (only pre-existing warnings)
- Build: `npm run build` starts successfully (Prisma generate + Next.js build)
- No regressions in existing functionality
- Homepage Builder unaffected
- Homepage Merchandising Engine unaffected
- Search unaffected
- Checkout unaffected
- Authentication unaffected

## Performance

- Recommendation queries are cached with configurable TTL (default: 5 minutes)
- AI components use lazy loading via React Suspense
- Trending data is cached to avoid repeated database queries
- All AI API endpoints are designed to be efficient with minimal database queries