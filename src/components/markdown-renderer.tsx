"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidChart } from "./mermaid-chart";
import { YouTubeEmbed } from "./youtube-embed";

interface MarkdownRendererProps {
  source: string;
  className?: string;
}

export function MarkdownRenderer({ source, className }: MarkdownRendererProps) {
  const components: Components = {
    // コードブロック: ```mermaid / ```youtube を特殊処理
    code({ className: codeClassName, children, ...props }) {
      const match = /language-(\w+)/.exec(codeClassName || "");
      const lang = match?.[1];
      const content = String(children).replace(/\n$/, "");

      if (lang === "mermaid") {
        return <MermaidChart code={content} />;
      }

      if (lang === "youtube") {
        return <YouTubeEmbed url={content.trim()} />;
      }

      // インラインコード or 通常のコードブロック
      // react-markdown v9ではinline判定はpre親の有無で判断
      const isInline = !match;
      if (isInline) {
        return (
          <code
            className="px-1 py-0.5 rounded bg-muted text-foreground text-[0.9em]"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <code className={codeClassName} {...props}>
          {children}
        </code>
      );
    },
    pre({ children }) {
      return (
        <pre className="my-3 p-3 rounded bg-muted overflow-x-auto text-sm">
          {children}
        </pre>
      );
    },
    img({ src, alt }) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={src || ""}
          alt={alt || ""}
          className="my-3 max-w-full h-auto rounded border"
          loading="lazy"
        />
      );
    },
    a({ href, children }) {
      const url = href || "";
      // YouTube URLの単体リンクは埋め込み
      if (
        /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url) &&
        typeof children === "object" &&
        Array.isArray(children) === false
      ) {
        // 中身がURLと同じ場合のみ埋め込み（意図的に埋め込みたいケース）
        const text = Array.isArray(children) ? children.join("") : String(children);
        if (text === url) {
          return <YouTubeEmbed url={url} />;
        }
      }
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {children}
        </a>
      );
    },
    h1({ children }) {
      return <h1 className="text-2xl font-bold mt-6 mb-3 pb-1 border-b">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-xl font-bold mt-5 mb-2 pb-1 border-b">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>;
    },
    h4({ children }) {
      return <h4 className="text-base font-semibold mt-3 mb-1">{children}</h4>;
    },
    ul({ children }) {
      return <ul className="list-disc list-outside pl-6 my-2 space-y-1">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal list-outside pl-6 my-2 space-y-1">{children}</ol>;
    },
    p({ children }) {
      return <p className="my-2 leading-7">{children}</p>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="my-3 pl-4 border-l-4 border-muted-foreground/30 text-muted-foreground italic">
          {children}
        </blockquote>
      );
    },
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto">
          <table className="min-w-full border-collapse border border-border text-sm">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-muted">{children}</thead>;
    },
    th({ children }) {
      return <th className="border border-border px-3 py-1.5 text-left font-semibold">{children}</th>;
    },
    td({ children }) {
      return <td className="border border-border px-3 py-1.5">{children}</td>;
    },
    hr() {
      return <hr className="my-4 border-border" />;
    },
  };

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
