/**
 * Specialized parser for handling weight-based item lines in receipts
 */

export interface WeightBasedItem {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
  currency: string;
  lineNumbers?: number[];
}

/**
 * Detect if a text likely represents a weight-based pricing line
 */
export function isWeightBasedLine(line: string): boolean {
  // Patterns to detect weight-based pricing
  const patterns = [
    // Pattern: 1.23 kg X 4.99 €/kg = 6.14 €
    /(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ)\s*[xXχΧ]\s*(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)(?:\/(?:kg|g|κιλό|κιλά|γρ))?\s*=\s*(\d+[.,]\d+)/i,
    
    // Pattern: 1.23 kg @ 4.99 €/kg
    /(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ)\s*(?:@|at)\s*(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ)/i,
    
    // Pattern with just €/kg indicator
    /(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ)/i,
    
    // Pattern with quantity, unit, price per unit and total
    /(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ).*?(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ).*?(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)/i,
  ];
  
  return patterns.some(pattern => pattern.test(line));
}

/**
 * Detect if a text might be an item name preceding a weight-based line
 */
export function isPotentialItemNameLine(line: string): boolean {
  // This is a heuristic - names typically don't contain pricing info
  // and are shorter than the detailed weight-based pricing lines
  if (!line.trim()) return false;
  
  // Typically item names don't have detailed pricing
  if (/(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ)/.test(line)) return false;
  
  // Typically item names are shorter
  if (line.length > 50) return false;
  
  // Check if line starts with an item code or numbers which often precede names
  if (/^(?:\d{3,}|\w{2,}\d{2,})\s+[A-Za-zΑ-Ωα-ω]/.test(line)) return true;
  
  // Check if line consists of alphabetic characters with no numbers or currency
  if (/^[A-Za-zΑ-Ωα-ω\s.,'-]+$/.test(line) && line.length > 2) return true;
  
  return false;
}

/**
 * Standardize the weight unit (convert variations to standard form)
 */
export function standardizeUnit(rawUnit: string): string {
  // Convert to lowercase for easier matching
  const unit = rawUnit.toLowerCase();
  
  // Kilograms
  if (/^(?:kg|kgr|kilo|kilos|κιλό|κιλά|κιλο|κιλα)$/.test(unit)) {
    return 'kg';
  }
  
  // Grams
  if (/^(?:g|gr|gram|grams|γρ|γραμ|γραμμάρια|γραμμαρια)$/.test(unit)) {
    return 'g';
  }
  
  // Liters
  if (/^(?:l|lt|ltr|liter|liters|λίτρο|λίτρα|λιτρο|λιτρα)$/.test(unit)) {
    return 'l';
  }
  
  // Milliliters
  if (/^(?:ml|milliliter|milliliters|μλ|μιλιλίτρ)$/.test(unit)) {
    return 'ml';
  }
  
  // Pieces
  if (/^(?:pcs|pieces|piece|τεμ|τεμάχια|τεμαχια|τεμάχιο|τεμαχιο)$/.test(unit)) {
    return 'pieces';
  }
  
  // Default: return the original
  return unit || 'pieces';
}

/**
 * Standardize the currency (convert symbols to standard codes)
 */
export function standardizeCurrency(rawCurrency: string): string {
  // Convert to uppercase for easier matching
  const currency = (rawCurrency || '').toUpperCase().trim();
  
  // Euro
  if (/^(?:€|EUR|EURO|ΕΥΡΩ)$/.test(currency)) {
    return 'EUR';
  }
  
  // US Dollar
  if (/^(?:\$|USD)$/.test(currency)) {
    return 'USD';
  }
  
  // British Pound
  if (/^(?:£|GBP)$/.test(currency)) {
    return 'GBP';
  }
  
  // Default: return the original or EUR if none provided
  return currency || 'EUR';
}

/**
 * Parse a single line that contains weight-based pricing information
 */
export function parseWeightBasedLine(line: string): Partial<WeightBasedItem> | null {
  if (!line || !isWeightBasedLine(line)) return null;
  
  // Various patterns for weight-based pricing formats
  const patterns = [
    // Pattern: 1.23 kg X 4.99 €/kg = 6.14 €
    {
      regex: /(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ)\s*[xXχΧ]\s*(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)(?:\/(?:kg|g|κιλό|κιλά|γρ))?\s*=\s*(\d+[.,]\d+)/i,
      extract: (matches: RegExpMatchArray) => {
        const quantity = parseFloat(matches[1].replace(',', '.'));
        const pricePerUnit = parseFloat(matches[2].replace(',', '.'));
        const totalPrice = parseFloat(matches[3].replace(',', '.'));
        const unit = matches[0].match(/(?:kg|g|κιλό|κιλά|γρ)/i)?.[0] || 'kg';
        
        return {
          quantity,
          unit: standardizeUnit(unit),
          pricePerUnit,
          totalPrice,
          currency: 'EUR',
        };
      }
    },
    
    // Pattern: 1.23 kg @ 4.99 €/kg
    {
      regex: /(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ)\s*(?:@|at)\s*(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ)/i,
      extract: (matches: RegExpMatchArray) => {
        const quantity = parseFloat(matches[1].replace(',', '.'));
        const pricePerUnit = parseFloat(matches[2].replace(',', '.'));
        const totalPrice = quantity * pricePerUnit;
        const unit = matches[0].match(/(?:kg|g|κιλό|κιλά|γρ)/i)?.[0] || 'kg';
        
        return {
          quantity,
          unit: standardizeUnit(unit),
          pricePerUnit,
          totalPrice,
          currency: 'EUR',
        };
      }
    },
    
    // Pattern with just €/kg indicator and two numeric values on the line
    {
      regex: /(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ).*?(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ)/i,
      extract: (matches: RegExpMatchArray) => {
        const quantity = parseFloat(matches[1].replace(',', '.'));
        const pricePerUnit = parseFloat(matches[2].replace(',', '.'));
        const totalPrice = Math.round(quantity * pricePerUnit * 100) / 100; // Round to 2 decimal places
        const unit = matches[0].match(/(?:kg|g|κιλό|κιλά|γρ)/i)?.[0] || 'kg';
        
        return {
          quantity,
          unit: standardizeUnit(unit),
          pricePerUnit,
          totalPrice,
          currency: 'EUR',
        };
      }
    },
    
    // Pattern with quantity, unit, price per unit and total all on one line
    {
      regex: /(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ).*?(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ).*?(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)/i,
      extract: (matches: RegExpMatchArray) => {
        const quantity = parseFloat(matches[1].replace(',', '.'));
        const pricePerUnit = parseFloat(matches[2].replace(',', '.'));
        const totalPrice = parseFloat(matches[3].replace(',', '.'));
        const unit = matches[0].match(/(?:kg|g|κιλό|κιλά|γρ)/i)?.[0] || 'kg';
        const currency = matches[0].match(/(?:€|EUR|ευρώ)/i)?.[0] || '€';
        
        return {
          quantity,
          unit: standardizeUnit(unit),
          pricePerUnit,
          totalPrice,
          currency: standardizeCurrency(currency),
        };
      }
    }
  ];
  
  // Try each pattern
  for (const { regex, extract } of patterns) {
    const matches = line.match(regex);
    if (matches) {
      try {
        return extract(matches);
      } catch (error) {
        console.error('Error parsing weight-based line:', error);
      }
    }
  }
  
  return null;
}

/**
 * Parse a group of lines to extract a weight-based item with its name
 */
export function parseWeightBasedItem(lines: string[]): WeightBasedItem | null {
  if (!lines || !lines.length) return null;
  
  // Try to find the weight-based pricing line
  let pricingLine: string | undefined;
  let pricingLineIndex: number = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (isWeightBasedLine(lines[i])) {
      pricingLine = lines[i];
      pricingLineIndex = i;
      break;
    }
  }
  
  if (!pricingLine || pricingLineIndex === -1) return null;
  
  // Parse the pricing information
  const pricingInfo = parseWeightBasedLine(pricingLine);
  if (!pricingInfo) return null;
  
  // Now look for a potential item name
  // First check the previous line if available
  let itemName = "";
  let lineNumbers: number[] = [pricingLineIndex];
  
  if (pricingLineIndex > 0 && isPotentialItemNameLine(lines[pricingLineIndex - 1])) {
    itemName = lines[pricingLineIndex - 1].trim();
    lineNumbers.unshift(pricingLineIndex - 1);
  } else {
    // If no name found in previous line, try to extract name from the pricing line itself
    // This is often the case when the item name and pricing info are on the same line
    
    // Remove pricing information to extract the item name
    let candidateName = pricingLine
      .replace(/(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ)\s*[xXχΧ]\s*(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)(?:\/(?:kg|g|κιλό|κιλά|γρ))?\s*=\s*(\d+[.,]\d+)/gi, '')
      .replace(/(\d+[.,]\d+)\s*(?:kg|g|κιλό|κιλά|γρ)\s*(?:@|at)\s*(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ)/gi, '')
      .replace(/(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)\/(?:kg|g|κιλό|κιλά|γρ)/gi, '')
      .replace(/(\d+[.,]\d+)\s*(?:€|EUR|ευρώ)/gi, '')
      .trim();
    
    // Check if there's any text left that could be the name
    if (candidateName && /[A-Za-zΑ-Ωα-ω]/.test(candidateName)) {
      itemName = candidateName;
    } else {
      // If still no name, look ahead to see if the next line could be a name
      // (some receipts list name after the pricing)
      if (pricingLineIndex < lines.length - 1 && isPotentialItemNameLine(lines[pricingLineIndex + 1])) {
        itemName = lines[pricingLineIndex + 1].trim();
        lineNumbers.push(pricingLineIndex + 1);
      } else {
        // Last resort: use a generic name based on unit
        itemName = pricingInfo.unit === 'kg' ? 'Weighted Item' : 'Item';
      }
    }
  }
  
  // Make sure itemName is always a string
  const finalName = typeof itemName === 'string' ? itemName : 'Weighted Item';
  
  return {
    name: finalName,
    quantity: pricingInfo.quantity || 0,
    unit: pricingInfo.unit || 'kg',
    pricePerUnit: pricingInfo.pricePerUnit || 0,
    totalPrice: pricingInfo.totalPrice || 0,
    currency: pricingInfo.currency || 'EUR',
    lineNumbers
  };
}

/**
 * Group related lines and parse weight-based items from a full receipt text
 */
export function extractWeightBasedItems(receiptLines: string[]): WeightBasedItem[] {
  if (!receiptLines || !receiptLines.length) return [];
  
  const items: WeightBasedItem[] = [];
  const processedLineIndices = new Set<number>();
  
  // First, find all potential weight-based pricing lines
  const pricingLineIndices: number[] = [];
  
  for (let i = 0; i < receiptLines.length; i++) {
    if (isWeightBasedLine(receiptLines[i])) {
      pricingLineIndices.push(i);
    }
  }
  
  // For each pricing line, try to find the associated item name
  for (const pricingIndex of pricingLineIndices) {
    // Skip if already processed
    if (processedLineIndices.has(pricingIndex)) continue;
    
    // Check if previous line could be an item name
    let startIndex = pricingIndex;
    let endIndex = pricingIndex;
    
    if (pricingIndex > 0 && isPotentialItemNameLine(receiptLines[pricingIndex - 1])) {
      startIndex = pricingIndex - 1;
    }
    
    // Check if next line could be relevant
    if (pricingIndex < receiptLines.length - 1 && 
        (isPotentialItemNameLine(receiptLines[pricingIndex + 1]) || 
         isWeightBasedLine(receiptLines[pricingIndex + 1]))) {
      endIndex = pricingIndex + 1;
    }
    
    // Extract the block of relevant lines
    const relevantLines = receiptLines.slice(startIndex, endIndex + 1);
    
    // Parse the item
    const item = parseWeightBasedItem(relevantLines);
    
    if (item) {
      // Update line numbers to be global indices
      item.lineNumbers = item.lineNumbers?.map(i => i + startIndex);
      
      // Mark lines as processed
      item.lineNumbers?.forEach(i => processedLineIndices.add(i));
      
      items.push(item);
    }
  }
  
  return items;
}