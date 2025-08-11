import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { patientsTable, usersTable, visitsTable } from '../db/schema';
import { type CreateVisitInput } from '../schema';
import { 
  createVisit, 
  getVisits, 
  getVisit, 
  getPatientVisits, 
  getDoctorVisits, 
  updateVisit 
} from '../handlers/visits';
import { eq } from 'drizzle-orm';

// Test data
const testDoctor = {
  username: 'doctor1',
  email: 'doctor@test.com',
  password_hash: 'hash123',
  role: 'doctor' as const,
  first_name: 'Dr. John',
  last_name: 'Smith',
  phone: '555-0123',
  is_active: true
};

const testPatient = {
  first_name: 'John',
  last_name: 'Doe',
  date_of_birth: '1990-01-01',
  gender: 'male' as const,
  phone: '555-0100',
  email: 'john.doe@test.com',
  address: '123 Main St',
  emergency_contact_name: 'Jane Doe',
  emergency_contact_phone: '555-0101',
  allergies: 'None',
  chronic_conditions: null,
  blood_type: 'O+'
};

const testCashier = {
  username: 'cashier1',
  email: 'cashier@test.com',
  password_hash: 'hash123',
  role: 'cashier_receptionist' as const,
  first_name: 'Jane',
  last_name: 'Wilson',
  phone: '555-0124',
  is_active: true
};

const testVisitInput: CreateVisitInput = {
  patient_id: 1,
  doctor_id: 1,
  visit_date: new Date('2024-01-15T10:00:00'),
  reason_for_visit: 'Regular checkup',
  diagnosis: 'Patient is healthy',
  treatment_notes: 'Continue regular exercise',
  vital_signs: 'BP: 120/80, HR: 72'
};

