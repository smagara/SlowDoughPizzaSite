import React from 'react';
import type { PreviewTemplateComponentProps } from 'decap-cms-core';

/**
 * Brand-matched live preview panes for each Decap CMS collection.
 * These run inside the CMS's preview iframe (styled by previewStyles.ts)
 * and give the pizza shop owner a near-WYSIWYG sense of how an edit will
 * look on the live site before they submit it for review.
 */

export const AnnouncementPreview: React.FC<PreviewTemplateComponentProps> = ({ entry }) => {
  const data = entry.get('data');
  const isActive = data.get('isActive');
  const badgeText = data.get('badgeText') || '';
  const detailText = data.get('detailText') || '';
  const heroEyebrow = data.get('heroEyebrow') || '';
  const heroHeadline = data.get('heroHeadline') || '';
  const heroBody = data.get('heroBody') || '';

  return (
    <div>
      {isActive ? (
        <div className="sd-banner">
          <span className="sd-dot" />
          <span>{badgeText}</span>
          {detailText ? <span> • {detailText}</span> : null}
        </div>
      ) : (
        <div className="sd-meta">(Banner currently hidden — "Show Banner?" is off)</div>
      )}
      <div className="sd-eyebrow">{heroEyebrow}</div>
      <h1 style={{ fontSize: 34, margin: '6px 0' }}>{heroHeadline}</h1>
      <p style={{ fontSize: 16, color: '#524940', maxWidth: 600 }}>{heroBody}</p>
    </div>
  );
};

export const MenuPreview: React.FC<PreviewTemplateComponentProps> = ({ entry }) => {
  const data = entry.get('data');
  const categories = data.get('categories')?.toJS?.() ?? [];

  return (
    <div>
      <div className="sd-eyebrow">{data.get('sectionLabel')}</div>
      <h2 style={{ fontSize: 28, margin: '6px 0' }}>{data.get('sectionTitle')}</h2>
      <p style={{ color: '#615448' }}>{data.get('sectionIntro')}</p>
      {categories.map((cat: any, ci: number) => (
        <div key={cat.id ?? ci} style={{ marginTop: 24 }}>
          <h3 style={{ borderBottom: '1px solid #ded3c5', paddingBottom: 8 }}>{cat.title}</h3>
          <p className="sd-meta">{cat.subtitle}</p>
          {(cat.items ?? []).map((item: any, ii: number) => (
            <div key={item.id ?? ii} className="sd-card">
              <span className="sd-price">${item.price}</span>
              <strong>{item.name}</strong>
              {item.italianName && (
                <div style={{ fontStyle: 'italic', color: '#8a7a6c', fontSize: 12 }}>{item.italianName}</div>
              )}
              <p style={{ fontSize: 14, color: '#5c5247' }}>{item.description}</p>
              {(item.tags ?? []).map((tag: string, ti: number) => (
                <span className="sd-tag" key={ti}>{tag}</span>
              ))}
            </div>
          ))}
        </div>
      ))}
      <div className="sd-card" style={{ borderStyle: 'dashed' }}>{data.get('orderingNote')}</div>
    </div>
  );
};

export const HoursPreview: React.FC<PreviewTemplateComponentProps> = ({ entry }) => {
  const data = entry.get('data');
  const days = data.get('days')?.toJS?.() ?? [];

  return (
    <div>
      <h2 style={{ fontSize: 26 }}>Store Hours & Location</h2>
      <p style={{ color: '#615448' }}>{data.get('sectionNote')}</p>
      <div className="sd-card">
        {days.map((d: any, i: number) => (
          <div
            key={i}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #ece2d6' }}
          >
            <span>{d.day}{d.statusNote ? `  (${d.statusNote})` : ''}</span>
            <span className={d.isClosed ? 'sd-closed' : ''}>{d.hours}</span>
          </div>
        ))}
      </div>
      <div className="sd-card" style={{ borderStyle: 'dashed' }}>{data.get('batchCapacityNote')}</div>
    </div>
  );
};

export const BlogPreview: React.FC<PreviewTemplateComponentProps> = ({ entry, widgetFor }) => {
  const data = entry.get('data');
  const takeaways: string[] = data.get('keyTakeaways')?.toJS?.() ?? [];
  const meta = [data.get('author'), data.get('authorRole'), data.get('readTime'), data.get('publishedDate')]
    .filter(Boolean)
    .join(' • ');

  return (
    <div>
      <div className="sd-eyebrow">The Baker&apos;s Journal</div>
      <div className="sd-meta">{meta}</div>
      <h1 style={{ fontSize: 32, margin: '4px 0' }}>{data.get('title')}</h1>
      <p style={{ fontStyle: 'italic', color: '#78695c' }}>{data.get('subtitle')}</p>
      {takeaways.length > 0 && (
        <div className="sd-card">
          <strong>Key Takeaways</strong>
          <ul>
            {takeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <div>{widgetFor('body')}</div>
    </div>
  );
};
