/**
 * Gemini AI Service
 * Google Gemini APIとの統合サービス
 * テキスト要約・翻訳機能を提供
 */

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_TEXT_MODEL } from "../constants";

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
let initError: string | null = null;

// Attempt to initialize AI client, capturing any immediate errors.
// This block executes when the module is first imported.
if (!API_KEY) {
  initError =
    "API_KEY environment variable is not set. Gemini services will not be available.";
  console.error(initError);
} else {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    initError = `Failed to initialize GoogleGenAI: ${message}. Check API_KEY.`;
    console.error(initError);
    ai = null;
  }
}

const checkAndGetAI = (): GoogleGenAI => {
  if (initError) {
    throw new Error(initError);
  }
  if (!ai) {
    // This case should ideally be caught by initError, but as a fallback:
    throw new Error(
      "GoogleGenAI client is not initialized. API_KEY might be missing, invalid, or initialization failed."
    );
  }
  return ai;
};

/**
 * テキストを要約する
 * @param text 要約対象のテキスト
 * @returns 要約されたテキスト
 */
export const summarizeText = async (text: string): Promise<string> => {
  if (!text.trim() && !initError) {
    // Allow initError check to proceed even with empty text
    // If text is empty and there's no initError, it's a genuine "empty text" case for summarization
    if (text === "") return ""; // For the dummy call from App.tsx to check init
    return "Please enter some text to summarize.";
  }

  const currentAI = checkAndGetAI(); // This will throw if initError or ai is null

  try {
    const prompt = `以下のテキストを極力簡潔に要約してください。以下の形式で出力してください：

• [ポイント1（30文字以内）]
• [ポイント2（30文字以内）]
• [ポイント3（30文字以内）]
• [ポイント4（30文字以内）]（必要に応じて）
• [ポイント5（30文字以内）]（必要に応じて）

[上記ポイントの背景情報・文脈・関連性の説明]

重要な制約：
- 各ポイントは30文字以内で簡潔に
- 最後の説明は背景情報、文脈、ポイント間の関連性など、箇条書きで表現しきれない重要な情報を補完
- 最大5ポイントまで
- 冗長な表現は控える
- 元のテキストの1/3以下の文字数にする
- テキストが短い場合は、そのまま返してください
- 【主要ポイント】【詳細要約】などのヘッダーは不要

---
${text}
---`;

    const response: GenerateContentResponse =
      await currentAI.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
      });
    return response.text || "要約の生成に失敗しました。";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error summarizing text:", message);
    // Re-throw the error so it can be caught by the caller in App.tsx
    throw new Error(`Failed to summarize: ${message}`);
  }
};

/**
 * テキストを指定言語に翻訳する
 * @param text 翻訳対象のテキスト
 * @param targetLanguageName 翻訳先言語名
 * @returns 翻訳されたテキスト
 */
export const translateText = async (
  text: string,
  targetLanguageName: string
): Promise<string> => {
  if (!text.trim() && !initError) {
    return "Please enter some text to translate.";
  }

  const currentAI = checkAndGetAI(); // This will throw if initError or ai is null

  try {
    const prompt = `以下のテキストを${targetLanguageName}に正確に翻訳してください。構造化された形式（箇条書きや番号付きリストなど）がある場合は、その構造を維持してください。意味と文脈を正確に伝えることを重視してください。

---
${text}
---`;
    const response: GenerateContentResponse =
      await currentAI.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
      });
    return response.text || "翻訳の生成に失敗しました。";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error translating text:", message);
    // Re-throw the error so it can be caught by the caller in App.tsx
    throw new Error(`Failed to translate: ${message}`);
  }
};
