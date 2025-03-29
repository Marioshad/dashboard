/**
 * Product name normalization for consistent tracking across different spellings,
 * languages, and store-specific variations.
 */

// Define a normalization rule
export interface NormalizationRule {
  pattern: RegExp | string;
  replacement: string;
  category?: string;
}

// Store-specific normalization rules
export const STORE_SPECIFIC_RULES: Record<string, NormalizationRule[]> = {
  // Lidl-specific rules
  'LIDL': [
    { pattern: /μπαν[άα]ν[εαι]ς/i, replacement: 'Bananas', category: 'Fruits' },
    { pattern: /ΜΠΑΝ[ΆΑ]Ν[ΕΑΙ]Σ/i, replacement: 'Bananas', category: 'Fruits' },
    { pattern: /ΜΠΑΝ\./i, replacement: 'Bananas', category: 'Fruits' },
    { pattern: /μήλα/i, replacement: 'Apples', category: 'Fruits' },
    { pattern: /ΜΗΛΑ/i, replacement: 'Apples', category: 'Fruits' },
    { pattern: /πατ[άα]τ[εαι]ς/i, replacement: 'Potatoes', category: 'Vegetables' },
    { pattern: /ΠΑΤΑΤΕΣ/i, replacement: 'Potatoes', category: 'Vegetables' },
    { pattern: /ντομ[άα]τ[εαι]ς/i, replacement: 'Tomatoes', category: 'Vegetables' },
    { pattern: /ΝΤΟΜΑΤΕΣ/i, replacement: 'Tomatoes', category: 'Vegetables' },
    { pattern: /ΚΑΡΟΤΑ/i, replacement: 'Carrots', category: 'Vegetables' },
    { pattern: /καρ[όο]τα/i, replacement: 'Carrots', category: 'Vegetables' },
    { pattern: /κρεμμύδια/i, replacement: 'Onions', category: 'Vegetables' },
    { pattern: /ΚΡΕΜΜΥΔΙΑ/i, replacement: 'Onions', category: 'Vegetables' },
    { pattern: /αγγούρια/i, replacement: 'Cucumbers', category: 'Vegetables' },
    { pattern: /ΑΓΓΟΥΡΙΑ/i, replacement: 'Cucumbers', category: 'Vegetables' },
    { pattern: /σκόρδο/i, replacement: 'Garlic', category: 'Vegetables' },
    { pattern: /ΣΚΟΡΔΟ/i, replacement: 'Garlic', category: 'Vegetables' },
    { pattern: /πιπεριές/i, replacement: 'Bell Peppers', category: 'Vegetables' },
    { pattern: /ΠΙΠΕΡΙΕΣ/i, replacement: 'Bell Peppers', category: 'Vegetables' },
    { pattern: /μανιτάρια/i, replacement: 'Mushrooms', category: 'Vegetables' },
    { pattern: /ΜΑΝΙΤΑΡΙΑ/i, replacement: 'Mushrooms', category: 'Vegetables' },
    { pattern: /λεμόνια/i, replacement: 'Lemons', category: 'Fruits' },
    { pattern: /ΛΕΜΟΝΙΑ/i, replacement: 'Lemons', category: 'Fruits' },
    { pattern: /πορτοκάλια/i, replacement: 'Oranges', category: 'Fruits' },
    { pattern: /ΠΟΡΤΟΚΑΛΙΑ/i, replacement: 'Oranges', category: 'Fruits' },
    { pattern: /ΨΩΜΙ/i, replacement: 'Bread', category: 'Bakery' },
    { pattern: /ψωμί/i, replacement: 'Bread', category: 'Bakery' },
    { pattern: /ΓΑΛΑ/i, replacement: 'Milk', category: 'Dairy' },
    { pattern: /γάλα/i, replacement: 'Milk', category: 'Dairy' },
    { pattern: /ΤΥΡΙ/i, replacement: 'Cheese', category: 'Dairy' },
    { pattern: /τυρί/i, replacement: 'Cheese', category: 'Dairy' },
    { pattern: /ΓΙΑΟΥΡΤΙ/i, replacement: 'Yogurt', category: 'Dairy' },
    { pattern: /γιαούρτι/i, replacement: 'Yogurt', category: 'Dairy' },
    { pattern: /αυγά/i, replacement: 'Eggs', category: 'Dairy' },
    { pattern: /ΑΥΓΑ/i, replacement: 'Eggs', category: 'Dairy' },
    { pattern: /κοτόπουλο/i, replacement: 'Chicken', category: 'Meat' },
    { pattern: /ΚΟΤΟΠΟΥΛΟ/i, replacement: 'Chicken', category: 'Meat' },
    { pattern: /μοσχάρι/i, replacement: 'Beef', category: 'Meat' },
    { pattern: /ΜΟΣΧΑΡΙ/i, replacement: 'Beef', category: 'Meat' },
    { pattern: /χοιρινό/i, replacement: 'Pork', category: 'Meat' },
    { pattern: /ΧΟΙΡΙΝΟ/i, replacement: 'Pork', category: 'Meat' },
    { pattern: /ψάρι/i, replacement: 'Fish', category: 'Meat' },
    { pattern: /ΨΑΡΙ/i, replacement: 'Fish', category: 'Meat' },
    { pattern: /ρύζι/i, replacement: 'Rice', category: 'Grains' },
    { pattern: /ΡΥΖΙ/i, replacement: 'Rice', category: 'Grains' },
    { pattern: /μακαρόνια/i, replacement: 'Pasta', category: 'Grains' },
    { pattern: /ΜΑΚΑΡΟΝΙΑ/i, replacement: 'Pasta', category: 'Grains' },
    { pattern: /δημητριακά/i, replacement: 'Cereal', category: 'Breakfast' },
    { pattern: /ΔΗΜΗΤΡΙΑΚΑ/i, replacement: 'Cereal', category: 'Breakfast' },
    { pattern: /καφές/i, replacement: 'Coffee', category: 'Beverages' },
    { pattern: /ΚΑΦΕΣ/i, replacement: 'Coffee', category: 'Beverages' },
    { pattern: /τσάι/i, replacement: 'Tea', category: 'Beverages' },
    { pattern: /ΤΣΑΙ/i, replacement: 'Tea', category: 'Beverages' },
    { pattern: /μπύρα/i, replacement: 'Beer', category: 'Beverages' },
    { pattern: /ΜΠΥΡΑ/i, replacement: 'Beer', category: 'Beverages' },
    { pattern: /κρασί/i, replacement: 'Wine', category: 'Beverages' },
    { pattern: /ΚΡΑΣΙ/i, replacement: 'Wine', category: 'Beverages' },
    { pattern: /νερό/i, replacement: 'Water', category: 'Beverages' },
    { pattern: /ΝΕΡΟ/i, replacement: 'Water', category: 'Beverages' },
    { pattern: /χυμός/i, replacement: 'Juice', category: 'Beverages' },
    { pattern: /ΧΥΜΟΣ/i, replacement: 'Juice', category: 'Beverages' },
    { pattern: /σοκολάτα/i, replacement: 'Chocolate', category: 'Snacks' },
    { pattern: /ΣΟΚΟΛΑΤΑ/i, replacement: 'Chocolate', category: 'Snacks' },
    { pattern: /μπισκότα/i, replacement: 'Cookies', category: 'Snacks' },
    { pattern: /ΜΠΙΣΚΟΤΑ/i, replacement: 'Cookies', category: 'Snacks' },
    { pattern: /παγωτό/i, replacement: 'Ice Cream', category: 'Frozen Food' },
    { pattern: /ΠΑΓΩΤΟ/i, replacement: 'Ice Cream', category: 'Frozen Food' },
    { pattern: /σαπούνι/i, replacement: 'Soap', category: 'Personal Care' },
    { pattern: /ΣΑΠΟΥΝΙ/i, replacement: 'Soap', category: 'Personal Care' },
    { pattern: /σαμπουάν/i, replacement: 'Shampoo', category: 'Personal Care' },
    { pattern: /ΣΑΜΠΟΥΑΝ/i, replacement: 'Shampoo', category: 'Personal Care' },
    { pattern: /χαρτί τουαλέτας/i, replacement: 'Toilet Paper', category: 'Cleaning' },
    { pattern: /ΧΑΡΤΙ ΤΟΥΑΛΕΤΑΣ/i, replacement: 'Toilet Paper', category: 'Cleaning' },
    { pattern: /απορρυπαντικό/i, replacement: 'Detergent', category: 'Cleaning' },
    { pattern: /ΑΠΟΡΡΥΠΑΝΤΙΚΟ/i, replacement: 'Detergent', category: 'Cleaning' },
  ],
  // Alphamega-specific rules
  'ALPHAMEGA': [
    { pattern: /μπανάνες/i, replacement: 'Bananas', category: 'Fruits' },
    { pattern: /ΜΠΑΝΑΝΕΣ/i, replacement: 'Bananas', category: 'Fruits' },
    { pattern: /φρέσκο γάλα/i, replacement: 'Fresh Milk', category: 'Dairy' },
    { pattern: /ΦΡΕΣΚΟ ΓΑΛΑ/i, replacement: 'Fresh Milk', category: 'Dairy' },
    { pattern: /ποτήρι νερό/i, replacement: 'Bottled Water', category: 'Beverages' },
    { pattern: /ΠΟΤΗΡΙ ΝΕΡΟ/i, replacement: 'Bottled Water', category: 'Beverages' },
    { pattern: /ΦΡΕΣΚΟ ΨΩΜΙ/i, replacement: 'Fresh Bread', category: 'Bakery' },
    { pattern: /φρέσκο ψωμί/i, replacement: 'Fresh Bread', category: 'Bakery' },
  ],
};

