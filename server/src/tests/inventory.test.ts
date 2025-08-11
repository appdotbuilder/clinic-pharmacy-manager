import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, medicinesTable, inventoryTransactionsTable } from '../db/schema';
import { type CreateUserInput, type CreateMedicineInput } from '../schema';
import {
  createInventoryTransaction,
  getInventoryTransactions,
  getInventoryTransactionsByMedicine,
  getInventoryTransactionsByDateRange,
  adjustMedicineStock,
  bulkUpdateStock
} from '../handlers/inventory';
import { eq } from 'drizzle-orm';

// Test user data
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
  role: 'admin',
  first_name: 'Test',
  last_name: 'User',
  phone: '1234567890'
};

// Test medicine data
const testMedicine: CreateMedicineInput = {
  name: 'Test Medicine',
  description: 'A medicine for testing',
  current_stock: 100,
  price: 19.99,
  supplier_name: 'Test Supplier',
  batch_number: 'BATCH001',
  expiry_date: new Date('2025-12-31'),
  storage_conditions: 'Room temperature',
  minimum_stock_level: 10
};

describe('Inventory Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let medicineId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        phone: testUser.phone,
        is_active: true
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test medicine
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: testMedicine.name,
        description: testMedicine.description,
        current_stock: testMedicine.current_stock,
        price: testMedicine.price.toString(),
        supplier_name: testMedicine.supplier_name,
        batch_number: testMedicine.batch_number,
        expiry_date: testMedicine.expiry_date?.toISOString().split('T')[0] || null,
        storage_conditions: testMedicine.storage_conditions,
        minimum_stock_level: testMedicine.minimum_stock_level
      })
      .returning()
      .execute();
    medicineId = medicineResult[0].id;
  });

  describe('createInventoryTransaction', () => {
    it('should create an addition transaction and update stock', async () => {
      const result = await createInventoryTransaction(
        medicineId,
        'addition',
        50,
        'Stock replenishment',
        userId
      );

      // Verify transaction creation
      expect(result.id).toBeDefined();
      expect(result.medicine_id).toEqual(medicineId);
      expect(result.transaction_type).toEqual('addition');
      expect(result.quantity).toEqual(50);
      expect(result.reason).toEqual('Stock replenishment');
      expect(result.performed_by_user_id).toEqual(userId);
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify stock was updated
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();
      
      expect(medicine[0].current_stock).toEqual(150); // 100 + 50
    });

    it('should create a subtraction transaction and update stock', async () => {
      const result = await createInventoryTransaction(
        medicineId,
        'subtraction',
        30,
        'Medicine dispensed',
        userId
      );

      expect(result.transaction_type).toEqual('subtraction');
      expect(result.quantity).toEqual(30);

      // Verify stock was updated
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();
      
      expect(medicine[0].current_stock).toEqual(70); // 100 - 30
    });

    it('should create an adjustment transaction and set new stock level', async () => {
      const result = await createInventoryTransaction(
        medicineId,
        'adjustment',
        85,
        'Stock count adjustment',
        userId,
        undefined,
        'stock_adjustment'
      );

      expect(result.transaction_type).toEqual('adjustment');
      expect(result.quantity).toEqual(-15); // 85 - 100 (actual change)

      // Verify stock was set to new level
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();
      
      expect(medicine[0].current_stock).toEqual(85);
    });

    it('should prevent negative stock on subtraction', async () => {
      const result = await createInventoryTransaction(
        medicineId,
        'subtraction',
        150, // More than available stock (100)
        'Over-dispensed',
        userId
      );

      // Verify stock was set to 0, not negative
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();
      
      expect(medicine[0].current_stock).toEqual(0);
      expect(result.quantity).toEqual(150); // Transaction still records attempted quantity
    });

    it('should include optional reference fields', async () => {
      const result = await createInventoryTransaction(
        medicineId,
        'subtraction',
        5,
        'Prescription dispensed',
        userId,
        123,
        'prescription'
      );

      expect(result.reference_id).toEqual(123);
      expect(result.reference_type).toEqual('prescription');
    });

    it('should throw error for non-existent medicine', async () => {
      await expect(
        createInventoryTransaction(99999, 'addition', 10, 'Test', userId)
      ).rejects.toThrow(/Medicine with id 99999 not found/i);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        createInventoryTransaction(medicineId, 'addition', 10, 'Test', 99999)
      ).rejects.toThrow(/User with id 99999 not found/i);
    });
  });

  describe('getInventoryTransactions', () => {
    it('should return all inventory transactions', async () => {
      // Create multiple transactions
      await createInventoryTransaction(medicineId, 'addition', 50, 'Restock', userId);
      await createInventoryTransaction(medicineId, 'subtraction', 20, 'Dispensed', userId);

      const results = await getInventoryTransactions();

      expect(results).toHaveLength(2);
      expect(results[0].medicine_id).toEqual(medicineId);
      expect(results[1].medicine_id).toEqual(medicineId);
    });

    it('should return empty array when no transactions exist', async () => {
      const results = await getInventoryTransactions();
      expect(results).toHaveLength(0);
    });
  });

  describe('getInventoryTransactionsByMedicine', () => {
    it('should return transactions for specific medicine', async () => {
      // Create another medicine
      const medicine2Result = await db.insert(medicinesTable)
        .values({
          name: 'Medicine 2',
          description: 'Second medicine',
          current_stock: 50,
          price: '29.99',
          supplier_name: 'Supplier 2',
          batch_number: 'BATCH002',
          expiry_date: '2025-12-31',
          storage_conditions: 'Cool place',
          minimum_stock_level: 5
        })
        .returning()
        .execute();
      const medicine2Id = medicine2Result[0].id;

      // Create transactions for both medicines
      await createInventoryTransaction(medicineId, 'addition', 25, 'Restock 1', userId);
      await createInventoryTransaction(medicine2Id, 'addition', 15, 'Restock 2', userId);
      await createInventoryTransaction(medicineId, 'subtraction', 10, 'Dispensed 1', userId);

      const results = await getInventoryTransactionsByMedicine(medicineId);

      expect(results).toHaveLength(2);
      expect(results.every(t => t.medicine_id === medicineId)).toBe(true);
    });

    it('should throw error for non-existent medicine', async () => {
      await expect(
        getInventoryTransactionsByMedicine(99999)
      ).rejects.toThrow(/Medicine with id 99999 not found/i);
    });
  });

  describe('getInventoryTransactionsByDateRange', () => {
    it('should return transactions within date range', async () => {
      // Create transactions
      await createInventoryTransaction(medicineId, 'addition', 25, 'Recent', userId);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1); // Yesterday
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1); // Tomorrow

      const results = await getInventoryTransactionsByDateRange(startDate, endDate);

      expect(results).toHaveLength(1);
      expect(results[0].medicine_id).toEqual(medicineId);
      expect(results[0].created_at >= startDate).toBe(true);
      expect(results[0].created_at <= endDate).toBe(true);
    });

    it('should return empty array for date range with no transactions', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2020-01-02');

      const results = await getInventoryTransactionsByDateRange(startDate, endDate);
      expect(results).toHaveLength(0);
    });
  });

  describe('adjustMedicineStock', () => {
    it('should adjust medicine stock to new level', async () => {
      const result = await adjustMedicineStock(
        medicineId,
        75,
        'Physical count adjustment',
        userId
      );

      expect(result.transaction_type).toEqual('adjustment');
      expect(result.quantity).toEqual(-25); // 75 - 100 (change)
      expect(result.reference_type).toEqual('stock_adjustment');

      // Verify stock level
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();
      
      expect(medicine[0].current_stock).toEqual(75);
    });

    it('should throw error for negative stock level', async () => {
      await expect(
        adjustMedicineStock(medicineId, -10, 'Invalid adjustment', userId)
      ).rejects.toThrow(/Stock level cannot be negative/i);
    });

    it('should throw error for non-existent medicine', async () => {
      await expect(
        adjustMedicineStock(99999, 50, 'Test', userId)
      ).rejects.toThrow(/Medicine with id 99999 not found/i);
    });
  });

  describe('bulkUpdateStock', () => {
    it('should process multiple stock updates', async () => {
      // Create another medicine
      const medicine2Result = await db.insert(medicinesTable)
        .values({
          name: 'Medicine 2',
          description: 'Second medicine',
          current_stock: 50,
          price: '29.99',
          supplier_name: 'Supplier 2',
          batch_number: 'BATCH002',
          expiry_date: '2025-12-31',
          storage_conditions: 'Cool place',
          minimum_stock_level: 5
        })
        .returning()
        .execute();
      const medicine2Id = medicine2Result[0].id;

      const updates = [
        {
          medicine_id: medicineId,
          quantity: 25,
          transaction_type: 'addition' as const,
          reason: 'Bulk restock 1'
        },
        {
          medicine_id: medicine2Id,
          quantity: 10,
          transaction_type: 'subtraction' as const,
          reason: 'Bulk dispensed 2'
        }
      ];

      const results = await bulkUpdateStock(updates, userId);

      expect(results).toHaveLength(2);
      expect(results[0].medicine_id).toEqual(medicineId);
      expect(results[0].transaction_type).toEqual('addition');
      expect(results[1].medicine_id).toEqual(medicine2Id);
      expect(results[1].transaction_type).toEqual('subtraction');

      // Verify stock updates
      const medicine1 = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();
      
      const medicine2 = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicine2Id))
        .execute();

      expect(medicine1[0].current_stock).toEqual(125); // 100 + 25
      expect(medicine2[0].current_stock).toEqual(40);  // 50 - 10
    });

    it('should throw error for non-existent user', async () => {
      const updates = [{
        medicine_id: medicineId,
        quantity: 10,
        transaction_type: 'addition' as const,
        reason: 'Test'
      }];

      await expect(
        bulkUpdateStock(updates, 99999)
      ).rejects.toThrow(/User with id 99999 not found/i);
    });

    it('should handle empty updates array', async () => {
      const results = await bulkUpdateStock([], userId);
      expect(results).toHaveLength(0);
    });

    it('should stop processing on error and maintain transaction integrity', async () => {
      const updates = [
        {
          medicine_id: medicineId,
          quantity: 25,
          transaction_type: 'addition' as const,
          reason: 'Valid update'
        },
        {
          medicine_id: 99999, // Non-existent medicine
          quantity: 10,
          transaction_type: 'addition' as const,
          reason: 'Invalid update'
        }
      ];

      await expect(
        bulkUpdateStock(updates, userId)
      ).rejects.toThrow(/Medicine with id 99999 not found/i);

      // Verify first update was processed before error
      const transactions = await db.select()
        .from(inventoryTransactionsTable)
        .where(eq(inventoryTransactionsTable.medicine_id, medicineId))
        .execute();

      expect(transactions).toHaveLength(1);
      expect(transactions[0].quantity).toEqual(25);
    });
  });
});