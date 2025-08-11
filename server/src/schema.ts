import { z } from 'zod';

// User roles enum
export const userRoleSchema = z.enum(['admin', 'doctor', 'cashier_receptionist']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// User input schemas
export const createUserInputSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleSchema,
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().nullable().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  username: z.string(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Patient schema
export const patientSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.coerce.date(),
  gender: z.enum(['male', 'female', 'other']),
  phone: z.string(),
  email: z.string().email().nullable(),
  address: z.string(),
  emergency_contact_name: z.string().nullable(),
  emergency_contact_phone: z.string().nullable(),
  allergies: z.string().nullable(),
  chronic_conditions: z.string().nullable(),
  blood_type: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Patient = z.infer<typeof patientSchema>;

export const createPatientInputSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.coerce.date(),
  gender: z.enum(['male', 'female', 'other']),
  phone: z.string().min(1),
  email: z.string().email().nullable().optional(),
  address: z.string().min(1),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
  chronic_conditions: z.string().nullable().optional(),
  blood_type: z.string().nullable().optional()
});

export type CreatePatientInput = z.infer<typeof createPatientInputSchema>;

export const updatePatientInputSchema = z.object({
  id: z.number(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  date_of_birth: z.coerce.date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().min(1).optional(),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
  chronic_conditions: z.string().nullable().optional(),
  blood_type: z.string().nullable().optional()
});

export type UpdatePatientInput = z.infer<typeof updatePatientInputSchema>;

// Medicine schema
export const medicineSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  current_stock: z.number().int(),
  price: z.number(),
  supplier_name: z.string().nullable(),
  batch_number: z.string().nullable(),
  expiry_date: z.coerce.date().nullable(),
  storage_conditions: z.string().nullable(),
  minimum_stock_level: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Medicine = z.infer<typeof medicineSchema>;

export const createMedicineInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  current_stock: z.number().int().nonnegative(),
  price: z.number().positive(),
  supplier_name: z.string().nullable().optional(),
  batch_number: z.string().nullable().optional(),
  expiry_date: z.coerce.date().nullable().optional(),
  storage_conditions: z.string().nullable().optional(),
  minimum_stock_level: z.number().int().nonnegative()
});

export type CreateMedicineInput = z.infer<typeof createMedicineInputSchema>;

export const updateMedicineInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  current_stock: z.number().int().nonnegative().optional(),
  price: z.number().positive().optional(),
  supplier_name: z.string().nullable().optional(),
  batch_number: z.string().nullable().optional(),
  expiry_date: z.coerce.date().nullable().optional(),
  storage_conditions: z.string().nullable().optional(),
  minimum_stock_level: z.number().int().nonnegative().optional()
});

export type UpdateMedicineInput = z.infer<typeof updateMedicineInputSchema>;

// Visit schema
export const visitSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  doctor_id: z.number(),
  visit_date: z.coerce.date(),
  reason_for_visit: z.string(),
  diagnosis: z.string().nullable(),
  treatment_notes: z.string().nullable(),
  vital_signs: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Visit = z.infer<typeof visitSchema>;

export const createVisitInputSchema = z.object({
  patient_id: z.number(),
  doctor_id: z.number(),
  visit_date: z.coerce.date(),
  reason_for_visit: z.string().min(1),
  diagnosis: z.string().nullable().optional(),
  treatment_notes: z.string().nullable().optional(),
  vital_signs: z.string().nullable().optional()
});

export type CreateVisitInput = z.infer<typeof createVisitInputSchema>;

// Prescription schema
export const prescriptionStatusSchema = z.enum(['pending', 'filled', 'partially_filled']);
export type PrescriptionStatus = z.infer<typeof prescriptionStatusSchema>;

export const prescriptionSchema = z.object({
  id: z.number(),
  visit_id: z.number(),
  doctor_id: z.number(),
  patient_id: z.number(),
  status: prescriptionStatusSchema,
  total_amount: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Prescription = z.infer<typeof prescriptionSchema>;

export const createPrescriptionInputSchema = z.object({
  visit_id: z.number(),
  doctor_id: z.number(),
  patient_id: z.number(),
  prescription_items: z.array(z.object({
    medicine_id: z.number(),
    quantity: z.number().int().positive(),
    dosage_instructions: z.string()
  }))
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionInputSchema>;

// Prescription Item schema
export const prescriptionItemSchema = z.object({
  id: z.number(),
  prescription_id: z.number(),
  medicine_id: z.number(),
  quantity_prescribed: z.number().int(),
  quantity_dispensed: z.number().int(),
  dosage_instructions: z.string(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;

// Payment schema
export const paymentMethodSchema = z.enum(['cash', 'card']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentSchema = z.object({
  id: z.number(),
  prescription_id: z.number().nullable(),
  patient_id: z.number(),
  amount: z.number(),
  payment_method: paymentMethodSchema,
  transaction_reference: z.string().nullable(),
  notes: z.string().nullable(),
  processed_by_user_id: z.number(),
  created_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

export const createPaymentInputSchema = z.object({
  prescription_id: z.number().nullable().optional(),
  patient_id: z.number(),
  amount: z.number().positive(),
  payment_method: paymentMethodSchema,
  transaction_reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  processed_by_user_id: z.number()
});

export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

// Inventory Transaction schema
export const transactionTypeSchema = z.enum(['addition', 'subtraction', 'adjustment']);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const inventoryTransactionSchema = z.object({
  id: z.number(),
  medicine_id: z.number(),
  transaction_type: transactionTypeSchema,
  quantity: z.number().int(),
  reason: z.string(),
  reference_id: z.number().nullable(),
  reference_type: z.string().nullable(),
  performed_by_user_id: z.number(),
  created_at: z.coerce.date()
});

export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>;

// Report input schemas
export const salesReportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date()
});

export type SalesReportInput = z.infer<typeof salesReportInputSchema>;

export const medicineUsageReportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  medicine_id: z.number().optional()
});

export type MedicineUsageReportInput = z.infer<typeof medicineUsageReportInputSchema>;

// Response schemas for reports
export const salesReportSchema = z.object({
  total_sales: z.number(),
  total_transactions: z.number(),
  daily_breakdown: z.array(z.object({
    date: z.string(),
    sales: z.number(),
    transactions: z.number()
  }))
});

export type SalesReport = z.infer<typeof salesReportSchema>;

export const medicineUsageReportSchema = z.object({
  medicine_name: z.string(),
  total_dispensed: z.number(),
  current_stock: z.number(),
  usage_breakdown: z.array(z.object({
    date: z.string(),
    quantity_dispensed: z.number()
  }))
});

export type MedicineUsageReport = z.infer<typeof medicineUsageReportSchema>;

export const lowStockAlertSchema = z.object({
  medicine_id: z.number(),
  medicine_name: z.string(),
  current_stock: z.number(),
  minimum_stock_level: z.number(),
  shortage: z.number()
});

export type LowStockAlert = z.infer<typeof lowStockAlertSchema>;