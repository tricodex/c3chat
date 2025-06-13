import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Terminal, FileCode } from "lucide-react";

interface CodeBlockProps {
  language: string;
  children: string;
  filename?: string;
}

export function CodeBlock({ language, children, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Custom theme based on C3Chat design
  const customStyle = {
    ...oneDark,
    'pre[class*="language-"]': {
      ...oneDark['pre[class*="language-"]'],
      background: "var(--c3-bg-tertiary)",
      border: "1px solid var(--c3-border-subtle)",
      borderRadius: "var(--c3-radius-md)",
      padding: "var(--c3-space-md)",
      fontSize: "var(--c3-font-size-sm)",
      lineHeight: "1.5",
      margin: 0,
    },
    'code[class*="language-"]': {
      ...oneDark['code[class*="language-"]'],
      background: "none",
      fontSize: "var(--c3-font-size-sm)",
      fontFamily: "var(--c3-font-mono)",
    },
  };

  return (
    <div className="c3-code-block">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--c3-bg-secondary)] border border-[var(--c3-border-subtle)] border-b-0 rounded-t-[var(--c3-radius-md)]">
        <div className="flex items-center gap-2">
          {language === "terminal" || language === "bash" || language === "shell" ? (
            <Terminal className="w-3.5 h-3.5 text-[var(--c3-text-tertiary)]" />
          ) : (
            <FileCode className="w-3.5 h-3.5 text-[var(--c3-text-tertiary)]" />
          )}
          <span className="text-xs text-[var(--c3-text-tertiary)]">
            {filename || language || "code"}
          </span>
        </div>
        
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-[var(--c3-surface-hover)] transition-colors text-[var(--c3-text-tertiary)] hover:text-[var(--c3-text-primary)]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-auto rounded-b-[var(--c3-radius-md)]">
        <SyntaxHighlighter
          language={language || "text"}
          style={customStyle}
          showLineNumbers={false}
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
