// Declare chrome as any to bypass TypeScript errors when @types/chrome is not available
// This is typically handled better by installing @types/chrome (which is in package.json)
// and configuring tsconfig.json if you had one. For esbuild, it might pick up types.

import React, { useState, useEffect, useCallback } from 'react';
import { summarizeText, translateText } from './services/geminiService';
import { UiTheme } from './types';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE_CODE, SpeakerWaveIcon, StopCircleIcon, SparklesIcon, LanguageIcon } from './constants';
import LanguageSelector from './components/LanguageSelector';
import ActionButton from './components/ActionButton';
import Header from './components/Header';

// This function will be injected into the active page.
function getPageContent(): string {
  const mainSelectors = ['article', 'main', '[role="main"]', '.post-content', '.entry-content', '.article-body'];
  let contentElement: HTMLElement | null = null;

  for (const selector of mainSelectors) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      contentElement = el;
      break;
    }
  }
  
  if (!contentElement) {
    contentElement = document.body;
  }

  const clonedContentElement = contentElement.cloneNode(true) as HTMLElement;
  const elementsToRemoveSelectors = 'script, style, nav, header, footer, aside, form, button, input, [aria-hidden="true"], noscript, .noprint, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="form"], [role="search"]';
  clonedContentElement.querySelectorAll(elementsToRemoveSelectors).forEach(el => el.remove());

  let text = clonedContentElement.innerText;
  
  if (!text.trim() && contentElement !== document.body) {
     const bodyClone = document.body.cloneNode(true) as HTMLElement;
     bodyClone.querySelectorAll(elementsToRemoveSelectors).forEach(el => el.remove());
     text = bodyClone.innerText;
  }

  text = text.replace(/(\r\n|\n|\r){3,}/gm, "\n\n"); 
  text = text.replace(/[ \t]{2,}/gm, " "); 
  text = text.trim();
  
  const MAX_TEXT_LENGTH = 15000;
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.substring(0, MAX_TEXT_LENGTH) + "... (コンテンツ省略)";
  }
  
  return text;
}


