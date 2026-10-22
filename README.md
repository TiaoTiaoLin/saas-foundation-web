# saas-foundation-web

Browser client for the [saas-foundation](https://github.com/TiaoTiaoLin/saas-foundation) API.

The deployed app is <https://saas-foundation-web.linzehui233.workers.dev/>. The first request after the API has been idle can take half a minute.

## Walk through

1. Create an organization.
2. Add a product.
3. Invite a member. They need an existing account and must accept the email.
4. From Billing, upgrade to Pro. Checkout uses Stripe test mode: card `4242 4242 4242 4242`, any future expiry, any CVC. Refresh after Stripe returns. The audit log opens once the webhook has stored the subscription.

## Run

1. Start the API on port 8080. See the API repo.
2. From this directory:

```bash
npm install
npm run dev
```

3. Open <http://localhost:5173>.

The dev server proxies `/api` to `http://localhost:8080`. To call another origin, set `VITE_API_BASE_URL`. That origin must be allowed by `saas.cors.allowed-origins` on the API.

## Screens

| Screen | Route | What it calls |
| --- | --- | --- |
| Create organization | `/signup` | `POST /api/v1/tenants/registrations` |
| Sign in | `/login` | `POST /api/v1/auth/login` |
| Stay signed in | | `POST /api/v1/auth/refresh` |
| Sign out | | `POST /api/v1/auth/logout` |
| Forgot password | `/forgot-password` | `POST /api/v1/auth/password-resets` |
| Reset password | `/reset-password` | `POST /api/v1/auth/password-resets/confirm` |
| Products | `/` | `GET`, `POST /api/v1/products`, `GET`, `PUT`, `DELETE /api/v1/products/{id}` |
| Members | `/members` | `GET`, `POST /api/v1/members`, `PATCH`, `DELETE /api/v1/members/{userId}` |
| Accept invite | `/invites/accept` | `POST /api/v1/membership-invites/accept` |
| Billing | `/billing` | `GET /api/v1/billing`, `POST /api/v1/billing/checkout`, `POST /api/v1/billing/portal` |
| Audit log | `/audit` | `GET /api/v1/audit` |
| Password | `/password` | `POST /api/v1/auth/password` |
| Account | `/account` | `GET`, `PUT /api/v1/auth/profile` |

Authenticated calls send `Authorization: Bearer`. The tenant id is the one in the access token.
