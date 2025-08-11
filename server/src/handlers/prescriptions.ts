import { db } from '../db';
import { 
  prescriptionsTable, 
  prescriptionItemsTable, 
  medicinesTable, 
  inventoryTransactionsTable,
  usersTable,
  patientsTable
} from '../db/schema';
import { 
  type CreatePrescriptionInput, 
  type Prescription, 
  type PrescriptionItem,
  type PrescriptionStatus 
} from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export async function createPrescription(input: CreatePrescriptionInput): Promise<Prescription> {
  try {
    // Verify that the visit, doctor, and patient exist
    const visitExists = await db.select({ id: sql`1` })
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.visit_id, input.visit_id))
      .limit(1)
      .execute();

    const doctorExists = await db.select({ id: sql`1` })
      .from(usersTable)
      .where(eq(usersTable.id, input.doctor_id))
      .limit(1)
      .execute();

    const patientExists = await db.select({ id: sql`1` })
      .from(patientsTable)
      .where(eq(patientsTable.id, input.patient_id))
      .limit(1)
      .execute();

    // Calculate total amount from prescription items
    let totalAmount = 0;
    const medicineDetails: Array<{ id: number; price: number }> = [];

    for (const item of input.prescription_items) {
      // Verify medicine exists and get price
      const medicine = await db.select({ id: medicinesTable.id, price: medicinesTable.price })
        .from(medicinesTable)
        .where(eq(medicinesTable.id, item.medicine_id))
        .limit(1)
        .execute();

      if (medicine.length === 0) {
        throw new Error(`Medicine with ID ${item.medicine_id} not found`);
      }

      const price = parseFloat(medicine[0].price);
      medicineDetails.push({ id: item.medicine_id, price });
      totalAmount += price * item.quantity;
    }

    // Create prescription record
    const prescriptionResult = await db.insert(prescriptionsTable)
      .values({
        visit_id: input.visit_id,
        doctor_id: input.doctor_id,
        patient_id: input.patient_id,
        status: 'pending',
        total_amount: totalAmount.toString()
      })
      .returning()
      .execute();

    const prescription = prescriptionResult[0];

    // Create prescription items
    for (let i = 0; i < input.prescription_items.length; i++) {
      const item = input.prescription_items[i];
      const medicine = medicineDetails[i];
      const itemTotal = medicine.price * item.quantity;

      await db.insert(prescriptionItemsTable)
        .values({
          prescription_id: prescription.id,
          medicine_id: item.medicine_id,
          quantity_prescribed: item.quantity,
          quantity_dispensed: 0,
          dosage_instructions: item.dosage_instructions,
          unit_price: medicine.price.toString(),
          total_price: itemTotal.toString()
        })
        .execute();
    }

    return {
      ...prescription,
      total_amount: parseFloat(prescription.total_amount)
    };
  } catch (error) {
    console.error('Prescription creation failed:', error);
    throw error;
  }
}

