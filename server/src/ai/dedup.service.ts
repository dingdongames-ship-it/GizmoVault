import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';

export interface DuplicateMatch {
  productId: string;
  sku: string;
  title: string;
  brand?: string;
  model?: string;
  similarityScore: number;
  matchType: 'EXACT_MATCH' | 'HIGH_CONFIDENCE_DUPLICATE' | 'POSSIBLE_VARIANT' | 'UNIQUE';
}

export interface CandidateItem {
  title: string;
  brand?: string;
  model?: string;
  specs?: Record<string, string>;
  selling_price?: number;
}

export class DeduplicationService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  // 1. Generate Canonical Product Fingerprint
  public generateFingerprint(candidate: CandidateItem): string {
    const cleanBrand = (candidate.brand || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const cleanModel = (candidate.model || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    // Stop words to remove from title
    const stopWords = new Set([
      'new', 'in', 'stock', 'arrival', 'fresh', 'best', 'offer', 'deal',
      'price', 'hot', 'authentic', 'imported', 'with', 'box', 'papers',
      'the', 'and', 'for', 'mrp', 'original', 'retail', 'sale', 'limited'
    ]);

    const titleTokens = candidate.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t))
      .sort();

    const specSignatures: string[] = [];
    if (candidate.specs) {
      for (const [key, val] of Object.entries(candidate.specs)) {
        const cleanVal = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanVal.length > 2) {
          specSignatures.push(`${key.slice(0, 3).toUpperCase()}:${cleanVal}`);
        }
      }
      specSignatures.sort();
    }

    const payload = `${cleanBrand}|${cleanModel}|${titleTokens.join(' ')}|${specSignatures.join(';')}`;
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  // 2. Token Jaccard & N-gram Similarity Computation
  public computeSimilarity(text1: string, text2: string): number {
    const tokenize = (str: string): Set<string> => {
      const clean = str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);
      return new Set(clean);
    };

    const tokens1 = tokenize(text1);
    const tokens2 = tokenize(text2);

    if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

    let intersectionCount = 0;
    for (const t of tokens1) {
      if (tokens2.has(t)) intersectionCount++;
    }

    const unionCount = new Set([...tokens1, ...tokens2]).size;
    const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0.0;

    return Math.round(jaccard * 100) / 100;
  }

  // 3. Match candidate against catalog
  public findDuplicates(candidate: CandidateItem): DuplicateMatch[] {
    const products = this.db.prepare(`
      SELECT p.id, p.sku, p.title, b.name as brand_name, p.model, p.selling_price
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.deleted_at IS NULL
    `).all() as any[];

    const matches: DuplicateMatch[] = [];

    const candidateFullStr = `${candidate.brand || ''} ${candidate.model || ''} ${candidate.title}`;

    for (const prod of products) {
      // Direct model match
      if (candidate.model && prod.model && candidate.model.toLowerCase() === prod.model.toLowerCase()) {
        matches.push({
          productId: prod.id,
          sku: prod.sku,
          title: prod.title,
          brand: prod.brand_name,
          model: prod.model,
          similarityScore: 0.95,
          matchType: 'HIGH_CONFIDENCE_DUPLICATE'
        });
        continue;
      }

      const prodFullStr = `${prod.brand_name || ''} ${prod.model || ''} ${prod.title}`;
      const titleScore = this.computeSimilarity(candidate.title, prod.title);
      const fullScore = this.computeSimilarity(candidateFullStr, prodFullStr);
      const score = Math.max(titleScore, fullScore);

      if (score >= 0.75) {
        matches.push({
          productId: prod.id,
          sku: prod.sku,
          title: prod.title,
          brand: prod.brand_name,
          model: prod.model,
          similarityScore: score,
          matchType: 'HIGH_CONFIDENCE_DUPLICATE'
        });
      } else if (score >= 0.40) {
        matches.push({
          productId: prod.id,
          sku: prod.sku,
          title: prod.title,
          brand: prod.brand_name,
          model: prod.model,
          similarityScore: score,
          matchType: 'POSSIBLE_VARIANT'
        });
      }
    }

    return matches.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  // 4. Inspect and tag extracted product with duplicate reference
  public evaluateAndTagExtractedProduct(extractedProductId: string): {
    isDuplicate: boolean;
    duplicateOf?: string;
    similarityScore: number;
  } {
    const ext = this.db.prepare(`
      SELECT * FROM extracted_products WHERE id = ?
    `).get(extractedProductId) as any;

    if (!ext) {
      throw new Error(`Extracted product ${extractedProductId} not found`);
    }

    const matches = this.findDuplicates({
      title: ext.extracted_title || '',
      brand: ext.extracted_brand,
      model: ext.extracted_model
    });

    const bestMatch = matches[0];

    if (bestMatch && (bestMatch.matchType === 'HIGH_CONFIDENCE_DUPLICATE' || bestMatch.similarityScore >= 0.80)) {
      this.db.prepare(`
        UPDATE extracted_products
        SET duplicate_of_product_id = ?, approval_status = 'FLAGGED'
        WHERE id = ?
      `).run(bestMatch.productId, extractedProductId);

      return {
        isDuplicate: true,
        duplicateOf: bestMatch.productId,
        similarityScore: bestMatch.similarityScore
      };
    }

    return {
      isDuplicate: false,
      similarityScore: bestMatch ? bestMatch.similarityScore : 0.0
    };
  }
}

export { DeduplicationService as ProductDeduplicationService };

