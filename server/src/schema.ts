import { z } from 'zod';

// User roles enum
export const userRoleEnum = z.enum(['admin', 'doctor', 'cashier']);
export type UserRole = z.infer<typeof userRoleEnum>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  full_name: z.string(),
  role: userRoleEnum,
  phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Patient schema
export const patientSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.coerce.date(),
  phone: z.string(),
  email: z.string().email().nullable(),
  address: z.string().nullable(),
  gender: z.enum(['male', 'female', 'other']),
  emergency_contact: z.string().nullable(),
  medical_history: z.string().nullable(),
  allergies: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Patient = z.infer<typeof patientSchema>;

// Medicine category schema
export const medicineCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date()
});

export type MedicineCategory = z.infer<typeof medicineCategorySchema>;

// Medicine schema
export const medicineSchema = z.object({
  id: z.number(),
  name: z.string(),
  brand: z.string().nullable(),
  category_id: z.number(),
  generic_name: z.string().nullable(),
  dosage: z.string(),
  unit: z.string(),
  price_per_unit: z.number(),
  stock_quantity: z.number().int(),
  min_stock_level: z.number().int(),
  expiry_date: z.coerce.date(),
  batch_number: z.string().nullable(),
  manufacturer: z.string().nullable(),
  description: z.string().nullable(),
  requires_prescription: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Medicine = z.infer<typeof medicineSchema>;

// Prescription schema
export const prescriptionSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  doctor_id: z.number(),
  prescription_date: z.coerce.date(),
  diagnosis: z.string(),
  symptoms: z.string().nullable(),
  notes: z.string().nullable(),
  is_filled: z.boolean(),
  total_amount: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Prescription = z.infer<typeof prescriptionSchema>;

// Prescription item schema
export const prescriptionItemSchema = z.object({
  id: z.number(),
  prescription_id: z.number(),
  medicine_id: z.number(),
  quantity: z.number().int(),
  dosage_instructions: z.string(),
  duration_days: z.number().int(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;

// Sale schema
export const saleSchema = z.object({
  id: z.number(),
  cashier_id: z.number(),
  patient_id: z.number().nullable(),
  prescription_id: z.number().nullable(),
  sale_date: z.coerce.date(),
  total_amount: z.number(),
  discount: z.number(),
  tax_amount: z.number(),
  final_amount: z.number(),
  payment_method: z.enum(['cash', 'card', 'insurance']),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type Sale = z.infer<typeof saleSchema>;

// Sale item schema
export const saleItemSchema = z.object({
  id: z.number(),
  sale_id: z.number(),
  medicine_id: z.number(),
  quantity: z.number().int(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type SaleItem = z.infer<typeof saleItemSchema>;

// Stock movement schema
export const stockMovementSchema = z.object({
  id: z.number(),
  medicine_id: z.number(),
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().int(),
  reference_id: z.number().nullable(),
  reference_type: z.string().nullable(),
  reason: z.string().nullable(),
  performed_by: z.number(),
  created_at: z.coerce.date()
});

export type StockMovement = z.infer<typeof stockMovementSchema>;

// Input schemas for creating records

// User input schemas
export const createUserInputSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string(),
  role: userRoleEnum,
  phone: z.string().nullable()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  username: z.string(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  full_name: z.string().optional(),
  phone: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Patient input schemas
export const createPatientInputSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.coerce.date(),
  phone: z.string(),
  email: z.string().email().nullable(),
  address: z.string().nullable(),
  gender: z.enum(['male', 'female', 'other']),
  emergency_contact: z.string().nullable(),
  medical_history: z.string().nullable(),
  allergies: z.string().nullable()
});

export type CreatePatientInput = z.infer<typeof createPatientInputSchema>;

export const updatePatientInputSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  date_of_birth: z.coerce.date().optional(),
  phone: z.string().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  emergency_contact: z.string().nullable().optional(),
  medical_history: z.string().nullable().optional(),
  allergies: z.string().nullable().optional()
});

export type UpdatePatientInput = z.infer<typeof updatePatientInputSchema>;

// Medicine category input schemas
export const createMedicineCategoryInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable()
});

export type CreateMedicineCategoryInput = z.infer<typeof createMedicineCategoryInputSchema>;

// Medicine input schemas
export const createMedicineInputSchema = z.object({
  name: z.string(),
  brand: z.string().nullable(),
  category_id: z.number(),
  generic_name: z.string().nullable(),
  dosage: z.string(),
  unit: z.string(),
  price_per_unit: z.number().positive(),
  stock_quantity: z.number().int().nonnegative(),
  min_stock_level: z.number().int().nonnegative(),
  expiry_date: z.coerce.date(),
  batch_number: z.string().nullable(),
  manufacturer: z.string().nullable(),
  description: z.string().nullable(),
  requires_prescription: z.boolean()
});

export type CreateMedicineInput = z.infer<typeof createMedicineInputSchema>;

export const updateMedicineInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  brand: z.string().nullable().optional(),
  category_id: z.number().optional(),
  generic_name: z.string().nullable().optional(),
  dosage: z.string().optional(),
  unit: z.string().optional(),
  price_per_unit: z.number().positive().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  min_stock_level: z.number().int().nonnegative().optional(),
  expiry_date: z.coerce.date().optional(),
  batch_number: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  requires_prescription: z.boolean().optional()
});

export type UpdateMedicineInput = z.infer<typeof updateMedicineInputSchema>;

// Prescription input schemas
export const createPrescriptionInputSchema = z.object({
  patient_id: z.number(),
  doctor_id: z.number(),
  diagnosis: z.string(),
  symptoms: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(z.object({
    medicine_id: z.number(),
    quantity: z.number().int().positive(),
    dosage_instructions: z.string(),
    duration_days: z.number().int().positive()
  }))
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionInputSchema>;

export const updatePrescriptionInputSchema = z.object({
  id: z.number(),
  diagnosis: z.string().optional(),
  symptoms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_filled: z.boolean().optional()
});

export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionInputSchema>;

// Sale input schemas
export const createSaleInputSchema = z.object({
  cashier_id: z.number(),
  patient_id: z.number().nullable(),
  prescription_id: z.number().nullable(),
  discount: z.number().nonnegative().default(0),
  tax_amount: z.number().nonnegative().default(0),
  payment_method: z.enum(['cash', 'card', 'insurance']),
  notes: z.string().nullable(),
  items: z.array(z.object({
    medicine_id: z.number(),
    quantity: z.number().int().positive()
  }))
});

export type CreateSaleInput = z.infer<typeof createSaleInputSchema>;

// Stock movement input schema
export const createStockMovementInputSchema = z.object({
  medicine_id: z.number(),
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().int(),
  reference_id: z.number().nullable(),
  reference_type: z.string().nullable(),
  reason: z.string().nullable(),
  performed_by: z.number()
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementInputSchema>;

// Query schemas
export const paginationInputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10)
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

export const searchPatientsInputSchema = paginationInputSchema.extend({
  search: z.string().optional()
});

export type SearchPatientsInput = z.infer<typeof searchPatientsInputSchema>;

export const searchMedicinesInputSchema = paginationInputSchema.extend({
  search: z.string().optional(),
  category_id: z.number().optional(),
  low_stock: z.boolean().optional()
});

export type SearchMedicinesInput = z.infer<typeof searchMedicinesInputSchema>;

export const reportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  type: z.enum(['sales', 'medicine_usage', 'stock_movement'])
});

export type ReportInput = z.infer<typeof reportInputSchema>;