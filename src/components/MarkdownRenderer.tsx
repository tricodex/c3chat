import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn("prose prose-gray dark:prose-invert max-w-none", className)}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const codeString = String(children).replace(/\n$/, '');
          
          return !inline ? (
            <div className="relative group">
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => navigator.clipboard.writeText(codeString)}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                >
                  Copy
                </button>
              </div>
              {language && (
                <div className="text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded-t-md">
                  {language}
                </div>
              )}
              <SyntaxHighlighter
                style={oneDark}
                language={language || 'text'}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderTopLeftRadius: language ? 0 : undefined,
                  borderTopRightRadius: language ? 0 : undefined,
                }}
                {...props}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm" {...props}>
              {children}
            </code>
          );
        },
        // Custom link renderer
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              {children}
            </a>
          );
        },
        // Custom table renderer
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                {children}
              </table>
            </div>
          );
        },
        // Custom image renderer
        img({ src, alt }) {
          return (
            <img
              src={src}
              alt={alt || ''}
              className="max-w-full h-auto rounded-lg shadow-md"
              loading="lazy"
            />
          );
        },
        // Custom blockquote renderer
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-blue-500 pl-4 my-4 italic text-gray-700 dark:text-gray-300">
              {children}
            </blockquote>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
