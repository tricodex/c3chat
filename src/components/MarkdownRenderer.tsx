import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="c3-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Code blocks with syntax highlighting
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          
          return !inline && language ? (
            <CodeBlock language={language}>
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          ) : (
            <code className="c3-inline-code" {...props}>
              {children}
            </code>
          );
        },
        // Links open in new tab with icon
        a({ href, children }: any) {
          const isExternal = href?.startsWith('http');
          return (
            <a
              href={href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className="c3-link inline-flex items-center gap-0.5"
            >
              {children}
              {isExternal && (
                <svg
                  className="inline-block w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              )}
            </a>
          );
        },
        // Tables with better styling
        table({ children }) {
          return (
            <div className="c3-table-wrapper">
              <table className="c3-table">{children}</table>
            </div>
          );
        },
        // Blockquotes
        blockquote({ children }) {
          return <blockquote className="c3-blockquote">{children}</blockquote>;
        },
        // Lists
        ul({ children }) {
          return <ul className="c3-list">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="c3-list c3-list-ordered">{children}</ol>;
        },
        // Headings
        h1({ children }) {
          return <h1 className="c3-heading c3-h1">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="c3-heading c3-h2">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="c3-heading c3-h3">{children}</h3>;
        },
        h4({ children }) {
          return <h4 className="c3-heading c3-h4">{children}</h4>;
        },
        h5({ children }) {
          return <h5 className="c3-heading c3-h5">{children}</h5>;
        },
        h6({ children }) {
          return <h6 className="c3-heading c3-h6">{children}</h6>;
        },
        // Paragraphs
        p({ children }) {
          return <p className="c3-paragraph">{children}</p>;
        },
        // Horizontal rules
        hr() {
          return <hr className="c3-divider" />;
        },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
