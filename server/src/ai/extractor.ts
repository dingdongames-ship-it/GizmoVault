import { InboundWhatsAppMessage } from '../whatsapp/connector.js';

export interface ExtractedProductResult {
  title: string;
  category: string;
  suggested_category_id: string;
  brand?: string;
  model?: string;
  original_price: number;
  selling_price: number;
  discount_amount: number;
  discount_percent: number;
  specs: Record<string, string>;
  description: string;
  media_urls: string[];
  confidence_score: number;
  approval_status: 'NEEDS_REVIEW' | 'FLAGGED';
}

export interface ProductExtractor {
  extract(message: InboundWhatsAppMessage): Promise<ExtractedProductResult>;
}

// Deterministic High-Precision Rule & NLP Heuristic Extractor
export class HeuristicProductExtractor implements ProductExtractor {
  public async extract(message: InboundWhatsAppMessage): Promise<ExtractedProductResult> {
    const text = (message.raw_text || message.caption || '').trim();

    // 1. Price Extraction
    const { originalPrice, sellingPrice } = this.extractPrices(text);

    // 2. Brand & Category Extraction
    const { brand, category, suggestedCategoryId } = this.extractTaxonomy(text);

    // 3. Title Extraction
    const title = this.extractTitle(text, brand);

    // 4. Model Extraction
    const model = this.extractModel(text, brand);

    // 5. Specs Extraction
    const specs = this.extractSpecs(text, category);

    // 6. Math
    const discountAmount = Math.max(0, originalPrice - sellingPrice);
    const discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;

    // 7. Confidence Scoring
    let confidence = 0.0;
    if (title && title.length >= 5) confidence += 0.25;
    if (sellingPrice > 0) confidence += 0.25;
    if (originalPrice > 0 && originalPrice >= sellingPrice) confidence += 0.15;
    if (brand) confidence += 0.15;
    if (category) confidence += 0.10;
    if (Object.keys(specs).length > 0) confidence += 0.10;

    confidence = Math.min(1.0, Math.round(confidence * 100) / 100);

    const approvalStatus: 'NEEDS_REVIEW' | 'FLAGGED' = confidence >= 0.70 ? 'NEEDS_REVIEW' : 'FLAGGED';

    // Media URLs
    const mediaUrls: string[] = [];
    if (message.media_id) {
      mediaUrls.push(`https://media.gizmovault.internal/${message.media_id}.jpg`);
    }

    return {
      title,
      category,
      suggested_category_id: suggestedCategoryId,
      brand,
      model,
      original_price: originalPrice,
      selling_price: sellingPrice,
      discount_amount: discountAmount,
      discount_percent: discountPercent,
      specs,
      description: text,
      media_urls: mediaUrls,
      confidence_score: confidence,
      approval_status: approvalStatus
    };
  }

  private extractPrices(text: string): { originalPrice: number; sellingPrice: number } {
    let original = 0;
    let selling = 0;

    // Patterns for MRP / Original
    const mrpMatch = text.match(/(?:MRP|Original|Market\s*Price|Retail|Was|Actual)\s*(?:for|at|[:=-])?\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)/i);
    if (mrpMatch) {
      original = parseFloat(mrpMatch[1].replace(/,/g, ''));
    }

