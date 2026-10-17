/** Default Open Graph image for all non-project pages: /og/default.png */
import type { APIRoute } from 'astro';
import { renderOg } from '@/lib/og';
import { site } from '@/data/site';

export const GET: APIRoute = async () => {
  const png = await renderOg({
    kicker: 'ETH Zürich · D-MAVT',
    title: site.name,
    subtitle: site.tagline.en,
    specs: [
      ['FOCUS', 'Mechatronics · Embedded'],
      ['STATUS', 'BSc Mechanical Eng.'],
    ],
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
