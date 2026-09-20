import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { RecommendationEngine } from './recommendation.engine.js';

describe('Phase 22 — Recommendation Engine', () => {
  let db: DatabaseSync;
  let engine: RecommendationEngine;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    engine = new RecommendationEngine(db);
  });

  afterEach(() => { db.close(); });

  it('getRecommendations returns array of items with required fields', () => {
    const recs = engine.getRecommendations({ limit: 5 });
    expect(Array.isArray(recs)).toBe(true);
    recs.forEach(item => {
      expect(item.id).toBeDefined();
      expect(item.title).toBeDefined();
      expect(typeof item.sellingPrice).toBe('number');
      expect(item.reason).toBeDefined();
    });
  });

  it('getRecommendations respects limit parameter', () => {
    const recs = engine.getRecommendations({ limit: 3 });
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it('getRecommendations excludes currentProductId from results', () => {
    const product = db.prepare(
      `SELECT id FROM products WHERE is_published = 1 AND deleted_at IS NULL LIMIT 1`
    ).get() as { id: string } | undefined;

    if (product) {
      const recs = engine.getRecommendations({ currentProductId: product.id, limit: 10 });
      const ids = recs.map(r => r.id);
      expect(ids).not.toContain(product.id);
    }
  });

  it('getRecentlyViewed returns empty array for empty input', () => {
    const result = engine.getRecentlyViewed([]);
    expect(result).toHaveLength(0);
  });

  it('getForUser returns recommendations with reason string', () => {
    const recs = engine.getForUser('user_demo_01', 4);
    expect(Array.isArray(recs)).toBe(true);
    // May be empty if user has no orders — check structure when results exist
    recs.forEach(r => {
      expect(r.reason).toBeDefined();
      expect(r.id).toBeDefined();
    });
  });

  it('recommendation items include correct RecommendationItem interface fields', () => {
    const recs = engine.getRecommendations({ limit: 2 });
    recs.forEach(r => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('brand');
      expect(r).toHaveProperty('sellingPrice');
      expect(r).toHaveProperty('mrp');
      expect(r).toHaveProperty('discountPercent');
      expect(r).toHaveProperty('categoryId');
      expect(r).toHaveProperty('reason');
    });
  });
});
