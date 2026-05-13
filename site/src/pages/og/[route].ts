// /og/<route>.png, static OG card generator.
//
// astro-og-canvas (CanvasKit/Skia under the hood) renders a PNG per
// entry in `pages` at build time. The keys of `pages` become the URL
// slug, file is `[route].png.ts` so the slug does NOT include `.png`.
// One entry today (`index`) → /og/index.png. Adding more is just
// another entry in `pages`.
//
// Fonts: CanvasKit only handles .ttf. The library's hardcoded default
// font URL (api.fontsource.org) currently 404s, so we ship a local
// JetBrains Mono .ttf inside the repo and point at it via file path.

import { OGImageRoute } from 'astro-og-canvas';

const SITE_TITLE = 'Flue on Cloudflare';
const SITE_DESCRIPTION =
  'Four agents I built, smallest to largest. Real code, real deploys.';

interface PageData {
  title: string;
  description: string;
}

const pages: Record<string, PageData> = {
  index: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page: PageData) => ({
    title: page.title,
    description: page.description,
    // CF-adjacent palette. Dark background, light text, orange accent.
    bgGradient: [
      [15, 15, 15], // matches --code-bg
      [26, 26, 26], // subtle vertical falloff
    ],
    border: {
      color: [246, 130, 31], // --cf-orange
      width: 12,
      side: 'inline-start',
    },
    padding: 72,
    font: {
      title: {
        color: [255, 255, 255],
        size: 84,
        weight: 'Bold',
        lineHeight: 1.05,
        families: ['JetBrains Mono'],
      },
      description: {
        color: [180, 180, 180],
        size: 34,
        weight: 'Bold',
        lineHeight: 1.4,
        families: ['JetBrains Mono'],
      },
    },
    // Local .ttf path, resolved relative to project root (the /site dir).
    fonts: ['./src/fonts/JetBrainsMono-Bold.ttf'],
  }),
});
