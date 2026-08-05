import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Suit uploads are a server action carrying a PNG, and the default cap is
       * 1MB — so any artwork above that failed before the action ever ran, even
       * though the admin page offers 4MB and checks for it itself.
       *
       * 4.5mb is deliberate: it is exactly Vercel's request-body limit for
       * serverless functions. Anything Next accepts here the platform accepts
       * too, so the app's own 4MB check is the one a user actually meets, and
       * that one answers with a sentence rather than a dropped connection. The
       * gap also absorbs the multipart boundary overhead, which the Next docs
       * put at 10–20KB.
       */
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
