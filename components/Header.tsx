/**
 * Header Component
 * アプリケーションヘッダー（タイトル・テーマ切り替えボタン）
 */

import React from "react";
import { SunIcon, MoonIcon } from "../constants";
import { UiTheme } from "../types";

interface HeaderProps {
  theme: UiTheme;
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme }) => {
  return (
    <header className="w-full mb-3">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200">
          VoiceArticle
        </h1>
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          aria-label={
            theme === UiTheme.LIGHT
              ? "Switch to dark mode"
              : "Switch to light mode"
          }
        >
          {theme === UiTheme.LIGHT ? (
            <MoonIcon className="h-5 w-5 text-slate-600" />
          ) : (
            <SunIcon className="h-5 w-5 text-yellow-400" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
