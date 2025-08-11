import { db } from '../db';
import { paymentsTable, patientsTable, prescriptionsTable, usersTable } from '../db/schema';
import { type CreatePaymentInput, type Payment } from '../schema';
import { eq, gte, lte, and, sum, SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  try {
    // Verify patient exists
    const patient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, input.patient_id))
      .execute();

    if (patient.length === 0) {
      throw new Error(`Patient with ID ${input.patient_id} not found`);
    }

    // Verify prescription exists if prescription_id is provided
    if (input.prescription_id) {
      const prescription = await db.select()
        .from(prescriptionsTable)
        .where(eq(prescriptionsTable.id, input.prescription_id))
        .execute();

      if (prescription.length === 0) {
        throw new Error(`Prescription with ID ${input.prescription_id} not found`);
      }
    }

    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.processed_by_user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with ID ${input.processed_by_user_id} not found`);
    }

    // Insert payment record
    const result = await db.insert(paymentsTable)
      .values({
        prescription_id: input.prescription_id || null,
        patient_id: input.patient_id,
        amount: input.amount.toString(), // Convert number to string for numeric column
        payment_method: input.payment_method,
        transaction_reference: input.transaction_reference || null,
        notes: input.notes || null,
        processed_by_user_id: input.processed_by_user_id
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
}

export async function getPayments(): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount) // Convert numeric field to number
    }));
  } catch (error) {
    console.error('Failed to fetch payments:', error);
    throw error;
  }
}

export async function getPayment(id: number): Promise<Payment | null> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const payment = results[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount) // Convert numeric field to number
    };
  } catch (error) {
    console.error('Failed to fetch payment:', error);
    throw error;
  }
}

export async function getPaymentsByPatient(patientId: number): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.patient_id, patientId))
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount) // Convert numeric field to number
    }));
  } catch (error) {
    console.error('Failed to fetch payments by patient:', error);
    throw error;
  }
}

export async function getPaymentsByPrescription(prescriptionId: number): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.prescription_id, prescriptionId))
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount) // Convert numeric field to number
    }));
  } catch (error) {
    console.error('Failed to fetch payments by prescription:', error);
    throw error;
  }
}

export async function getPaymentsByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(and(
        gte(paymentsTable.created_at, startDate),
        lte(paymentsTable.created_at, endDate)
      ))
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount) // Convert numeric field to number
    }));
  } catch (error) {
    console.error('Failed to fetch payments by date range:', error);
    throw error;
  }
}

export async function getTotalPaymentsByDate(date: Date): Promise<number> {
  try {
    // Create date range for the entire day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db.select({
      total: sum(paymentsTable.amount)
    })
      .from(paymentsTable)
      .where(and(
        gte(paymentsTable.created_at, startOfDay),
        lte(paymentsTable.created_at, endOfDay)
      ))
      .execute();

    // sum() returns string | null, convert to number
    const total = result[0]?.total;
    return total ? parseFloat(total) : 0;
  } catch (error) {
    console.error('Failed to calculate total payments by date:', error);
    throw error;
  }
}