// Default normalization rules applied to all stores
export const DEFAULT_RULES: NormalizationRule[] = [
  // Organic/Bio variations
  { pattern: /^(?:organic|bio|οργανικ[οό][ςσ]?|βιο)(?:\s+)(.+)$/i, replacement: '$1', category: 'Organic' },
  { pattern: /^(.+)(?:\s+)(?:organic|bio|οργανικ[οό][ςσ]?|βιο)$/i, replacement: '$1', category: 'Organic' },
  // Fresh variations
  { pattern: /^(?:fresh|φρέσκ[οα]?[ςσ]?)(?:\s+)(.+)$/i, replacement: '$1' },
  { pattern: /^(.+)(?:\s+)(?:fresh|φρέσκ[οα]?[ςσ]?)$/i, replacement: '$1' },
  // Package size variations (remove g, kg, ml, l indicators)
  { pattern: /(\d+)(?:\s*)(?:g|gr|grams|γρ)(?:\s+)(.+)$/i, replacement: '$2' },
  { pattern: /(\d+)(?:\s*)(?:kg|kgr|kilos|κιλ[οό]|κιλ[αά])(?:\s+)(.+)$/i, replacement: '$2' },
  { pattern: /(\d+)(?:\s*)(?:ml|milliliters|μλ)(?:\s+)(.+)$/i, replacement: '$2' },
  { pattern: /(\d+)(?:\s*)(?:l|lt|liter|λίτρ[αο]|λτ)(?:\s+)(.+)$/i, replacement: '$2' },
  // Remove packaging indicators
  { pattern: /(.+)(?:\s+)(?:pack|package|συσκευασία|πακέτο)/i, replacement: '$1' },
  { pattern: /(?:pack|package|συσκευασία|πακέτο)(?:\s+)(.+)/i, replacement: '$1' },
  // Common category patterns
  { pattern: /(?:μήλα|apples|apple|μήλο)/i, replacement: 'Apples', category: 'Fruits' },
  { pattern: /(?:bananas|banana|μπανάνες|μπανάνα)/i, replacement: 'Bananas', category: 'Fruits' },
  { pattern: /(?:orange|oranges|πορτοκάλια|πορτοκάλι)/i, replacement: 'Oranges', category: 'Fruits' },
  { pattern: /(?:potatoes|potato|πατάτες|πατάτα)/i, replacement: 'Potatoes', category: 'Vegetables' },
  { pattern: /(?:tomatoes|tomato|ντομάτες|ντομάτα)/i, replacement: 'Tomatoes', category: 'Vegetables' },
  { pattern: /(?:carrots|carrot|καρότα|καρότο)/i, replacement: 'Carrots', category: 'Vegetables' },
  { pattern: /(?:milk|γάλα)/i, replacement: 'Milk', category: 'Dairy' },
  { pattern: /(?:yogurt|yoghurt|γιαούρτι)/i, replacement: 'Yogurt', category: 'Dairy' },
  { pattern: /(?:cheese|τυρί)/i, replacement: 'Cheese', category: 'Dairy' },
  { pattern: /(?:beef|μοσχάρι)/i, replacement: 'Beef', category: 'Meat' },
  { pattern: /(?:chicken|κοτόπουλο)/i, replacement: 'Chicken', category: 'Meat' },
  { pattern: /(?:pork|χοιρινό)/i, replacement: 'Pork', category: 'Meat' },
  { pattern: /(?:bread|ψωμί)/i, replacement: 'Bread', category: 'Bakery' },
  { pattern: /(?:water|νερό)/i, replacement: 'Water', category: 'Beverages' },
  { pattern: /(?:juice|χυμός)/i, replacement: 'Juice', category: 'Beverages' },
  { pattern: /(?:cola|κόλα)/i, replacement: 'Cola', category: 'Beverages' },
  { pattern: /(?:cereal|δημητριακά)/i, replacement: 'Cereal', category: 'Breakfast' },
  { pattern: /(?:toilet|paper|χαρτί)/i, replacement: 'Toilet Paper', category: 'Cleaning' },
  { pattern: /(?:soap|σαπούνι)/i, replacement: 'Soap', category: 'Personal Care' },
];