export async function getPrescriptions(): Promise<Prescription[]> {
  try {
    const results = await db.select()
      .from(prescriptionsTable)
      .execute();

    return results.map(prescription => ({
      ...prescription,
      total_amount: parseFloat(prescription.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get prescriptions:', error);
    throw error;
  }
}

export async function getPrescription(id: number): Promise<Prescription | null> {
  try {
    const results = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.id, id))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    const prescription = results[0];
    return {
      ...prescription,
      total_amount: parseFloat(prescription.total_amount)
    };
  } catch (error) {
    console.error('Failed to get prescription:', error);
    throw error;
  }
}

export async function getPrescriptionsByPatient(patientId: number): Promise<Prescription[]> {
  try {
    const results = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.patient_id, patientId))
      .execute();

    return results.map(prescription => ({
      ...prescription,
      total_amount: parseFloat(prescription.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get prescriptions by patient:', error);
    throw error;
  }
}

export async function getPrescriptionsByDoctor(doctorId: number): Promise<Prescription[]> {
  try {
    const results = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.doctor_id, doctorId))
      .execute();

    return results.map(prescription => ({
      ...prescription,
      total_amount: parseFloat(prescription.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get prescriptions by doctor:', error);
    throw error;
  }
}

export async function getPendingPrescriptions(): Promise<Prescription[]> {
  try {
    const results = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.status, 'pending'))
      .execute();

    return results.map(prescription => ({
      ...prescription,
      total_amount: parseFloat(prescription.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get pending prescriptions:', error);
    throw error;
  }
}

export async function updatePrescriptionStatus(id: number, status: PrescriptionStatus): Promise<Prescription> {
  try {
    const results = await db.update(prescriptionsTable)
      .set({ 
        status: status,
        updated_at: new Date()
      })
      .where(eq(prescriptionsTable.id, id))
      .returning()
      .execute();

    if (results.length === 0) {
      throw new Error('Prescription not found');
    }

    const prescription = results[0];
    return {
      ...prescription,
      total_amount: parseFloat(prescription.total_amount)
    };
  } catch (error) {
    console.error('Failed to update prescription status:', error);
    throw error;
  }
}

export async function dispenseMedicine(
  prescriptionId: number, 
  medicineId: number, 
  quantityDispensed: number,
  userId: number
): Promise<PrescriptionItem> {
  try {
    // Get the prescription item
    const itemResults = await db.select()
      .from(prescriptionItemsTable)
      .where(
        and(
          eq(prescriptionItemsTable.prescription_id, prescriptionId),
          eq(prescriptionItemsTable.medicine_id, medicineId)
        )
      )
      .limit(1)
      .execute();

    if (itemResults.length === 0) {
      throw new Error('Prescription item not found');
    }

    const item = itemResults[0];
    const newQuantityDispensed = item.quantity_dispensed + quantityDispensed;

    if (newQuantityDispensed > item.quantity_prescribed) {
      throw new Error('Cannot dispense more than prescribed quantity');
    }

    // Check medicine stock
    const medicineResults = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicineId))
      .limit(1)
      .execute();

    if (medicineResults.length === 0) {
      throw new Error('Medicine not found');
    }

    const medicine = medicineResults[0];
    if (medicine.current_stock < quantityDispensed) {
      throw new Error('Insufficient stock');
    }

    // Update medicine stock
    await db.update(medicinesTable)
      .set({ 
        current_stock: medicine.current_stock - quantityDispensed,
        updated_at: new Date()
      })
      .where(eq(medicinesTable.id, medicineId))
      .execute();

    // Update prescription item
    const updatedItemResults = await db.update(prescriptionItemsTable)
      .set({ quantity_dispensed: newQuantityDispensed })
      .where(eq(prescriptionItemsTable.id, item.id))
      .returning()
      .execute();

    // Create inventory transaction
    await db.insert(inventoryTransactionsTable)
      .values({
        medicine_id: medicineId,
        transaction_type: 'subtraction',
        quantity: quantityDispensed,
        reason: 'Medicine dispensed',
        reference_id: prescriptionId,
        reference_type: 'prescription',
        performed_by_user_id: userId
      })
      .execute();

    const updatedItem = updatedItemResults[0];
    return {
      ...updatedItem,
      unit_price: parseFloat(updatedItem.unit_price),
      total_price: parseFloat(updatedItem.total_price)
    };
  } catch (error) {
    console.error('Failed to dispense medicine:', error);
    throw error;
  }
}

export async function getPrescriptionItems(prescriptionId: number): Promise<PrescriptionItem[]> {
  try {
    const results = await db.select()
      .from(prescriptionItemsTable)
      .where(eq(prescriptionItemsTable.prescription_id, prescriptionId))
      .execute();

    return results.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price)
    }));
  } catch (error) {
    console.error('Failed to get prescription items:', error);
    throw error;
  }
}