    // Patterns for Selling / Offer / Price
    const offerMatch = text.match(/(?:Selling|Offer|Now|Special|Our\s*Price|Price|Deal|Rate)\s*(?:for|at|[:=-])?\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)/i);
    if (offerMatch) {
      selling = parseFloat(offerMatch[1].replace(/,/g, ''));
    }

    // Generic fallback for any ₹ or Rs occurrences or bare numbers after MRP/selling
    if (selling === 0 || original === 0) {
      const allPrices = [...text.matchAll(/(?:(?:₹|Rs\.?|INR)\s*|(?:\b(?:mrp|selling|offer|price)\b\s*(?:for|at|[:=-])?\s*))([\d,]+)/gi)]
        .map((m) => parseFloat(m[1].replace(/,/g, '')))
        .filter((val) => val > 100 && val < 5000000);

      if (allPrices.length >= 2) {
        // Sort descending: larger is usually MRP, smaller is selling price
        const sorted = [...allPrices].sort((a, b) => b - a);
        if (original === 0) original = sorted[0];
        if (selling === 0) selling = sorted[1];
      } else if (allPrices.length === 1) {
        if (selling === 0) selling = allPrices[0];
        if (original === 0) original = Math.round(selling * 1.25); // estimate realistic MRP
      }
    }

    // Ensure sanity: selling price cannot exceed MRP
    if (selling > 0 && original > 0 && selling > original) {
      const temp = original;
      original = selling;
      selling = temp;
    }

    return { originalPrice: original, sellingPrice: selling };
  }

  private extractTaxonomy(text: string): { brand?: string; category: string; suggestedCategoryId: string } {
    const lower = text.toLowerCase();

    // Brand detection
    const knownBrands: Record<string, string> = {
      chronomaster: 'ChronoMaster',
      auracraft: 'AuraCraft',
      vortex: 'VortexTech',
      vortextech: 'VortexTech',
      soundcore: 'SoundCore Labs',
      nebulagear: 'NebulaGear',
      nebula: 'NebulaGear',
      zenaura: 'ZenAura',
      rolex: 'ChronoMaster', // mapped to authorized luxury partner brand
      seiko: 'AuraCraft',    // mapped to Japanese watch partner
      apple: 'VortexTech',
      samsung: 'VortexTech',
      dji: 'VortexTech',
      sony: 'SoundCore Labs'
    };

    let detectedBrand: string | undefined;
    for (const [key, bName] of Object.entries(knownBrands)) {
      if (lower.includes(key)) {
        detectedBrand = bName;
        break;
      }
    }

    // Category detection: Priority order
    // 1. Luxury Watches
    if (
      lower.includes('watch') ||
      lower.includes('tourbillon') ||
      lower.includes('chronograph') ||
      lower.includes('diver') ||
      lower.includes('nh35') ||
      lower.includes('bezel') ||
      lower.includes('gmt')
    ) {
      return {
        brand: detectedBrand || 'ChronoMaster',
        category: 'Imported Luxury Watches',
        suggestedCategoryId: 'cat_watches'
      };
    }

    // 2. Audio & Sound (check before phone because "headphone" contains "phone")
    if (
      lower.includes('headphone') ||
      lower.includes('earbuds') ||
      lower.includes('earphone') ||
      lower.includes('anc') ||
      lower.includes('audio') ||
      lower.includes('speaker') ||
      lower.includes('sound')
    ) {
      return {
        brand: detectedBrand || 'SoundCore Labs',
        category: 'Audio & Sound',
        suggestedCategoryId: 'cat_audio'
      };
    }

    // 3. Smartphones & Foldables
    if (
      /\b(?:phones?|smartphones?|foldables?)\b/i.test(text) ||
      lower.includes('fold pro') ||
      lower.includes('flip') ||
      lower.includes('snapdragon') ||
      lower.includes('5g')
    ) {
      return {
        brand: detectedBrand || 'VortexTech',
        category: 'Smartphones & Foldables',
        suggestedCategoryId: 'cat_phones'
      };
    }

    if (lower.includes('ring') || lower.includes('smartwatch') || lower.includes('wearable') || lower.includes('glasses') || lower.includes('fitness')) {
      return {
        brand: detectedBrand || 'AuraCraft',
        category: 'Smart Wearables',
        suggestedCategoryId: 'cat_wearables'
      };
    }

    if (lower.includes('drone') || lower.includes('camera') || lower.includes('gimbal') || lower.includes('mic')) {
      return {
        brand: detectedBrand || 'VortexTech',
        category: 'Photography & Drones',
        suggestedCategoryId: 'cat_drones'
      };
    }

    if (lower.includes('gaming') || lower.includes('console') || lower.includes('deck') || lower.includes('keyboard') || lower.includes('mouse')) {
      return {
        brand: detectedBrand || 'NebulaGear',
        category: 'Gaming Gear',
        suggestedCategoryId: 'cat_gaming'
      };
    }

    return {
      brand: detectedBrand || 'GizmoVault Editions',
      category: 'Smart Wearables',
      suggestedCategoryId: 'cat_wearables'
    };
  }

  private extractTitle(text: string, brand?: string): string {
    // Take the first line or sentence up to 60 characters
    const firstLine = text.split(/[\n\r.!?]/)[0].trim();
    if (firstLine.length >= 8 && firstLine.length <= 80) {
      return firstLine.replace(/^(fresh arrival|new arrival|in stock|just in|brand new|hot deal)[:\s-]*/i, '').trim();
    }
    return brand ? `${brand} Premium Edition` : 'GizmoVault Luxury Import';
  }

  private extractModel(text: string, brand?: string): string | undefined {
    const modelMatch = text.match(/(?:Model|Caliber|Series|Ref\.?)\s*[:=-]?\s*([A-Za-z0-9\-]+)/i);
    if (modelMatch) return modelMatch[1];
    return brand ? `${brand}-2026` : undefined;
  }

  private extractSpecs(text: string, category: string): Record<string, string> {
    const specs: Record<string, string> = {};
    const lower = text.toLowerCase();

    // Movement / Processor
    if (category === 'Imported Luxury Watches') {
      if (lower.includes('automatic')) specs['Movement'] = 'Automatic Mechanical';
      else if (lower.includes('quartz')) specs['Movement'] = 'High Precision Quartz';
      else if (lower.includes('manual') || lower.includes('hand-wound')) specs['Movement'] = 'Manual Wind Mechanical';

      if (lower.includes('sapphire')) specs['Crystal'] = 'Anti-Reflective Sapphire Crystal';
      if (lower.includes('ceramic')) specs['Bezel'] = 'Scratch-Proof High-Gloss Ceramic';
      if (lower.includes('steel') || lower.includes('316l') || lower.includes('904l')) specs['Case Material'] = '316L Stainless Steel';
      if (lower.includes('leather')) specs['Strap'] = 'Italian Handcrafted Leather';

      const waterMatch = text.match(/(\d+\s*(?:m|atm|bar)\s*(?:water\s*resist\w*|diver)?)/i);
      if (waterMatch) specs['Water Resistance'] = waterMatch[1];
    } else {
      if (lower.includes('snapdragon')) specs['Processor'] = 'Snapdragon 8 Gen 3';
      if (lower.includes('amoled') || lower.includes('oled')) specs['Display'] = 'High Refresh OLED / AMOLED';
      if (lower.includes('anc') || lower.includes('noise cancellation')) specs['Noise Cancellation'] = 'Hybrid Active Noise Cancellation';

      const batteryMatch = text.match(/(\d{3,5}\s*mah|\d+\s*hours?\s*battery)/i);
      if (batteryMatch) specs['Battery'] = batteryMatch[1];
    }

    return specs;
  }
}