// Product modifiers that don't change the core product identity but are important for description
export const MODIFIER_PATTERNS = [
  /(?:organic|bio|οργανικ[οό][ςσ]?|βιο)/i,
  /(?:fresh|φρέσκ[οα]?[ςσ]?)/i,
  /(?:premium|gourmet|πολυτελείας|γκουρμέ)/i,
  /(?:whole grain|ολικής|ολικήs άλεσης)/i,
  /(?:low fat|light|χαμηλά λιπαρά|λάιτ)/i,
  /(?:gluten free|χωρίς γλουτένη)/i,
  /(?:sugar free|χωρίς ζάχαρη)/i,
  /(?:lactose free|χωρίς λακτόζη)/i,
  /(?:vegan|βίγκαν)/i,
  /(?:vegetarian|χορτοφαγικό)/i,
];

/**
 * Preprocesses an item name by removing punctuation, extra spaces, etc.
 */
export function preprocessItemName(rawName: string): string {
  if (!rawName) return '';
  
  // Convert to uppercase for consistent matching
  let processed = rawName.trim();
  
  // Replace specific abbreviations
  processed = processed.replace(/\bORG\b/gi, 'ORGANIC');
  processed = processed.replace(/\bBIO\b/gi, 'ORGANIC');
  
  // Remove common noise patterns
  processed = processed.replace(/\d+\s*[xX]\s*\d+\s*(?:pcs|pieces|τεμ)/gi, '');
  processed = processed.replace(/\d+\s*(?:pcs|pieces|τεμ)/gi, '');
  
  // Remove common packaging terms that don't identify the product
  processed = processed.replace(/(?:pack of|συσκευασία)\s*\d+/gi, '');
  
  // Remove price indicators
  processed = processed.replace(/\d+[.,]\d+\s*(?:€|EUR)/gi, '');
  
  // Remove parenthetical information as it's usually contextual
  processed = processed.replace(/\([^)]*\)/g, '');
  
  // Collapse multiple spaces
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
}

