import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { AccountService } from './account.service.js';

describe('Phase 20 — Customer Account & Data Deletion', () => {
  let db: DatabaseSync;
  let accountService: AccountService;
  let testUserId: string;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    accountService = new AccountService(db);

    const user = db.prepare(`SELECT id FROM users WHERE status = 'ACTIVE' LIMIT 1`).get() as { id: string } | undefined;
    testUserId = user?.id || '';
  });

  afterEach(() => {
    db.close();
  });

  it('getProfile returns expected customer profile fields', () => {
    if (!testUserId) return;
    const profile = accountService.getProfile(testUserId);
    expect(profile.id).toBe(testUserId);
    expect(profile.fullName).toBeDefined();
    expect(profile.phone).toBeDefined();
    expect(typeof profile.ordersCount).toBe('number');
    expect(typeof profile.addressesCount).toBe('number');
  });

  it('updateProfile updates fullName and email successfully', () => {
    if (!testUserId) return;
    const updated = accountService.updateProfile(testUserId, {
      fullName: 'Updated Name',
      email: 'updated_test@example.com',
    });
    expect(updated.fullName).toBe('Updated Name');
    expect(updated.email).toBe('updated_test@example.com');
  });

  it('exportCustomerData returns GDPR/Play Store complete export bundle', () => {
    if (!testUserId) return;
    const exportBundle = accountService.exportCustomerData(testUserId);
    expect(exportBundle.user.id).toBe(testUserId);
    expect(Array.isArray(exportBundle.addresses)).toBe(true);
    expect(Array.isArray(exportBundle.orders)).toBe(true);
    expect(Array.isArray(exportBundle.wishlist)).toBe(true);
    expect(exportBundle.exportedAt).toBeDefined();
  });

  it('deleteAccount soft deletes user and anonymizes PII', () => {
    if (!testUserId) return;
    const res = accountService.deleteAccount(testUserId, 'User requested account removal');
    expect(res.success).toBe(true);

    // Profile lookup should now fail
    expect(() => accountService.getProfile(testUserId)).toThrow('not found');

    // Check directly in DB that record is marked DELETED with deleted_at
    const raw = db.prepare(`SELECT status, full_name, deleted_at FROM users WHERE id = ?`).get(testUserId) as any;
    expect(raw.status).toBe('DELETED');
    expect(raw.full_name).toBe('Deleted Account');
    expect(raw.deleted_at).not.toBeNull();
  });
});
