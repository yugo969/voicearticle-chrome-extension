
// This file is intentionally simple.
// It's designed to be executed via chrome.scripting.executeScript's `func` property.
// The function below will be stringified and executed in the context of the web page.

function getPageContent() {
  // Try to find a main content area, otherwise fallback to body.
  const mainSelectors = ['article', 'main', '[role="main"]'];
  let mainContentElement = null;
  for (const selector of mainSelectors) {
    mainContentElement = document.querySelector(selector);
    if (mainContentElement) break;
  }

  const contentElement = mainContentElement || document.body;
  
  // Basic filter to remove script, style, nav, header, footer, aside, form, button, input elements
  const elementsToRemove = contentElement.querySelectorAll('script, style, nav, header, footer, aside, form, button, input, [aria-hidden="true"], noscript');
  elementsToRemove.forEach(el => el.remove());

  // Get innerText which tries to represent what's rendered.
  let text = contentElement.innerText;

  // Simple clean-up: replace multiple newlines/spaces with single ones
  text = text.replace(/(\r\n|\n|\r){3,}/gm, "\n\n"); // Collapse 3+ newlines to 2
  text = text.replace(/[ \t]{2,}/gm, " "); // Collapse 2+ spaces/tabs to 1
  text = text.trim();
  
  return text;
}

// To make TypeScript happy that this file is a module, though it's not strictly necessary
// when used with `func` in executeScript.
export {};

// The actual way this script's functionality is used is by passing the function
// (getPageContent) directly to chrome.scripting.executeScript from popup.tsx.
// Example in popup.tsx:
//
// chrome.scripting.executeScript(
//   {
//     target: { tabId: tab.id },
//     func: getPageContent, // The function itself
//   },
//   (injectionResults) => { ... }
// );
//
// No need to explicitly use chrome.runtime.sendMessage here if executeScript callback is used.