/**
 * Checks if a string contains Greek characters
 */
export function containsGreekCharacters(text: string): boolean {
  return /[\u0370-\u03FF]/.test(text);
}

/**
 * Transliterates Greek text to Latin characters
 */
export function transliterateGreekToLatin(text: string): string {
  if (!text) return '';
  
  const greekToLatinMap: Record<string, string> = {
    'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'i', 'θ': 'th',
    'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
    'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o',
    'Α': 'A', 'Β': 'B', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'I', 'Θ': 'TH',
    'Ι': 'I', 'Κ': 'K', 'Λ': 'L', 'Μ': 'M', 'Ν': 'N', 'Ξ': 'X', 'Ο': 'O', 'Π': 'P',
    'Ρ': 'R', 'Σ': 'S', 'Τ': 'T', 'Υ': 'Y', 'Φ': 'F', 'Χ': 'CH', 'Ψ': 'PS', 'Ω': 'O',
    'ά': 'a', 'έ': 'e', 'ί': 'i', 'ή': 'i', 'ό': 'o', 'ύ': 'y', 'ώ': 'o', 'Ά': 'A',
    'Έ': 'E', 'Ί': 'I', 'Ή': 'I', 'Ό': 'O', 'Ύ': 'Y', 'Ώ': 'O', 'ϊ': 'i', 'ϋ': 'y',
    'ΐ': 'i', 'ΰ': 'y', 'Ϊ': 'I', 'Ϋ': 'Y'
  };
  
  return text.split('').map(char => greekToLatinMap[char] || char).join('');
}

