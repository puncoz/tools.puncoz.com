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

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deployment

`vercel.json` overrides the build command:

```
bun scripts/build-aws-icons.ts && ./node_modules/.bin/next build
```

Two things are load-bearing here.

**Next is built with Node, not Bun.** Bun 1.3.14 segfaults during `next build`'s
"Collecting page data" phase on Next.js 16.3.0 — an open Bun bug on the Linux x64
baseline build Vercel uses ([oven-sh/bun#36866](https://github.com/oven-sh/bun/issues/36866)).
The default `bun run build` hands `next` to Bun's runtime and the build dies with
`panic: Segmentation fault` *after* printing its route table. Invoking
`./node_modules/.bin/next` directly runs it under Node via its shebang. Bun still
installs dependencies and still runs the icon script, which is TypeScript.

**The icon step must run before `next build`.** `public/aws-icons/` is gitignored
and generated from the `aws-icons` dependency; skip the script and every AWS icon
404s in production without the build failing. It is chained explicitly rather than
through a `prebuild` hook because Bun does not run those the way npm does.

If Vercel's dashboard has a Build Command set, clear it — `vercel.json` should be
the single source of truth.
