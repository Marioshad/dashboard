import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { FoodItem, InsertFoodItem } from "@shared/schema";
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

    // Call OpenAI Vision API with the receipt image
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
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
  userId: number
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
    purchased: format(today, "yyyy-MM-dd")
  }));
}