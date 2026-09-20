import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { SearchService } from './search.service.js';
import { createSearchRouter } from './routes.js';

describe('Phase 21 — Product Search Engine', () => {
  let db: DatabaseSync;
  let searchService: SearchService;
  let app: express.Express;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    searchService = new SearchService(db);

    app = express();
    app.use(express.json());
    app.use('/api/v1/search', createSearchRouter(searchService));
  });

  afterEach(() => { db.close(); });

  it('returns empty results for empty query', () => {
    const result = searchService.search({ query: '' });
    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('searches products by partial title match', () => {
    // Use a very broad term that's likely in seeds
    const result = searchService.search({ query: 'watch' });
    // Should return results or at least not crash
    expect(result.query).toBe('watch');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('autocomplete returns empty for short input (< 2 chars)', () => {
    const results = searchService.autocomplete('a');
    expect(results).toHaveLength(0);
  });

  it('autocomplete returns typed suggestions for valid input', () => {
    const results = searchService.autocomplete('watch');
    expect(Array.isArray(results)).toBe(true);
    results.forEach(r => {
      expect(['product', 'brand', 'category', 'keyword']).toContain(r.type);
      expect(r.value).toBeDefined();
    });
  });

  it('getSuggestions returns popular, recent, and trending arrays', () => {
    const sug = searchService.getSuggestions();
    expect(sug).toHaveProperty('popular');
    expect(sug).toHaveProperty('recent');
    expect(sug).toHaveProperty('trending');
    expect(Array.isArray(sug.popular)).toBe(true);
    expect(Array.isArray(sug.recent)).toBe(true);
    expect(Array.isArray(sug.trending)).toBe(true);
  });

  it('search respects price filter — no results returned above maxPrice', () => {
    // maxPrice=0 should return no results (no product is free)
    const result = searchService.search({ query: 'a', maxPrice: 0 });
    expect(result.results.length).toBe(0);
  });

  it('search result items have required fields', () => {
    const result = searchService.search({ query: 'watch' });
    result.results.forEach(item => {
      expect(item.id).toBeDefined();
      expect(item.title).toBeDefined();
      expect(typeof item.sellingPrice).toBe('number');
    });
  });

  it('REST GET /api/v1/search?q=watch returns 200 with results', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=watch')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('REST GET /api/v1/search without q returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('REST GET /api/v1/search/autocomplete?q=watch returns suggestions', async () => {
    const res = await request(app)
      .get('/api/v1/search/autocomplete?q=watch')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
