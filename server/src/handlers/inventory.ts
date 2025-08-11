import { db } from '../db';
import { inventoryTransactionsTable, medicinesTable, usersTable } from '../db/schema';
import { type InventoryTransaction, type TransactionType } from '../schema';
import { eq, and, gte, lte, SQL } from 'drizzle-orm';

export async function createInventoryTransaction(
  medicineId: number,
  transactionType: TransactionType,
  quantity: number,
  reason: string,
  userId: number,
  referenceId?: number,
  referenceType?: string
): Promise<InventoryTransaction> {
  try {
    // Verify medicine exists
    const medicine = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicineId))
      .execute();

    if (medicine.length === 0) {
      throw new Error(`Medicine with id ${medicineId} not found`);
    }

    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    // Create transaction record
    const result = await db.insert(inventoryTransactionsTable)
      .values({
        medicine_id: medicineId,
        transaction_type: transactionType,
        quantity: quantity,
        reason: reason,
        reference_id: referenceId || null,
        reference_type: referenceType || null,
        performed_by_user_id: userId
      })
      .returning()
      .execute();

    // Update medicine stock based on transaction type
    const currentMedicine = medicine[0];
    const currentStock = currentMedicine.current_stock;
    
    let newStock: number;
    if (transactionType === 'addition') {
      newStock = currentStock + quantity;
    } else if (transactionType === 'subtraction') {
      newStock = Math.max(0, currentStock - quantity); // Don't allow negative stock
    } else { // adjustment
      newStock = quantity; // For adjustments, quantity is the new stock level
    }

    await db.update(medicinesTable)
      .set({ current_stock: newStock })
      .where(eq(medicinesTable.id, medicineId))
      .execute();

    return {
      ...result[0],
      // Adjust quantity for adjustment type to reflect actual change
      quantity: transactionType === 'adjustment' ? (newStock - currentStock) : quantity
    };
  } catch (error) {
    console.error('Inventory transaction creation failed:', error);
    throw error;
  }
}

export async function getInventoryTransactions(): Promise<InventoryTransaction[]> {
  try {
    const result = await db.select()
      .from(inventoryTransactionsTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch inventory transactions:', error);
    throw error;
  }
}

export async function getInventoryTransactionsByMedicine(medicineId: number): Promise<InventoryTransaction[]> {
  try {
    // Verify medicine exists
    const medicine = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicineId))
      .execute();

    if (medicine.length === 0) {
      throw new Error(`Medicine with id ${medicineId} not found`);
    }

    const result = await db.select()
      .from(inventoryTransactionsTable)
      .where(eq(inventoryTransactionsTable.medicine_id, medicineId))
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch inventory transactions by medicine:', error);
    throw error;
  }
}

export async function getInventoryTransactionsByDateRange(
  startDate: Date, 
  endDate: Date
): Promise<InventoryTransaction[]> {
  try {
    const result = await db.select()
      .from(inventoryTransactionsTable)
      .where(
        and(
          gte(inventoryTransactionsTable.created_at, startDate),
          lte(inventoryTransactionsTable.created_at, endDate)
        )
      )
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch inventory transactions by date range:', error);
    throw error;
  }
}

export async function adjustMedicineStock(
  medicineId: number, 
  newStockLevel: number, 
  reason: string, 
  userId: number
): Promise<InventoryTransaction> {
  try {
    if (newStockLevel < 0) {
      throw new Error('Stock level cannot be negative');
    }

    // Use createInventoryTransaction with adjustment type
    return await createInventoryTransaction(
      medicineId,
      'adjustment',
      newStockLevel, // For adjustments, quantity represents the new stock level
      reason,
      userId,
      undefined,
      'stock_adjustment'
    );
  } catch (error) {
    console.error('Stock adjustment failed:', error);
    throw error;
  }
}

export async function bulkUpdateStock(updates: Array<{
  medicine_id: number;
  quantity: number;
  transaction_type: TransactionType;
  reason: string;
}>, userId: number): Promise<InventoryTransaction[]> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    const transactions: InventoryTransaction[] = [];

    // Process each update sequentially to maintain stock consistency
    for (const update of updates) {
      const transaction = await createInventoryTransaction(
        update.medicine_id,
        update.transaction_type,
        update.quantity,
        update.reason,
        userId
      );
      transactions.push(transaction);
    }

    return transactions;
  } catch (error) {
    console.error('Bulk stock update failed:', error);
    throw error;
  }
}