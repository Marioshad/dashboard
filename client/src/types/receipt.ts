export interface Receipt {
  id: number;
  userId: number;
  storeId?: number;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadDate?: string;
  receiptDate?: string;
  receiptNumber?: string;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
  store?: {
    id: number;
    name: string;
    location: string;
  };
  paymentMethod?: string;
  extractedData?: any;
}

export interface ExtractedItem {
  name: string;
  quantity: number;
  unit: string;
  price: number | null;
  expiryDate: string;
}

export interface VatBreakdown {
  rate: number;
  amount: number;
}

export interface ReceiptDetails {
  receiptNumber?: string;
  date?: string;
  time?: string;
  cashier?: string;
  paymentMethod?: string;
  totalAmount?: number;
  vatBreakdown?: VatBreakdown[];
}

export interface ReceiptResponse {
  receiptId: number;
  receiptUrl: string;
  message: string;
  items: ExtractedItem[];
  store: any;
  receiptDetails?: ReceiptDetails;
  error?: string;
}