describe('Visits Handler', () => {
  let doctorId: number;
  let patientId: number;
  let cashierId: number;

  beforeEach(async () => {
    await createDB();

    // Create test doctor
    const doctorResult = await db.insert(usersTable)
      .values(testDoctor)
      .returning()
      .execute();
    doctorId = doctorResult[0].id;

    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values(testPatient)
      .returning()
      .execute();
    patientId = patientResult[0].id;

    // Create test cashier
    const cashierResult = await db.insert(usersTable)
      .values(testCashier)
      .returning()
      .execute();
    cashierId = cashierResult[0].id;

    // Update test input with actual IDs
    testVisitInput.patient_id = patientId;
    testVisitInput.doctor_id = doctorId;
  });

  afterEach(resetDB);

  describe('createVisit', () => {
    it('should create a visit successfully', async () => {
      const result = await createVisit(testVisitInput);

      expect(result.id).toBeDefined();
      expect(result.patient_id).toEqual(patientId);
      expect(result.doctor_id).toEqual(doctorId);
      expect(result.visit_date).toEqual(testVisitInput.visit_date);
      expect(result.reason_for_visit).toEqual('Regular checkup');
      expect(result.diagnosis).toEqual('Patient is healthy');
      expect(result.treatment_notes).toEqual('Continue regular exercise');
      expect(result.vital_signs).toEqual('BP: 120/80, HR: 72');
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a visit with minimal data', async () => {
      const minimalInput: CreateVisitInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        visit_date: new Date('2024-01-15T14:00:00'),
        reason_for_visit: 'Follow-up'
      };

      const result = await createVisit(minimalInput);

      expect(result.id).toBeDefined();
      expect(result.patient_id).toEqual(patientId);
      expect(result.doctor_id).toEqual(doctorId);
      expect(result.reason_for_visit).toEqual('Follow-up');
      expect(result.diagnosis).toBeNull();
      expect(result.treatment_notes).toBeNull();
      expect(result.vital_signs).toBeNull();
    });

    it('should save visit to database', async () => {
      const result = await createVisit(testVisitInput);

      const visits = await db.select()
        .from(visitsTable)
        .where(eq(visitsTable.id, result.id))
        .execute();

      expect(visits).toHaveLength(1);
      expect(visits[0].patient_id).toEqual(patientId);
      expect(visits[0].doctor_id).toEqual(doctorId);
      expect(visits[0].reason_for_visit).toEqual('Regular checkup');
    });

    it('should throw error for non-existent patient', async () => {
      const invalidInput = {
        ...testVisitInput,
        patient_id: 999
      };

      await expect(createVisit(invalidInput)).rejects.toThrow(/patient.*not found/i);
    });

    it('should throw error for non-existent doctor', async () => {
      const invalidInput = {
        ...testVisitInput,
        doctor_id: 999
      };

      await expect(createVisit(invalidInput)).rejects.toThrow(/doctor.*not found/i);
    });

    it('should throw error for non-doctor user as doctor', async () => {
      const invalidInput = {
        ...testVisitInput,
        doctor_id: cashierId
      };

      await expect(createVisit(invalidInput)).rejects.toThrow(/doctor.*not found/i);
    });
  });

  describe('getVisits', () => {
    it('should return all visits ordered by visit date desc', async () => {
      // Create multiple visits
      const visit1 = await createVisit({
        ...testVisitInput,
        visit_date: new Date('2024-01-10T10:00:00'),
        reason_for_visit: 'First visit'
      });

      const visit2 = await createVisit({
        ...testVisitInput,
        visit_date: new Date('2024-01-20T10:00:00'),
        reason_for_visit: 'Second visit'
      });

      const result = await getVisits();

      expect(result).toHaveLength(2);
      // Should be ordered by visit_date desc (newest first)
      expect(result[0].id).toEqual(visit2.id);
      expect(result[1].id).toEqual(visit1.id);
      expect(result[0].reason_for_visit).toEqual('Second visit');
      expect(result[1].reason_for_visit).toEqual('First visit');
    });

    it('should return empty array when no visits exist', async () => {
      const result = await getVisits();
      expect(result).toHaveLength(0);
    });
  });

  describe('getVisit', () => {
    it('should return visit by ID', async () => {
      const createdVisit = await createVisit(testVisitInput);

      const result = await getVisit(createdVisit.id);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdVisit.id);
      expect(result!.patient_id).toEqual(patientId);
      expect(result!.doctor_id).toEqual(doctorId);
      expect(result!.reason_for_visit).toEqual('Regular checkup');
    });

    it('should return null for non-existent visit', async () => {
      const result = await getVisit(999);
      expect(result).toBeNull();
    });
  });

  describe('getPatientVisits', () => {
    it('should return visits for specific patient', async () => {
      // Create another patient
      const patient2Result = await db.insert(patientsTable)
        .values({
          ...testPatient,
          email: 'patient2@test.com',
          phone: '555-0102'
        })
        .returning()
        .execute();
      const patient2Id = patient2Result[0].id;

      // Create visits for both patients
      const visit1 = await createVisit({
        ...testVisitInput,
        patient_id: patientId,
        visit_date: new Date('2024-01-10T10:00:00'),
        reason_for_visit: 'Patient 1 - Visit 1'
      });

      await createVisit({
        ...testVisitInput,
        patient_id: patient2Id,
        reason_for_visit: 'Patient 2 - Visit'
      });

      const visit3 = await createVisit({
        ...testVisitInput,
        patient_id: patientId,
        visit_date: new Date('2024-01-20T10:00:00'),
        reason_for_visit: 'Patient 1 - Visit 2'
      });

      const result = await getPatientVisits(patientId);

      expect(result).toHaveLength(2);
      // Should be ordered by visit_date desc
      expect(result[0].id).toEqual(visit3.id);
      expect(result[1].id).toEqual(visit1.id);
      expect(result[0].reason_for_visit).toEqual('Patient 1 - Visit 2');
      expect(result[1].reason_for_visit).toEqual('Patient 1 - Visit 1');
    });

    it('should return empty array for patient with no visits', async () => {
      // Create another patient without visits
      const patient2Result = await db.insert(patientsTable)
        .values({
          ...testPatient,
          email: 'patient2@test.com',
          phone: '555-0102'
        })
        .returning()
        .execute();

      const result = await getPatientVisits(patient2Result[0].id);
      expect(result).toHaveLength(0);
    });

    it('should throw error for non-existent patient', async () => {
      await expect(getPatientVisits(999)).rejects.toThrow(/patient.*not found/i);
    });
  });

  describe('getDoctorVisits', () => {
    it('should return visits for specific doctor', async () => {
      // Create another doctor
      const doctor2Result = await db.insert(usersTable)
        .values({
          ...testDoctor,
          username: 'doctor2',
          email: 'doctor2@test.com',
          first_name: 'Dr. Jane'
        })
        .returning()
        .execute();
      const doctor2Id = doctor2Result[0].id;

      // Create visits for both doctors
      const visit1 = await createVisit({
        ...testVisitInput,
        doctor_id: doctorId,
        visit_date: new Date('2024-01-10T10:00:00'),
        reason_for_visit: 'Doctor 1 - Visit 1'
      });

      await createVisit({
        ...testVisitInput,
        doctor_id: doctor2Id,
        reason_for_visit: 'Doctor 2 - Visit'
      });

      const visit3 = await createVisit({
        ...testVisitInput,
        doctor_id: doctorId,
        visit_date: new Date('2024-01-20T10:00:00'),
        reason_for_visit: 'Doctor 1 - Visit 2'
      });

      const result = await getDoctorVisits(doctorId);

      expect(result).toHaveLength(2);
      // Should be ordered by visit_date desc
      expect(result[0].id).toEqual(visit3.id);
      expect(result[1].id).toEqual(visit1.id);
      expect(result[0].reason_for_visit).toEqual('Doctor 1 - Visit 2');
      expect(result[1].reason_for_visit).toEqual('Doctor 1 - Visit 1');
    });

    it('should return empty array for doctor with no visits', async () => {
      // Create another doctor without visits
      const doctor2Result = await db.insert(usersTable)
        .values({
          ...testDoctor,
          username: 'doctor2',
          email: 'doctor2@test.com',
          first_name: 'Dr. Jane'
        })
        .returning()
        .execute();

      const result = await getDoctorVisits(doctor2Result[0].id);
      expect(result).toHaveLength(0);
    });

    it('should throw error for non-existent doctor', async () => {
      await expect(getDoctorVisits(999)).rejects.toThrow(/doctor.*not found/i);
    });

    it('should throw error for non-doctor user', async () => {
      await expect(getDoctorVisits(cashierId)).rejects.toThrow(/doctor.*not found/i);
    });
  });

  describe('updateVisit', () => {
    it('should update visit successfully', async () => {
      const createdVisit = await createVisit(testVisitInput);

      const updateData = {
        reason_for_visit: 'Updated reason',
        diagnosis: 'Updated diagnosis',
        treatment_notes: 'Updated notes'
      };

      const result = await updateVisit(createdVisit.id, updateData);

      expect(result.id).toEqual(createdVisit.id);
      expect(result.reason_for_visit).toEqual('Updated reason');
      expect(result.diagnosis).toEqual('Updated diagnosis');
      expect(result.treatment_notes).toEqual('Updated notes');
      expect(result.vital_signs).toEqual(testVisitInput.vital_signs ?? null);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update partial visit data', async () => {
      const createdVisit = await createVisit(testVisitInput);

      const updateData = {
        diagnosis: 'Only diagnosis updated'
      };

      const result = await updateVisit(createdVisit.id, updateData);

      expect(result.diagnosis).toEqual('Only diagnosis updated');
      expect(result.reason_for_visit).toEqual(testVisitInput.reason_for_visit);
      expect(result.treatment_notes).toEqual(testVisitInput.treatment_notes ?? null);
    });

    it('should save updates to database', async () => {
      const createdVisit = await createVisit(testVisitInput);

      await updateVisit(createdVisit.id, {
        diagnosis: 'Database updated diagnosis'
      });

      const visits = await db.select()
        .from(visitsTable)
        .where(eq(visitsTable.id, createdVisit.id))
        .execute();

      expect(visits[0].diagnosis).toEqual('Database updated diagnosis');
    });

    it('should update patient_id when valid', async () => {
      const createdVisit = await createVisit(testVisitInput);

      // Create another patient
      const patient2Result = await db.insert(patientsTable)
        .values({
          ...testPatient,
          email: 'patient2@test.com',
          phone: '555-0102'
        })
        .returning()
        .execute();

      const result = await updateVisit(createdVisit.id, {
        patient_id: patient2Result[0].id
      });

      expect(result.patient_id).toEqual(patient2Result[0].id);
    });

    it('should update doctor_id when valid', async () => {
      const createdVisit = await createVisit(testVisitInput);

      // Create another doctor
      const doctor2Result = await db.insert(usersTable)
        .values({
          ...testDoctor,
          username: 'doctor2',
          email: 'doctor2@test.com'
        })
        .returning()
        .execute();

      const result = await updateVisit(createdVisit.id, {
        doctor_id: doctor2Result[0].id
      });

      expect(result.doctor_id).toEqual(doctor2Result[0].id);
    });

    it('should throw error for non-existent visit', async () => {
      await expect(updateVisit(999, { diagnosis: 'Test' })).rejects.toThrow(/visit.*not found/i);
    });

    it('should throw error for invalid patient_id', async () => {
      const createdVisit = await createVisit(testVisitInput);

      await expect(updateVisit(createdVisit.id, { patient_id: 999 })).rejects.toThrow(/patient.*not found/i);
    });

    it('should throw error for invalid doctor_id', async () => {
      const createdVisit = await createVisit(testVisitInput);

      await expect(updateVisit(createdVisit.id, { doctor_id: 999 })).rejects.toThrow(/doctor.*not found/i);
    });

    it('should throw error when updating to non-doctor user', async () => {
      const createdVisit = await createVisit(testVisitInput);

      await expect(updateVisit(createdVisit.id, { doctor_id: cashierId })).rejects.toThrow(/doctor.*not found/i);
    });
  });
});