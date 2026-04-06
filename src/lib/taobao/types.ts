export interface TaobaoSearchItem {
  itemId: string;
  title: string;
  price: string;
  image: string;
  sellerNick?: string;
  shopName?: string;
  salesStr?: string;
  location?: string;
  itemUrl?: string;
}

export interface TaobaoImageSearchResponse {
  code: number;
  msg: string;
  data?: {
    items: TaobaoSearchItem[];
    totalResults?: number;
  };
}

export interface TaobaoKeywordSearchResponse {
  code: number;
  msg: string;
  data?: {
    items: TaobaoSearchItem[];
    totalResults?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface TaobaoItemDetail {
  itemId: string;
  title: string;
  price: string;
  images: string[];
  description?: string;
  sellerNick?: string;
  shopName?: string;
  location?: string;
}

export interface TaobaoItemDetailResponse {
  code: number;
  msg: string;
  data?: TaobaoItemDetail;
}
