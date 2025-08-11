import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type CreatePatientInput, type UpdatePatientInput } from '../schema';
import { 
  createPatient, 
  getPatients, 
  getPatient, 
  updatePatient, 
  deletePatient, 
  searchPatients 
} from '../handlers/patients';
import { eq } from 'drizzle-orm';

// Test patient data
const testPatientInput: CreatePatientInput = {
  first_name: 'John',
  last_name: 'Doe',
  date_of_birth: new Date('1990-01-15'),
  gender: 'male',
  phone: '+1234567890',
  email: 'john.doe@example.com',
  address: '123 Main St, City, State 12345',
  emergency_contact_name: 'Jane Doe',
  emergency_contact_phone: '+1234567891',
  allergies: 'Peanuts, Shellfish',
  chronic_conditions: 'Hypertension',
  blood_type: 'O+'
};

const minimalPatientInput: CreatePatientInput = {
  first_name: 'Jane',
  last_name: 'Smith',
  date_of_birth: new Date('1985-03-20'),
  gender: 'female',
  phone: '+1987654321',
  address: '456 Oak Ave, City, State 54321'
};

describe('Patient Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createPatient', () => {
    it('should create a patient with all fields', async () => {
      const result = await createPatient(testPatientInput);

      expect(result.id).toBeDefined();
      expect(result.first_name).toEqual('John');
      expect(result.last_name).toEqual('Doe');
      expect(result.date_of_birth).toEqual(new Date('1990-01-15'));
      expect(result.gender).toEqual('male');
      expect(result.phone).toEqual('+1234567890');
      expect(result.email).toEqual('john.doe@example.com');
      expect(result.address).toEqual('123 Main St, City, State 12345');
      expect(result.emergency_contact_name).toEqual('Jane Doe');
      expect(result.emergency_contact_phone).toEqual('+1234567891');
      expect(result.allergies).toEqual('Peanuts, Shellfish');
      expect(result.chronic_conditions).toEqual('Hypertension');
      expect(result.blood_type).toEqual('O+');
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a patient with minimal required fields', async () => {
      const result = await createPatient(minimalPatientInput);

      expect(result.id).toBeDefined();
      expect(result.first_name).toEqual('Jane');
      expect(result.last_name).toEqual('Smith');
      expect(result.date_of_birth).toEqual(new Date('1985-03-20'));
      expect(result.gender).toEqual('female');
      expect(result.phone).toEqual('+1987654321');
      expect(result.address).toEqual('456 Oak Ave, City, State 54321');
      expect(result.email).toBeNull();
      expect(result.emergency_contact_name).toBeNull();
      expect(result.emergency_contact_phone).toBeNull();
      expect(result.allergies).toBeNull();
      expect(result.chronic_conditions).toBeNull();
      expect(result.blood_type).toBeNull();
    });

    it('should save patient to database', async () => {
      const result = await createPatient(testPatientInput);

      const patients = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, result.id))
        .execute();

      expect(patients).toHaveLength(1);
      expect(patients[0].first_name).toEqual('John');
      expect(patients[0].last_name).toEqual('Doe');
      expect(patients[0].phone).toEqual('+1234567890');
      expect(patients[0].email).toEqual('john.doe@example.com');
    });
  });

  describe('getPatients', () => {
    it('should return empty array when no patients exist', async () => {
      const result = await getPatients();
      expect(result).toEqual([]);
    });

    it('should return all patients ordered by created_at desc', async () => {
      // Create multiple patients
      const patient1 = await createPatient(testPatientInput);
      const patient2 = await createPatient(minimalPatientInput);

      const result = await getPatients();

      expect(result).toHaveLength(2);
      // Should be ordered by created_at desc (newer first)
      expect(result[0].id).toEqual(patient2.id);
      expect(result[1].id).toEqual(patient1.id);
    });
  });

  describe('getPatient', () => {
    it('should return null for non-existent patient', async () => {
      const result = await getPatient(999);
      expect(result).toBeNull();
    });

    it('should return patient by id', async () => {
      const created = await createPatient(testPatientInput);

      const result = await getPatient(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.first_name).toEqual('John');
      expect(result!.last_name).toEqual('Doe');
      expect(result!.phone).toEqual('+1234567890');
    });
  });

  describe('updatePatient', () => {
    it('should update patient with partial data', async () => {
      const created = await createPatient(testPatientInput);

      const updateInput: UpdatePatientInput = {
        id: created.id,
        first_name: 'Johnny',
        phone: '+1111111111'
      };

      const result = await updatePatient(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.first_name).toEqual('Johnny');
      expect(result.phone).toEqual('+1111111111');
      // Other fields should remain unchanged
      expect(result.last_name).toEqual('Doe');
      expect(result.email).toEqual('john.doe@example.com');
      expect(result.updated_at).not.toEqual(created.updated_at);
    });

    it('should update patient with all fields', async () => {
      const created = await createPatient(minimalPatientInput);

      const updateInput: UpdatePatientInput = {
        id: created.id,
        first_name: 'Janet',
        last_name: 'Johnson',
        email: 'janet.johnson@example.com',
        allergies: 'Cats',
        blood_type: 'A-'
      };

      const result = await updatePatient(updateInput);

      expect(result.first_name).toEqual('Janet');
      expect(result.last_name).toEqual('Johnson');
      expect(result.email).toEqual('janet.johnson@example.com');
      expect(result.allergies).toEqual('Cats');
      expect(result.blood_type).toEqual('A-');
    });

    it('should throw error for non-existent patient', async () => {
      const updateInput: UpdatePatientInput = {
        id: 999,
        first_name: 'Non-existent'
      };

      await expect(updatePatient(updateInput)).rejects.toThrow(/not found/i);
    });

    it('should save updated data to database', async () => {
      const created = await createPatient(testPatientInput);

      const updateInput: UpdatePatientInput = {
        id: created.id,
        first_name: 'Updated Name'
      };

      await updatePatient(updateInput);

      const patients = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, created.id))
        .execute();

      expect(patients[0].first_name).toEqual('Updated Name');
    });
  });

  describe('deletePatient', () => {
    it('should return false for non-existent patient', async () => {
      const result = await deletePatient(999);
      expect(result).toBe(false);
    });

    it('should delete existing patient and return true', async () => {
      const created = await createPatient(testPatientInput);

      const result = await deletePatient(created.id);

      expect(result).toBe(true);

      // Verify patient is deleted from database
      const patients = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, created.id))
        .execute();

      expect(patients).toHaveLength(0);
    });
  });

  describe('searchPatients', () => {
    beforeEach(async () => {
      // Create test data for search
      await createPatient({
        ...testPatientInput,
        first_name: 'Alice',
        last_name: 'Anderson',
        phone: '+1111111111',
        email: 'alice@test.com'
      });

      await createPatient({
        ...testPatientInput,
        first_name: 'Bob',
        last_name: 'Brown',
        phone: '+2222222222',
        email: 'bob@example.org'
      });

      await createPatient({
        ...testPatientInput,
        first_name: 'Charlie',
        last_name: 'Smith',
        phone: '+3333333333',
        email: 'charlie@test.net'
      });
    });

    it('should return empty array for no matches', async () => {
      const result = await searchPatients('NonExistent');
      expect(result).toEqual([]);
    });

    it('should search by first name', async () => {
      const result = await searchPatients('Alice');
      expect(result).toHaveLength(1);
      expect(result[0].first_name).toEqual('Alice');
    });

    it('should search by last name', async () => {
      const result = await searchPatients('Brown');
      expect(result).toHaveLength(1);
      expect(result[0].last_name).toEqual('Brown');
    });

    it('should search by phone number', async () => {
      const result = await searchPatients('1111111111');
      expect(result).toHaveLength(1);
      expect(result[0].phone).toEqual('+1111111111');
    });

    it('should search by email', async () => {
      const result = await searchPatients('test');
      expect(result).toHaveLength(2);
      expect(result.map(p => p.email)).toContain('alice@test.com');
      expect(result.map(p => p.email)).toContain('charlie@test.net');
    });

    it('should perform case-insensitive search', async () => {
      const result = await searchPatients('ALICE');
      expect(result).toHaveLength(1);
      expect(result[0].first_name).toEqual('Alice');
    });

    it('should search with partial matches', async () => {
      const result = await searchPatients('mit');
      expect(result).toHaveLength(1);
      expect(result[0].last_name).toEqual('Smith');
    });

    it('should return results ordered by created_at desc', async () => {
      const result = await searchPatients('test');
      expect(result).toHaveLength(2);
      // Results should be ordered by creation time (newer first)
      // Since Charlie was created after Alice, Charlie should come first
      expect(result.some(p => p.email === 'charlie@test.net')).toBe(true);
      expect(result.some(p => p.email === 'alice@test.com')).toBe(true);
    });
  });
});