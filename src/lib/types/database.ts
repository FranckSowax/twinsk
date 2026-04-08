export type RequestStatus = 'draft' | 'submitted' | 'processing' | 'quoted' | 'completed' | 'proposal_sent' | 'client_reviewed';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
export type DocumentType = 'devis' | 'packing_list';
export type SearchSource = 'taobao' | '1688' | 'manual' | 'factory';

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
  image_url: string | null;
  description: string | null;
  created_at: string;
  processed: boolean;
  added_by: 'client' | 'admin';
  client_note: string | null;
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
  source: SearchSource;
  title_original: string | null;
  description: string | null;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  client_quantity: number | null;
  main_image_url: string | null;
  client_selected: boolean | null;
  extra_images: string[] | null;
  description_original: string | null;
}

export interface Quote {
  id: string;
  request_id: string;
  created_at: string;
  total_amount: number;
  margin_global: number;
  status: QuoteStatus;
  pdf_url: string | null;
  document_type: DocumentType;
}

export interface RequestItemWithResults extends RequestItem {
  search_results: SearchResult[];
}
