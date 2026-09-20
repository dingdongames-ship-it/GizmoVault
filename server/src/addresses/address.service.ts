import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

export interface AddressRecord {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface AddressInput {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

export interface ShippingCalculationParams {
  country?: string;
  postalCode?: string;
  subtotal: number;
  method?: 'STANDARD' | 'EXPRESS' | 'INTERNATIONAL';
}

export interface ShippingOption {
  method: 'STANDARD' | 'EXPRESS' | 'INTERNATIONAL';
  title: string;
  fee: number;
  isFree: boolean;
  timeline: string;
  carrier: string;
}

export interface ShippingCalculationResult {
  selectedOption: ShippingOption;
  availableOptions: ShippingOption[];
  isInternational: boolean;
  deliveryEstimateDays: number;
  freeShippingThreshold: number;
  amountNeededForFreeShipping: number;
}

export class AddressService {
  private db: DatabaseSync;

  // Configurable shipping policy
  private freeDomesticThreshold = 999;
  private standardDomesticFee = 99;
  private expressDomesticFee = 199;
  private internationalAirFee = 1499;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  /**
   * Validates address input for domestic (India) or international formats.
   */
  public validateAddressInput(input: AddressInput): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const country = (input.country || 'IN').trim().toUpperCase();

    if (!input.fullName || input.fullName.trim().length < 2) {
      errors.push('Full name must be at least 2 characters.');
    }

    if (!input.phone || input.phone.trim().length < 7) {
      errors.push('A valid contact phone number is required.');
    } else if (country === 'IN') {
      const cleanPhone = input.phone.replace(/[\s\-\(\)\+]/g, '');
      // Expect 10 digits or 12 digits starting with 91
      if (!/^(?:91)?[6-9]\d{9}$/.test(cleanPhone)) {
        errors.push('Please enter a valid 10-digit Indian mobile number.');
      }
    }

    if (!input.addressLine1 || input.addressLine1.trim().length < 5) {
      errors.push('Address Line 1 is required (building, street, landmark).');
    }

    if (!input.city || input.city.trim().length < 2) {
      errors.push('City is required.');
    }

    if (!input.state || input.state.trim().length < 2) {
      errors.push('State / Province / Region is required.');
    }

