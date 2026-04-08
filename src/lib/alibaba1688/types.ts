// 1688 DataHub API response types — based on similar structure to Taobao DataHub
// To be validated at runtime; the parser is defensive

export interface Alibaba1688Sku {
  def?: {
    price?: string;
    promotionPrice?: string;
  };
}

export interface Alibaba1688Item {
  itemId?: string;
  itemIdStr?: string;
  title?: string;
  image?: string;
  sku?: Alibaba1688Sku;
  minOrderQuantity?: number;
  moq?: number;
  unitWeight?: number;
  weight?: number;
}

export interface Alibaba1688Seller {
  sellerId?: string;
  storeId?: string;
  storeTitle?: string;
  storeType?: string;
}

export interface Alibaba1688ResultListEntry {
  item: Alibaba1688Item;
  seller?: Alibaba1688Seller;
}

export interface Alibaba1688ApiResponse {
  result?: {
    status?: { code?: number; data?: string };
    resultList?: Alibaba1688ResultListEntry[];
  };
}

// Item detail response (for MOQ, weight, dimensions, main images)
export interface Alibaba1688ItemDetailResponse {
  result?: {
    item?: {
      itemId?: string;
      title?: string;
      description?: string;
      minOrderQuantity?: number;
      unitWeight?: number;
      weight?: number;
      images?: string[];
      mainImage?: string;
      pic?: string;
      packageInfo?: {
        weight?: number;
        volume?: number;
        length?: number;
        width?: number;
        height?: number;
        unit?: string;
      };
    };
    sku?: {
      def?: {
        price?: string;
        promotionPrice?: string;
      };
    };
    seller?: Alibaba1688Seller;
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
