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
  language?: string; // Receipt language
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
  pricePerUnit?: number; // Price per unit (for weight-based items)
  isWeightBased?: boolean; // Flag for items sold by weight
  expiryDate: string;
  locationId?: number; // Suggested storage location
  suggestionScore?: number; // Score for item suggestion
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
  language?: string; // Receipt language detected
  receiptId?: string | number; // ID of the receipt in the database
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