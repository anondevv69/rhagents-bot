import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

export function DocsMarkdown({ content }: { content: string }) {
  return (
    <article className="docs-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-link"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          ),
          pre: ({ children }) => <pre className="docs-codeblock">{children}</pre>,
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code className="docs-code-inline" {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="docs-table-wrap">
              <table className="docs-table">{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
