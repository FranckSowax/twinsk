import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';

export async function GET(request: NextRequest) {
  const agent = await getAgent(request);
  return NextResponse.json({ agent });
}
