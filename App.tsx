// Declare chrome as any to bypass TypeScript errors when @types/chrome is not available.
declare var chrome: any;

import React, { useState, useEffect, useCallback } from "react";
import { summarizeText, translateText } from "./services/geminiService";
import { LanguageOption, UiTheme } from "./types";
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE_CODE,
  SpeakerWaveIcon,
  StopCircleIcon,
  SparklesIcon,
  LanguageIcon,
  Spinner,
} from "./constants";
import LanguageSelector from "./components/LanguageSelector";
import ActionButton from "./components/ActionButton";
import Header from "./components/Header"; // Assuming Header.tsx is adapted or simple enough

// This function will be injected into the active page.
function getPageContent(): { title: string; content: string } {
  // ページタイトルを取得
  const title = document.title || "タイトルなし";

  // Try to find a main content area, otherwise fallback to body.
  // Prioritize common semantic tags for articles.
  const mainSelectors = [
    "article",
    "main",
    '[role="main"]',
    ".post-content",
    ".entry-content",
    ".article-body",
  ];
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

  // Clone the element to avoid modifying the live page structure directly
  const clonedContentElement = contentElement.cloneNode(true) as HTMLElement;

  // Remove unwanted elements like scripts, styles, navs, headers, footers, asides, forms, buttons, inputs
  const elementsToRemoveSelectors =
    'script, style, nav, header, footer, aside, form, button, input, [aria-hidden="true"], noscript, .noprint, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="form"], [role="search"]';
  clonedContentElement
    .querySelectorAll(elementsToRemoveSelectors)
    .forEach((el) => el.remove());

  // Fallback if no text after filtering, use body but still try to filter known noisy elements
  let text = clonedContentElement.innerText;

  if (!text.trim() && contentElement !== document.body) {
    // If specific selection yielded no text, try a broader approach from body but still filter
    const bodyClone = document.body.cloneNode(true) as HTMLElement;
    bodyClone
      .querySelectorAll(elementsToRemoveSelectors)
      .forEach((el) => el.remove());
    text = bodyClone.innerText;
  }

  // Simple clean-up: replace multiple newlines/spaces with single ones
  text = text.replace(/(\r\n|\n|\r){3,}/gm, "\n\n");
  text = text.replace(/[ \t]{2,}/gm, " ");
  text = text.trim();

  // Limit text length to avoid performance issues and huge API requests
  const MAX_TEXT_LENGTH = 15000; // Approx 5000 tokens
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.substring(0, MAX_TEXT_LENGTH) + "... (content truncated)";
  }

  return { title, content: text };
}

