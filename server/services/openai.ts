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
  expiryDate: string;
}

export interface ExtractedStore {
  name: string;
  location: string;
  phone?: string;
  fax?: string;
  vatNumber?: string;
  taxId?: string;
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
          content: `You are a specialized receipt analyzer. Extract all food items from the receipt image. 
          For each item, identify the name, quantity, unit, and price in cents. 
          Format your response strictly as a JSON array with each food item having: name, quantity (numeric), unit (pieces, grams, oz, etc.), price (in cents, numeric).
          Use 'pieces' as the default unit if not specified. Estimate expiry dates based on typical shelf life.
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
        const defaultExpiryDate = format(addDays(today, 7), "yyyy-MM-dd"); // Default to a week
        
        // Ensure proper types and defaults
        return {
          name: String(item.name || "Unknown Item").trim(),
          quantity: Number(item.quantity) || 1,
          unit: String(item.unit || "pieces").toLowerCase(),
          price: item.price !== undefined ? Number(item.price) : null,
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
 * @returns Array of food items ready for database insertion
 */
export function convertToFoodItems(
  items: ExtractedItem[],
  locationId: number,
  userId: number,
  storeId?: number
): Partial<InsertFoodItem>[] {
  const today = new Date();
  
  return items.map(item => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    price: item.price !== null ? item.price : undefined,
    expiryDate: item.expiryDate,
    locationId,
    userId,
    storeId,
    purchased: format(today, "yyyy-MM-dd")
  }));
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