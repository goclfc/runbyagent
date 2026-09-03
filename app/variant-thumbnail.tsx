'use client';

import { useEffect, useRef } from 'react';

export function VariantThumbnail({ file, slug }: { file: string; slug: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (!iframeRef.current || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const scale = containerWidth / 1200;
      iframeRef.current.style.transform = `scale(${scale})`;
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="variant-thumbnail-container" ref={containerRef}>
      <iframe
        ref={iframeRef}
        src={`/variants/${file}`}
        title={`Variant ${slug}`}
        sandbox="allow-same-origin"
        loading="lazy"
      />
    </div>
  );
}
