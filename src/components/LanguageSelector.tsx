import React from 'react';
import { LanguageOption } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

interface LanguageSelectorProps {
  selectedLanguageCode: string;
  onChange: (languageCode: string) => void;
  id: string;
  label: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ selectedLanguageCode, onChange, id, label }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-0.5">
        {label}
      </label>
      <select
        id={id}
        value={selectedLanguageCode}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-1.5 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;