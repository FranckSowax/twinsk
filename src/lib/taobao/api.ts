import type { TaobaoApiResponse } from './types';

const RAPIDAPI_HOST = 'taobao-datahub.p.rapidapi.com';

function getHeaders(): HeadersInit {
  return {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
    'x-rapidapi-host': RAPIDAPI_HOST,
    'Content-Type': 'application/json',
  };
}

export async function searchByImage(
  imgUrl: string,
  options?: { pageSize?: number; page?: number }
): Promise<TaobaoApiResponse> {
  const params = new URLSearchParams({
    imgUrl,
    pageSize: String(options?.pageSize ?? 20),
    switches: 'disableAutoCrop',
  });
  if (options?.page) params.set('page', String(options.page));

  const res = await fetch(
    `https://${RAPIDAPI_HOST}/item_search_image_x?${params}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(`Taobao image search failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function searchByKeyword(
  query: string,
  options?: { pageSize?: number; page?: number; startPrice?: string; endPrice?: string; sort?: string }
): Promise<TaobaoApiResponse> {
  const params = new URLSearchParams({
    q: query,
    pageSize: String(options?.pageSize ?? 20),
  });
  if (options?.page) params.set('page', String(options.page));
  if (options?.startPrice) params.set('startPrice', options.startPrice);
  if (options?.endPrice) params.set('endPrice', options.endPrice);
  if (options?.sort) params.set('sort', options.sort);

  const res = await fetch(
    `https://${RAPIDAPI_HOST}/item_search_x?${params}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(`Taobao keyword search failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getItemDetail(itemId: string): Promise<unknown> {
  const params = new URLSearchParams({ itemId });

  const res = await fetch(
    `https://${RAPIDAPI_HOST}/item_detail?${params}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(`Taobao item detail failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
