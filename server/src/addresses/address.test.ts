import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { AddressService } from './address.service.js';
import { createAddressRouter } from './routes.js';
import express from 'express';

describe('Phase 16: Address & Delivery Management Architecture', () => {
  let db: DatabaseSync;
  let addressService: AddressService;
  let app: express.Express;
  const testUserId = 'user_demo_01';

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    db.prepare('DELETE FROM addresses').run();
    addressService = new AddressService(db);

    app = express();
    app.use(express.json());
    app.use('/api/v1/addresses', createAddressRouter(addressService));
  });

  afterEach(() => {
    db.close();
  });

  it('adds an Indian domestic delivery address with 6-digit PIN code and 10-digit mobile', () => {
    const created = addressService.addAddress(testUserId, {
      fullName: 'Vikram Malhotra',
      phone: '9876543210',
      addressLine1: '402 Prestige Towers, Residency Road',
      addressLine2: 'Near Richmond Circle',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560025',
      country: 'IN'
    });

    expect(created.id).toMatch(/^addr_/);
    expect(created.full_name).toBe('Vikram Malhotra');
    expect(created.postal_code).toBe('560025');
    expect(created.country).toBe('IN');
  });

  it('adds an international delivery address with international postal code and phone', () => {
    const created = addressService.addAddress(testUserId, {
      fullName: 'Alexander Wright',
      phone: '+1 415 555 2671',
      addressLine1: '742 Evergreen Terrace',
      city: 'San Francisco',
      state: 'California',
      postalCode: '94103',
      country: 'US'
    });

    expect(created.id).toMatch(/^addr_/);
    expect(created.country).toBe('US');
    expect(created.postal_code).toBe('94103');
  });

  it('validates and rejects malformed domestic and international addresses', () => {
    // Malformed domestic PIN code (5 digits instead of 6)
    expect(() => {
      addressService.addAddress(testUserId, {
        fullName: 'Test User',
        phone: '9876543210',
        addressLine1: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '40001', // Invalid
        country: 'IN'
      });
    }).toThrow(/6-digit/);

    // Missing address line 1
    expect(() => {
      addressService.addAddress(testUserId, {
        fullName: 'Test User',
        phone: '9876543210',
        addressLine1: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'IN'
      });
    }).toThrow(/Line 1/);
  });

  it('manages default address switching and auto-promotion', () => {
    // Add first address (becomes default if no other default exists)
    const addr1 = addressService.addAddress(testUserId, {
      fullName: 'Address One',
      phone: '9876543210',
      addressLine1: 'Street 1, HSR Layout',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560102',
      country: 'IN',
      isDefault: true
    });
    expect(addr1.is_default).toBe(1);

    // Add second address as default
    const addr2 = addressService.addAddress(testUserId, {
      fullName: 'Address Two',
      phone: '9876543211',
      addressLine1: 'Street 2, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560034',
      country: 'IN',
      isDefault: true
    });
    expect(addr2.is_default).toBe(1);

    // Verify first address is now non-default
    const refreshedAddr1 = addressService.getAddressById(addr1.id, testUserId);
    expect(refreshedAddr1?.is_default).toBe(0);

    // Explicitly set addr1 back as default
    const switched = addressService.setDefaultAddress(addr1.id, testUserId);
    expect(switched.is_default).toBe(1);

    // Delete addr1 -> addr2 should be promoted to default
    addressService.deleteAddress(addr1.id, testUserId);
    const refreshedAddr2 = addressService.getAddressById(addr2.id, testUserId);
    expect(refreshedAddr2?.is_default).toBe(1);
  });

  it('updates an existing address cleanly', () => {
    const created = addressService.addAddress(testUserId, {
      fullName: 'Initial Name',
      phone: '9876543210',
      addressLine1: 'Old Address Line',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'IN'
    });

    const updated = addressService.updateAddress(created.id, testUserId, {
      fullName: 'Updated Name',
      addressLine1: 'New Address Line 42',
      city: 'New Delhi'
    });

    expect(updated.full_name).toBe('Updated Name');
    expect(updated.address_line1).toBe('New Address Line 42');
    expect(updated.city).toBe('New Delhi');
  });

  it('calculates configurable shipping rules for domestic and international orders', () => {
    // 1. Domestic India >= ₹999: Free shipping
    const domesticFree = addressService.calculateShipping({
      country: 'IN',
      subtotal: 1499,
      method: 'STANDARD'
    });
    expect(domesticFree.selectedOption.fee).toBe(0);
    expect(domesticFree.selectedOption.isFree).toBe(true);

    // 2. Domestic India < ₹999: Standard shipping fee of ₹99
    const domesticPaid = addressService.calculateShipping({
      country: 'IN',
      subtotal: 499,
      method: 'STANDARD'
    });
    expect(domesticPaid.selectedOption.fee).toBe(99);
    expect(domesticPaid.selectedOption.isFree).toBe(false);
    expect(domesticPaid.amountNeededForFreeShipping).toBe(500); // 999 - 499

    // 3. Domestic Priority Air Courier: ₹199
    const domesticExpress = addressService.calculateShipping({
      country: 'IN',
      subtotal: 5000,
      method: 'EXPRESS'
    });
    expect(domesticExpress.selectedOption.fee).toBe(199);
    expect(domesticExpress.deliveryEstimateDays).toBe(2);

    // 4. International Global Air Express: ₹1,499
    const international = addressService.calculateShipping({
      country: 'US',
      subtotal: 8000
    });
    expect(international.isInternational).toBe(true);
    expect(international.selectedOption.fee).toBe(1499);
    expect(international.selectedOption.carrier).toContain('DHL');
  });

  it('exposes full REST API endpoints for customer address book', async () => {
    // 1. POST /api/v1/addresses
    const createRes = await request(app)
      .post('/api/v1/addresses')
      .set('x-user-id', testUserId)
      .send({
        fullName: 'API Test User',
        phone: '9876543210',
        addressLine1: 'Suite 100, Tech Park',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500081',
        country: 'IN',
        isDefault: true
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.id).toBeDefined();
    const addressId = createRes.body.data.id;

    // 2. GET /api/v1/addresses
    const listRes = await request(app)
      .get('/api/v1/addresses')
      .set('x-user-id', testUserId);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    // 3. PUT /api/v1/addresses/:id
    const updateRes = await request(app)
      .put(`/api/v1/addresses/${addressId}`)
      .set('x-user-id', testUserId)
      .send({ city: 'Secunderabad' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.city).toBe('Secunderabad');

    // 4. POST /api/v1/addresses/calculate-shipping
    const shipRes = await request(app)
      .post('/api/v1/addresses/calculate-shipping')
      .send({ country: 'IN', subtotal: 2500 });
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.selectedOption.isFree).toBe(true);

    // 5. DELETE /api/v1/addresses/:id
    const delRes = await request(app)
      .delete(`/api/v1/addresses/${addressId}`)
      .set('x-user-id', testUserId);
    expect(delRes.status).toBe(200);
  });
});
