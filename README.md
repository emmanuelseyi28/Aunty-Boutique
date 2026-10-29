This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

## Connect the product catalog to Supabase

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your Supabase project's **Connect** panel.
2. For a fresh Supabase project only, run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. If your `products` table already exists, keep it and set up its read policy in the dashboard instead.
3. Add the boutique's real products to the `products` table. Use categories such as `Men's Underwear`, `Women's Underwear`, and `Fashion Clothes`. Enter prices in naira in `price_ngn`, stock counts in `stock_quantity`, and a photo URL in `image_url`.
4. Restart the development server. The storefront will show “Live collection from Supabase” when the catalog loads. Without credentials or while the connection is unavailable, clearly marked sample items remain visible.

Only the public publishable key belongs in this browser app. Never put a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.

## Merge duplicate Kids' Ready-to-Wear categories

The storefront displays common spelling variations as one **Kids' Ready-to-Wear** category. To also standardize existing product rows in Supabase, open **SQL Editor → New query**, paste [`supabase/migrations/20261027000000_normalize_kids_ready_to_wear_category.sql`](./supabase/migrations/20261027000000_normalize_kids_ready_to_wear_category.sql), and click **Run** once.

## Membership and members-only products

For the existing Supabase project, open **SQL Editor → New query**, paste the contents of [`supabase/migrations/20261022000000_membership_and_exclusive_products.sql`](./supabase/migrations/20261022000000_membership_and_exclusive_products.sql), and click **Run**. If you already ran an earlier version of this file for membership, run this updated version again to add the private profile photo storage. The SQL can be safely rerun. It creates the private customer profile table, adds the `is_exclusive` product switch, and changes row-level security so visitors cannot read exclusive products.

After running the SQL:

1. In Supabase, open **Authentication → URL Configuration** and add your local website address to **Redirect URLs** (for example, `http://localhost:3000/**` or the local network address you use on your phone, ending in `:3000/**`).
2. In **Authentication → Providers → Email**, decide whether customers must confirm their email. If confirmation is on, they need to open the email link before signing in.
3. In **Table Editor → products**, set `is_exclusive` to `true` for products reserved for members. Existing products default to `false`.
4. Run the website and use **Become a member** to create an account. Sign-in uses the registered email address and password; the username is collected and saved in the customer profile.

Passwords are stored and checked by Supabase Auth. Customer contact and address details are stored in `profiles`, where each signed-in customer can access only their own profile. Profile photos are saved in a private Storage bucket and can only be read by the member who uploaded them.

## Admin product management

The store owner can add and edit products, prices, quantities, categories, photos, and members-only status from `/admin`. They can also mark a product unavailable without deleting it. Home-page sample items can be added to the admin list as unavailable drafts, then reviewed and edited before being made available to customers.

To set this up for the store owner:

1. In Supabase, open **SQL Editor → New query**. Open [`supabase/migrations/20261027010000_store_admin_dashboard.sql`](./supabase/migrations/20261027010000_store_admin_dashboard.sql), copy all its contents into the query, and click **Run** once. This creates the admin access rules and product photo bucket.
2. The store owner needs a normal Phunvict Fashion account first. She can use **Become a member** on the site, or use an account she already has. No password needs to be shared.
3. Open [`supabase/grant_store_admin.sql`](./supabase/grant_store_admin.sql), replace `admin@example.com` with the email address she used for her account, paste the SQL into a new Supabase query, and click **Run**. This approves only that account as an administrator.
4. Open `http://localhost:3000/admin` while the website is running and sign in with her own email and password. On the live website, use the same address with `/admin` at the end of the domain.

The admin page uses the regular Supabase publishable key in the browser. Never put a Supabase secret or service-role key in the website.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