/**
 * Apply store-specific normalization rules to an item name
 */
function applyStoreRules(itemName: string, storeName?: string): {
  normalizedName: string;
  category?: string;
  description?: string;
} {
  if (!itemName) {
    return { normalizedName: '', category: undefined, description: undefined };
  }
  
  // If storeName is provided and we have specific rules for it, apply them
  if (storeName && STORE_SPECIFIC_RULES[storeName]) {
    const rules = STORE_SPECIFIC_RULES[storeName];
    
    for (const rule of rules) {
      if (typeof rule.pattern === 'string') {
        if (itemName.includes(rule.pattern)) {
          return {
            normalizedName: rule.replacement,
            category: rule.category,
            description: itemName !== rule.replacement ? itemName : undefined
          };
        }
      } else {
        // RegExp pattern
        if (rule.pattern.test(itemName)) {
          const normalizedName = itemName.replace(rule.pattern, rule.replacement);
          return {
            normalizedName,
            category: rule.category,
            description: itemName !== normalizedName ? itemName : undefined
          };
        }
      }
    }
  }
  
  // No store-specific match found, return the original
  return { normalizedName: itemName, category: undefined, description: undefined };
}

/**
 * Apply default normalization rules to an item name
 */
function applyDefaultRules(itemName: string): {
  normalizedName: string;
  category?: string;
  description?: string;
} {
  if (!itemName) {
    return { normalizedName: '', category: undefined, description: undefined };
  }
  
  for (const rule of DEFAULT_RULES) {
    if (typeof rule.pattern === 'string') {
      if (itemName.includes(rule.pattern)) {
        return {
          normalizedName: rule.replacement,
          category: rule.category,
          description: itemName !== rule.replacement ? itemName : undefined
        };
      }
    } else {
      // RegExp pattern
      if (rule.pattern.test(itemName)) {
        const normalizedName = itemName.replace(rule.pattern, rule.replacement);
        return {
          normalizedName,
          category: rule.category,
          description: itemName !== normalizedName ? itemName : undefined
        };
      }
    }
  }
  
  // No default match found, return the original
  return { normalizedName: itemName, category: undefined, description: undefined };
}

/**
 * Extract modifiers from an item name (e.g., "organic", "fresh", etc.)
 */