const App: React.FC = () => {
  const [fetchedPageText, setFetchedPageText] = useState<string>("");
  const [pageTitle, setPageTitle] = useState<string>("");
  const [isFetchingContent, setIsFetchingContent] = useState<boolean>(false);

  // 各結果を個別に管理
  const [summaryText, setSummaryText] = useState<string>("");
  const [translationText, setTranslationText] = useState<string>("");
  const [contentText, setContentText] = useState<string>("");
  const [showFullContent, setShowFullContent] = useState<boolean>(false);

  const [isLoadingSummarize, setIsLoadingSummarize] = useState<boolean>(false);
  const [isLoadingTranslate, setIsLoadingTranslate] = useState<boolean>(false);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>(
    DEFAULT_LANGUAGE_CODE
  );
  const [error, setError] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [theme, setTheme] = useState<UiTheme>(UiTheme.LIGHT);

  // Load theme from chrome.storage on component mount
  useEffect(() => {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.get(["theme"], (result: { [key: string]: any }) => {
        if (result.theme) {
          setTheme(result.theme as UiTheme);
        }
      });
    }
    // Check for Gemini API key availability from geminiService
    // This is a bit of a workaround to get the initError from geminiService
    (async () => {
      try {
        await summarizeText(""); // A "dummy" call to trigger initialization check
      } catch (e: any) {
        if (
          e.message.includes("API_KEY") ||
          e.message.includes("GoogleGenAI client is not initialized")
        ) {
          setGeminiError(
            "Gemini API Key is not configured. Summarization and Translation will not work. Please ensure API_KEY is set in the extension's environment."
          );
        }
      }
    })();
  }, []);

  // Apply theme to HTML element and save to chrome.storage when it changes
  useEffect(() => {
    const rootHtml = document.documentElement;
    if (theme === UiTheme.DARK) {
      rootHtml.classList.add("dark");
      document.body.classList.add("dark:bg-slate-900");
      document.body.classList.remove("bg-slate-100");
    } else {
      rootHtml.classList.remove("dark");
      document.body.classList.add("bg-slate-100");
      document.body.classList.remove("dark:bg-slate-900");
    }
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.set({ theme });
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === UiTheme.LIGHT ? UiTheme.DARK : UiTheme.LIGHT
    );
  };

  const clearError = () => {
    if (error) setError(null);
  };

  const handleFetchPageContent = useCallback(async () => {
    clearError();
    setGeminiError(null); // Clear Gemini error as we are fetching new content
    if (typeof chrome === "undefined" || !(chrome.tabs && chrome.scripting)) {
      setError(
        "Chrome APIs (tabs, scripting) not available. Ensure you're running this as an extension."
      );
      return;
    }
    setIsFetchingContent(true);
    setFetchedPageText("");
    setPageTitle("");
    setContentText("");
    setShowFullContent(false);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs.length === 0 || !tabs[0].id) {
        setError("Could not find active tab.");
        setIsFetchingContent(false);
        return;
      }
      const activeTabId = tabs[0].id;
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTabId },
          func: getPageContent, // Injected function
        },
        (injectionResults: any[]) => {
          setIsFetchingContent(false);
          if (chrome.runtime && chrome.runtime.lastError) {
            setError(
              `Error fetching content: ${chrome.runtime.lastError.message}`
            );
            return;
          }
          if (
            injectionResults &&
            injectionResults[0] &&
            typeof injectionResults[0].result === "object"
          ) {
            const { title, content } = injectionResults[0].result;
            if (content.trim()) {
              setFetchedPageText(content);
              setPageTitle(title);
              setContentText(content); // 読み込み内容確認の結果として設定
            } else {
              setError(
                "No text content found on the page or the content was too short."
              );
            }
          } else {
            setError("Could not extract text content from the page.");
          }
        }
      );
    });
  }, []);

  const textToProcess = fetchedPageText;

  const handleSummarizeAndRead = useCallback(async () => {
    clearError();
    if (geminiError) {
      setError(geminiError);
      return;
    }

    setIsLoadingSummarize(true);
    setSummaryText("");

    try {
      // まずページコンテンツを取得
      let pageText = fetchedPageText;
      if (!pageText.trim()) {
        // コンテンツが未取得の場合は自動取得
        await new Promise<void>((resolve, reject) => {
          if (
            typeof chrome === "undefined" ||
            !(chrome.tabs && chrome.scripting)
          ) {
            reject(
              new Error(
                "Chrome APIs (tabs, scripting) not available. Ensure you're running this as an extension."
              )
            );
            return;
          }

          chrome.tabs.query(
            { active: true, currentWindow: true },
            (tabs: any[]) => {
              if (tabs.length === 0 || !tabs[0].id) {
                reject(new Error("Could not find active tab."));
                return;
              }
              const activeTabId = tabs[0].id;
              chrome.scripting.executeScript(
                {
                  target: { tabId: activeTabId },
                  func: getPageContent,
                },
                (injectionResults: any[]) => {
                  if (chrome.runtime && chrome.runtime.lastError) {
                    reject(
                      new Error(
                        `Error fetching content: ${chrome.runtime.lastError.message}`
                      )
                    );
                    return;
                  }
                  if (
                    injectionResults &&
                    injectionResults[0] &&
                    typeof injectionResults[0].result === "object"
                  ) {
                    const { title, content } = injectionResults[0].result;
                    if (content.trim()) {
                      pageText = content;
                      setFetchedPageText(content);
                      setPageTitle(title);
                      resolve();
                    } else {
                      reject(
                        new Error(
                          "No text content found on the page or the content was too short."
                        )
                      );
                    }
                  } else {
                    reject(
                      new Error("Could not extract text content from the page.")
                    );
                  }
                }
              );
            }
          );
        });
      }

      // 要約を実行
      const rawSummary = await summarizeText(pageText);

      // 要約結果をクリーンアップ（要約用の関数を作成）
      const cleanedSummary = cleanSummaryResponse(rawSummary);
      setSummaryText(cleanedSummary);

      // 要約が完了したら自動的に読み上げ開始（日本語で）
      setTimeout(() => {
        startReadAloudInLanguage(cleanedSummary, "ja");
      }, 500);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "要約中に不明なエラーが発生しました。"
      );
      if (
        e instanceof Error &&
        (e.message.includes("API_KEY") ||
          e.message.includes("GoogleGenAI client is not initialized"))
      ) {
        setGeminiError(e.message);
      }
    } finally {
      setIsLoadingSummarize(false);
    }
  }, [fetchedPageText, geminiError]);

  const handleTranslateAndRead = useCallback(async () => {
    clearError();
    if (geminiError) {
      setError(geminiError);
      return;
    }

    setIsLoadingTranslate(true);
    setTranslationText("");

    try {
      // まず要約を取得または生成
      let textToTranslate = summaryText;

      if (!textToTranslate.trim()) {
        // 要約がない場合は、まずページコンテンツを取得して要約
        let pageText = fetchedPageText;
        if (!pageText.trim()) {
          // コンテンツが未取得の場合は自動取得
          await new Promise<void>((resolve, reject) => {
            if (
              typeof chrome === "undefined" ||
              !(chrome.tabs && chrome.scripting)
            ) {
              reject(
                new Error(
                  "Chrome APIs (tabs, scripting) not available. Ensure you're running this as an extension."
                )
              );
              return;
            }

            chrome.tabs.query(
              { active: true, currentWindow: true },
              (tabs: any[]) => {
                if (tabs.length === 0 || !tabs[0].id) {
                  reject(new Error("Could not find active tab."));
                  return;
                }
                const activeTabId = tabs[0].id;
                chrome.scripting.executeScript(
                  {
                    target: { tabId: activeTabId },
                    func: getPageContent,
                  },
                  (injectionResults: any[]) => {
                    if (chrome.runtime && chrome.runtime.lastError) {
                      reject(
                        new Error(
                          `Error fetching content: ${chrome.runtime.lastError.message}`
                        )
                      );
                      return;
                    }
                    if (
                      injectionResults &&
                      injectionResults[0] &&
                      typeof injectionResults[0].result === "object"
                    ) {
                      const { title, content } = injectionResults[0].result;
                      if (content.trim()) {
                        pageText = content;
                        setFetchedPageText(content);
                        setPageTitle(title);
                        resolve();
                      } else {
                        reject(
                          new Error(
                            "No text content found on the page or the content was too short."
                          )
                        );
                      }
                    } else {
                      reject(
                        new Error(
                          "Could not extract text content from the page."
                        )
                      );
                    }
                  }
                );
              }
            );
          });
        }

        // 要約を生成
        const rawSummary = await summarizeText(pageText);
        textToTranslate = cleanSummaryResponse(rawSummary);
        setSummaryText(textToTranslate); // 要約も保存
      }

      // 要約を翻訳
      const targetLanguage = SUPPORTED_LANGUAGES.find(
        (lang) => lang.code === selectedLanguageCode
      );
      if (!targetLanguage) {
        throw new Error("無効な翻訳先の言語が選択されました。");
      }
      const rawTranslation = await translateText(
        textToTranslate,
        targetLanguage.name
      );

      // AIの応答から翻訳結果のみを抽出
      const cleanedTranslation = cleanTranslationResponse(rawTranslation);
      setTranslationText(cleanedTranslation);

      // 翻訳が完了したら自動的に読み上げ開始（翻訳先言語で）
      setTimeout(() => {
        startReadAloudInLanguage(cleanedTranslation, selectedLanguageCode);
      }, 500);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "翻訳中に不明なエラーが発生しました。"
      );
      if (
        e instanceof Error &&
        (e.message.includes("API_KEY") ||
          e.message.includes("GoogleGenAI client is not initialized"))
      ) {
        setGeminiError(e.message);
      }
    } finally {
      setIsLoadingTranslate(false);
    }
  }, [fetchedPageText, summaryText, selectedLanguageCode, geminiError]);

  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  // 要約結果からAIの余計な応答を除去する関数
  const cleanSummaryResponse = useCallback((response: string): string => {
    let cleaned = response;

    // 「Here is the summary:」「以下が要約です：」などの前置きを除去
    cleaned = cleaned.replace(
      /^(Here is the|Here's the|This is the|以下が|これが).*?(summary|要約).*?[:：]\s*/i,
      ""
    );

    // 「Summary:」「要約：」などのラベルを除去
    cleaned = cleaned.replace(/^(Summary|要約)[:：]\s*/i, "");

    // 「---」区切りを除去
    cleaned = cleaned.replace(/^---+\s*/gm, "");

    // 「Note:」「注意：」以降の説明を除去
    cleaned = cleaned.replace(/\n\n(Note|注意|備考)[:：].*$/is, "");

    // 「I have summarized」「要約しました」などの説明を除去
    cleaned = cleaned.replace(
      /^(I have summarized|要約しました|要約完了).*?\n/i,
      ""
    );

    // 複数の改行を整理
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    // 前後の空白を除去
    cleaned = cleaned.trim();

    return cleaned;
  }, []);

  // 翻訳結果からAIの余計な応答を除去する関数
  const cleanTranslationResponse = useCallback((response: string): string => {
    // 一般的なAIの応答パターンを除去
    let cleaned = response;

    // 「Here is the translation:」「以下が翻訳です：」などの前置きを除去
    cleaned = cleaned.replace(
      /^(Here is the|Here's the|This is the|以下が|これが).*?(translation|翻訳).*?[:：]\s*/i,
      ""
    );

    // 「---」区切りを除去
    cleaned = cleaned.replace(/^---+\s*/gm, "");

    // 「Translation:」「翻訳：」などのラベルを除去
    cleaned = cleaned.replace(/^(Translation|翻訳)[:：]\s*/i, "");

    // 「Note:」「注意：」以降の説明を除去
    cleaned = cleaned.replace(/\n\n(Note|注意|備考)[:：].*$/is, "");

    // 「I have translated」「翻訳しました」などの説明を除去
    cleaned = cleaned.replace(
      /^(I have translated|翻訳しました|翻訳完了).*?\n/i,
      ""
    );

    // 複数の改行を整理
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    // 前後の空白を除去
    cleaned = cleaned.trim();

    return cleaned;
  }, []);

  // 指定された言語で読み上げを開始する関数
  const startReadAloudInLanguage = useCallback(
    (textToRead: string, languageCode: string) => {
      if (!textToRead.trim()) {
        return;
      }

      // 音声合成が利用可能かチェック
      if (!("speechSynthesis" in window)) {
        setError("お使いのブラウザは音声合成をサポートしていません。");
        return;
      }

      // 既存の音声合成を停止
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }

      // 音声の準備ができるまで少し待つ
      const initiateSpeech = () => {
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utteranceRef.current = utterance;

        const voices = speechSynthesis.getVoices();

        // 言語コードに基づいて適切な音声を選択
        let voice = null;

        // 言語コードマッピング
        const languageMapping: { [key: string]: string[] } = {
          en: ["en-US", "en-GB", "en-AU", "en"],
          ja: ["ja-JP", "ja"],
          es: ["es-ES", "es-MX", "es"],
          fr: ["fr-FR", "fr-CA", "fr"],
          de: ["de-DE", "de"],
          zh: ["zh-CN", "zh-TW", "zh"],
          ko: ["ko-KR", "ko"],
          ar: ["ar-SA", "ar"],
          ru: ["ru-RU", "ru"],
          pt: ["pt-BR", "pt-PT", "pt"],
        };

        const targetLangs = languageMapping[languageCode] || [languageCode];

        // 指定された言語の音声を優先的に探す
        for (const lang of targetLangs) {
          voice = voices.find((v) => v.lang.startsWith(lang));
          if (voice) break;
        }

        // 見つからない場合は英語をフォールバック
        if (!voice) {
          voice = voices.find((v) => v.lang.startsWith("en")) || voices[0];
        }

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
          console.log(`選択された音声: ${voice.name} (${voice.lang})`);
        }

        // 音声の設定を調整
        // utterance.rate = 0.9; // 少し遅めで明瞭に
        utterance.rate = 1.2;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
          console.log("音声読み上げ開始");
          setIsReading(true);
        };

        utterance.onend = () => {
          console.log("音声読み上げ終了");
          setIsReading(false);
          utteranceRef.current = null;
        };

        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          console.error("音声合成エラー:", event.error);
          let errorMessage = "音声読み上げでエラーが発生しました。";

          switch (event.error) {
            case "network":
              errorMessage =
                "ネットワークエラーにより音声読み上げに失敗しました。";
              break;
            case "synthesis-failed":
              errorMessage =
                "音声合成に失敗しました。テキストが長すぎる可能性があります。";
              break;
            case "synthesis-unavailable":
              errorMessage = "音声合成が利用できません。";
              break;
            case "language-unavailable":
              errorMessage = "選択された言語の音声が利用できません。";
              break;
            case "voice-unavailable":
              errorMessage = "音声が利用できません。";
              break;
            case "text-too-long":
              errorMessage = "テキストが長すぎて読み上げできません。";
              break;
            case "invalid-argument":
              errorMessage = "無効な引数により音声読み上げに失敗しました。";
              break;
            default:
              errorMessage = `音声読み上げエラー: ${event.error}`;
          }

          setError(errorMessage);
          setIsReading(false);
          utteranceRef.current = null;
        };

        try {
          speechSynthesis.speak(utterance);
          console.log("音声読み上げを開始しました");
        } catch (error) {
          console.error("speechSynthesis.speak エラー:", error);
          setError("音声読み上げの開始に失敗しました。");
          setIsReading(false);
          utteranceRef.current = null;
        }
      };

      // 音声が読み込まれていない場合は少し待つ
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        const checkVoices = () => {
          const availableVoices = speechSynthesis.getVoices();
          if (availableVoices.length > 0) {
            initiateSpeech();
          } else {
            setTimeout(() => {
              if (speechSynthesis.getVoices().length > 0) {
                initiateSpeech();
              } else {
                setError(
                  "音声が読み込まれませんでした。しばらく待ってから再試行してください。"
                );
              }
            }, 3000);
          }
        };

        if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = checkVoices;
        }
        checkVoices();
      } else {
        initiateSpeech();
      }
    },
    []
  );

  const startReadAloud = useCallback(
    (textToRead: string) => {
      if (!textToRead.trim()) {
        return;
      }

      // 音声合成が利用可能かチェック
      if (!("speechSynthesis" in window)) {
        setError("お使いのブラウザは音声合成をサポートしていません。");
        return;
      }

      // 既存の音声合成を停止
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }

      // 音声の準備ができるまで少し待つ
      const initiateSpeech = () => {
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utteranceRef.current = utterance;

        // 音声設定
        const langForSpeech =
          SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguageCode)
            ?.code || "ja";
        const voices = speechSynthesis.getVoices();

        // 日本語音声を優先的に探す
        let voice = voices.find((v) => v.lang.startsWith("ja"));
        if (!voice && langForSpeech !== "ja") {
          voice = voices.find((v) => v.lang.startsWith(langForSpeech));
        }
        if (!voice) {
          voice =
            voices.find((v) => v.lang.startsWith("en")) ||
            voices.find((v) => v.default) ||
            voices[0];
        }

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }

        // 音声の設定を調整
        utterance.rate = 1.0; // 読み上げ速度
        utterance.pitch = 1.0; // 音の高さ
        utterance.volume = 1.0; // 音量

        utterance.onstart = () => {
          console.log("音声読み上げ開始");
          setIsReading(true);
        };

        utterance.onend = () => {
          console.log("音声読み上げ終了");
          setIsReading(false);
          utteranceRef.current = null;
        };

        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          console.error("音声合成エラー:", event.error);
          let errorMessage = "音声読み上げでエラーが発生しました。";

          switch (event.error) {
            case "network":
              errorMessage =
                "ネットワークエラーにより音声読み上げに失敗しました。";
              break;
            case "synthesis-failed":
              errorMessage =
                "音声合成に失敗しました。テキストが長すぎる可能性があります。";
              break;
            case "synthesis-unavailable":
              errorMessage = "音声合成が利用できません。";
              break;
            case "language-unavailable":
              errorMessage = "選択された言語の音声が利用できません。";
              break;
            case "voice-unavailable":
              errorMessage = "音声が利用できません。";
              break;
            case "text-too-long":
              errorMessage = "テキストが長すぎて読み上げできません。";
              break;
            case "invalid-argument":
              errorMessage = "無効な引数により音声読み上げに失敗しました。";
              break;
            default:
              errorMessage = `音声読み上げエラー: ${event.error}`;
          }

          setError(errorMessage);
          setIsReading(false);
          utteranceRef.current = null;
        };

        try {
          speechSynthesis.speak(utterance);
          console.log("音声読み上げを開始しました");
        } catch (error) {
          console.error("speechSynthesis.speak エラー:", error);
          setError("音声読み上げの開始に失敗しました。");
          setIsReading(false);
          utteranceRef.current = null;
        }
      };

      // 音声が読み込まれていない場合は少し待つ
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        // 音声が読み込まれるまで待機
        const checkVoices = () => {
          const availableVoices = speechSynthesis.getVoices();
          if (availableVoices.length > 0) {
            initiateSpeech();
          } else {
            // 最大3秒待機
            setTimeout(() => {
              if (speechSynthesis.getVoices().length > 0) {
                initiateSpeech();
              } else {
                setError(
                  "音声が読み込まれませんでした。しばらく待ってから再試行してください。"
                );
              }
            }, 3000);
          }
        };

        if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = checkVoices;
        }
        checkVoices();
      } else {
        initiateSpeech();
      }
    },
    [selectedLanguageCode]
  );

  const handleReadAloud = useCallback(() => {
    clearError();
    // 優先順位: 翻訳結果 > 要約結果 > 読み込み内容
    const textToRead =
      translationText || summaryText || contentText || fetchedPageText;
    if (!textToRead.trim()) {
      setError(
        "読み上げる内容がありません。ページの内容を読み込むか、結果を生成してください。"
      );
      return;
    }

    if (isReading) {
      speechSynthesis.cancel();
      setIsReading(false);
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      return;
    }

    startReadAloud(textToRead);
  }, [
    fetchedPageText,
    summaryText,
    translationText,
    contentText,
    isReading,
    startReadAloud,
  ]);

  useEffect(() => {
    // Ensure voices are loaded for language selection in TTS
    speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
    };
  }, []);

  const currentSelectedLanguageName =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguageCode)?.name ||
    "英語";

  return (
    <div
      className={`p-4 flex flex-col min-h-[280px] max-h-[580px] ${
        theme === UiTheme.LIGHT ? "bg-slate-100" : "bg-slate-900 text-white"
      }`}
    >
      <Header theme={theme} onToggleTheme={handleToggleTheme} />
      <main className="flex-grow flex flex-col space-y-3 overflow-y-auto">
        {/* 要約して読み上げるボタンとその結果 */}
        <div className="space-y-2">
          <ActionButton
            onClick={handleSummarizeAndRead}
            isLoading={isLoadingSummarize}
            disabled={
              isLoadingTranslate ||
              isReading ||
              isFetchingContent ||
              !!geminiError
            }
            icon={<SparklesIcon className="w-4 h-4" />}
            className="w-full"
            title="ページの内容を要約して読み上げます"
          >
            要約して読み上げる
          </ActionButton>

          {summaryText && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                要約結果:
              </h3>
              <div className="p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100 max-h-48 overflow-y-auto text-sm">
                {summaryText}
              </div>
            </div>
          )}
        </div>

        {geminiError && (
          <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-200 text-sm">
            <p className="font-semibold">API設定エラー:</p>
            <p>{geminiError}</p>
          </div>
        )}

        {error &&
          !geminiError /* Show general errors if not a geminiError */ && (
            <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-200 text-sm">
              <p className="font-semibold">エラー:</p>
              <p>{error}</p>
            </div>
          )}

        {/* 要約を翻訳して読み上げるボタンとその結果 */}
        <div className="flex flex-col space-y-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
          <LanguageSelector
            id="languageSelect"
            label="翻訳先の言語:"
            selectedLanguageCode={selectedLanguageCode}
            onChange={(v) => {
              setSelectedLanguageCode(v);
              clearError();
            }}
          />
          <ActionButton
            onClick={handleTranslateAndRead}
            isLoading={isLoadingTranslate}
            disabled={
              isLoadingSummarize ||
              isReading ||
              isFetchingContent ||
              !!geminiError
            }
            icon={<LanguageIcon className="w-4 h-4" />}
            className="w-full"
            title={`要約を${currentSelectedLanguageName}に翻訳して読み上げます`}
          >
            要約を翻訳して読み上げる
          </ActionButton>

          {translationText && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                翻訳結果:
              </h3>
              <div className="p-3 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-md whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100 max-h-48 overflow-y-auto text-sm">
                {translationText}
              </div>
            </div>
          )}
        </div>

        {/* その他のボタン */}
        <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-2">
          <div className="space-y-2">
            {/* 読み込み内容確認ボタンとその結果 */}
            <div className="space-y-2">
              <ActionButton
                onClick={handleFetchPageContent}
                isLoading={isFetchingContent}
                disabled={
                  isFetchingContent ||
                  isLoadingSummarize ||
                  isLoadingTranslate ||
                  isReading
                }
                variant="secondary"
                className="w-full"
                title="現在のページのコンテンツを確認します"
              >
                読み込み内容を確認
              </ActionButton>

              {contentText && !isFetchingContent && (
                <div className="space-y-1">
                  {pageTitle && (
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        ページタイトル:
                      </h3>
                      <div className="p-2 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md text-slate-800 dark:text-slate-100 text-sm font-medium">
                        {pageTitle}
                      </div>
                    </div>
                  )}
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    取得したコンテンツ:
                  </h3>
                  <div
                    className="p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-800 dark:text-slate-100 overflow-y-auto text-xs whitespace-pre-wrap break-words"
                    style={{ maxHeight: showFullContent ? "400px" : "112px" }}
                    aria-label="取得したページコンテンツ"
                  >
                    {showFullContent
                      ? contentText
                      : `${contentText.substring(0, 300)}${
                          contentText.length > 300 ? "..." : ""
                        }`}
                  </div>
                  {contentText.length > 300 && (
                    <button
                      onClick={() => setShowFullContent(!showFullContent)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
                    >
                      {showFullContent ? "省略表示" : "全文表示"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <ActionButton
              onClick={handleReadAloud}
              disabled={
                (!fetchedPageText.trim() &&
                  !summaryText.trim() &&
                  !translationText.trim() &&
                  !contentText.trim()) ||
                isLoadingSummarize ||
                isLoadingTranslate ||
                isFetchingContent
              }
              icon={
                isReading ? (
                  <StopCircleIcon className="w-5 h-5" />
                ) : (
                  <SpeakerWaveIcon className="w-5 h-5" />
                )
              }
              variant="secondary"
              className="w-full"
              title={
                isReading
                  ? "読み上げを停止します"
                  : "読み込んだ、または結果のテキストを読み上げます"
              }
            >
              {isReading ? "読み上げ停止" : "読み上げる"}
            </ActionButton>
          </div>
        </div>
      </main>
      <footer className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>&copy; {new Date().getFullYear()} AIアシスタント</p>
      </footer>
    </div>
  );
};

export default App;
