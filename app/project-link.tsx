'use client';

interface ProjectLinkProps {
  href: string;
  slug: string;
  children: React.ReactNode;
  className?: string;
}

export function ProjectLink({ href, slug, children, className }: ProjectLinkProps) {
  const handleClick = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'outbound_project', { slug });
    }
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: 'outbound_project', 
        path: window.location.pathname, 
        meta: { slug } 
      })
    }).catch(() => {});
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
