import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Term, TermCategory } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helpers ---

// Sanitize JSON string from Markdown code blocks
const cleanJson = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- Core Functions ---

/**
 * 1. DEEP SCAN: Extracts terms from a large chunk of text.
 * We use Flash for its large context window and speed.
 */
export const extractTermsFromText = async (textChunk: string): Promise<Partial<Term>[]> => {
  const prompt = `
    Analyze the following webnovel text. 
    Identify key proper nouns and recurring terminology that require consistent translation.
    Categorize them into: Person, Location, Martial Art/Skill, Item, Organization.
    
    Return a JSON array where each object has:
    - original: the term in source language
    - category: one of the requested categories
    
    Ignore common words. Focus on unique entities.
    
    Text:
    "${textChunk.slice(0, 30000)}" 
  `; 
  // Slicing to ~30k chars to be safe, though Flash can handle much more.

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING },
              category: { type: Type.STRING },
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Extraction error:", error);
    return [];
  }
};

/**
 * 2. SMART TERM TRANSLATION: Uses Search Grounding to find established Arabic translations.
 */
export const findArabicTranslationForTerm = async (term: string, contextSnippet: string): Promise<string> => {
  const prompt = `
    Find the established or most accurate Arabic translation/transliteration for the webnovel term: "${term}".
    Context of usage: "${contextSnippet}".
    
    If it is a famous anime/novel term (e.g., from Naruto, One Piece, Wuxia novels), find the community accepted Arabic term.
    If it is a generic name, transliterate it accurately to Arabic phonetics.
    
    Return ONLY the Arabic translation string. Nothing else.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Flash supports search in grounding
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    
    // Clean up response, sometimes models are chatty even when told not to be
    let cleanText = response.text?.trim() || "";
    // Remove quotes if present
    cleanText = cleanText.replace(/^["']|["']$/g, '');
    return cleanText;
  } catch (error) {
    console.error(`Search error for ${term}:`, error);
    return term; // Fallback to original
  }
};

/**
 * 3. CONTEXT-AWARE TRANSLATION: Translates chapter text using the Glossary.
 */
export const translateChapterWithGlossary = async (
  content: string, 
  glossary: Term[]
): Promise<string> => {
  
  // Format glossary for the prompt
  const glossaryString = glossary.map(g => `${g.original} -> ${g.translation}`).join('\n');

  const prompt = `
    Translate the following webnovel chapter to Arabic.
    
    CRITICAL RULES:
    1. You MUST strictly adhere to the provided Glossary. If a term appears in the text, use the exact Arabic translation provided below.
    2. Maintain the tone and flow of a webnovel (engaging, dramatic where necessary).
    3. Output ONLY the translated Arabic text.
    
    GLOSSARY (Strict adherence required):
    ${glossaryString}
    
    CHAPTER CONTENT:
    ${content}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Translation failed.";
  } catch (error) {
    console.error("Translation error:", error);
    return "Error generating translation. Please check API Key or quota.";
  }
};
