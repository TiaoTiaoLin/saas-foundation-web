# saas-foundation-web

Browser client for the [saas-foundation](../saas-foundation) API.

It registers an organization, signs in, and manages that tenant's products.

## Run

1. Start the API on port 8080 with the `local` profile.
2. From this directory:

```bash
npm install
npm run dev
```

3. Open http://localhost:5173.

The dev server proxies `/api` to `http://localhost:8080`. To call the API on its own origin instead, set `VITE_API_BASE_URL=http://localhost:8080`. That origin is listed in `saas.cors.allowed-origins`.

## API surface

| Screen | Endpoints |
| --- | --- |
| Create organization | `POST /api/v1/tenants/registrations` |
| Sign in | `POST /api/v1/auth/login` |
| Stay signed in | `POST /api/v1/auth/refresh` |
| Sign out | `POST /api/v1/auth/logout` |
| Products | `GET`, `POST /api/v1/products`, `GET`, `PUT`, `DELETE /api/v1/products/{id}` |

Product calls send `Authorization: Bearer` and `X-Tenant-ID`. The tenant id comes from the login response and must match the access token.
