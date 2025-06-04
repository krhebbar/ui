// components/CodeBlock/CodeBlock.utils.ts

export const monokaiCustomTheme = (isDarkMode: boolean) => {
  return {
    hljs: {
      display: "block",
      overflowX: "auto",
      padding: "1rem",
      borderRadius: "0.5rem",
      background: isDarkMode ? "#1e1e1e" : "#f6f8fa",
      color: isDarkMode ? "#d4d4d4" : "#24292f",
      fontSize: "0.95rem",
      lineHeight: "1.6",
    },

    "hljs-keyword": { color: "#c586c0", fontWeight: "bold" },
    "hljs-literal": { color: "#569cd6" },
    "hljs-symbol": { color: "#569cd6" },
    "hljs-name": { color: "#569cd6" },
    "hljs-selector-tag": { color: "#d7ba7d" },

    "hljs-string": { color: "#ce9178" },
    "hljs-title": { color: "#4ec9b0" },
    "hljs-section": { color: "#4ec9b0" },
    "hljs-attribute": { color: "#9cdcfe" },

    "hljs-variable": { color: "#9cdcfe" },
    "hljs-template-variable": { color: "#9cdcfe" },
    "hljs-number": { color: "#b5cea8" },
    "hljs-type": { color: "#4ec9b0" },

    "hljs-comment": {
      color: isDarkMode ? "#a1a1aa" : "#6c727f",
      fontStyle: "italic",
    },

    "hljs-meta": { color: "#d4d4d4" },
    "hljs-quote": { color: "#6a9955" },
    "hljs-built_in": { color: "#dcdcaa" },

    "hljs-bullet": { color: "#d7ba7d" },
    "hljs-code": { color: "#dcdcaa" },
    "hljs-addition": { color: "#b5cea8" },
    "hljs-deletion": { color: "#ce9178" },

    "hljs-selector-attr": { color: "#d7ba7d" },
    "hljs-selector-pseudo": { color: "#c586c0" },

    "hljs-link": {
      color: "#3794ff",
      textDecoration: "underline",
    },

    "hljs-strong": { fontWeight: "bold" },
    "hljs-emphasis": { fontStyle: "italic" },
  };
};
