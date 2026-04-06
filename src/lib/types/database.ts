export type RequestStatus = 'draft' | 'submitted' | 'processing' | 'quoted' | 'completed';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface Request {
  id: string;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: RequestStatus;
  notes: string | null;
}

export interface RequestItem {
  id: string;
  request_id: string;
  image_url: string;
  description: string | null;
  created_at: string;
}

export interface SearchResult {
  id: string;
  request_item_id: string;
  taobao_item_id: string;
  title: string;
  price: number;
  image_url: string;
  seller: string | null;
  product_url: string;
  selected: boolean;
  quantity: number;
  margin_percent: number;
  created_at: string;
}

export interface Quote {
  id: string;
  request_id: string;
  created_at: string;
  total_amount: number;
  margin_global: number;
  status: QuoteStatus;
  pdf_url: string | null;
}

export interface RequestItemWithResults extends RequestItem {
  search_results: SearchResult[];
}
