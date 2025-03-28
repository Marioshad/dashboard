import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { FoodItem, InsertFoodItem, InsertStore } from "@shared/schema";
import { format, addDays } from "date-fns";

// Initialize OpenAI with API key
if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not provided. Receipt OCR features will be disabled.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedItem {
  name: string;
  quantity: number;
  unit: string;
  price: number | null;
  pricePerUnit?: number | null; // Price per unit (kg, liter, etc.)
  isWeightBased?: boolean; // Indicates if this is a weight-based item
  expiryDate: string;
  purchaseDate?: string; // Add optional purchase date field
}

export interface ExtractedStore {
  name: string;
  location: string;
  phone?: string;
  fax?: string;
  vatNumber?: string;
  taxId?: string;
}

export interface ReceiptDetails {
  receiptNumber?: string;
  date?: string;
  time?: string;
  cashier?: string;
  paymentMethod?: string;
  totalAmount?: number;
  vatBreakdown?: {
    rate: number;
    amount: number;
  }[];
  language?: string; // Detected language of the receipt
}

/**
 * Process a receipt image using OpenAI's Vision API to extract food items
 * @param filePath Path to the uploaded receipt image
 * @returns Array of extracted food items
 */
export async function processReceiptImage(filePath: string): Promise<ExtractedItem[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const absolutePath = path.resolve(filePath);
    const fileBuffer = fs.readFileSync(absolutePath);
    const base64Image = fileBuffer.toString("base64");

    // Call OpenAI API with the receipt image
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a specialized receipt analyzer. Extract all food items from the receipt image with detailed information.
          For each item, identify the following:
          - name: The product name
          - quantity: The numeric quantity (can be decimal for weight-based items like 0.450 kg of apples)
          - unit: The unit of measurement (pieces, grams, kg, oz, etc.)
          - price: The total price as shown on the receipt (numeric, e.g., 2.99)
          - pricePerUnit: If the item is sold by weight, include the price per unit (e.g., 1.99 per kg, g, lb, etc.)
          - isWeightBased: true if the item is sold by weight (kg, g, lb), false if sold by count
          - expiryDate: Estimated expiry date based on TODAY'S DATE (${format(new Date(), "yyyy-MM-dd")}) and typical shelf life of the product. Use YYYY-MM-DD format. 
            - Fresh produce like leafy greens: 5-7 days from today
            - Fruits like apples, oranges: 1-2 weeks from today
            - Dairy: 1-2 weeks from today
            - Meat/Fish: 3-5 days from today if fresh, 3-6 months if frozen
            - Bread: 4-7 days from today
            - Dry goods (pasta, rice): 1 year from today
            - Frozen goods: 3 months from today

          For weight-based items (fruits, vegetables, meat):
          - Include both the total price and price per unit
          - Make sure to properly handle decimal quantities (e.g., 0.450 kg)
          - Calculate the actual total price (quantity * pricePerUnit) if needed
          Use 'pieces' as the default unit if not specified.
          Format your response strictly as a JSON array.
          Response should be valid JSON array only, no explanations or text.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all food items from this receipt." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      temperature: 0,
    });

    // Extract and parse the JSON response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Try to extract JSON array from the response
    let jsonStr = content;
    // If response has markdown code blocks, extract the JSON part
    if (content.includes("```")) {
      jsonStr = content.split("```json")[1]?.split("```")[0] || 
               content.split("```")[1]?.split("```")[0] || content;
    }
    
    // Clean up any explanatory text before or after the JSON array
    jsonStr = jsonStr.trim();
    if (jsonStr.startsWith("[") && jsonStr.endsWith("]")) {
      const extractedItems = JSON.parse(jsonStr) as Array<any>;
      
      // Map and validate the extracted items
      const processedItems: ExtractedItem[] = extractedItems.map(item => {
        const today = new Date();
        
        // Set default expiry based on food category
        let defaultExpiryDays = 7; // Default to a week
        const itemNameLower = String(item.name || "").toLowerCase();
        
        // Determine default expiry based on food type
        if (itemNameLower.includes("milk") || itemNameLower.includes("yogurt") || itemNameLower.includes("cheese") || 
            itemNameLower.includes("butter") || itemNameLower.includes("cream")) {
          // Dairy products
          defaultExpiryDays = 10;
        } else if (itemNameLower.includes("meat") || itemNameLower.includes("chicken") || 
                   itemNameLower.includes("fish") || itemNameLower.includes("beef") || 
                   itemNameLower.includes("pork") || itemNameLower.includes("lamb")) {
          // Meat products
          defaultExpiryDays = 4;
        } else if (itemNameLower.includes("bread") || itemNameLower.includes("bagel") || 
                   itemNameLower.includes("bun") || itemNameLower.includes("roll")) {
          // Bread products
          defaultExpiryDays = 5;
        } else if (itemNameLower.includes("apple") || itemNameLower.includes("orange") || 
                   itemNameLower.includes("banana") || itemNameLower.includes("fruit")) {
          // Fruits
          defaultExpiryDays = 10;
        } else if (itemNameLower.includes("vegetable") || itemNameLower.includes("lettuce") || 
                   itemNameLower.includes("spinach") || itemNameLower.includes("kale") || 
                   itemNameLower.includes("salad")) {
          // Leafy vegetables
          defaultExpiryDays = 5;
        } else if (itemNameLower.includes("frozen")) {
          // Frozen foods
          defaultExpiryDays = 90;
        } else if (itemNameLower.includes("pasta") || itemNameLower.includes("rice") || 
                   itemNameLower.includes("cereal") || itemNameLower.includes("can")) {
          // Dry goods
          defaultExpiryDays = 365;
        }
        
        const defaultExpiryDate = format(addDays(today, defaultExpiryDays), "yyyy-MM-dd");
        
        // Check if the item is weight-based by examining the unit
        const weightUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces'];
        const unit = String(item.unit || "pieces").toLowerCase();
        const isWeightBased = item.isWeightBased === true || weightUnits.some(wu => unit.includes(wu));
        
        // Ensure proper types and defaults
        return {
          name: String(item.name || "Unknown Item").trim(),
          quantity: Number(item.quantity) || 1,
          unit: unit,
          price: item.price !== undefined ? Number(item.price) : null,
          pricePerUnit: isWeightBased && item.pricePerUnit ? Number(item.pricePerUnit) : null,
          isWeightBased: isWeightBased,
          expiryDate: item.expiryDate || defaultExpiryDate
        };
      });
      
      return processedItems;
    }
    
    throw new Error("Could not parse valid JSON from OpenAI response");
  } catch (error: any) {
    console.error("Error processing receipt with OpenAI:", error);
    throw new Error(`Receipt processing failed: ${error.message}`);
  }
}

