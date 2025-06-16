// This file is intentionally simple.
// It's designed to be executed via chrome.scripting.executeScript's `func` property.
// The function below will be stringified and executed in the context of the web page.

/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
// The getPageContent function is defined and used in App.tsx and injected from there.
// This file can be kept for clarity or if you plan to expand content script functionalities
// that are not directly injected functions.
// For the current setup where getPageContent is defined in App.tsx and injected,
// this file is not strictly necessary for THAT function, but good for structure.

// If you were to have a content script that runs on page load (defined in manifest.json),
// you would put its logic here.

// Example:
// console.log("AI Article Assistant content script loaded (if configured in manifest).");

// To make TypeScript happy that this file is a module.
export {};
