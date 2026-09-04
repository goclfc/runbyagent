import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * markdown → safe html for library docs, the setup page and research docs.
 * no raw html passes through: everything goes through sanitize-html with a fixed allowlist.
 * external links open in a new tab, tables are wrapped so wide ones scroll instead of breaking the page.
 */

const SITE_HOSTS = new Set(['runbyagents.usectl.com', 'runbyagent.com', 'www.runbyagent.com']);

function isExternal(href: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return !SITE_HOSTS.has(new URL(href).hostname);
  } catch {
    return false;
  }
}

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'del', 's', 'code', 'pre', 'kbd',
    'a', 'ul', 'ol', 'li', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'sup', 'sub', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    th: ['align'],
    td: ['align'],
    code: ['class'],
    ol: ['start'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  // marked emits <h5>/<h6> for deep headings; fold them into h4 so the allowlist does not drop them
  transformTags: {
    h5: 'h4',
    h6: 'h4',
    a: (tagName, attribs) => {
      const href = attribs.href || '';
      const out: Record<string, string> = { ...attribs };
      if (isExternal(href)) {
        out.target = '_blank';
        out.rel = 'noopener noreferrer';
      } else {
        delete out.target;
        delete out.rel;
      }
      return { tagName, attribs: out };
    },
  },
};

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return '';
  const raw = marked.parse(source, { gfm: true, breaks: false, async: false }) as string;
  const clean = sanitizeHtml(raw, SANITIZE);
  // wrap every table so a wide one scrolls inside its own box
  return clean
    .replace(/<table>/g, '<div class="tw"><table>')
    .replace(/<\/table>/g, '</table></div>');
}

/** research docs arrive as an array of lines. some are markdown, some are "a | b | c" rows. */
export function linesLookLikeMarkdown(lines: string[]): boolean {
  return lines.some((line) =>
    /^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\|)/.test(line) || /\*\*|\[[^\]]+\]\([^)]+\)|`/.test(line)
  );
}

export function renderLines(lines: string[]): string {
  return renderMarkdown(lines.join('\n'));
}
