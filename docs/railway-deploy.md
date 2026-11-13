# Railway Deploy: Migrations

## Migration Execution

Prisma migrations no longer run from the `start` script. Run migrations as Railway's **Pre-deploy Command**:

```sh
npm run migrate:deploy
```

This decouples migrations from application startup so that:

- A failed migration blocks the deploy and **keeps the previous version running** instead of crash-looping.
- The web process starts only after migrations have been applied successfully.

## ⚠️ REQUIRED: Configure Before Deploying This Change

> **The Railway Pre-deploy Command MUST be configured to `npm run migrate:deploy` BEFORE this change is deployed.**
>
> If you deploy this change without setting the Pre-deploy Command, **migrations will silently stop running**. New migrations will not be applied and the application may run against an outdated schema.

## Operational Notes

- Ensure the deploy environment has access to the production `DATABASE_URL` during the Pre-deploy phase.
- If a migration fails, fix the migration or resolve it manually (see Prisma `migrate resolve` documentation) before redeploying. Do not remove the Pre-deploy Command as a workaround.
- `npm start` now launches the server only: `cross-env NODE_OPTIONS=--max-old-space-size=768 node server-entry.js`.
