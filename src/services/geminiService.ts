import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_TEXT_MODEL } from '../constants';

// This will be replaced by esbuild's --define option.
// For example, if GEMINI_API_KEY="testkey" is set in env during build,
// esbuild --define:process.env.API_KEY='"testkey"' will replace this.
// If not defined, it might become `undefined` or an empty string depending on shell and build script.
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
let initError: string | null = null;

if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE" || API_KEY === "$GEMINI_API_KEY" || API_KEY === "") {
  initError = "APIキーが正しく設定されていません。存在しないか、プレースホルダーのままか、ビルド時に置換されていない可能性があります。Geminiサービスは利用できません。";
  console.error(initError);
} else {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    initError = `GoogleGenAIの初期化に失敗しました: ${message}。APIキーが有効であることを確認してください。`;
    console.error(initError);
    ai = null; 
  }
}

const checkAndGetAI = (): GoogleGenAI => {
  if (initError) {
    throw new Error(initError);
  }
  if (!ai) {
    throw new Error("GoogleGenAIクライアントが初期化されていません。これはinitErrorで検出されるべきです。ビルドプロセスとAPIキーを確認してください。");
  }
  return ai;
};

export const summarizeText = async (text: string): Promise<string> => {
  // Allow dummy call for initialization check in App.tsx
  if (text === '' && !initError) return ''; 
  if (!text.trim() && !initError) {
    return "要約するテキストを入力してください。";
  }
  
  const currentAI = checkAndGetAI();

  try {
    const prompt = `Summarize the following text concisely. If the text is very short, just return the original text. Focus on the main points and ensure the summary is significantly shorter than the original if the original is long enough to be summarized:\n\n---\n${text}\n---`;
    
    const response: GenerateContentResponse = await currentAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error summarizing text:", message);
    // Re-throw the error with a more specific prefix if it's not already an init error
    if (initError && message.includes(initError)) throw new Error(message); // 初期化エラーの場合はそのまま投げる
    // API呼び出し固有のエラーの場合
    if (message.includes("API key not valid")) {
       throw new Error(`要約に失敗しました: APIキーが無効です。キーを確認してください。(${message})`);
    }
    throw new Error(`要約に失敗しました: ${message}`);
  }
};

export const translateText = async (text: string, targetLanguageName: string): Promise<string> => {
  if (!text.trim() && !initError) {
    return "翻訳するテキストを入力してください。";
  }

  const currentAI = checkAndGetAI();

  try {
    const prompt = `Translate the following text accurately into ${targetLanguageName}. Preserve the original meaning and tone as much as possible. If the text appears to be a list or structured, try to maintain a similar structure in ${targetLanguageName}.\n\n---\n${text}\n---`;
    const response: GenerateContentResponse = await currentAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error translating text:", message);
    if (initError && message.includes(initError)) throw new Error(message); // 初期化エラーの場合はそのまま投げる
    // API呼び出し固有のエラーの場合
    if (message.includes("API key not valid")) {
       throw new Error(`翻訳に失敗しました: APIキーが無効です。キーを確認してください。(${message})`);
    }
    throw new Error(`翻訳に失敗しました: ${message}`);
  }
};