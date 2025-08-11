import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { medicinesTable, usersTable, inventoryTransactionsTable } from '../db/schema';
import { type CreateMedicineInput, type UpdateMedicineInput } from '../schema';
import { 
  createMedicine, 
  getMedicines, 
  getMedicine, 
  updateMedicine, 
  deleteMedicine, 
  searchMedicines, 
  getLowStockAlerts, 
  updateMedicineStock 
} from '../handlers/medicines';
import { eq } from 'drizzle-orm';

// Test input data
const testMedicineInput: CreateMedicineInput = {
  name: 'Paracetamol',
  description: 'Pain reliever and fever reducer',
  current_stock: 100,
  price: 5.50,
  supplier_name: 'Pharma Co',
  batch_number: 'PC001',
  expiry_date: new Date('2025-12-31'),
  storage_conditions: 'Store in cool, dry place',
  minimum_stock_level: 10
};

const minimalMedicineInput: CreateMedicineInput = {
  name: 'Aspirin',
  description: null,
  current_stock: 50,
  price: 3.25,
  supplier_name: null,
  batch_number: null,
  expiry_date: null,
  storage_conditions: null,
  minimum_stock_level: 5
};

describe('Medicine Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createMedicine', () => {
    it('should create a medicine with all fields', async () => {
      const result = await createMedicine(testMedicineInput);

      expect(result.id).toBeDefined();
      expect(result.name).toEqual('Paracetamol');
      expect(result.description).toEqual('Pain reliever and fever reducer');
      expect(result.current_stock).toEqual(100);
      expect(result.price).toEqual(5.50);
      expect(typeof result.price).toBe('number');
      expect(result.supplier_name).toEqual('Pharma Co');
      expect(result.batch_number).toEqual('PC001');
      expect(result.expiry_date).toEqual(new Date('2025-12-31'));
      expect(result.storage_conditions).toEqual('Store in cool, dry place');
      expect(result.minimum_stock_level).toEqual(10);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a medicine with minimal fields', async () => {
      const result = await createMedicine(minimalMedicineInput);

      expect(result.id).toBeDefined();
      expect(result.name).toEqual('Aspirin');
      expect(result.description).toBeNull();
      expect(result.current_stock).toEqual(50);
      expect(result.price).toEqual(3.25);
      expect(result.supplier_name).toBeNull();
      expect(result.batch_number).toBeNull();
      expect(result.expiry_date).toBeNull();
      expect(result.storage_conditions).toBeNull();
      expect(result.minimum_stock_level).toEqual(5);
    });

    it('should save medicine to database', async () => {
      const result = await createMedicine(testMedicineInput);

      const medicines = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, result.id))
        .execute();

      expect(medicines).toHaveLength(1);
      expect(medicines[0].name).toEqual('Paracetamol');
      expect(parseFloat(medicines[0].price)).toEqual(5.50);
    });
  });

  describe('getMedicines', () => {
    it('should return empty array when no medicines exist', async () => {
      const result = await getMedicines();
      expect(result).toEqual([]);
    });

    it('should return all medicines', async () => {
      await createMedicine(testMedicineInput);
      await createMedicine(minimalMedicineInput);

      const result = await getMedicines();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Paracetamol');
      expect(result[1].name).toEqual('Aspirin');
      expect(typeof result[0].price).toBe('number');
      expect(typeof result[1].price).toBe('number');
    });
  });

  describe('getMedicine', () => {
    it('should return null for non-existent medicine', async () => {
      const result = await getMedicine(999);
      expect(result).toBeNull();
    });

    it('should return medicine by id', async () => {
      const created = await createMedicine(testMedicineInput);
      
      const result = await getMedicine(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Paracetamol');
      expect(result!.price).toEqual(5.50);
      expect(typeof result!.price).toBe('number');
    });
  });

  describe('updateMedicine', () => {
    it('should throw error for non-existent medicine', async () => {
      const updateInput: UpdateMedicineInput = {
        id: 999,
        name: 'Updated Name'
      };

      await expect(updateMedicine(updateInput)).rejects.toThrow(/Medicine not found/i);
    });

    it('should update medicine fields', async () => {
      const created = await createMedicine(testMedicineInput);
      
      const updateInput: UpdateMedicineInput = {
        id: created.id,
        name: 'Updated Paracetamol',
        price: 6.00,
        current_stock: 150
      };

      const result = await updateMedicine(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Updated Paracetamol');
      expect(result.price).toEqual(6.00);
      expect(result.current_stock).toEqual(150);
      expect(result.description).toEqual('Pain reliever and fever reducer'); // Unchanged
    });

    it('should update medicine in database', async () => {
      const created = await createMedicine(testMedicineInput);
      
      const updateInput: UpdateMedicineInput = {
        id: created.id,
        name: 'Database Updated',
        price: 7.75
      };

      await updateMedicine(updateInput);

      const medicines = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, created.id))
        .execute();

      expect(medicines[0].name).toEqual('Database Updated');
      expect(parseFloat(medicines[0].price)).toEqual(7.75);
    });
  });

  describe('deleteMedicine', () => {
    it('should return false for non-existent medicine', async () => {
      const result = await deleteMedicine(999);
      expect(result).toBe(false);
    });

    it('should delete existing medicine', async () => {
      const created = await createMedicine(testMedicineInput);
      
      const result = await deleteMedicine(created.id);
      expect(result).toBe(true);

      // Verify deletion
      const medicine = await getMedicine(created.id);
      expect(medicine).toBeNull();
    });

    it('should remove medicine from database', async () => {
      const created = await createMedicine(testMedicineInput);
      
      await deleteMedicine(created.id);

      const medicines = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, created.id))
        .execute();

      expect(medicines).toHaveLength(0);
    });
  });

  describe('searchMedicines', () => {
    beforeEach(async () => {
      await createMedicine(testMedicineInput);
      
      const medicineWithSupplier: CreateMedicineInput = {
        name: 'Aspirin',
        description: null,
        current_stock: 50,
        price: 3.25,
        supplier_name: 'MedSupply Inc',
        batch_number: 'MS002',
        expiry_date: null,
        storage_conditions: null,
        minimum_stock_level: 5
      };
      
      await createMedicine(medicineWithSupplier);
    });

    it('should return empty array for empty query', async () => {
      const result = await searchMedicines('');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace query', async () => {
      const result = await searchMedicines('   ');
      expect(result).toEqual([]);
    });

    it('should search by medicine name', async () => {
      const result = await searchMedicines('para');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Paracetamol');
    });

    it('should search by supplier name', async () => {
      const result = await searchMedicines('medsupply');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Aspirin');
    });

    it('should search by batch number', async () => {
      const result = await searchMedicines('PC001');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Paracetamol');
    });

    it('should be case insensitive', async () => {
      const result = await searchMedicines('PARACETAMOL');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Paracetamol');
    });
  });

  describe('getLowStockAlerts', () => {
    it('should return empty array when no low stock medicines', async () => {
      await createMedicine(testMedicineInput); // stock: 100, min: 10
      
      const result = await getLowStockAlerts();
      expect(result).toEqual([]);
    });

    it('should return medicines with stock below minimum', async () => {
      const lowStockMedicine: CreateMedicineInput = {
        name: 'Low Stock Medicine',
        description: 'Pain reliever and fever reducer',
        current_stock: 5, // Below minimum of 10
        price: 5.50,
        supplier_name: 'Pharma Co',
        batch_number: 'PC001',
        expiry_date: new Date('2025-12-31'),
        storage_conditions: 'Store in cool, dry place',
        minimum_stock_level: 10
      };
      
      await createMedicine(lowStockMedicine);
      await createMedicine(testMedicineInput); // Normal stock

      const result = await getLowStockAlerts();

      expect(result).toHaveLength(1);
      expect(result[0].medicine_name).toEqual('Low Stock Medicine');
      expect(result[0].current_stock).toEqual(5);
      expect(result[0].minimum_stock_level).toEqual(10);
      expect(result[0].shortage).toEqual(5);
    });

    it('should calculate shortage correctly', async () => {
      const outOfStockMedicine: CreateMedicineInput = {
        name: 'Out of Stock',
        description: 'Pain reliever and fever reducer',
        current_stock: 0,
        price: 5.50,
        supplier_name: 'Pharma Co',
        batch_number: 'PC001',
        expiry_date: new Date('2025-12-31'),
        storage_conditions: 'Store in cool, dry place',
        minimum_stock_level: 20
      };
      
      await createMedicine(outOfStockMedicine);

      const result = await getLowStockAlerts();

      expect(result[0].shortage).toEqual(20);
    });
  });

  describe('updateMedicineStock', () => {
    let testUserId: number;

    beforeEach(async () => {
      // Create a test user for inventory transactions
      const userResult = await db.insert(usersTable)
        .values({
          username: 'testuser',
          email: 'test@example.com',
          password_hash: 'hashedpassword',
          role: 'admin',
          first_name: 'Test',
          last_name: 'User'
        })
        .returning()
        .execute();
      
      testUserId = userResult[0].id;
    });

    it('should throw error for non-existent medicine', async () => {
      await expect(
        updateMedicineStock(999, 50, 'Test reason', testUserId)
      ).rejects.toThrow(/Medicine not found/i);
    });

    it('should update medicine stock and create transaction for addition', async () => {
      const created = await createMedicine(testMedicineInput); // stock: 100
      
      const result = await updateMedicineStock(created.id, 150, 'Stock replenishment', testUserId);

      expect(result.current_stock).toEqual(150);
      expect(result.id).toEqual(created.id);

      // Check transaction was created
      const transactions = await db.select()
        .from(inventoryTransactionsTable)
        .where(eq(inventoryTransactionsTable.medicine_id, created.id))
        .execute();

      expect(transactions).toHaveLength(1);
      expect(transactions[0].transaction_type).toEqual('addition');
      expect(transactions[0].quantity).toEqual(50); // 150 - 100
      expect(transactions[0].reason).toEqual('Stock replenishment');
      expect(transactions[0].performed_by_user_id).toEqual(testUserId);
    });

    it('should update medicine stock and create transaction for subtraction', async () => {
      const created = await createMedicine(testMedicineInput); // stock: 100
      
      const result = await updateMedicineStock(created.id, 75, 'Medicine dispensed', testUserId);

      expect(result.current_stock).toEqual(75);

      // Check transaction
      const transactions = await db.select()
        .from(inventoryTransactionsTable)
        .where(eq(inventoryTransactionsTable.medicine_id, created.id))
        .execute();

      expect(transactions[0].transaction_type).toEqual('subtraction');
      expect(transactions[0].quantity).toEqual(25); // 100 - 75
    });

    it('should handle adjustment when stock remains same', async () => {
      const created = await createMedicine(testMedicineInput); // stock: 100
      
      await updateMedicineStock(created.id, 100, 'Stock audit - no change', testUserId);

      const transactions = await db.select()
        .from(inventoryTransactionsTable)
        .where(eq(inventoryTransactionsTable.medicine_id, created.id))
        .execute();

      expect(transactions[0].transaction_type).toEqual('adjustment');
      expect(transactions[0].quantity).toEqual(0);
    });

    it('should preserve numeric type conversion for price', async () => {
      const created = await createMedicine(testMedicineInput);
      
      const result = await updateMedicineStock(created.id, 120, 'Test reason', testUserId);

      expect(typeof result.price).toBe('number');
      expect(result.price).toEqual(5.50);
    });
  });
});