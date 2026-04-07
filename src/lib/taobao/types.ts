export interface TaobaoSku {
  def?: {
    price?: string;
    promotionPrice?: string;
  };
}

export interface TaobaoItem {
  itemId?: string;
  itemIdStr?: string;
  title?: string;
  sales?: number;
  image?: string;
  sku?: TaobaoSku;
}

export interface TaobaoSeller {
  sellerId?: string;
  storeTitle?: string;
  storeType?: string;
}

export interface TaobaoDelivery {
  shippingFrom?: string;
}

export interface TaobaoResultListEntry {
  item: TaobaoItem;
  delivery?: TaobaoDelivery;
  seller?: TaobaoSeller;
}

export interface TaobaoApiResponse {
  result?: {
    status?: { code?: number; data?: string };
    resultList?: TaobaoResultListEntry[];
  };
}
