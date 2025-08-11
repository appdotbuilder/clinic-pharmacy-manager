import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  prescriptionsTable, 
  prescriptionItemsTable, 
  medicinesTable, 
  usersTable, 
  patientsTable, 
  visitsTable,
  inventoryTransactionsTable 
} from '../db/schema';
import { type CreatePrescriptionInput, type PrescriptionStatus } from '../schema';
import { 
  createPrescription, 
  getPrescriptions, 
  getPrescription, 
  getPrescriptionsByPatient, 
  getPrescriptionsByDoctor, 
  getPendingPrescriptions, 
  updatePrescriptionStatus,
  dispenseMedicine,
  getPrescriptionItems
} from '../handlers/prescriptions';
import { eq, and } from 'drizzle-orm';

describe('prescriptions handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  async function createTestData() {
    // Create test user (doctor)
    const doctorResult = await db.insert(usersTable)
      .values({
        username: 'testdoctor',
        email: 'doctor@test.com',
        password_hash: 'hashedpassword',
        role: 'doctor',
        first_name: 'Test',
        last_name: 'Doctor',
        phone: '123-456-7890'
      })
      .returning()
      .execute();

    // Create test user (pharmacist)
    const pharmacistResult = await db.insert(usersTable)
      .values({
        username: 'testpharmacist',
        email: 'pharmacist@test.com',
        password_hash: 'hashedpassword',
        role: 'cashier_receptionist',
        first_name: 'Test',
        last_name: 'Pharmacist',
        phone: '123-456-7891'
      })
      .returning()
      .execute();

    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        first_name: 'Test',
        last_name: 'Patient',
        date_of_birth: '1990-01-01',
        gender: 'male',
        phone: '123-456-7892',
        email: 'patient@test.com',
        address: '123 Test St'
      })
      .returning()
      .execute();

    // Create test visit
    const visitResult = await db.insert(visitsTable)
      .values({
        patient_id: patientResult[0].id,
        doctor_id: doctorResult[0].id,
        visit_date: new Date(),
        reason_for_visit: 'Routine checkup'
      })
      .returning()
      .execute();

    // Create test medicines
    const medicine1Result = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine 1',
        description: 'A test medicine',
        current_stock: 100,
        price: '10.50',
        minimum_stock_level: 10
      })
      .returning()
      .execute();

    const medicine2Result = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine 2',
        description: 'Another test medicine',
        current_stock: 50,
        price: '25.75',
        minimum_stock_level: 5
      })
      .returning()
      .execute();

    return {
      doctor: doctorResult[0],
      pharmacist: pharmacistResult[0],
      patient: patientResult[0],
      visit: visitResult[0],
      medicine1: medicine1Result[0],
      medicine2: medicine2Result[0]
    };
  }

  describe('createPrescription', () => {
    it('should create a prescription with items', async () => {
      const testData = await createTestData();
      
      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 2,
            dosage_instructions: 'Take twice daily'
          },
          {
            medicine_id: testData.medicine2.id,
            quantity: 1,
            dosage_instructions: 'Take once daily'
          }
        ]
      };

      const result = await createPrescription(input);

      expect(result.visit_id).toEqual(testData.visit.id);
      expect(result.doctor_id).toEqual(testData.doctor.id);
      expect(result.patient_id).toEqual(testData.patient.id);
      expect(result.status).toEqual('pending');
      expect(result.total_amount).toEqual(46.75); // (10.50 * 2) + (25.75 * 1)
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify prescription items were created
      const items = await db.select()
        .from(prescriptionItemsTable)
        .where(eq(prescriptionItemsTable.prescription_id, result.id))
        .execute();

      expect(items).toHaveLength(2);
      expect(items[0].quantity_prescribed).toEqual(2);
      expect(items[0].quantity_dispensed).toEqual(0);
      expect(parseFloat(items[0].unit_price)).toEqual(10.50);
      expect(parseFloat(items[0].total_price)).toEqual(21.00);
    });

    it('should throw error for non-existent medicine', async () => {
      const testData = await createTestData();
      
      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: 999,
            quantity: 1,
            dosage_instructions: 'Take as needed'
          }
        ]
      };

      await expect(createPrescription(input)).rejects.toThrow(/Medicine with ID 999 not found/i);
    });
  });

  describe('getPrescriptions', () => {
    it('should return all prescriptions', async () => {
      const testData = await createTestData();

      // Create a prescription
      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 1,
            dosage_instructions: 'Take once daily'
          }
        ]
      };

      await createPrescription(input);

      const results = await getPrescriptions();

      expect(results).toHaveLength(1);
      expect(results[0].doctor_id).toEqual(testData.doctor.id);
      expect(results[0].patient_id).toEqual(testData.patient.id);
      expect(typeof results[0].total_amount).toBe('number');
    });

    it('should return empty array when no prescriptions exist', async () => {
      const results = await getPrescriptions();
      expect(results).toHaveLength(0);
    });
  });

  describe('getPrescription', () => {
    it('should return a specific prescription', async () => {
      const testData = await createTestData();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 1,
            dosage_instructions: 'Take once daily'
          }
        ]
      };

      const created = await createPrescription(input);
      const result = await getPrescription(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.doctor_id).toEqual(testData.doctor.id);
      expect(typeof result!.total_amount).toBe('number');
    });

    it('should return null for non-existent prescription', async () => {
      const result = await getPrescription(999);
      expect(result).toBeNull();
    });
  });

  describe('getPrescriptionsByPatient', () => {
    it('should return prescriptions for specific patient', async () => {
      const testData = await createTestData();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 1,
            dosage_instructions: 'Take once daily'
          }
        ]
      };

      await createPrescription(input);

      const results = await getPrescriptionsByPatient(testData.patient.id);

      expect(results).toHaveLength(1);
      expect(results[0].patient_id).toEqual(testData.patient.id);
    });

    it('should return empty array for patient with no prescriptions', async () => {
      const results = await getPrescriptionsByPatient(999);
      expect(results).toHaveLength(0);
    });
  });

  describe('getPrescriptionsByDoctor', () => {
    it('should return prescriptions for specific doctor', async () => {
      const testData = await createTestData();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 1,
            dosage_instructions: 'Take once daily'
          }
        ]
      };

      await createPrescription(input);

      const results = await getPrescriptionsByDoctor(testData.doctor.id);

      expect(results).toHaveLength(1);
      expect(results[0].doctor_id).toEqual(testData.doctor.id);
    });

    it('should return empty array for doctor with no prescriptions', async () => {
      const results = await getPrescriptionsByDoctor(999);
      expect(results).toHaveLength(0);
    });
  });

  describe('getPendingPrescriptions', () => {
    it('should return only pending prescriptions', async () => {
      const testData = await createTestData();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 1,
            dosage_instructions: 'Take once daily'
          }
        ]
      };

      const created = await createPrescription(input);

      // Update one to filled status
      await updatePrescriptionStatus(created.id, 'filled');

      // Create another pending prescription
      await createPrescription(input);

      const results = await getPendingPrescriptions();

      expect(results).toHaveLength(1);
      expect(results[0].status).toEqual('pending');
    });
  });

  describe('updatePrescriptionStatus', () => {
    it('should update prescription status', async () => {
      const testData = await createTestData();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 1,
            dosage_instructions: 'Take once daily'
          }
        ]
      };

      const created = await createPrescription(input);
      const updated = await updatePrescriptionStatus(created.id, 'filled');

      expect(updated.status).toEqual('filled');
      expect(updated.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent prescription', async () => {
      await expect(updatePrescriptionStatus(999, 'filled')).rejects.toThrow(/Prescription not found/i);
    });
  });

  describe('dispenseMedicine', () => {
    it('should dispense medicine and update inventory', async () => {
      const testData = await createTestData();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 5,
            dosage_instructions: 'Take twice daily'
          }
        ]
      };

      const prescription = await createPrescription(input);
      
      const result = await dispenseMedicine(
        prescription.id,
        testData.medicine1.id,
        3,
        testData.pharmacist.id
      );

      expect(result.quantity_dispensed).toEqual(3);
      expect(typeof result.unit_price).toBe('number');
      expect(typeof result.total_price).toBe('number');

      // Check that medicine stock was updated
      const updatedMedicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, testData.medicine1.id))
        .limit(1)
        .execute();

      expect(updatedMedicine[0].current_stock).toEqual(97); // 100 - 3

      // Check inventory transaction was created
      const transactions = await db.select()
        .from(inventoryTransactionsTable)
        .where(
          and(
            eq(inventoryTransactionsTable.medicine_id, testData.medicine1.id),
            eq(inventoryTransactionsTable.reference_id, prescription.id)
          )
        )
        .execute();

      expect(transactions).toHaveLength(1);
      expect(transactions[0].transaction_type).toEqual('subtraction');
      expect(transactions[0].quantity).toEqual(3);
    });

    it('should throw error when dispensing more than prescribed', async () => {
      const testData = await createTestData();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 2,
            dosage_instructions: 'Take twice daily'
          }
        ]
      };

      const prescription = await createPrescription(input);
      
      await expect(dispenseMedicine(
        prescription.id,
        testData.medicine1.id,
        5,
        testData.pharmacist.id
      )).rejects.toThrow(/Cannot dispense more than prescribed quantity/i);
    });

    it('should throw error when insufficient stock', async () => {
      const testData = await createTestData();

      // Update medicine to have low stock
      await db.update(medicinesTable)
        .set({ current_stock: 1 })
        .where(eq(medicinesTable.id, testData.medicine1.id))
        .execute();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 5,
            dosage_instructions: 'Take twice daily'
          }
        ]
      };

      const prescription = await createPrescription(input);
      
      await expect(dispenseMedicine(
        prescription.id,
        testData.medicine1.id,
        3,
        testData.pharmacist.id
      )).rejects.toThrow(/Insufficient stock/i);
    });
  });

  describe('getPrescriptionItems', () => {
    it('should return items for a specific prescription', async () => {
      const testData = await createTestData();

      const input: CreatePrescriptionInput = {
        visit_id: testData.visit.id,
        doctor_id: testData.doctor.id,
        patient_id: testData.patient.id,
        prescription_items: [
          {
            medicine_id: testData.medicine1.id,
            quantity: 2,
            dosage_instructions: 'Take twice daily'
          },
          {
            medicine_id: testData.medicine2.id,
            quantity: 1,
            dosage_instructions: 'Take once daily'
          }
        ]
      };

      const prescription = await createPrescription(input);
      const items = await getPrescriptionItems(prescription.id);

      expect(items).toHaveLength(2);
      expect(items[0].prescription_id).toEqual(prescription.id);
      expect(items[0].quantity_prescribed).toEqual(2);
      expect(typeof items[0].unit_price).toBe('number');
      expect(typeof items[0].total_price).toBe('number');
    });

    it('should return empty array for prescription with no items', async () => {
      const items = await getPrescriptionItems(999);
      expect(items).toHaveLength(0);
    });
  });
});