    if (!input.postalCode || input.postalCode.trim().length < 3) {
      errors.push('Postal / PIN Code is required.');
    } else if (country === 'IN') {
      if (!/^\d{6}$/.test(input.postalCode.trim())) {
        errors.push('Please enter a valid 6-digit Indian PIN code.');
      }
    } else {
      if (!/^[A-Za-z0-9\s\-]{3,10}$/.test(input.postalCode.trim())) {
        errors.push('Please enter a valid international postal code.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Adds a new address to the user's address book.
   */
  public addAddress(userId: string, input: AddressInput): AddressRecord {
    const validation = this.validateAddressInput(input);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '));
    }

    const existingCount = this.db.prepare('SELECT COUNT(*) as count FROM addresses WHERE user_id = ?').get(userId) as { count: number };
    const shouldBeDefault = input.isDefault || existingCount.count === 0;

    if (shouldBeDefault) {
      this.db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
    }

    const id = `addr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const country = (input.country || 'IN').trim().toUpperCase();

    const insertStmt = this.db.prepare(`
      INSERT INTO addresses (
        id, user_id, full_name, phone, address_line1, address_line2,
        city, state, postal_code, country, is_default, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    insertStmt.run(
      id,
      userId,
      input.fullName.trim(),
      input.phone.trim(),
      input.addressLine1.trim(),
      input.addressLine2 ? input.addressLine2.trim() : null,
      input.city.trim(),
      input.state.trim(),
      input.postalCode.trim(),
      country,
      shouldBeDefault ? 1 : 0
    );

    return this.getAddressById(id, userId)!;
  }

  /**
   * Updates an existing address.
   */
  public updateAddress(addressId: string, userId: string, input: Partial<AddressInput>): AddressRecord {
    const existing = this.getAddressById(addressId, userId);
    if (!existing) {
      throw new Error('Address not found');
    }

    const merged: AddressInput = {
      fullName: input.fullName !== undefined ? input.fullName : existing.full_name,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      addressLine1: input.addressLine1 !== undefined ? input.addressLine1 : existing.address_line1,
      addressLine2: input.addressLine2 !== undefined ? input.addressLine2 : existing.address_line2 || undefined,
      city: input.city !== undefined ? input.city : existing.city,
      state: input.state !== undefined ? input.state : existing.state,
      postalCode: input.postalCode !== undefined ? input.postalCode : existing.postal_code,
      country: input.country !== undefined ? input.country : existing.country,
      isDefault: input.isDefault !== undefined ? input.isDefault : Boolean(existing.is_default)
    };

    const validation = this.validateAddressInput(merged);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '));
    }

    if (input.isDefault) {
      this.db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
    }

    this.db.prepare(`
      UPDATE addresses SET
        full_name = ?,
        phone = ?,
        address_line1 = ?,
        address_line2 = ?,
        city = ?,
        state = ?,
        postal_code = ?,
        country = ?,
        is_default = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      merged.fullName.trim(),
      merged.phone.trim(),
      merged.addressLine1.trim(),
      merged.addressLine2 ? merged.addressLine2.trim() : null,
      merged.city.trim(),
      merged.state.trim(),
      merged.postalCode.trim(),
      merged.country ? merged.country.trim().toUpperCase() : 'IN',
      merged.isDefault ? 1 : 0,
      addressId,
      userId
    );

    return this.getAddressById(addressId, userId)!;
  }

  /**
   * Sets a designated address as user's primary default address.
   */
  public setDefaultAddress(addressId: string, userId: string): AddressRecord {
    const existing = this.getAddressById(addressId, userId);
    if (!existing) {
      throw new Error('Address not found');
    }

    this.db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
    this.db.prepare('UPDATE addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
      .run(addressId, userId);

    return this.getAddressById(addressId, userId)!;
  }

  /**
   * Deletes an address.
   */
  public deleteAddress(addressId: string, userId: string): void {
    const existing = this.getAddressById(addressId, userId);
    if (!existing) {
      throw new Error('Address not found');
    }

    this.db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(addressId, userId);

    // If the deleted address was default, make the most recently updated remaining address default
    if (existing.is_default === 1) {
      const remaining = this.db.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1')
        .get(userId) as { id: string } | undefined;
      if (remaining) {
        this.db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(remaining.id);
      }
    }
  }

  /**
   * Lists all addresses for a specific user.
   */
  public listAddresses(userId: string): AddressRecord[] {
    return this.db.prepare(`
      SELECT * FROM addresses 
      WHERE user_id = ? 
      ORDER BY is_default DESC, updated_at DESC
    `).all(userId) as unknown as AddressRecord[];
  }

  /**
   * Retrieves single address by ID.
   */
  public getAddressById(addressId: string, userId?: string): AddressRecord | null {
    if (userId) {
      const row = this.db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(addressId, userId);
      return (row as unknown as AddressRecord) || null;
    }
    const row = this.db.prepare('SELECT * FROM addresses WHERE id = ?').get(addressId);
    return (row as unknown as AddressRecord) || null;
  }

  /**
   * Configurable Dynamic Shipping Calculator.
   */
  public calculateShipping(params: ShippingCalculationParams): ShippingCalculationResult {
    const country = (params.country || 'IN').trim().toUpperCase();
    const isInternational = country !== 'IN';
    const subtotal = Math.max(0, params.subtotal);
    const availableOptions: ShippingOption[] = [];

    if (!isInternational) {
      // Domestic India
      const isStandardFree = subtotal >= this.freeDomesticThreshold;
      availableOptions.push({
        method: 'STANDARD',
        title: 'Doorstep Courier Express',
        fee: isStandardFree ? 0 : this.standardDomesticFee,
        isFree: isStandardFree,
        timeline: '2-4 business days',
        carrier: 'BlueDart / Delhivery Express'
      });

      availableOptions.push({
        method: 'EXPRESS',
        title: 'Priority Air Courier (Fastest)',
        fee: this.expressDomesticFee,
        isFree: false,
        timeline: '1-2 business days',
        carrier: 'BlueDart Air Apex'
      });
    } else {
      // International
      availableOptions.push({
        method: 'INTERNATIONAL',
        title: 'Global Insured Air Express',
        fee: this.internationalAirFee,
        isFree: false,
        timeline: '5-8 business days',
        carrier: 'DHL Express International'
      });
    }

    const requestedMethod = params.method || (isInternational ? 'INTERNATIONAL' : 'STANDARD');
    const selected = availableOptions.find(o => o.method === requestedMethod) || availableOptions[0];

    const amountNeeded = !isInternational && subtotal < this.freeDomesticThreshold
      ? this.freeDomesticThreshold - subtotal
      : 0;

    return {
      selectedOption: selected,
      availableOptions,
      isInternational,
      deliveryEstimateDays: isInternational ? 6 : selected.method === 'EXPRESS' ? 2 : 3,
      freeShippingThreshold: this.freeDomesticThreshold,
      amountNeededForFreeShipping: amountNeeded
    };
  }
}
