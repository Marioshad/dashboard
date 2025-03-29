/**
 * Store-specific receipt parsers using a strategy pattern
 */
import { WeightBasedItem, extractWeightBasedItems } from './weight-parser';
import { normalizeItemName } from './normalizer';

// Types for receipt parsing
export interface ParsedItem {
  name: string;
  normalizedName: string;
  originalName: string;
  quantity: number;
  unit: string;
  price: number | null;
  pricePerUnit?: number | null;
  isWeightBased: boolean;
  isDiscount: boolean;
  category?: string;
  description?: string;
  lineNumbers?: number[];
}

export interface ReceiptHeader {
  store: string;
  address?: string;
  date?: string;
  time?: string;
  receiptNumber?: string;
  cashier?: string;
}

export interface ReceiptFooter {
  totalAmount: number;
  paymentMethod?: string;
  cardLastDigits?: string;
  vatBreakdown?: {
    rate: number;
    amount: number;
    netAmount?: number;
    grossAmount?: number;
  }[];
  discounts?: {
    description: string;
    amount: number;
  }[];
  loyaltyInfo?: {
    programName?: string;
    points?: number;
    stickerCount?: number;
    message?: string;
  };
}

export interface ParsedReceipt {
  header: ReceiptHeader;
  items: ParsedItem[];
  footer: ReceiptFooter;
  language?: string;
  rawText: string;
}

// Base interface for receipt parsers
export interface ReceiptParserStrategy {
  storeName: string;
  parse(rawText: string): ParsedReceipt;
  parseItems(lines: string[]): ParsedItem[];
  parseHeader(lines: string[]): ReceiptHeader;
  parseFooter(lines: string[]): ReceiptFooter;
  detectLanguage(text: string): string;
}

// Abstract base class with common functionality
abstract class BaseReceiptParser implements ReceiptParserStrategy {
  abstract storeName: string;
  
  parse(rawText: string): ParsedReceipt {
    const lines = rawText.split('\n');
    
    // Extract header, items, and footer
    const header = this.parseHeader(lines);
    const items = this.parseItems(lines);
    const footer = this.parseFooter(lines);
    const language = this.detectLanguage(rawText);
    
    return {
      header,
      items,
      footer,
      language,
      rawText
    };
  }
  
  abstract parseItems(lines: string[]): ParsedItem[];
  abstract parseHeader(lines: string[]): ReceiptHeader;
  abstract parseFooter(lines: string[]): ReceiptFooter;
  
  // Base implementation for language detection
  detectLanguage(text: string): string {
    // Check for Greek characters
    if (/[\u0370-\u03FF]/.test(text)) {
      return 'Greek';
    }
    
    // Default to English
    return 'English';
  }
  
  // Helper methods that can be used by specific implementations
  
