# Dhream Market - Phase 1 Marketplace Foundation
 
Dhream Market is a premium, scalable marketplace foundation for digital trade. This Phase 1 implementation provides a rock-solid base for future B2B, B2C, and P2P commerce features.

## Features

- **Secure Authentication**: JWT-based login/register with role-based access (Admin, Vendor, Customer)
- **Protected Dashboards**: Role-specific dashboards for platform management
- **Premium UI**: Clean, modern design with Tailwind CSS
- **Database Schema**: Comprehensive Prisma schema for marketplace entities
- **Middleware Protection**: Route-level security for sensitive areas

## Tech Stack

- **Frontend**: Next.js 14 with App Router, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with bcryptjs password hashing
- **Deployment**: Railway-ready

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/dhraverse.git
   cd dhraverse
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your database URL and JWT secret:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/dhraverse"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   ```

4. Set up the database:
   ```bash
   npm run db:generate
   npm run db:push  # Use db:push for Railway; db:migrate for local PostgreSQL
   npm run db:seed
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Seeded Test Accounts

After running the seed script, you can log in with these accounts:

- **Admin**: admin@dhraverse.com / admin123
- **Vendor**: vendor@dhraverse.com / vendor123
- **Customer**: customer@dhraverse.com / customer123

## Project Structure

```
dhraverse/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Protected dashboard pages
│   ├── login/             # Login page
│   ├── register/          # Registration page
│   └── page.tsx           # Homepage
├── components/            # Reusable UI components
├── lib/                   # Utility functions
├── prisma/                # Database schema and seed
└── middleware.ts          # Route protection
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes
- `npm run db:seed` - Seed database with test data

## Deployment to Railway

1. Connect your GitHub repository to Railway
2. Add environment variables in Railway dashboard:
   - `DATABASE_URL` (Railway provides this)
   - `JWT_SECRET` (generate a secure random string)
3. Deploy automatically or manually

## Architecture Notes

- **Modular Design**: Clean separation of concerns across UI, API, and database layers
- **Type Safety**: Full TypeScript coverage for reliability
- **Scalable Schema**: Database design prepared for future marketplace expansions
- **Security First**: Proper authentication, validation, and route protection

## Future Phases

This Phase 1 foundation enables future development of:
- Product listings and search
- Shopping cart and checkout
- Payment integration
- Order management
- Vendor store management
- Customer reviews and ratings
- Advanced analytics

## License

ISC
## App Waitlist

- Page: /app-waitlist (landing page collecting name, email, optional phone, interest, device).
- API: POST /api/waitlist (rate-limited, validated server-side, duplicate-email friendly).
- Storage: app_waitlist_entries table (Prisma AppWaitlistEntry) and waitlist_signups table (Prisma WaitlistSignup).
- Export signups: npm run export:waitlist (writes waitlist-export.csv) or admin GET /api/admin/waitlist/export.
- Configure via .env (see .env.example): DATABASE_URL, ENABLE_WELCOME_EMAIL, RESEND_API_KEY, etc.

### Waitlist migration

- Migration: prisma/migrations/20261031140000_add_waitlist_signups/migration.sql creates waitlist_signups.
- Apply locally: npx prisma migrate dev (or npm run db:dev:migrate).
- Apply in production: npx prisma migrate deploy (runs automatically on npm start).
- Super Admin access: set a user's role to SUPER_ADMIN in the database (e.g., via Prisma Studio or admin tools).
- Admin view: /dashboard/super-admin/waitlist (super admins only).
- Export: /api/admin/waitlist/export or npm run export:waitlist.
