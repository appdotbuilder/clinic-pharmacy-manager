import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentsTable, patientsTable, prescriptionsTable, usersTable, visitsTable, medicinesTable } from '../db/schema';
import { type CreatePaymentInput, type UserRole } from '../schema';
import {
  createPayment,
  getPayments,
  getPayment,
  getPaymentsByPatient,
  getPaymentsByPrescription,
  getPaymentsByDateRange,
  getTotalPaymentsByDate
} from '../handlers/payments';
import { eq } from 'drizzle-orm';

describe('Payment handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let patientId: number;
  let doctorId: number;
  let cashierId: number;
  let visitId: number;
  let prescriptionId: number;

  beforeEach(async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1990-01-01',
        gender: 'male',
        phone: '1234567890',
        email: 'john.doe@example.com',
        address: '123 Main St'
      })
      .returning()
      .execute();
    patientId = patientResult[0].id;

    // Create test doctor
    const doctorResult = await db.insert(usersTable)
      .values({
        username: 'doctor1',
        email: 'doctor@example.com',
        password_hash: 'hashedpassword',
        role: 'doctor' as UserRole,
        first_name: 'Dr. Jane',
        last_name: 'Smith',
        phone: '9876543210'
      })
      .returning()
      .execute();
    doctorId = doctorResult[0].id;

    // Create test cashier
    const cashierResult = await db.insert(usersTable)
      .values({
        username: 'cashier1',
        email: 'cashier@example.com',
        password_hash: 'hashedpassword',
        role: 'cashier_receptionist' as UserRole,
        first_name: 'Alice',
        last_name: 'Johnson',
        phone: '5555555555'
      })
      .returning()
      .execute();
    cashierId = cashierResult[0].id;

    // Create test visit
    const visitResult = await db.insert(visitsTable)
      .values({
        patient_id: patientId,
        doctor_id: doctorId,
        visit_date: new Date(),
        reason_for_visit: 'Regular checkup'
      })
      .returning()
      .execute();
    visitId = visitResult[0].id;

    // Create test prescription
    const prescriptionResult = await db.insert(prescriptionsTable)
      .values({
        visit_id: visitId,
        doctor_id: doctorId,
        patient_id: patientId,
        status: 'pending',
        total_amount: '100.50'
      })
      .returning()
      .execute();
    prescriptionId = prescriptionResult[0].id;
  });

  describe('createPayment', () => {
    it('should create a payment with prescription', async () => {
      const testInput: CreatePaymentInput = {
        prescription_id: prescriptionId,
        patient_id: patientId,
        amount: 100.50,
        payment_method: 'cash',
        transaction_reference: 'TXN123',
        notes: 'Payment for prescription',
        processed_by_user_id: cashierId
      };

      const result = await createPayment(testInput);

      expect(result.prescription_id).toEqual(prescriptionId);
      expect(result.patient_id).toEqual(patientId);
      expect(result.amount).toEqual(100.50);
      expect(typeof result.amount).toEqual('number');
      expect(result.payment_method).toEqual('cash');
      expect(result.transaction_reference).toEqual('TXN123');
      expect(result.notes).toEqual('Payment for prescription');
      expect(result.processed_by_user_id).toEqual(cashierId);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a payment without prescription', async () => {
      const testInput: CreatePaymentInput = {
        patient_id: patientId,
        amount: 50.25,
        payment_method: 'card',
        processed_by_user_id: cashierId
      };

      const result = await createPayment(testInput);

      expect(result.prescription_id).toBeNull();
      expect(result.patient_id).toEqual(patientId);
      expect(result.amount).toEqual(50.25);
      expect(result.payment_method).toEqual('card');
      expect(result.transaction_reference).toBeNull();
      expect(result.notes).toBeNull();
      expect(result.processed_by_user_id).toEqual(cashierId);
    });

    it('should save payment to database', async () => {
      const testInput: CreatePaymentInput = {
        patient_id: patientId,
        amount: 75.00,
        payment_method: 'cash',
        processed_by_user_id: cashierId
      };

      const result = await createPayment(testInput);

      const payments = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, result.id))
        .execute();

      expect(payments).toHaveLength(1);
      expect(payments[0].patient_id).toEqual(patientId);
      expect(parseFloat(payments[0].amount)).toEqual(75.00);
      expect(payments[0].payment_method).toEqual('cash');
      expect(payments[0].processed_by_user_id).toEqual(cashierId);
    });

    it('should throw error for non-existent patient', async () => {
      const testInput: CreatePaymentInput = {
        patient_id: 99999,
        amount: 100.00,
        payment_method: 'cash',
        processed_by_user_id: cashierId
      };

      await expect(createPayment(testInput)).rejects.toThrow(/Patient with ID 99999 not found/i);
    });

    it('should throw error for non-existent prescription', async () => {
      const testInput: CreatePaymentInput = {
        prescription_id: 99999,
        patient_id: patientId,
        amount: 100.00,
        payment_method: 'cash',
        processed_by_user_id: cashierId
      };

      await expect(createPayment(testInput)).rejects.toThrow(/Prescription with ID 99999 not found/i);
    });

    it('should throw error for non-existent user', async () => {
      const testInput: CreatePaymentInput = {
        patient_id: patientId,
        amount: 100.00,
        payment_method: 'cash',
        processed_by_user_id: 99999
      };

      await expect(createPayment(testInput)).rejects.toThrow(/User with ID 99999 not found/i);
    });
  });

  describe('getPayments', () => {
    beforeEach(async () => {
      // Create test payments
      await db.insert(paymentsTable)
        .values([
          {
            patient_id: patientId,
            amount: '100.50',
            payment_method: 'cash',
            processed_by_user_id: cashierId
          },
          {
            prescription_id: prescriptionId,
            patient_id: patientId,
            amount: '75.25',
            payment_method: 'card',
            processed_by_user_id: cashierId
          }
        ])
        .execute();
    });

    it('should return all payments', async () => {
      const result = await getPayments();

      expect(result).toHaveLength(2);
      expect(result[0].amount).toEqual(100.50);
      expect(typeof result[0].amount).toEqual('number');
      expect(result[0].payment_method).toEqual('cash');
      expect(result[1].amount).toEqual(75.25);
      expect(result[1].payment_method).toEqual('card');
    });

    it('should return empty array when no payments exist', async () => {
      // Clear all payments
      await db.delete(paymentsTable).execute();

      const result = await getPayments();
      expect(result).toHaveLength(0);
    });
  });

  describe('getPayment', () => {
    let paymentId: number;

    beforeEach(async () => {
      const paymentResult = await db.insert(paymentsTable)
        .values({
          patient_id: patientId,
          amount: '150.75',
          payment_method: 'card',
          transaction_reference: 'TXN456',
          notes: 'Test payment',
          processed_by_user_id: cashierId
        })
        .returning()
        .execute();
      paymentId = paymentResult[0].id;
    });

    it('should return payment by ID', async () => {
      const result = await getPayment(paymentId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(paymentId);
      expect(result!.amount).toEqual(150.75);
      expect(typeof result!.amount).toEqual('number');
      expect(result!.payment_method).toEqual('card');
      expect(result!.transaction_reference).toEqual('TXN456');
      expect(result!.notes).toEqual('Test payment');
    });

    it('should return null for non-existent payment', async () => {
      const result = await getPayment(99999);
      expect(result).toBeNull();
    });
  });

  describe('getPaymentsByPatient', () => {
    let otherPatientId: number;

    beforeEach(async () => {
      // Create another patient
      const otherPatientResult = await db.insert(patientsTable)
        .values({
          first_name: 'Jane',
          last_name: 'Smith',
          date_of_birth: '1985-05-15',
          gender: 'female',
          phone: '9876543210',
          address: '456 Oak St'
        })
        .returning()
        .execute();
      otherPatientId = otherPatientResult[0].id;

      // Create payments for both patients
      await db.insert(paymentsTable)
        .values([
          {
            patient_id: patientId,
            amount: '100.00',
            payment_method: 'cash',
            processed_by_user_id: cashierId
          },
          {
            patient_id: patientId,
            amount: '50.00',
            payment_method: 'card',
            processed_by_user_id: cashierId
          },
          {
            patient_id: otherPatientId,
            amount: '75.00',
            payment_method: 'cash',
            processed_by_user_id: cashierId
          }
        ])
        .execute();
    });

    it('should return payments for specific patient', async () => {
      const result = await getPaymentsByPatient(patientId);

      expect(result).toHaveLength(2);
      result.forEach(payment => {
        expect(payment.patient_id).toEqual(patientId);
        expect(typeof payment.amount).toEqual('number');
      });
    });

    it('should return empty array for patient with no payments', async () => {
      // Create a new patient without payments
      const newPatientResult = await db.insert(patientsTable)
        .values({
          first_name: 'Bob',
          last_name: 'Wilson',
          date_of_birth: '1992-03-20',
          gender: 'male',
          phone: '1111111111',
          address: '789 Pine St'
        })
        .returning()
        .execute();

      const result = await getPaymentsByPatient(newPatientResult[0].id);
      expect(result).toHaveLength(0);
    });
  });

  describe('getPaymentsByPrescription', () => {
    let otherPrescriptionId: number;

    beforeEach(async () => {
      // Create another prescription
      const otherPrescriptionResult = await db.insert(prescriptionsTable)
        .values({
          visit_id: visitId,
          doctor_id: doctorId,
          patient_id: patientId,
          status: 'filled',
          total_amount: '200.00'
        })
        .returning()
        .execute();
      otherPrescriptionId = otherPrescriptionResult[0].id;

      // Create payments for both prescriptions
      await db.insert(paymentsTable)
        .values([
          {
            prescription_id: prescriptionId,
            patient_id: patientId,
            amount: '100.50',
            payment_method: 'cash',
            processed_by_user_id: cashierId
          },
          {
            prescription_id: prescriptionId,
            patient_id: patientId,
            amount: '25.50',
            payment_method: 'card',
            processed_by_user_id: cashierId
          },
          {
            prescription_id: otherPrescriptionId,
            patient_id: patientId,
            amount: '200.00',
            payment_method: 'cash',
            processed_by_user_id: cashierId
          }
        ])
        .execute();
    });

    it('should return payments for specific prescription', async () => {
      const result = await getPaymentsByPrescription(prescriptionId);

      expect(result).toHaveLength(2);
      result.forEach(payment => {
        expect(payment.prescription_id).toEqual(prescriptionId);
        expect(typeof payment.amount).toEqual('number');
      });
    });

    it('should return empty array for prescription with no payments', async () => {
      // Create a new prescription without payments
      const newPrescriptionResult = await db.insert(prescriptionsTable)
        .values({
          visit_id: visitId,
          doctor_id: doctorId,
          patient_id: patientId,
          status: 'pending',
          total_amount: '50.00'
        })
        .returning()
        .execute();

      const result = await getPaymentsByPrescription(newPrescriptionResult[0].id);
      expect(result).toHaveLength(0);
    });
  });

  describe('getPaymentsByDateRange', () => {
    beforeEach(async () => {
      // Use specific times to avoid timezone issues
      const baseDate = new Date('2024-01-15T10:00:00Z');
      const yesterday = new Date('2024-01-14T10:00:00Z');
      const today = new Date('2024-01-15T10:00:00Z');
      const tomorrow = new Date('2024-01-16T10:00:00Z');

      // Create payments with different dates
      await db.insert(paymentsTable)
        .values([
          {
            patient_id: patientId,
            amount: '100.00',
            payment_method: 'cash',
            processed_by_user_id: cashierId,
            created_at: yesterday
          },
          {
            patient_id: patientId,
            amount: '50.00',
            payment_method: 'card',
            processed_by_user_id: cashierId,
            created_at: today
          },
          {
            patient_id: patientId,
            amount: '75.00',
            payment_method: 'cash',
            processed_by_user_id: cashierId,
            created_at: tomorrow
          }
        ])
        .execute();
    });

    it('should return payments within date range', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-16T23:59:59Z');

      const result = await getPaymentsByDateRange(startDate, endDate);

      expect(result).toHaveLength(2);
      result.forEach(payment => {
        expect(payment.created_at >= startDate).toBe(true);
        expect(payment.created_at <= endDate).toBe(true);
        expect(typeof payment.amount).toEqual('number');
      });
    });

    it('should return empty array when no payments in date range', async () => {
      const futureDate1 = new Date('2024-02-01T00:00:00Z');
      const futureDate2 = new Date('2024-02-02T23:59:59Z');

      const result = await getPaymentsByDateRange(futureDate1, futureDate2);
      expect(result).toHaveLength(0);
    });
  });

  describe('getTotalPaymentsByDate', () => {
    beforeEach(async () => {
      const today = new Date('2024-01-15T12:00:00Z');
      const yesterday = new Date('2024-01-14T12:00:00Z');

      // Create payments for today and yesterday
      await db.insert(paymentsTable)
        .values([
          {
            patient_id: patientId,
            amount: '100.50',
            payment_method: 'cash',
            processed_by_user_id: cashierId,
            created_at: today
          },
          {
            patient_id: patientId,
            amount: '75.25',
            payment_method: 'card',
            processed_by_user_id: cashierId,
            created_at: today
          },
          {
            patient_id: patientId,
            amount: '50.00',
            payment_method: 'cash',
            processed_by_user_id: cashierId,
            created_at: yesterday
          }
        ])
        .execute();
    });

    it('should return total payments for specific date', async () => {
      const today = new Date('2024-01-15');
      const result = await getTotalPaymentsByDate(today);

      expect(result).toEqual(175.75); // 100.50 + 75.25
      expect(typeof result).toEqual('number');
    });

    it('should return zero when no payments for date', async () => {
      const futureDate = new Date('2024-02-01');

      const result = await getTotalPaymentsByDate(futureDate);
      expect(result).toEqual(0);
    });
  });
});