export interface StructuredProductAttributes {
  title: string;
  brand?: string;
  model?: string;
  mrp: number;
  selling_price: number;
  category: string;
  suggested_category_id: string;
  specifications: Record<string, string>;
  description: string;
  confidence_score: number;
  discount_amount: number;
  discount_percent: number;
  media_urls: string[];
}

export class AIExtractionService {
  private extractor: ProductExtractor;

  constructor(extractor?: ProductExtractor) {
    this.extractor = extractor || new HeuristicProductExtractor();
  }

  public async extract(captionOrMessage: string | InboundWhatsAppMessage): Promise<StructuredProductAttributes> {
    let msg: InboundWhatsAppMessage;
    if (typeof captionOrMessage === 'string') {
      msg = {
        source_id: 'src_wa_meta',
        meta_message_id: `msg_${Date.now()}`,
        sender_phone: '+919876543210',
        message_type: 'text',
        raw_text: captionOrMessage,
        caption: captionOrMessage,
        timestamp: new Date().toISOString()
      };
    } else {
      msg = captionOrMessage;
    }

    const result = await this.extractor.extract(msg);
    return {
      title: result.title,
      brand: result.brand,
      model: result.model,
      mrp: result.original_price,
      selling_price: result.selling_price,
      category: result.category,
      suggested_category_id: result.suggested_category_id,
      specifications: result.specs,
      description: result.description,
      confidence_score: result.confidence_score,
      discount_amount: result.discount_amount,
      discount_percent: result.discount_percent,
      media_urls: result.media_urls
    };
  }
}

