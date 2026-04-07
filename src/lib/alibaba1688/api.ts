import type {
  Alibaba1688ApiResponse,
  Alibaba1688ItemDetailResponse,
  Alibaba1688PackageDetailResponse,
} from './types';

const RAPIDAPI_HOST = '1688-datahub.p.rapidapi.com';

function getHeaders(): HeadersInit {
  return {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
    'x-rapidapi-host': RAPIDAPI_HOST,
    'Content-Type': 'application/json',
  };
}

export async function searchByImage1688(
  imgUrl: string,
  options?: { page?: number }
): Promise<Alibaba1688ApiResponse> {
  const params = new URLSearchParams({
    imgUrl,
    page: String(options?.page ?? 1),
    sort: 'default',
  });

  const res = await fetch(
    `https://${RAPIDAPI_HOST}/item_search_image_2?${params}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(`1688 image search failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getItemDetail1688(itemId: string): Promise<Alibaba1688ItemDetailResponse> {
  const params = new URLSearchParams({ itemId });

  const res = await fetch(
    `https://${RAPIDAPI_HOST}/item_detail?${params}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(`1688 item detail failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getPackageDetail1688(
  itemId: string,
  storeId: string
): Promise<Alibaba1688PackageDetailResponse> {
  const params = new URLSearchParams({ itemId, storeId });

  const res = await fetch(
    `https://${RAPIDAPI_HOST}/package_detail?${params}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(`1688 package detail failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
