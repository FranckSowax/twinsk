import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';

// GET: Public-facing view of an offer (only when status='published').
// Delegates to the shared lib so the page Server Component and this route
// stay in sync.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const data = await fetchPublicOffer(uuid);
  if (!data) {
    return NextResponse.json(
      { error: "Offre introuvable ou non publique" },
      { status: 404 }
    );
  }
  return NextResponse.json(data);
}
