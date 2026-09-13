"use client";

export function LanguageSelect() {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-text-secondary">
      <span className="hidden sm:inline">Translate</span>
      <select
        aria-label="Translate this page with Google Translate (opens a new tab)"
        title="Open this page in Google Translate"
        defaultValue=""
        className="min-h-11 w-32 rounded-sm border border-gold-dim bg-bg-card px-2 text-sm text-text-primary sm:w-40"
        onChange={(event) => {
          const language = event.currentTarget.value;
          if (!language) return;
          const page = new URL(window.location.href);
          page.hash = "";
          const target = new URL("https://translate.google.com/translate");
          target.searchParams.set("sl", "en");
          target.searchParams.set("tl", language);
          target.searchParams.set("u", page.href);
          window.open(target.href, "_blank", "noopener,noreferrer");
          event.currentTarget.value = "";
        }}
      >
        <option value="">English</option>
        <option value="ko">한국어</option>
        <option value="fr">Français</option>
        <option value="de">Deutsch</option>
        <option value="zh-CN">简体中文</option>
        <option value="zh-TW">繁體中文</option>
        <option value="es">Español</option>
        <option value="pt-BR">Português (Brasil)</option>
        <option value="ru">Русский</option>
      </select>
    </label>
  );
}
