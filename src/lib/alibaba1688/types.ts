// 1688 DataHub API response types — based on real API responses
// Confirmed by curl tests on 2026-04-08

export interface Alibaba1688SkuDef {
  price?: string; // can be a single value "2.45" or a range "2.45 - 3.40"
  promotionPrice?: string;
  minOrder?: string | number;
  quantity?: number;
  unit?: string;
}

export interface Alibaba1688Item {
  itemId?: number | string;
  title?: string;
  sales?: number | string;
  itemUrl?: string; // "//detail.1688.com/offer/{id}.html"
  image?: string;
  rootCatId?: number | string;
  sku?: {
    def?: Alibaba1688SkuDef;
  };
  averageStarRate?: string;
  rePurchaseRate?: number;
}

export interface Alibaba1688ResultListEntry {
  item: Alibaba1688Item;
}

export interface Alibaba1688ApiResponse {
  result?: {
    status?: { code?: number; data?: string };
    base?: {
      page?: number;
      pageSize?: number;
      totalResults?: number;
    };
    resultList?: Alibaba1688ResultListEntry[];
  };
}

// Item detail response (richer data: full images array, description, SKU details)
export interface Alibaba1688ItemDetailResponse {
  result?: {
    status?: { code?: number; data?: string };
    item?: {
      itemId?: string;
      title?: string;
      catId?: string;
      rootCatId?: string;
      sales?: string;
      itemUrl?: string;
      images?: string[];
      video?: string | null;
      description?: {
        url?: string;
        images?: string[];
      } | string;
      sku?: {
        def?: Alibaba1688SkuDef;
        saleInfo?: {
          skuRangePrice?: { startAmount: string; price: string }[];
          price?: string | null;
          promotionPrice?: { startAmount: string; price: string }[];
        };
      };
      properties?: {
        cut?: string;
        list?: { name: string; value: string }[];
      };
    };
  };
}

export interface Alibaba1688PackageDetailResponse {
  result?: {
    weight?: number;
    volume?: number;
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
}
