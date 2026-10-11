import React from 'react';
import { Quote } from 'lucide-react';
import { parseMarkdown, type Block, type Inline } from '../lib/safeMarkdown';

/**
 * Renders CMS-authored Markdown using plain React elements only.
 * See src/lib/safeMarkdown.ts for the security rationale – there is no
 * dangerouslySetInnerHTML anywhere in this path.
 */

const renderInlines = (nodes: Inline[]): React.ReactNode[] =>
  nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <React.Fragment key={i}>{node.value}</React.Fragment>;
      case 'strong':
        return (
          <strong key={i} className="font-semibold text-[#24211e]">
            {renderInlines(node.children)}
          </strong>
        );
      case 'em':
        return <em key={i}>{renderInlines(node.children)}</em>;
      case 'code':
        return (
          <code key={i} className="font-mono text-[0.9em] bg-[#f0e7dc] px-1 py-0.5 rounded">
            {node.value}
          </code>
        );
      case 'link': {
        const external = /^https?:\/\//i.test(node.href);
        return (
          <a
            key={i}
            href={node.href}
            className="text-[#c85a32] underline underline-offset-2 hover:text-[#8c3d1e]"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInlines(node.children)}
          </a>
        );
      }
    }
  });

const renderBlock = (block: Block, i: number): React.ReactNode => {
  switch (block.type) {
    case 'heading':
      return block.level === 2 ? (
        <h3 key={i} className="font-serif text-2xl font-bold text-[#24211e] pt-2">
          {renderInlines(block.children)}
        </h3>
      ) : (
        <h4 key={i} className="font-serif text-xl font-bold text-[#24211e] pt-1">
          {renderInlines(block.children)}
        </h4>
      );
    case 'paragraph':
      return (
        <p key={i} className="leading-relaxed">
          {renderInlines(block.children)}
        </p>
      );
    case 'quote':
      return (
        <div key={i} className="my-6 p-5 border-l-3 border-[#c85a32] bg-[#f4ece0]/60 rounded-r-lg">
          <Quote className="w-5 h-5 text-[#c85a32] mb-1" />
          <p className="font-serif italic text-lg text-[#24211e]">{renderInlines(block.children)}</p>
        </div>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className={`${block.ordered ? 'list-decimal' : 'list-disc'} pl-6 space-y-1.5`}>
          {block.items.map((item, j) => (
            <li key={j} className="leading-relaxed">
              {renderInlines(item)}
            </li>
          ))}
        </Tag>
      );
    }
  }
};

interface SafeMarkdownProps {
  source: string;
  className?: string;
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ source, className }) => {
  const blocks = React.useMemo(() => parseMarkdown(source), [source]);
  return <div className={className}>{blocks.map(renderBlock)}</div>;
};
