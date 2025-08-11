import { db } from '../db';
import { visitsTable, patientsTable, usersTable } from '../db/schema';
import { type CreateVisitInput, type Visit } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function createVisit(input: CreateVisitInput): Promise<Visit> {
  try {
    // Verify that patient exists
    const patient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, input.patient_id))
      .execute();
    
    if (patient.length === 0) {
      throw new Error(`Patient with ID ${input.patient_id} not found`);
    }

    // Verify that doctor exists and has the correct role
    const doctor = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.doctor_id))
      .execute();
    
    if (doctor.length === 0 || doctor[0].role !== 'doctor') {
      throw new Error(`Doctor with ID ${input.doctor_id} not found`);
    }

    // Insert visit record
    const result = await db.insert(visitsTable)
      .values({
        patient_id: input.patient_id,
        doctor_id: input.doctor_id,
        visit_date: input.visit_date,
        reason_for_visit: input.reason_for_visit,
        diagnosis: input.diagnosis ?? null,
        treatment_notes: input.treatment_notes ?? null,
        vital_signs: input.vital_signs ?? null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Visit creation failed:', error);
    throw error;
  }
}

export async function getVisits(): Promise<Visit[]> {
  try {
    const results = await db.select()
      .from(visitsTable)
      .orderBy(desc(visitsTable.visit_date))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch visits:', error);
    throw error;
  }
}

export async function getVisit(id: number): Promise<Visit | null> {
  try {
    const results = await db.select()
      .from(visitsTable)
      .where(eq(visitsTable.id, id))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch visit:', error);
    throw error;
  }
}

export async function getPatientVisits(patientId: number): Promise<Visit[]> {
  try {
    // Verify patient exists
    const patient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId))
      .execute();
    
    if (patient.length === 0) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }

    const results = await db.select()
      .from(visitsTable)
      .where(eq(visitsTable.patient_id, patientId))
      .orderBy(desc(visitsTable.visit_date))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch patient visits:', error);
    throw error;
  }
}

export async function getDoctorVisits(doctorId: number): Promise<Visit[]> {
  try {
    // Verify doctor exists and has correct role
    const doctor = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, doctorId))
      .execute();
    
    if (doctor.length === 0 || doctor[0].role !== 'doctor') {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    const results = await db.select()
      .from(visitsTable)
      .where(eq(visitsTable.doctor_id, doctorId))
      .orderBy(desc(visitsTable.visit_date))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch doctor visits:', error);
    throw error;
  }
}

export async function updateVisit(id: number, input: Partial<CreateVisitInput>): Promise<Visit> {
  try {
    // Check if visit exists
    const existingVisit = await db.select()
      .from(visitsTable)
      .where(eq(visitsTable.id, id))
      .execute();

    if (existingVisit.length === 0) {
      throw new Error(`Visit with ID ${id} not found`);
    }

    // If patient_id is being updated, verify it exists
    if (input.patient_id !== undefined) {
      const patient = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, input.patient_id))
        .execute();
      
      if (patient.length === 0) {
        throw new Error(`Patient with ID ${input.patient_id} not found`);
      }
    }

    // If doctor_id is being updated, verify it exists and has correct role
    if (input.doctor_id !== undefined) {
      const doctor = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.doctor_id))
        .execute();
      
      if (doctor.length === 0 || doctor[0].role !== 'doctor') {
        throw new Error(`Doctor with ID ${input.doctor_id} not found`);
      }
    }

    // Update visit record
    const result = await db.update(visitsTable)
      .set({
        ...input,
        updated_at: new Date()
      })
      .where(eq(visitsTable.id, id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Visit update failed:', error);
    throw error;
  }
}