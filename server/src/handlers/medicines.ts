import { db } from '../db';
import { medicinesTable, inventoryTransactionsTable } from '../db/schema';
import { type CreateMedicineInput, type UpdateMedicineInput, type Medicine, type LowStockAlert } from '../schema';
import { eq, ilike, or, lt, SQL } from 'drizzle-orm';

export async function createMedicine(input: CreateMedicineInput): Promise<Medicine> {
  try {
    const result = await db.insert(medicinesTable)
      .values({
        name: input.name,
        description: input.description || null,
        current_stock: input.current_stock,
        price: input.price.toString(),
        supplier_name: input.supplier_name || null,
        batch_number: input.batch_number || null,
        expiry_date: input.expiry_date ? input.expiry_date.toISOString().split('T')[0] : null,
        storage_conditions: input.storage_conditions || null,
        minimum_stock_level: input.minimum_stock_level
      })
      .returning()
      .execute();

    const medicine = result[0];
    return {
      ...medicine,
      price: parseFloat(medicine.price),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    };
  } catch (error) {
    console.error('Medicine creation failed:', error);
    throw error;
  }
}

export async function getMedicines(): Promise<Medicine[]> {
  try {
    const results = await db.select()
      .from(medicinesTable)
      .execute();

    return results.map(medicine => ({
      ...medicine,
      price: parseFloat(medicine.price),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    }));
  } catch (error) {
    console.error('Failed to fetch medicines:', error);
    throw error;
  }
}

export async function getMedicine(id: number): Promise<Medicine | null> {
  try {
    const results = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const medicine = results[0];
    return {
      ...medicine,
      price: parseFloat(medicine.price),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    };
  } catch (error) {
    console.error('Failed to fetch medicine:', error);
    throw error;
  }
}

export async function updateMedicine(input: UpdateMedicineInput): Promise<Medicine> {
  try {
    // First check if medicine exists
    const existing = await getMedicine(input.id);
    if (!existing) {
      throw new Error('Medicine not found');
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.current_stock !== undefined) updateData.current_stock = input.current_stock;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.supplier_name !== undefined) updateData.supplier_name = input.supplier_name;
    if (input.batch_number !== undefined) updateData.batch_number = input.batch_number;
    if (input.expiry_date !== undefined) updateData.expiry_date = input.expiry_date ? input.expiry_date.toISOString().split('T')[0] : null;
    if (input.storage_conditions !== undefined) updateData.storage_conditions = input.storage_conditions;
    if (input.minimum_stock_level !== undefined) updateData.minimum_stock_level = input.minimum_stock_level;

    // Add updated timestamp
    updateData.updated_at = new Date();

    const result = await db.update(medicinesTable)
      .set(updateData)
      .where(eq(medicinesTable.id, input.id))
      .returning()
      .execute();

    const medicine = result[0];
    return {
      ...medicine,
      price: parseFloat(medicine.price),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    };
  } catch (error) {
    console.error('Medicine update failed:', error);
    throw error;
  }
}

export async function deleteMedicine(id: number): Promise<boolean> {
  try {
    // Check if medicine exists
    const existing = await getMedicine(id);
    if (!existing) {
      return false;
    }

    const result = await db.delete(medicinesTable)
      .where(eq(medicinesTable.id, id))
      .execute();

    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Medicine deletion failed:', error);
    throw error;
  }
}

export async function searchMedicines(query: string): Promise<Medicine[]> {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;
    
    const results = await db.select()
      .from(medicinesTable)
      .where(
        or(
          ilike(medicinesTable.name, searchTerm),
          ilike(medicinesTable.batch_number, searchTerm),
          ilike(medicinesTable.supplier_name, searchTerm)
        )
      )
      .execute();

    return results.map(medicine => ({
      ...medicine,
      price: parseFloat(medicine.price),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    }));
  } catch (error) {
    console.error('Medicine search failed:', error);
    throw error;
  }
}

export async function getLowStockAlerts(): Promise<LowStockAlert[]> {
  try {
    const results = await db.select()
      .from(medicinesTable)
      .where(lt(medicinesTable.current_stock, medicinesTable.minimum_stock_level))
      .execute();

    return results.map(medicine => ({
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      current_stock: medicine.current_stock,
      minimum_stock_level: medicine.minimum_stock_level,
      shortage: medicine.minimum_stock_level - medicine.current_stock
    }));
  } catch (error) {
    console.error('Failed to fetch low stock alerts:', error);
    throw error;
  }
}

export async function updateMedicineStock(medicineId: number, newStock: number, reason: string, userId: number): Promise<Medicine> {
  try {
    // Check if medicine exists
    const existing = await getMedicine(medicineId);
    if (!existing) {
      throw new Error('Medicine not found');
    }

    // Calculate transaction type and quantity
    const oldStock = existing.current_stock;
    const quantity = Math.abs(newStock - oldStock);
    const transactionType = newStock > oldStock ? 'addition' : 
                           newStock < oldStock ? 'subtraction' : 'adjustment';

    // Update medicine stock
    const result = await db.update(medicinesTable)
      .set({
        current_stock: newStock,
        updated_at: new Date()
      })
      .where(eq(medicinesTable.id, medicineId))
      .returning()
      .execute();

    // Create inventory transaction record
    await db.insert(inventoryTransactionsTable)
      .values({
        medicine_id: medicineId,
        transaction_type: transactionType,
        quantity: quantity,
        reason: reason,
        performed_by_user_id: userId
      })
      .execute();

    const medicine = result[0];
    return {
      ...medicine,
      price: parseFloat(medicine.price),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    };
  } catch (error) {
    console.error('Medicine stock update failed:', error);
    throw error;
  }
}