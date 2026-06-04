import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
  text: string;
}

export function MarkdownContent({ text }: MarkdownContentProps) {
  return (
    <div className="prose prose-stone max-w-none text-base text-stone-800 prose-headings:font-semibold prose-headings:text-stone-900 prose-h3:text-base prose-p:my-1 prose-p:leading-relaxed prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-stone-900">
    <ReactMarkdown
      components={{
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-lg bg-stone-100 px-3 py-2 text-sm my-2">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return <code className={className}>{children}</code>;
          }
          return (
            <code className="rounded bg-stone-100 px-1 py-0.5 text-sm">
              {children}
            </code>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
    </div>
  );
}
