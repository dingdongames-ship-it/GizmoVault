import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';

export interface CategoryClassificationResult {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  confidence: number;
  routingStatus: 'AUTO_ASSIGNED' | 'SUGGESTED' | 'UNCATEGORIZED';
  matchedKeywords: string[];
  subcategory?: string;
}

interface CategoryRule {
  id: string;
  name: string;
  slug: string;
  primaryKeywords: string[];
  secondaryKeywords: string[];
  negativeKeywords: string[];
  subcategories?: Array<{ name: string; keywords: string[] }>;
}

export class SmartCategoryService {
  private db: DatabaseSync;
  private rules: CategoryRule[];

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
    this.rules = [
      {
        id: 'cat_watches',
        name: 'Imported Luxury Watches',
        slug: 'imported-luxury-watches',
        primaryKeywords: ['watch', 'tourbillon', 'chronograph', 'diver', 'nh35', 'bezel', 'rolex', 'seiko', 'patek', 'audemars', 'submariner', 'automatic', 'skeleton'],
        secondaryKeywords: ['sapphire', 'ceramic', '316l', 'dial', 'leather strap', 'water resistant', 'jewels', 'skeleton', 'power reserve', 'caliber'],
        negativeKeywords: ['smartwatch', 'apple watch', 'wearable', 'fitness band'],
        subcategories: [
          { name: 'Mechanical & Automatic', keywords: ['automatic', 'mechanical', 'nh35', 'skeleton', 'tourbillon'] },
          { name: 'Diver & Tool Watches', keywords: ['diver', '300m', '200m', 'helium', 'submariner', 'bezel'] },
          { name: 'Chronographs', keywords: ['chronograph', 'tachymeter', 'stopwatch', 'monopusher'] }
        ]
      },
      {
        id: 'cat_phones',
        name: 'Smartphones & Foldables',
        slug: 'smartphones-foldables',
        primaryKeywords: ['phone', 'smartphone', 'foldable', 'fold pro', 'flip', 'snapdragon', 'iphone', 'galaxy', '5g', 'amoled'],
        secondaryKeywords: ['camera', '200mp', '50mp', 'periscope', 'ram', 'storage', 'fast charging', 'screen', 'android'],
        negativeKeywords: ['headphone', 'earphone', 'watch', 'drone'],
        subcategories: [
          { name: 'Foldable & Flip Phones', keywords: ['fold', 'flip', 'dual screen', 'crease', 'inner display'] },
          { name: 'Flagship Smartphones', keywords: ['ultra', 'pro 5g', 'snapdragon 8', 'titanium', '200mp'] }
        ]
      },
      {
        id: 'cat_audio',
        name: 'Audio & Sound',
        slug: 'audio-sound',
        primaryKeywords: ['headphone', 'headphones', 'earbuds', 'earphone', 'earphones', 'speaker', 'audio', 'soundbar', 'hi-fi'],
        secondaryKeywords: ['anc', 'noise cancellation', 'spatial audio', 'bluetooth', 'bass', 'drivers', 'ldac', 'microphones', 'playtime'],
        negativeKeywords: ['smartwatch', 'smart glasses'],
        subcategories: [
          { name: 'Over-Ear Headphones', keywords: ['over-ear', 'headband', 'earcups', 'memory foam'] },
          { name: 'True Wireless Earbuds', keywords: ['tws', 'earbuds', 'charging case', 'in-ear'] },
          { name: 'Bluetooth Speakers', keywords: ['speaker', 'portable', 'waterproof', 'partycast', 'woofer'] }
        ]
      },
      {
        id: 'cat_wearables',
        name: 'Smart Wearables',
        slug: 'smart-wearables',
        primaryKeywords: ['smartwatch', 'smart ring', 'smart glasses', 'smartring', 'wearable', 'fitness band', 'activity tracker', 'smartband'],
        secondaryKeywords: ['ecg', 'heart rate', 'spo2', 'sleep tracking', 'hrv', 'gps', 'pedometer', 'waterproof', 'health'],
        negativeKeywords: ['chronograph', 'tourbillon', 'analog'],
        subcategories: [
          { name: 'Smart Rings', keywords: ['ring', 'smartring', 'finger', 'sleep tracking', 'stealth'] },
          { name: 'Rugged Smartwatches', keywords: ['smartwatch', '49mm', 'gps', 'dive computer', 'ecg'] },
          { name: 'AR Smart Glasses', keywords: ['glasses', 'heads-up', 'hud', 'waveguide', 'micro-oled'] }
        ]
      },
      {
        id: 'cat_gaming',
        name: 'Gaming Gear',
        slug: 'gaming-gear',
        primaryKeywords: ['gaming', 'console', 'handheld', 'mechanical keyboard', 'gaming mouse', 'esports', 'deck', 'rgb'],
        secondaryKeywords: ['hall effect', 'rapid trigger', 'polling rate', 'dpi', 'switches', 'ryzen z1', 'nvme', 'analog sticks'],
        negativeKeywords: ['drone', 'camera'],
        subcategories: [
          { name: 'Handheld Gaming Consoles', keywords: ['handheld', 'console', 'deck', 'ryzen', 'joystick'] },
          { name: 'Esports Keyboards', keywords: ['keyboard', 'rapid trigger', 'hall effect', 'mechanical switches'] },
          { name: 'Precision Mice', keywords: ['mouse', 'ultralight', 'dpi', 'skates', 'paw3395'] }
        ]
      },
      {
        id: 'cat_drones',
        name: 'Photography & Drones',
        slug: 'photography-drones',
        primaryKeywords: ['drone', 'gimbal', 'camera', 'quadcopter', 'aerial', 'sub-249g', 'lavalier', 'vlog'],
        secondaryKeywords: ['4k', 'fps', 'sensor', 'flight time', 'obstacle sensing', 'wireless mic', '32-bit float', '3-axis'],
        negativeKeywords: ['smartwatch', 'mechanical watch'],
        subcategories: [
          { name: 'Camera Drones', keywords: ['drone', 'quadcopter', 'flight', 'obstacle', 'sub-249g'] },
          { name: 'Pocket Gimbal Cameras', keywords: ['pocket', 'gimbal camera', 'activetrack', 'touchscreen'] },
          { name: 'Wireless Creator Microphones', keywords: ['lavalier', 'mic', 'receiver', 'transmitter', '32-bit float'] }
        ]
      }
    ];
  }

  public classify(
    title: string,
    description: string = '',
    specs: Record<string, string> = {},
    brand: string = ''
  ): CategoryClassificationResult {
    const combinedText = `${title} ${description} ${brand} ${Object.values(specs).join(' ')}`.toLowerCase();

    let bestCategory: CategoryRule | null = null;
    let highestScore = 0.0;
    let matchedWords: string[] = [];

    for (const rule of this.rules) {
      // Check negative keywords (if any hit strongly, penalize score)
      let negativeHit = false;
      for (const neg of rule.negativeKeywords) {
        if (combinedText.includes(neg)) {
          negativeHit = true;
          break;
        }
      }

      const currentMatches: string[] = [];
      let score = 0.0;

      // Primary keywords (high weight +0.40 per match)
      for (const kw of rule.primaryKeywords) {
        if (combinedText.includes(kw)) {
          currentMatches.push(kw);
          score += 0.40;
        }
      }

      // Secondary keywords (+0.15 per match)
      for (const kw of rule.secondaryKeywords) {
        if (combinedText.includes(kw)) {
          currentMatches.push(kw);
          score += 0.15;
        }
      }

      // Negative penalty
      if (negativeHit) {
        score -= 0.50;
      }

      // Cap and round to 2 decimal places
      score = Math.round(Math.min(1.0, Math.max(0.0, score)) * 100) / 100;

      if (score > highestScore) {
        highestScore = score;
        bestCategory = rule;
        matchedWords = currentMatches;
      }
    }

    // Determine subcategory if a category matched
    let subcategory: string | undefined;
    if (bestCategory && bestCategory.subcategories) {
      for (const sub of bestCategory.subcategories) {
        if (sub.keywords.some((kw) => combinedText.includes(kw))) {
          subcategory = sub.name;
          break;
        }
      }
    }

    // Confidence routing status
    let routingStatus: CategoryClassificationResult['routingStatus'] = 'UNCATEGORIZED';
    if (highestScore >= 0.70) {
      routingStatus = 'AUTO_ASSIGNED';
    } else if (highestScore >= 0.40) {
      routingStatus = 'SUGGESTED';
    }

    if (!bestCategory || highestScore < 0.20) {
      return {
        categoryId: 'cat_wearables', // fallback general category
        categoryName: 'Smart Wearables',
        categorySlug: 'smart-wearables',
        confidence: 0.10,
        routingStatus: 'UNCATEGORIZED',
        matchedKeywords: []
      };
    }

    return {
      categoryId: bestCategory.id,
      categoryName: bestCategory.name,
      categorySlug: bestCategory.slug,
      confidence: Math.round(highestScore * 100) / 100,
      routingStatus,
      matchedKeywords: matchedWords,
      subcategory
    };
  }

  public getAllCategories(): any[] {
    return this.db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.sort_order ASC
    `).all();
  }
}
