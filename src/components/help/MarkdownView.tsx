/**
 * MarkdownView.tsx
 * Renders the safe Markdown tree from src/lib/help/markdown.ts as React
 * elements. There is no HTML string anywhere in this path and no
 * dangerouslySetInnerHTML: text is always a text node, and links exist only
 * when the parser has already proven they are internal app paths.
 *
 * `headingOffset` shifts heading levels down when the article sits under
 * another heading (the panel), so the document outline stays correct.
 */
import type { ReactElement } from "react";
import { Info } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { BlockNode, InlineNode } from "@/lib/help";

interface MarkdownViewProps {
  readonly blocks: readonly BlockNode[];
  /** 0 on the article page (h2/h3), 1 inside the panel (h3/h4). */
  readonly headingOffset?: 0 | 1;
}

const LINK_CLASS = "font-medium text-accent underline underline-offset-2 hover:text-accent-hover";

const Inline = ({ nodes }: { readonly nodes: readonly InlineNode[] }): ReactElement => (
  <>
    {nodes.map((node, index) => {
      switch (node.type) {
        case "text":
          return <span key={index}>{node.text}</span>;
        case "strong":
          return (
            <strong key={index} className="font-semibold text-fg">
              <Inline nodes={node.children} />
            </strong>
          );
        case "em":
          return (
            <em key={index}>
              <Inline nodes={node.children} />
            </em>
          );
        case "code":
          return (
            <code key={index} className="rounded-sm bg-surface-sunken px-1 font-mono text-[0.9em]">
              {node.text}
            </code>
          );
        case "link":
          return (
            <Link key={index} to={node.href} className={LINK_CLASS}>
              <Inline nodes={node.children} />
            </Link>
          );
      }
    })}
  </>
);

const HEADING_CLASS: Readonly<Record<2 | 3, string>> = {
  2: "mt-8 text-xl font-semibold tracking-tight text-fg first:mt-0",
  3: "mt-6 text-lg font-semibold text-fg first:mt-0"
};

interface HeadingProps {
  readonly level: 2 | 3;
  readonly offset: 0 | 1;
  readonly nodes: readonly InlineNode[];
}

const Heading = ({ level, offset, nodes }: HeadingProps): ReactElement => {
  const Tag = `h${level + offset}` as "h2" | "h3" | "h4";
  return (
    <Tag className={HEADING_CLASS[level]}>
      <Inline nodes={nodes} />
    </Tag>
  );
};

const Block = ({ block, offset }: { readonly block: BlockNode; readonly offset: 0 | 1 }): ReactElement => {
  switch (block.type) {
    case "heading":
      return <Heading level={block.level} offset={offset} nodes={block.children} />;
    case "paragraph":
      return (
        <p className="mt-3 text-fg">
          <Inline nodes={block.children} />
        </p>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag className={`mt-3 flex flex-col gap-2 pl-6 text-fg ${block.ordered ? "list-decimal" : "list-disc"}`}>
          {block.items.map((item, index) => (
            <li key={index} className="pl-1 marker:text-fg-subtle">
              <Inline nodes={item} />
            </li>
          ))}
        </ListTag>
      );
    }
    case "note":
      // Used for "Coming soon" notes: icon + text so it reads without color.
      return (
        <aside className="mt-4 flex gap-3 rounded-md border border-border bg-surface-sunken p-4 text-fg-muted">
          <Info aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-fg" />
          <p>
            <Inline nodes={block.children} />
          </p>
        </aside>
      );
  }
};

export const MarkdownView = ({ blocks, headingOffset = 0 }: MarkdownViewProps): ReactElement => (
  <div className="leading-relaxed">
    {blocks.map((block, index) => (
      <Block key={index} block={block} offset={headingOffset} />
    ))}
  </div>
);
