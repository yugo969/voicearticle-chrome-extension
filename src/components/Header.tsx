import React from 'react';
import { SunIcon, MoonIcon } from '../constants';
import { UiTheme } from '../types';

interface HeaderProps {
  theme: UiTheme;
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme }) => {
  return (
    <header className="w-full mb-2">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold text-slate-700 dark:text-slate-200">
          AI記事アシスタント
        </h1>
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          aria-label={theme === UiTheme.LIGHT ? "ダークモードに切り替え" : "ライトモードに切り替え"}
        >
          {theme === UiTheme.LIGHT ? (
            <MoonIcon className="h-5 w-5 text-slate-500" />
          ) : (
            <SunIcon className="h-5 w-5 text-yellow-400" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;