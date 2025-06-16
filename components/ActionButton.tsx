/**
 * ActionButton Component
 * 再利用可能なアクションボタンコンポーネント
 * ローディング状態、アイコン、バリアント対応
 */

import React from "react";
import { Spinner } from "../constants";

interface ActionButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
  title?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  icon,
  children,
  className = "",
  variant = "primary",
  title,
}) => {
  const baseStyle =
    "flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-150 ease-in-out";

  const variantStyles = {
    primary:
      "text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:ring-blue-500",
    secondary:
      "text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-300 dark:bg-slate-700 dark:hover:bg-slate-600 focus:ring-blue-500",
  };

  const disabledStyle = "opacity-60 cursor-not-allowed";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading || disabled}
      title={title}
      className={`${baseStyle} ${variantStyles[variant]} ${
        isLoading || disabled ? disabledStyle : ""
      } ${className}`}
    >
      {isLoading ? (
        <Spinner />
      ) : (
        icon && <span className="mr-1.5 -ml-0.5 h-4 w-4">{icon}</span>
      )}
      {children}
    </button>
  );
};

export default ActionButton;