/**
 * Convert extracted items to food items with appropriate defaults for database insertion
 * @param items Extracted items from receipt
 * @param locationId Storage location ID
 * @param userId User ID
 * @param storeId Optional store ID
 * @returns Array of food items ready for database insertion
 */
export function convertToFoodItems(
  items: ExtractedItem[],
  locationId: number,
  userId: number,
  storeId?: number
): Partial<InsertFoodItem>[] {
  const today = new Date();
  
  return items.map(item => {
    // Use purchase date from receipt if available, otherwise use today's date
    const purchaseDate = (item as any).purchaseDate || format(today, "yyyy-MM-dd");
    
    // Determine if the item is weight-based (by examining unit or other indicators)
    const isWeightBased = 
      item.isWeightBased || 
      ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces'].includes(item.unit.toLowerCase());
    
    return {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price !== null ? item.price : undefined,
      pricePerUnit: item.pricePerUnit || undefined,
      isWeightBased: isWeightBased,
      expiryDate: item.expiryDate,
      locationId,
      userId,
      storeId,
      purchased: purchaseDate
    };
  });
}

/**
 * Extract store information from a receipt image using OpenAI's Vision API
 * @param filePath Path to the uploaded receipt image
 * @returns Store information extracted from the receipt
 */
export async function extractStoreFromReceipt(filePath: string): Promise<ExtractedStore> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const absolutePath = path.resolve(filePath);
    const fileBuffer = fs.readFileSync(absolutePath);
    const base64Image = fileBuffer.toString("base64");

    // Call OpenAI API with the receipt image
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a specialized receipt analyzer. Extract the store information from the receipt image.
          Look for the store name, location/address, phone number, fax number, VAT number, and tax ID.
          Format your response as a JSON object with the following structure:
          {
            "name": "Store Name",
            "location": "Store Address or Location",
            "phone": "Phone Number if available",
            "fax": "Fax Number if available",
            "vatNumber": "VAT Registration Number if available",
            "taxId": "Tax ID if available"
          }
          The name and location fields are required, others are optional.
          Response should be valid JSON only, no explanations or text.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the store information from this receipt." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0,
    });

    // Extract and parse the JSON response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Try to extract JSON from the response
    let jsonStr = content;
    // If response has markdown code blocks, extract the JSON part
    if (content.includes("```")) {
      jsonStr = content.split("```json")[1]?.split("```")[0] || 
               content.split("```")[1]?.split("```")[0] || content;
    }
    
    // Clean up any explanatory text before or after the JSON
    jsonStr = jsonStr.trim();
    
    // Parse the JSON response
    try {
      const extractedStore = JSON.parse(jsonStr) as ExtractedStore;
      
      // Ensure required fields are present and valid
      if (!extractedStore.name || typeof extractedStore.name !== 'string') {
        extractedStore.name = "Unknown Store";
      }
      
      if (!extractedStore.location || typeof extractedStore.location !== 'string') {
        extractedStore.location = "Unknown Location";
      }
      
      return {
        name: extractedStore.name.trim(),
        location: extractedStore.location.trim(),
        phone: extractedStore.phone?.trim(),
        fax: extractedStore.fax?.trim(),
        vatNumber: extractedStore.vatNumber?.trim(),
        taxId: extractedStore.taxId?.trim()
      };
    } catch (error) {
      console.error("Failed to parse store information:", error);
      // Return default store info if parsing fails
      return {
        name: "Unknown Store",
        location: "Unknown Location"
      };
    }
  } catch (error: any) {
    console.error("Error extracting store information with OpenAI:", error);
    // Return default store info if API call fails
    return {
      name: "Unknown Store",
      location: "Unknown Location"
    };
  }
}

