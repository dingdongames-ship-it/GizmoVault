import crypto from 'crypto';
import { ShopifyProductDraft, ShopifyProductMedia } from '../models/catalog.model.js';

export interface ClassifyCatalogOptions {
  merchantId?: string;
  originalFilename?: string;
  customId?: string;
  tags?: string[];
}

export class CatalogClassifierService {

  public classifyCatalogItem(
    rawText: string,
    mediaUrl: string,
    mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE',
    options: ClassifyCatalogOptions = {}
  ): ShopifyProductDraft {
    const text = (rawText || '').trim();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Price & Currency Detection
    const { price, currency } = this.extractPriceAndCurrency(text);

    // 2. Category Detection
    const category = this.detectCategory(text, options.originalFilename);

    // 3. Title Extraction with Fallbacks
    const title = this.extractTitle(lines, category, options.originalFilename);

    // 4. Clean Shopify-Style Description HTML
    const descriptionHtml = this.generateDescriptionHtml(lines, text, category, price, currency);

    const media: ShopifyProductMedia[] = mediaUrl
      ? [{ url: mediaUrl, media_type: mediaType, position: 1 }]
      : [];

    return {
      id: options.customId || crypto.randomUUID(),
      merchant_id: options.merchantId || 'default_merchant',
      title,
      description_html: descriptionHtml,
      status: 'DRAFT',
      category,
      price,
      currency,
      media,
      raw_whatsapp_source: {
        raw_text: text,
        original_filename: options.originalFilename,
        tags: options.tags || [],
        classified_at: new Date().toISOString()
      }
    };
  }

  private extractPriceAndCurrency(text: string): { price: number; currency: string } {
    let currency = 'INR';
    if (/\$|USD/i.test(text)) currency = 'USD';
    else if (/€|EUR/i.test(text)) currency = 'EUR';
    else if (/£|GBP/i.test(text)) currency = 'GBP';
    else if (/AED|DHS/i.test(text)) currency = 'AED';

    // Patterns like ₹2,999, Rs. 2999, Price: 2999, etc.
    const pricePatterns = [
      /(?:₹|rs\.?|inr)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+)/i,
      /(?:price|offer|discount|deal|only)\s*[:=-]?\s*(?:₹|rs\.?|inr|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+)/i,
      /(?:\$|€|£)\s*([0-9]+(?:\.[0-9]{2})?)/,
      /\b([1-9][0-9]{2,5})\s*(?:rs|inr|\/-)/i
    ];

    for (const pattern of pricePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleanedNumber = match[1].replace(/,/g, '');
        const parsed = parseFloat(cleanedNumber);
        if (!isNaN(parsed) && parsed > 0) {
          return { price: parsed, currency };
        }
      }
    }

    return { price: 0.0, currency };
  }

  private detectCategory(text: string, filename?: string): string {
    const combined = `${text} ${filename || ''}`.toLowerCase();

    if (/watch|amoled|dial|chronograph|rolex|quartz|wrist|strap|smartwatch/i.test(combined)) {
      return 'Imported Watches';
    }
    if (/airpods|earbuds|earphone|headphone|bluetooth|speaker|tws|soundbar/i.test(combined)) {
      return 'Audio Products';
    }
    if (/charger|cable|adapter|case|cover|holder|stand|power\s*bank|tempered/i.test(combined)) {
      return 'Mobile Accessories';
    }
    if (/drone|gimbal|camera|gadget|smart\s*device|projector|tracker/i.test(combined)) {
      return 'Electronic Gadgets';
    }
    if (/shirt|hoodie|jacket|shoes|sneakers|perfume|wallet|belt|sunglasses/i.test(combined)) {
      return 'Fashion';
    }
    if (/lamp|diffuser|light|decor|pillow|clock/i.test(combined)) {
      return 'Home Decor';
    }

    return 'Electronic Gadgets';
  }

  private extractTitle(lines: string[], category: string, filename?: string): string {
    if (lines.length > 0) {
      // Find first line that isn't just a price or link
      for (const line of lines) {
        const clean = line.replace(/[₹$€£]|https?:\S+/g, '').trim();
        if (clean.length >= 4 && clean.length <= 100 && !/^(price|rs|dm|contact|whatsapp)/i.test(clean)) {
          return clean;
        }
      }
    }

    // Fallback based on filename or category
    if (filename) {
      const cleanName = filename
        .replace(/\.[^/.]+$/, '') // remove extension
        .replace(/[_-]+/g, ' ')
        .trim();
      if (cleanName.length > 3 && !/^wa|img|vid|whatsapp/i.test(cleanName)) {
        return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      }
    }

    return `${category} Item - ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
  }

  private generateDescriptionHtml(
    lines: string[],
    rawText: string,
    category: string,
    price: number,
    currency: string
  ): string {
    if (!rawText || rawText.trim().length === 0) {
      return `<p>Newly ingested ${category} item from WhatsApp catalog sync.</p>`;
    }

    const featureLines: string[] = [];
    const narrativeLines: string[] = [];

    for (const line of lines) {
      if (/^[-*•]|\b(feature|spec|battery|display|bluetooth|warranty|calling|waterproof|strap|color)\b/i.test(line)) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (cleaned) featureLines.push(cleaned);
      } else {
        narrativeLines.push(line);
      }
    }

    let html = '';
    if (narrativeLines.length > 0) {
      html += `<p>${narrativeLines.join('<br/>')}</p>`;
    } else {
      html += `<p>${category} imported quality product.</p>`;
    }

    if (featureLines.length > 0) {
      html += '<h4>Key Features</h4><ul>';
      for (const feat of featureLines) {
        html += `<li>${feat}</li>`;
      }
      html += '</ul>';
    }

    if (price > 0) {
      html += `<p><strong>Price:</strong> ${currency === 'INR' ? '₹' : currency + ' '}${price.toLocaleString('en-IN')}</p>`;
    }

    return html;
  }
}