const App: React.FC = () => {
  const [fetchedPageText, setFetchedPageText] = useState<string>('');
  const [isFetchingContent, setIsFetchingContent] = useState<boolean>(false);
  const [outputText, setOutputText] = useState<string>('');
  const [isLoadingSummarize, setIsLoadingSummarize] = useState<boolean>(false);
  const [isLoadingTranslate, setIsLoadingTranslate] = useState<boolean>(false);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>(DEFAULT_LANGUAGE_CODE);
  const [error, setError] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [theme, setTheme] = useState<UiTheme>(UiTheme.LIGHT);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['theme'], (result: { [key: string]: any }) => {
        if (result.theme && Object.values(UiTheme).includes(result.theme)) {
          setTheme(result.theme as UiTheme);
        } else {
          // Optional: Check system preference if no theme is stored
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          setTheme(prefersDark ? UiTheme.DARK : UiTheme.LIGHT);
        }
      });
    }

    // Check for Gemini API key availability
    (async () => {
        try {
            // A "dummy" call, or check initialization status from geminiService if exposed
            await summarizeText(''); 
        } catch (e: any) {
             if (e.message.includes("APIキー") || e.message.includes("GoogleGenAI client is not initialized") || e.message.includes("初期化に失敗しました")) {
                setGeminiError("Gemini APIキーが設定されていないか無効です。要約と翻訳は機能しません。ビルドプロセス中にGEMINI_API_KEY環境変数が正しく設定されたことを確認してください。");
            }
        }
    })();
  }, []);

  useEffect(() => {
    const rootHtml = document.documentElement;
    if (theme === UiTheme.DARK) {
      rootHtml.classList.add('dark');
      // Body classes are handled by Tailwind's dark: variant in popup.html
    } else {
      rootHtml.classList.remove('dark');
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ theme });
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prevTheme => prevTheme === UiTheme.LIGHT ? UiTheme.DARK : UiTheme.LIGHT);
  };

  const clearError = () => {
    if (error) setError(null);
  };
  
  const handleFetchPageContent = useCallback(async () => {
    clearError();
    // Do not clear geminiError here, it's a persistent config issue
    if (typeof chrome === 'undefined' || !(chrome.tabs && chrome.scripting)) {
      setError("Chrome API (tabs, scripting) が利用できません。これは拡張機能として実行する必要があります。");
      return;
    }
    setIsFetchingContent(true);
    setFetchedPageText('');
    setOutputText('');

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0 || !tabs[0].id) {
        setError("アクティブなタブが見つかりませんでした。");
        setIsFetchingContent(false);
        return;
      }
      const activeTabId = tabs[0].id;
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: getPageContent,
      });

      setIsFetchingContent(false);
      if (chrome.runtime.lastError) { // Should be caught by promise rejection, but good to check
        setError(`コンテンツの取得エラー: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (injectionResults && injectionResults[0] && typeof injectionResults[0].result === 'string') {
        const text = injectionResults[0].result;
        if (text.trim()) {
          setFetchedPageText(text);
        } else {
          setError("ページにテキストコンテンツが見つからないか、内容が短すぎます。");
        }
      } else {
        setError("ページからテキストコンテンツを抽出できませんでした。");
      }
    } catch (e: any) {
        setIsFetchingContent(false);
        setError(`コンテンツの取得エラー: ${e.message}`);
    }
  }, []);

  const textToProcess = fetchedPageText;

  const handleSummarize = useCallback(async () => {
    clearError();
    if (geminiError) { setError(geminiError); return; }
    if (!textToProcess.trim()) {
      setError("要約する前にページの内容を読み込んでください。");
      return;
    }
    setIsLoadingSummarize(true);
    setOutputText('');
    try {
      const summary = await summarizeText(textToProcess);
      setOutputText(summary);
    } catch (e: any) {
      setError(e.message || '要約中に不明なエラーが発生しました。');
       if (e.message.includes("APIキー") || e.message.includes("GoogleGenAI client is not initialized") || e.message.includes("初期化に失敗しました")) {
          setGeminiError(e.message); // Update if a new API error occurs
       }
    } finally {
      setIsLoadingSummarize(false);
    }
  }, [textToProcess, geminiError]);

  const handleTranslate = useCallback(async () => {
    clearError();
    if (geminiError) { setError(geminiError); return; }
    if (!textToProcess.trim()) {
      setError("翻訳する前にページの内容を読み込んでください。");
      return;
    }
    setIsLoadingTranslate(true);
    setOutputText('');
    try {
      const targetLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguageCode);
      if (!targetLanguage) {
        throw new Error("無効な翻訳先の言語が選択されました。");
      }
      const translation = await translateText(textToProcess, targetLanguage.name);
      setOutputText(translation);
    } catch (e: any) {
      setError(e.message || '翻訳中に不明なエラーが発生しました。');
      if (e.message.includes("APIキー") || e.message.includes("GoogleGenAI client is not initialized") || e.message.includes("初期化に失敗しました")) {
          setGeminiError(e.message); // Update if a new API error occurs
      }
    } finally {
      setIsLoadingTranslate(false);
    }
  }, [textToProcess, selectedLanguageCode, geminiError]);

  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const handleReadAloud = useCallback(() => {
    clearError();
    const textToRead = outputText || fetchedPageText;
    if (!textToRead.trim()) {
      setError("読み上げる内容がありません。ページの内容を読み込むか、結果を生成してください。");
      return;
    }

    if (isReading) {
        speechSynthesis.cancel();
        setIsReading(false);
        if(utteranceRef.current) {
            utteranceRef.current.onend = null;
            utteranceRef.current.onerror = null;
        }
        return;
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utteranceRef.current = utterance;
    
    const langForSpeech = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguageCode)?.code || 'ja'; // デフォルト読み上げ言語を日本語に変更も検討
    const voices = speechSynthesis.getVoices();
    // 指定言語の音声を探し、なければ英語、それでもなければデフォルトの音声を使用
    const voice = voices.find(v => v.lang.startsWith(langForSpeech)) || voices.find(v => v.lang.startsWith('en')) || voices.find(v => v.default);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onstart = () => setIsReading(true);
    utterance.onend = () => {
        setIsReading(false);
        utteranceRef.current = null;
    };
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      setError(`音声合成エラー: ${event.error}`);
      setIsReading(false);
      utteranceRef.current = null;
    };
    speechSynthesis.speak(utterance);
  }, [fetchedPageText, outputText, isReading, selectedLanguageCode]);

  useEffect(() => {
    const voicesChangedHandler = () => speechSynthesis.getVoices();
    speechSynthesis.getVoices(); 
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = voicesChangedHandler;
    }
    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
      if(utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = null; // Clean up listener
    }
    };
  }, []);
  
  const currentSelectedLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguageCode)?.name || '英語';

  return (
    <div className="p-4 flex flex-col min-h-[280px] max-h-[580px] w-full text-slate-800 dark:text-slate-100">
      <Header theme={theme} onToggleTheme={handleToggleTheme} />
      <main className="flex-grow flex flex-col space-y-3 overflow-y-auto pt-1">
        <ActionButton
            onClick={handleFetchPageContent}
            isLoading={isFetchingContent}
            disabled={isFetchingContent || isLoadingSummarize || isLoadingTranslate || isReading}
            className="w-full"
            title="現在のページのコンテンツを読み込みます"
        >
            ページの内容を読み込む
        </ActionButton>

        {geminiError && (
          <div className="p-2.5 bg-red-100 dark:bg-red-800 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-200 text-xs">
            <p className="font-semibold">API設定エラー:</p>
            <p>{geminiError}</p>
          </div>
        )}
        
        {error && !geminiError && (
          <div className="p-2.5 bg-red-100 dark:bg-red-800 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-200 text-xs">
            <p className="font-semibold">エラー:</p>
            <p>{error}</p>
          </div>
        )}

        {fetchedPageText && !isFetchingContent && (
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-300">取得したコンテンツ (プレビュー):</h2>
            <div 
              className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md max-h-24 overflow-y-auto text-xs whitespace-pre-wrap break-words"
              aria-label="取得したページコンテンツのプレビュー"
            >
              {fetchedPageText.substring(0, 300)} {fetchedPageText.length > 300 ? '...' : ''}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2 items-end">
          <ActionButton
            onClick={handleSummarize}
            isLoading={isLoadingSummarize}
            disabled={!fetchedPageText.trim() || isLoadingTranslate || isReading || isFetchingContent || !!geminiError}
            icon={<SparklesIcon className="w-3.5 h-3.5" />}
            title="読み込んだページのコンテンツを要約します"
          >
            要約する
          </ActionButton>
          
          <div className="flex flex-col space-y-1">
             <LanguageSelector
              id="languageSelect"
              label="翻訳先の言語:"
              selectedLanguageCode={selectedLanguageCode}
              onChange={(v) => { setSelectedLanguageCode(v); clearError(); }}
            />
            <ActionButton
              onClick={handleTranslate}
              isLoading={isLoadingTranslate}
              disabled={!fetchedPageText.trim() || isLoadingSummarize || isReading || isFetchingContent || !!geminiError}
              icon={<LanguageIcon className="w-3.5 h-3.5"/>}
              title={`読み込んだコンテンツを${currentSelectedLanguageName}に翻訳します`}
            >
              翻訳する
            </ActionButton>
          </div>
        </div>

        <ActionButton
          onClick={handleReadAloud}
          disabled={(!fetchedPageText.trim() && !outputText.trim()) || isLoadingSummarize || isLoadingTranslate || isFetchingContent}
          icon={isReading ? <StopCircleIcon className="w-4 h-4"/> : <SpeakerWaveIcon className="w-4 h-4"/>}
          variant="secondary"
          className="w-full"
          title={isReading ? "読み上げを停止します" : "読み込んだ、または結果のテキストを読み上げます"}
        >
          {isReading ? '読み上げ停止' : '読み上げる'}
        </ActionButton>


        {outputText && (
          <div className="mt-2 space-y-1 flex-grow flex flex-col">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">結果:</h2>
            <div className="flex-grow p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md whitespace-pre-wrap break-words overflow-y-auto min-h-[70px] text-sm">
              {outputText}
            </div>
          </div>
        )}
      </main>
      <footer className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>&copy; {new Date().getFullYear()} AIアシスタント</p>
      </footer>
    </div>
  );
};

export default App;