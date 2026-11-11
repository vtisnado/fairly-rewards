import type { APIRoute } from 'astro';
import { renderCardArt } from '../../../../lib/card-art';
import { getProgram } from '../../../../lib/near';

const MAX_STAMPS = 8;

export const GET: APIRoute = async ({ params, url }) => {
  const tierIndex = Number(params.tier);
  const program = params.slug ? await getProgram(params.slug).catch(() => null) : null;
  const tier = program?.tiers[tierIndex];

  if (!program || !tier || !Number.isInteger(tierIndex)) {
    return new Response('Not found', { status: 404 });
  }

  const nextTier = program.tiers[tierIndex + 1];
  const stampsToNextTier = nextTier ? Math.min(nextTier.min_purchases - tier.min_purchases, MAX_STAMPS) : 0;
  const purchases = Number(url.searchParams.get('purchases') ?? tier.min_purchases);
  const balance = url.searchParams.get('balance');

  const svg = renderCardArt({
    programName: program.name,
    brandColor: program.brand_color,
    tierName: tier.name,
    tierIndex,
    stampsToNextTier,
    stampsFilled: Math.max(0, purchases - tier.min_purchases),
    balance: balance && /^\d+$/.test(balance) ? balance : undefined,
    number: url.searchParams.get('number') ?? undefined,
  });

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600',
    },
  });
};