/**
 * Extract receipt details from a receipt image using OpenAI's Vision API
 * @param filePath Path to the uploaded receipt image
 * @returns Receipt details extracted from the receipt
 */
export async function extractReceiptDetails(filePath: string): Promise<ReceiptDetails> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const absolutePath = path.resolve(filePath);
    const fileBuffer = fs.readFileSync(absolutePath);
    const base64Image = fileBuffer.toString("base64");

    // Call OpenAI API with the receipt image
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a specialized receipt analyzer. Extract detailed transaction information from the receipt.
          Look for receipt number, transaction date, transaction time, cashier name, payment method, and total amount.
          Also extract VAT breakdown information if available.
          Format your response as a JSON object with the following structure:
          {
            "receiptNumber": "Receipt or transaction ID",
            "date": "Transaction date in YYYY-MM-DD format",
            "time": "Transaction time in HH:MM:SS format",
            "cashier": "Name of the cashier if available",
            "paymentMethod": "Method of payment (CASH, VISA, MASTERCARD, etc.)",
            "totalAmount": Total amount as shown on the receipt (numeric, e.g., 24.99),
            "vatBreakdown": [
              { "rate": VAT rate as a number (e.g., 5 for 5%), "amount": amount as shown on receipt }
            ],
            "language": "The language of the receipt (e.g., English, French, German, etc.)"
          }
          All fields are optional but provide as many as you can identify.
          For the language field, detect what language the receipt text is in.
          Response should be valid JSON only, no explanations or text.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the transaction details from this receipt." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0,
    });

    // Extract and parse the JSON response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Try to extract JSON from the response
    let jsonStr = content;
    // If response has markdown code blocks, extract the JSON part
    if (content.includes("```")) {
      jsonStr = content.split("```json")[1]?.split("```")[0] || 
               content.split("```")[1]?.split("```")[0] || content;
    }
    
    // Clean up any explanatory text before or after the JSON
    jsonStr = jsonStr.trim();
    
    // Parse the JSON response
    try {
      const receiptDetails = JSON.parse(jsonStr) as ReceiptDetails;
      
      // Format date if present but not in YYYY-MM-DD format
      if (receiptDetails.date && !receiptDetails.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        try {
          // Try to parse the date and convert to YYYY-MM-DD
          const dateParts = receiptDetails.date.split(/[\/.-]/);
          // Handle various date formats (DD/MM/YYYY, MM/DD/YYYY, etc.)
          if (dateParts.length === 3) {
            // If the year is 2 digits, assume it's 20XX
            let year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
            // Check if the first part is likely a day (1-31) and second part is likely a month (1-12)
            const isFirstPartDay = parseInt(dateParts[0]) > 12 && parseInt(dateParts[0]) <= 31;
            
            if (isFirstPartDay) {
              // Format is DD/MM/YYYY
              const day = dateParts[0].padStart(2, '0');
              const month = dateParts[1].padStart(2, '0');
              receiptDetails.date = `${year}-${month}-${day}`;
            } else {
              // Assume format is MM/DD/YYYY
              const month = dateParts[0].padStart(2, '0');
              const day = dateParts[1].padStart(2, '0');
              receiptDetails.date = `${year}-${month}-${day}`;
            }
          }
        } catch (error) {
          console.error("Error formatting date:", error);
          // Keep the original date string if formatting fails
        }
      }
      
      // Default language to English if not detected
      if (!receiptDetails.language) {
        receiptDetails.language = "English";
      }
      
      return receiptDetails;
    } catch (error) {
      console.error("Failed to parse receipt details:", error);
      // Return empty details if parsing fails
      return {};
    }
  } catch (error: any) {
    console.error("Error extracting receipt details with OpenAI:", error);
    // Return empty details if API call fails
    return {};
  }
}

/**
 * Convert extracted store information to a store object for database insertion
 * @param store Extracted store information
 * @param userId User ID
 * @returns Store object ready for database insertion
 */
export function convertToStore(
  store: ExtractedStore,
  userId: number
): InsertStore & { userId: number } {
  return {
    name: store.name,
    location: store.location,
    phone: store.phone || undefined,
    fax: store.fax || undefined,
    vatNumber: store.vatNumber || undefined,
    taxId: store.taxId || undefined,
    userId
  };
}