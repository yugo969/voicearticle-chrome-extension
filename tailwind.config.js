/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./popup.html", "./src/**/*.{js,jsx,ts,tsx}"],
  // ダークモード対応（クラスベース）
  darkMode: "class",
  theme: {
    extend: {
      // カスタムテーマ拡張はここに追加
    },
  },
  plugins: [
    // 必要に応じてTailwindプラグインを追加
  ],
};
