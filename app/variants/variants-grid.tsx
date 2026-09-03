'use client';

import { useEffect, useState, useRef } from 'react';
import { formatDateMonthDayTbilisi, formatTimeTbilisi } from '@/lib/date-utils';

interface Variant {
  id: number;
  slug: string;
  name: string;
  description: string;
  file: string;
  avg_stars: number | null;
  rating_count: number;
  pick_count: number;
  comment_count: number;
  is_new: boolean;
  user_stars?: number;
  user_picked?: boolean;
}

interface Comment {
  id: number;
  name: string | null;
  body: string;
  created_at: string;
}

function StarRating({ 
  stars, 
  onRate, 
  disabled 
}: { 
  stars?: number; 
  onRate: (stars: number) => void; 
  disabled?: boolean;
}) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          className={`star ${s <= (stars || 0) ? 'filled' : ''}`}
          onClick={() => !disabled && onRate(s)}
          disabled={disabled}
          aria-label={`Rate ${s} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function VariantCard({ variant, onExpand }: { variant: Variant; onExpand: () => void }) {
  const [userStars, setUserStars] = useState(variant.user_stars);
  const [userPicked, setUserPicked] = useState(variant.user_picked || false);
  const [rating, setRating] = useState(false);
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

  const handleRate = async (stars: number) => {
    setRating(true);
    try {
      const response = await fetch(`/api/variants/${variant.slug}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars }),
      });
      if (response.ok) {
        setUserStars(stars);
      }
    } catch (error) {
      console.error('Error rating:', error);
    } finally {
      setRating(false);
    }
  };

  const handlePick = async () => {
    try {
      const response = await fetch(`/api/variants/${variant.slug}/pick`, {
        method: 'POST',
      });
      if (response.ok) {
        setUserPicked(true);
      }
    } catch (error) {
      console.error('Error picking:', error);
    }
  };

  return (
    <div className="variant-card" id={variant.slug}>
      <div className="variant-thumbnail" ref={containerRef}>
        <iframe
          ref={iframeRef}
          src={`/variants/${variant.file}`}
          title={`Variant ${variant.slug}`}
          sandbox="allow-same-origin"
          loading="lazy"
        />
      </div>
      <div className="variant-info">
        <div className="variant-header">
          <h3>
            <span className="variant-number">{variant.slug}</span> {variant.name}
          </h3>
          {variant.is_new && <span className="badge">new</span>}
        </div>
        <p className="variant-description">{variant.description}</p>
        <div className="variant-stats">
          <div className="stat">
            {variant.avg_stars ? Number(variant.avg_stars).toFixed(1) : 'n/a'} ★
            <span className="stat-label">({variant.rating_count})</span>
          </div>
          <div className="stat">
            {variant.pick_count} <span className="stat-label">picks</span>
          </div>
          <div className="stat">
            {variant.comment_count} <span className="stat-label">comments</span>
          </div>
        </div>
        <div className="variant-actions">
          <StarRating stars={userStars} onRate={handleRate} disabled={rating} />
          <button
            type="button"
            className={`btn ${userPicked ? 'btn-picked' : 'btn-secondary'}`}
            onClick={handlePick}
          >
            {userPicked ? '✓ picked' : 'pick this one'}
          </button>
        </div>
        <div className="variant-links">
          <a href={`/variants/${variant.file}`} target="_blank" rel="noopener noreferrer">
            view full screen →
          </a>
          <button type="button" className="link-button" onClick={onExpand}>
            view comments →
          </button>
        </div>
      </div>
    </div>
  );
}

function VariantExpanded({ 
  variant, 
  onClose,
  dwellToken
}: { 
  variant: Variant; 
  onClose: () => void;
  dwellToken: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadComments();
  }, [variant.slug]);

  const loadComments = async () => {
    try {
      const response = await fetch(`/api/variants/${variant.slug}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!body.trim()) {
      setError('comment body is required');
      return;
    }

    if (body.length > 2000) {
      setError('comment must be 2000 characters or less');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/variants/${variant.slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim() || undefined, 
          body: body.trim(),
          website,
          t0: dwellToken
        }),
      });

      if (response.ok) {
        setName('');
        setBody('');
        setWebsite('');
        loadComments();
      } else {
        const data = await response.json();
        setError(data.error || 'failed to post comment');
      }
    } catch (error) {
      setError('failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="variant-expanded">
      <div className="variant-expanded-header">
        <h2>
          <span className="variant-number">{variant.slug}</span> {variant.name}
        </h2>
        <button type="button" className="btn-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <p className="variant-description">{variant.description}</p>

      <div className="comments-section">
        <h3>comments ({variant.comment_count})</h3>
        
        <form onSubmit={handleSubmit} className="comment-form">
          <input
            type="text"
            placeholder="your name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            disabled={submitting}
          />
          <input
            type="text"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-9999px',
              width: '1px',
              height: '1px',
              opacity: 0
            }}
          />
          <textarea
            placeholder="your comment"
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={2000}
            rows={4}
            required
            disabled={submitting}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'posting...' : 'post comment'}
          </button>
        </form>

        {loading ? (
          <p>loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="no-comments">no comments yet. be the first!</p>
        ) : (
          <div className="comments-list">
            {comments.map(comment => (
              <div key={comment.id} className="comment">
                <div className="comment-header">
                  <span className="comment-author">{comment.name || 'anonymous'}</span>
                  <span className="comment-date">
                    {formatDateMonthDayTbilisi(comment.created_at)} at {formatTimeTbilisi(comment.created_at)}
                  </span>
                </div>
                <p className="comment-body">{comment.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VariantsGrid({ variants: initialVariants, dwellToken }: { variants: Variant[]; dwellToken: string }) {
  const [expandedVariant, setExpandedVariant] = useState<Variant | null>(null);

  useEffect(() => {
    // Handle hash navigation
    if (window.location.hash) {
      const slug = window.location.hash.slice(1);
      const element = document.getElementById(slug);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight');
          setTimeout(() => element.classList.remove('highlight'), 2000);
        }, 100);
      }
    }
  }, []);

  return (
    <>
      <div className="variants-grid">
        {initialVariants.map(variant => (
          <VariantCard 
            key={variant.id} 
            variant={variant} 
            onExpand={() => setExpandedVariant(variant)}
          />
        ))}
      </div>

      {expandedVariant && (
        <div className="modal-overlay" onClick={() => setExpandedVariant(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <VariantExpanded 
              variant={expandedVariant} 
              onClose={() => setExpandedVariant(null)}
              dwellToken={dwellToken}
            />
          </div>
        </div>
      )}
    </>
  );
}