  /**
   * Extract date from text using common formats
   */
  protected extractDate(lines: string[]): string | undefined {
    const datePatterns = [
      // DD/MM/YYYY format
      /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/,
      // YYYY-MM-DD format
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
      // Greek format: "Ημερομηνία: DD/MM/YYYY"
      /Ημερομηνία:?\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i,
      // English format: "Date: DD/MM/YYYY"
      /Date:?\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i
    ];
    
    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          // Format depends on the pattern matched
          if (pattern.toString().includes('\\d{4}-')) {
            // YYYY-MM-DD format
            return match[0];
          } else {
            // Convert to YYYY-MM-DD format
            let day, month, year;
            if (pattern.toString().includes('Ημερομηνία') || pattern.toString().includes('Date')) {
              day = match[1].padStart(2, '0');
              month = match[2].padStart(2, '0');
              year = match[3].length === 2 ? `20${match[3]}` : match[3];
            } else {
              day = match[1].padStart(2, '0');
              month = match[2].padStart(2, '0');
              year = match[3].length === 2 ? `20${match[3]}` : match[3];
            }
            return `${year}-${month}-${day}`;
          }
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract time from text using common formats
   */
  protected extractTime(lines: string[]): string | undefined {
    const timePatterns = [
      // HH:MM format
      /(\d{1,2}):(\d{2})(?::(\d{2}))?/,
      // Greek format: "Ώρα: HH:MM"
      /Ώρα:?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i,
      // English format: "Time: HH:MM"
      /Time:?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i
    ];
    
    for (const line of lines) {
      for (const pattern of timePatterns) {
        const match = line.match(pattern);
        if (match) {
          // Format: HH:MM:SS
          const hour = match[1].padStart(2, '0');
          const minute = match[2].padStart(2, '0');
          const second = match[3] ? match[3].padStart(2, '0') : '00';
          return `${hour}:${minute}:${second}`;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract receipt number from text using common formats
   */
  protected extractReceiptNumber(lines: string[]): string | undefined {
    const receiptNumberPatterns = [
      // Common format: "Receipt/Transaction/No: XXXX"
      /(?:Receipt|Transaction|No|Number|Απόδειξη|Αριθμός|Αρ)\s*(?:\/|\s|:|#|No\.*)\s*([A-Z0-9\/-]+)/i,
      // Format with hash: "#123456"
      /#\s*([A-Z0-9\/-]+)/i
    ];
    
    for (const line of lines) {
      for (const pattern of receiptNumberPatterns) {
        const match = line.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract cashier name from text using common formats
   */
  protected extractCashier(lines: string[]): string | undefined {
    const cashierPatterns = [
      // Common formats
      /(?:Cashier|Operator|Ταμίας|Πωλητής)[:.]?\s*([A-Za-zΑ-Ωα-ω\s]+)/i,
    ];
    
    for (const line of lines) {
      for (const pattern of cashierPatterns) {
        const match = line.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract total amount from text using common formats
   */
  protected extractTotal(lines: string[]): number {
    const totalPatterns = [
      // Common formats
      /(?:TOTAL|ΣΥΝΟΛΟ|ΤΕΛΙΚΟ ΠΟΣΟ)[:.]?\s*(\d+[.,]\d+)/i,
      // Format with currency symbol: "€ 24.99"
      /[€$£]\s*(\d+[.,]\d+)/,
      // Format with currency code: "EUR 24.99"
      /EUR\s*(\d+[.,]\d+)/i
    ];
    
    for (const line of lines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          return parseFloat(match[1].replace(',', '.'));
        }
      }
    }
    
    return 0;
  }
  
  /**
   * Extract payment method from text using common formats
   */
  protected extractPaymentMethod(lines: string[]): string | undefined {
    const paymentMethodPatterns = [
      // Common payment methods
      /(?:VISA|MASTERCARD|MAESTRO|PAYPAL|AMERICAN EXPRESS|AMEX|ΜΕΤΡΗΤΑ|CASH|CARD|ΚΑΡΤΑ)/i
    ];
    
    for (const line of lines) {
      for (const pattern of paymentMethodPatterns) {
        const match = line.match(pattern);
        if (match) {
          const method = match[0].toUpperCase();
          if (method === 'ΚΑΡΤΑ' || method === 'CARD') return 'CARD';
          if (method === 'ΜΕΤΡΗΤΑ' || method === 'CASH') return 'CASH';
          return method; // VISA, MASTERCARD, etc.
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract card last digits from text using common formats
   */
  protected extractCardLastDigits(lines: string[]): string | undefined {
    const cardDigitPatterns = [
      // Format: "XXXX XXXX XXXX 1234"
      /(?:XXXX|[*]{4})\s*(?:XXXX|[*]{4})\s*(?:XXXX|[*]{4})\s*(\d{4})/i,
      // Format: "ending with 1234"
      /ending (?:with|in)\s*(\d{4})/i,
      // Format: "...1234"
      /[.]{3}(\d{4})/
    ];
    
    for (const line of lines) {
      for (const pattern of cardDigitPatterns) {
        const match = line.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract VAT breakdown from text using common formats
   */
  protected extractVAT(lines: string[]): { rate: number; amount: number; netAmount?: number; grossAmount?: number; }[] {
    const vatBreakdown: { rate: number; amount: number; netAmount?: number; grossAmount?: number; }[] = [];
    
    // Common VAT rates in Cyprus
    const ratePatterns = [
      // 0% VAT
      { rate: 0, pattern: /(?:0%|Α\s*0%|A\s*0%|Απαλ|ΦΠΑ\s*0%)/i },
      // 5% VAT
      { rate: 5, pattern: /(?:5%|Β\s*5%|B\s*5%|ΦΠΑ\s*5%)/i },
      // 9% VAT
      { rate: 9, pattern: /(?:9%|Γ\s*9%|C\s*9%|ΦΠΑ\s*9%)/i },
      // 19% VAT
      { rate: 19, pattern: /(?:19%|Δ\s*19%|D\s*19%|ΦΠΑ\s*19%)/i }
    ];
    
    for (const line of lines) {
      for (const { rate, pattern } of ratePatterns) {
        if (pattern.test(line)) {
          // Try to extract amount, net amount, and gross amount
          const amountMatch = line.match(/(\d+[.,]\d+)/g);
          
          if (amountMatch) {
            // Different positions in the line determine what's what
            // This is a simplistic approach and might need adjustment for specific stores
            const amounts = amountMatch.map(a => parseFloat(a.replace(',', '.')));
            
            if (amounts.length >= 1) {
              const vatEntry: { rate: number; amount: number; netAmount?: number; grossAmount?: number; } = {
                rate,
                amount: amounts[0]
              };
              
              // Try to determine net and gross amounts
              if (amounts.length >= 3) {
                // Assuming format: net + VAT = gross
                vatEntry.netAmount = amounts[0];
                vatEntry.amount = amounts[1];
                vatEntry.grossAmount = amounts[2];
              } else if (amounts.length === 2) {
                // Assuming format: net = X, VAT = Y
                vatEntry.netAmount = amounts[0];
                vatEntry.amount = amounts[1];
                vatEntry.grossAmount = amounts[0] + amounts[1];
              }
              
              vatBreakdown.push(vatEntry);
            }
          }
        }
      }
    }
    
    return vatBreakdown;
  }
  
  /**
   * Extract loyalty program information from text
   */
  protected extractLoyaltyInfo(lines: string[]): { programName?: string; points?: number; stickerCount?: number; message?: string; } | undefined {
    // Check for known loyalty programs
    const lidlPlusPattern = /(?:LIDL\s*PLUS|Lidl\s*Plus)/i;
    const alphamegaPattern = /(?:My\s*Alphamega|ΑΛΦΑΜΕΓΑ)/i;
    const stickerPattern = /(?:entitled to|δικαιούστε)\s*(\d+)\s*(?:stickers|αυτοκόλλητα)/i;
    const pointsPattern = /(?:points|πόντοι|πόντους)[:.]?\s*(\d+)/i;
    const savingsPattern = /(?:saved|εξοικονομήθηκαν)[:.]?\s*(\d+[.,]\d+)/i;
    
    let loyaltyInfo: { programName?: string; points?: number; stickerCount?: number; message?: string; } | undefined;
    
    for (const line of lines) {
      // Check for program name
      if (lidlPlusPattern.test(line)) {
        loyaltyInfo = loyaltyInfo || {};
        loyaltyInfo.programName = 'Lidl Plus';
      } else if (alphamegaPattern.test(line)) {
        loyaltyInfo = loyaltyInfo || {};
        loyaltyInfo.programName = 'My Alphamega';
      }
      
      // Check for stickers
      const stickerMatch = line.match(stickerPattern);
      if (stickerMatch) {
        loyaltyInfo = loyaltyInfo || {};
        loyaltyInfo.stickerCount = parseInt(stickerMatch[1]);
        loyaltyInfo.message = line.trim();
      }
      
      // Check for points
      const pointsMatch = line.match(pointsPattern);
      if (pointsMatch) {
        loyaltyInfo = loyaltyInfo || {};
        loyaltyInfo.points = parseInt(pointsMatch[1]);
      }
      
      // Check for savings message
      const savingsMatch = line.match(savingsPattern);
      if (savingsMatch) {
        loyaltyInfo = loyaltyInfo || {};
        if (!loyaltyInfo.message) {
          loyaltyInfo.message = line.trim();
        }
      }
    }
    
    return loyaltyInfo;
  }
  
  /**
   * Extract discounts from text
   */
  protected extractDiscounts(lines: string[]): { description: string; amount: number; }[] {
    const discounts: { description: string; amount: number; }[] = [];
    
    const discountPatterns = [
      // Common discount patterns
      /(?:DISCOUNT|ΕΚΠΤΩΣΗ|LOYALTY|ΠΙΣΤΟΤΗΤΑ)[:.]?\s*(\d+[.,]\d+)/i,
      // Negative amount pattern
      /(?:DISCOUNT|ΕΚΠΤΩΣΗ|LOYALTY|ΠΙΣΤΟΤΗΤΑ)[^-]*(-\d+[.,]\d+)/i
    ];
    
    for (const line of lines) {
      for (const pattern of discountPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = parseFloat(match[1].replace(',', '.'));
          discounts.push({
            description: line.trim(),
            amount: Math.abs(amount) // Ensure amount is positive
          });
        }
      }
    }
    
    return discounts;
  }
}

/**
 * Lidl-specific receipt parser
 */
export class LidlParser extends BaseReceiptParser {
  storeName = 'LIDL';
  
  parseItems(lines: string[]): ParsedItem[] {
    const items: ParsedItem[] = [];
    const weightBasedItems = extractWeightBasedItems(lines);
    
    // Typical Lidl receipt format has pairs of lines:
    // Line 1: Item name
    // Line 2: Price and quantity info
    
    // First, extract weight-based items
    for (const wbItem of weightBasedItems) {
      const normalizationResult = normalizeItemName(wbItem.name, this.storeName);
      
      items.push({
        name: wbItem.name,
        normalizedName: normalizationResult.normalizedName,
        originalName: wbItem.name,
        quantity: wbItem.quantity,
        unit: wbItem.unit,
        price: wbItem.totalPrice,
        pricePerUnit: wbItem.pricePerUnit,
        isWeightBased: true,
        isDiscount: false,
        category: normalizationResult.category,
        description: normalizationResult.description,
        lineNumbers: wbItem.lineNumbers
      });
    }
    
    // Then, look for discount items
    const discountPatterns = [
      /έκπτωση\s*Lidl\s*Plus/i,
      /Lidl\s*Plus\s*έκπτωση/i,
      /έκπτωση/i,
      /discount/i
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line.length === 0) continue;
      
      // Check if this is a discount line
      const isDiscount = discountPatterns.some(pattern => pattern.test(line));
      
      if (isDiscount) {
        // Extract discount amount from the same line or next line
        const amountPattern = /[-]?(\d+[.,]\d+)/;
        let amount = 0;
        
        const amountMatch = line.match(amountPattern);
        if (amountMatch) {
          amount = parseFloat(amountMatch[1].replace(',', '.'));
        } else if (i + 1 < lines.length) {
          // Check next line for amount
          const nextLineMatch = lines[i + 1].match(amountPattern);
          if (nextLineMatch) {
            amount = parseFloat(nextLineMatch[1].replace(',', '.'));
            i++; // Skip the next line since we've processed it
          }
        }
        
        items.push({
          name: 'Discount',
          normalizedName: 'Discount',
          originalName: line,
          quantity: 1,
          unit: 'pieces',
          price: -Math.abs(amount), // Negative price for discounts
          isWeightBased: false,
          isDiscount: true,
          lineNumbers: [i]
        });
        
        continue;
      }
      
      // Skip lines that were processed as part of weight-based items
      const wasProcessed = weightBasedItems.some(wbItem => 
        wbItem.lineNumbers?.includes(i)
      );
      
      if (wasProcessed) continue;
      
      // Look for regular item patterns:
      // First, check if this line could be an item name
      if (!line.match(/^\s*\d+/) && line.length > 0 && !line.includes('ΣΥΝΟΛΟ') && !line.includes('TOTAL')) {
        // This might be an item name, check if the next line has price information
        const pricePattern = /(\d+)?\s*[xX]\s*(\d+[.,]\d+)\s*(?:EUR|€)?$/;
        
        if (i + 1 < lines.length && lines[i + 1].match(pricePattern)) {
          const priceMatch = lines[i + 1].match(pricePattern);
          if (priceMatch) {
            const quantity = priceMatch[1] ? parseInt(priceMatch[1]) : 1;
            const price = parseFloat(priceMatch[2].replace(',', '.'));
            
            const normalizationResult = normalizeItemName(line, this.storeName);
            
            items.push({
              name: line,
              normalizedName: normalizationResult.normalizedName,
              originalName: line,
              quantity: quantity,
              unit: 'pieces',
              price: price,
              isWeightBased: false,
              isDiscount: false,
              category: normalizationResult.category,
              description: normalizationResult.description,
              lineNumbers: [i, i + 1]
            });
            
            i++; // Skip the next line since we've processed it
          }
        }
      }
    }
    
    return items;
  }
  
  parseHeader(lines: string[]): ReceiptHeader {
    // Lidl receipts typically have store info at the top
    const storeNamePattern = /LIDL\s+([A-Za-z\s]+)/i;
    const storeAddressPattern = /((?:[A-Za-z0-9\s]+),\s*(?:[A-Za-z\s]+))/i;
    
    let storeName = 'LIDL';
    let address = '';
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      
      const nameMatch = line.match(storeNamePattern);
      if (nameMatch) {
        storeName = `LIDL ${nameMatch[1].trim()}`;
      }
      
      const addressMatch = line.match(storeAddressPattern);
      if (addressMatch) {
        address = addressMatch[1].trim();
      }
    }
    
    return {
      store: storeName,
      address: address,
      date: this.extractDate(lines),
      time: this.extractTime(lines),
      receiptNumber: this.extractReceiptNumber(lines),
      cashier: this.extractCashier(lines)
    };
  }
  
  parseFooter(lines: string[]): ReceiptFooter {
    return {
      totalAmount: this.extractTotal(lines),
      paymentMethod: this.extractPaymentMethod(lines),
      cardLastDigits: this.extractCardLastDigits(lines),
      vatBreakdown: this.extractVAT(lines),
      discounts: this.extractDiscounts(lines),
      loyaltyInfo: this.extractLoyaltyInfo(lines)
    };
  }
}

/**
 * Alphamega-specific receipt parser
 */
export class AlphamegaParser extends BaseReceiptParser {
  storeName = 'ALPHAMEGA';
  
  parseItems(lines: string[]): ParsedItem[] {
    const items: ParsedItem[] = [];
    const weightBasedItems = extractWeightBasedItems(lines);
    
    // Alphamega receipts typically have item name and price on the same line
    const itemPattern = /(.+?)(?:(?:\s{2,}|\t)(\d+)?(?:\s*[xX]\s*)?)(\d+[.,]\d+)$/;
    
    // First, extract weight-based items
    for (const wbItem of weightBasedItems) {
      const normalizationResult = normalizeItemName(wbItem.name, this.storeName);
      
      items.push({
        name: wbItem.name,
        normalizedName: normalizationResult.normalizedName,
        originalName: wbItem.name,
        quantity: wbItem.quantity,
        unit: wbItem.unit,
        price: wbItem.totalPrice,
        pricePerUnit: wbItem.pricePerUnit,
        isWeightBased: true,
        isDiscount: false,
        category: normalizationResult.category,
        description: normalizationResult.description,
        lineNumbers: wbItem.lineNumbers
      });
    }
    
    // Then, look for regular items and discount items
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line.length === 0) continue;
      
      // Skip lines that were processed as part of weight-based items
      const wasProcessed = weightBasedItems.some(wbItem => 
        wbItem.lineNumbers?.includes(i)
      );
      
      if (wasProcessed) continue;
      
      // Check if this is a discount line
      const isDiscount = /(?:ΕΚΠΤΩΣΗ|DISCOUNT|OFFER)/i.test(line);
      
      // Try to match the general item pattern
      const match = line.match(itemPattern);
      if (match) {
        const name = match[1].trim();
        const quantity = match[2] ? parseInt(match[2]) : 1;
        const price = parseFloat(match[3].replace(',', '.'));
        
        const normalizationResult = normalizeItemName(name, this.storeName);
        
        items.push({
          name,
          normalizedName: normalizationResult.normalizedName,
          originalName: name,
          quantity,
          unit: 'pieces',
          price,
          isWeightBased: false,
          isDiscount,
          category: normalizationResult.category,
          description: normalizationResult.description,
          lineNumbers: [i]
        });
      }
    }
    
    return items;
  }
  
  parseHeader(lines: string[]): ReceiptHeader {
    // Alphamega receipts typically have store info at the top
    const storeNamePattern = /ALPHAMEGA|ΑΛΦΑΜΕΓΑ/i;
    const storeAddressPattern = /(?:[A-Za-z0-9\s]+),\s*(?:[A-Za-z\s]+)/i;
    
    let storeName = 'ALPHAMEGA';
    let address = '';
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      
      if (storeNamePattern.test(line)) {
        storeName = line;
      }
      
      const addressMatch = line.match(storeAddressPattern);
      if (addressMatch) {
        address = addressMatch[0].trim();
      }
    }
    
    return {
      store: storeName,
      address: address,
      date: this.extractDate(lines),
      time: this.extractTime(lines),
      receiptNumber: this.extractReceiptNumber(lines),
      cashier: this.extractCashier(lines)
    };
  }
  
  parseFooter(lines: string[]): ReceiptFooter {
    return {
      totalAmount: this.extractTotal(lines),
      paymentMethod: this.extractPaymentMethod(lines),
      cardLastDigits: this.extractCardLastDigits(lines),
      vatBreakdown: this.extractVAT(lines),
      discounts: this.extractDiscounts(lines),
      loyaltyInfo: this.extractLoyaltyInfo(lines)
    };
  }
}

/**
 * Generic receipt parser for unknown stores
 */
export class GenericReceiptParser extends BaseReceiptParser {
  storeName = 'GENERIC';
  
  parseItems(lines: string[]): ParsedItem[] {
    const items: ParsedItem[] = [];
    const weightBasedItems = extractWeightBasedItems(lines);
    
    // First, extract weight-based items
    for (const wbItem of weightBasedItems) {
      const normalizationResult = normalizeItemName(wbItem.name);
      
      items.push({
        name: wbItem.name,
        normalizedName: normalizationResult.normalizedName,
        originalName: wbItem.name,
        quantity: wbItem.quantity,
        unit: wbItem.unit,
        price: wbItem.totalPrice,
        pricePerUnit: wbItem.pricePerUnit,
        isWeightBased: true,
        isDiscount: false,
        category: normalizationResult.category,
        description: normalizationResult.description,
        lineNumbers: wbItem.lineNumbers
      });
    }
    
    // Generic pattern for items with price at the end
    const itemPattern = /(.+?)(?:\s{2,}|\t)(\d+[.,]\d+)$/;
    // Pattern for quantity * price format
    const quantityPricePattern = /(.+?)(?:\s{2,}|\t)(\d+)\s*[xX]\s*(\d+[.,]\d+)$/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line.length === 0) continue;
      
      // Skip lines that were processed as part of weight-based items
      const wasProcessed = weightBasedItems.some(wbItem => 
        wbItem.lineNumbers?.includes(i)
      );
      
      if (wasProcessed) continue;
      
      // Check if this is a discount line
      const isDiscount = /(?:ΕΚΠΤΩΣΗ|DISCOUNT|OFFER)/i.test(line);
      
      // Try to match quantity * price pattern first
      const qtyMatch = line.match(quantityPricePattern);
      if (qtyMatch) {
        const name = qtyMatch[1].trim();
        const quantity = parseInt(qtyMatch[2]);
        const price = parseFloat(qtyMatch[3].replace(',', '.')) * quantity;
        
        const normalizationResult = normalizeItemName(name);
        
        items.push({
          name,
          normalizedName: normalizationResult.normalizedName,
          originalName: name,
          quantity,
          unit: 'pieces',
          price,
          isWeightBased: false,
          isDiscount,
          category: normalizationResult.category,
          description: normalizationResult.description,
          lineNumbers: [i]
        });
        
        continue;
      }
      
      // Try to match the general item pattern
      const match = line.match(itemPattern);
      if (match) {
        const name = match[1].trim();
        const price = parseFloat(match[2].replace(',', '.'));
        
        const normalizationResult = normalizeItemName(name);
        
        items.push({
          name,
          normalizedName: normalizationResult.normalizedName,
          originalName: name,
          quantity: 1,
          unit: 'pieces',
          price,
          isWeightBased: false,
          isDiscount,
          category: normalizationResult.category,
          description: normalizationResult.description,
          lineNumbers: [i]
        });
      }
    }
    
    return items;
  }
  
  parseHeader(lines: string[]): ReceiptHeader {
    // For unknown stores, try to find store name and address
    let storeName = 'Unknown Store';
    let address = '';
    
    // Look for store name in the first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line && !line.match(/^[0-9\/:-]/) && !line.includes('RECEIPT') && !line.includes('ΑΠΟΔΕΙΞΗ')) {
        storeName = line;
        break;
      }
    }
    
    // Look for address pattern
    const addressPattern = /(?:[A-Za-z0-9\s]+),\s*(?:[A-Za-z\s]+)/i;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      const addressMatch = line.match(addressPattern);
      if (addressMatch) {
        address = addressMatch[0].trim();
        break;
      }
    }
    
    return {
      store: storeName,
      address: address,
      date: this.extractDate(lines),
      time: this.extractTime(lines),
      receiptNumber: this.extractReceiptNumber(lines),
      cashier: this.extractCashier(lines)
    };
  }
  
  parseFooter(lines: string[]): ReceiptFooter {
    return {
      totalAmount: this.extractTotal(lines),
      paymentMethod: this.extractPaymentMethod(lines),
      cardLastDigits: this.extractCardLastDigits(lines),
      vatBreakdown: this.extractVAT(lines),
      discounts: this.extractDiscounts(lines),
      loyaltyInfo: this.extractLoyaltyInfo(lines)
    };
  }
}

/**
 * Factory to get the appropriate parser for a store
 */
export class ReceiptParserFactory {
  private parsers: Map<string, ReceiptParserStrategy> = new Map();
  
  constructor() {
    // Register available parsers
    this.registerParser(new LidlParser());
    this.registerParser(new AlphamegaParser());
    this.registerParser(new GenericReceiptParser());
  }
  
  registerParser(parser: ReceiptParserStrategy): void {
    this.parsers.set(parser.storeName.toUpperCase(), parser);
  }
  
  getParser(storeName: string): ReceiptParserStrategy {
    // Try to find an exact match
    const exactMatch = this.parsers.get(storeName.toUpperCase());
    if (exactMatch) return exactMatch;
    
    // If no exact match, try fuzzy matching store names
    // Convert entries to array for compatibility
    const entries = Array.from(this.parsers.entries());
    for (let i = 0; i < entries.length; i++) {
      const [key, parser] = entries[i];
      if (storeName.toUpperCase().includes(key.toUpperCase())) {
        return parser;
      }
    }
    
    // Fall back to the generic parser
    return this.parsers.get('GENERIC') as ReceiptParserStrategy;
  }
}

// Export a factory instance for convenience
export const receiptParserFactory = new ReceiptParserFactory();