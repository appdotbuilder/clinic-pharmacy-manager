import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type CreatePatientInput, type UpdatePatientInput, type Patient } from '../schema';
import { eq, or, ilike, desc } from 'drizzle-orm';

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  try {
    const result = await db.insert(patientsTable)
      .values({
        first_name: input.first_name,
        last_name: input.last_name,
        date_of_birth: input.date_of_birth.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        gender: input.gender,
        phone: input.phone,
        email: input.email || null,
        address: input.address,
        emergency_contact_name: input.emergency_contact_name || null,
        emergency_contact_phone: input.emergency_contact_phone || null,
        allergies: input.allergies || null,
        chronic_conditions: input.chronic_conditions || null,
        blood_type: input.blood_type || null
      })
      .returning()
      .execute();

    // Convert date string back to Date object before returning
    const patient = result[0];
    return {
      ...patient,
      date_of_birth: new Date(patient.date_of_birth)
    };
  } catch (error) {
    console.error('Patient creation failed:', error);
    throw error;
  }
}

export async function getPatients(): Promise<Patient[]> {
  try {
    const result = await db.select()
      .from(patientsTable)
      .orderBy(desc(patientsTable.created_at))
      .execute();

    // Convert date strings back to Date objects
    return result.map(patient => ({
      ...patient,
      date_of_birth: new Date(patient.date_of_birth)
    }));
  } catch (error) {
    console.error('Failed to fetch patients:', error);
    throw error;
  }
}

export async function getPatient(id: number): Promise<Patient | null> {
  try {
    const result = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, id))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert date string back to Date object
    const patient = result[0];
    return {
      ...patient,
      date_of_birth: new Date(patient.date_of_birth)
    };
  } catch (error) {
    console.error('Failed to fetch patient:', error);
    throw error;
  }
}

export async function updatePatient(input: UpdatePatientInput): Promise<Patient> {
  try {
    // Build update object with only provided fields
    const updateData: any = {};
    
    if (input.first_name !== undefined) updateData.first_name = input.first_name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.date_of_birth !== undefined) updateData.date_of_birth = input.date_of_birth.toISOString().split('T')[0]; // Convert Date to string
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.emergency_contact_name !== undefined) updateData.emergency_contact_name = input.emergency_contact_name;
    if (input.emergency_contact_phone !== undefined) updateData.emergency_contact_phone = input.emergency_contact_phone;
    if (input.allergies !== undefined) updateData.allergies = input.allergies;
    if (input.chronic_conditions !== undefined) updateData.chronic_conditions = input.chronic_conditions;
    if (input.blood_type !== undefined) updateData.blood_type = input.blood_type;

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    const result = await db.update(patientsTable)
      .set(updateData)
      .where(eq(patientsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Patient with id ${input.id} not found`);
    }

    // Convert date string back to Date object before returning
    const patient = result[0];
    return {
      ...patient,
      date_of_birth: new Date(patient.date_of_birth)
    };
  } catch (error) {
    console.error('Patient update failed:', error);
    throw error;
  }
}

export async function deletePatient(id: number): Promise<boolean> {
  try {
    const result = await db.delete(patientsTable)
      .where(eq(patientsTable.id, id))
      .returning({ id: patientsTable.id })
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Patient deletion failed:', error);
    throw error;
  }
}

export async function searchPatients(query: string): Promise<Patient[]> {
  try {
    const searchTerm = `%${query}%`;
    
    const result = await db.select()
      .from(patientsTable)
      .where(
        or(
          ilike(patientsTable.first_name, searchTerm),
          ilike(patientsTable.last_name, searchTerm),
          ilike(patientsTable.phone, searchTerm),
          ilike(patientsTable.email, searchTerm)
        )
      )
      .orderBy(desc(patientsTable.created_at))
      .execute();

    // Convert date strings back to Date objects
    return result.map(patient => ({
      ...patient,
      date_of_birth: new Date(patient.date_of_birth)
    }));
  } catch (error) {
    console.error('Patient search failed:', error);
    throw error;
  }
}