export function extractModifiers(itemName: string): {
  modifiers: string[];
  cleanName: string;
} {
  const modifiers: string[] = [];
  let cleanName = itemName;
  
  for (const pattern of MODIFIER_PATTERNS) {
    const match = cleanName.match(pattern);
    if (match) {
      modifiers.push(match[0]);
      cleanName = cleanName.replace(pattern, '').trim();
    }
  }
  
  // Clean up multiple spaces
  cleanName = cleanName.replace(/\s+/g, ' ').trim();
  
  return { modifiers, cleanName };
}

/**
 * Normalize an item name by applying various rules and strategies.
 */
export function normalizeItemName(
  originalName: string,
  storeName?: string
): {
  normalizedName: string;
  originalName: string;
  category?: string;
  description?: string;
  modifiers: string[];
  confidence: number;
} {
  if (!originalName) {
    return {
      normalizedName: '',
      originalName: '',
      category: undefined,
      description: undefined,
      modifiers: [],
      confidence: 0
    };
  }
  
  // Step 1: Preprocess the name
  const preprocessed = preprocessItemName(originalName);
  
  // Step 2: Extract modifiers
  const { modifiers, cleanName } = extractModifiers(preprocessed);
  
  // Step 3: Apply store-specific rules if applicable
  const storeResult = applyStoreRules(cleanName, storeName);
  
  // Step 4: If no store-specific match, apply default rules
  const normalizeResult = storeResult.normalizedName !== cleanName
    ? storeResult
    : applyDefaultRules(cleanName);
  
  // Step 5: Handle Greek text if present
  let normalizedName = normalizeResult.normalizedName;
  if (containsGreekCharacters(normalizedName)) {
    normalizedName = transliterateGreekToLatin(normalizedName);
  }
  
  // Step 6: Create a description incorporating original name and modifiers
  const description = createItemDescription({
    normalizedName,
    originalName,
    modifiers
  });
  
  // Step 7: Calculate a confidence score for the normalization
  // This is a simple heuristic but can be made more sophisticated
  const confidence = calculateConfidence(originalName, normalizedName, !!storeResult.category);
  
  return {
    normalizedName,
    originalName,
    category: normalizeResult.category,
    description,
    modifiers,
    confidence
  };
}

/**
 * Create a standardized description incorporating modifiers and original name if different
 */
export function createItemDescription(normalizedResult: {
  normalizedName: string;
  originalName: string;
  modifiers: string[];
}): string {
  const { normalizedName, originalName, modifiers } = normalizedResult;
  
  // Start with modifiers
  const modifierText = modifiers.length > 0 ? modifiers.join(', ') + ' ' : '';
  
  // Add normalized name
  const description = modifierText + normalizedName;
  
  // Add original name in parentheses if significantly different
  if (normalizedName !== originalName && 
      normalizedName.toLowerCase() !== originalName.toLowerCase() &&
      !originalName.toLowerCase().includes(normalizedName.toLowerCase())) {
    return `${description} (${originalName})`;
  }
  
  return description;
}

/**
 * Calculate a confidence score for the normalization
 */
function calculateConfidence(
  originalName: string, 
  normalizedName: string, 
  hasCategory: boolean
): number {
  // Start with a base confidence
  let confidence = 0.5;
  
  // Increase confidence if we were able to categorize the item
  if (hasCategory) confidence += 0.3;
  
  // Increase confidence if normalized name is not vastly different from original
  // (This is a simple heuristic - can be made more sophisticated with string similarity algorithms)
  const originalWords = originalName.toLowerCase().split(/\s+/);
  const normalizedWords = normalizedName.toLowerCase().split(/\s+/);
  
  // Check how many words are common between the two
  const commonWords = originalWords.filter(word => 
    normalizedWords.some(nWord => nWord.includes(word) || word.includes(nWord))
  );
  
  const wordSimilarityScore = commonWords.length / Math.max(originalWords.length, 1);
  confidence += wordSimilarityScore * 0.2;
  
  // Cap confidence at 0.99
  return Math.min(confidence, 0.99);
}