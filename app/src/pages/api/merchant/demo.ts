import type { APIRoute } from 'astro';
import { dollarsToBaseUnits } from '../../../lib/format';
import { rejectUnlessDemo } from '../../../lib/server/demo-guard';
import { DEMO_METHODS, callDemoProgram, fundDemoPool, type DemoMethod } from '../../../lib/server/merchant';
import { getProgram } from '../../../lib/near';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';

const FUND_OPTIONS = [25, 50, 100];

export const POST: APIRoute = async ({ request }) => {
  const { slug, method, args } = (await request.json().catch(() => ({}))) as {
    slug?: string;
    method?: string;
    args?: Record<string, unknown>;
  };
  const rejected = rejectUnlessDemo(request, slug, 'merchant-demo', 20);
  if (rejected) return rejected;
  if (!slug || !method || !args || typeof args !== 'object') {
    return failure('INVALID_REQUEST');
  }
  try {
    if (method === 'fund') {
      const dollars = Number(args.dollars);
      if (!FUND_OPTIONS.includes(dollars)) return failure('INVALID_REQUEST');
      await fundDemoPool(slug, dollarsToBaseUnits(dollars));
      return json({ ok: true });
    }
    if (method === 'settle') {
      const program = await getProgram(slug);
      if (!program || BigInt(program.pending_total) === 0n) return failure('NOTHING_PENDING');
      await fundDemoPool(slug, program.pending_total);
      return json({ ok: true });
    }
    if (!DEMO_METHODS.includes(method as DemoMethod)) {
      return failure('DEMO_LOCKED', 403);
    }
    await callDemoProgram(method as DemoMethod, { ...args, slug });
    return json({ ok: true });
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
