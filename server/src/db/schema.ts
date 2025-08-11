import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  date,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'doctor', 'cashier_receptionist']);
export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);
export const prescriptionStatusEnum = pgEnum('prescription_status', ['pending', 'filled', 'partially_filled']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card']);
export const transactionTypeEnum = pgEnum('transaction_type', ['addition', 'subtraction', 'adjustment']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  phone: text('phone'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Patients table
export const patientsTable = pgTable('patients', {
  id: serial('id').primaryKey(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  date_of_birth: date('date_of_birth').notNull(),
  gender: genderEnum('gender').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address').notNull(),
  emergency_contact_name: text('emergency_contact_name'),
  emergency_contact_phone: text('emergency_contact_phone'),
  allergies: text('allergies'),
  chronic_conditions: text('chronic_conditions'),
  blood_type: text('blood_type'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Medicines table
export const medicinesTable = pgTable('medicines', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  current_stock: integer('current_stock').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  supplier_name: text('supplier_name'),
  batch_number: text('batch_number'),
  expiry_date: date('expiry_date'),
  storage_conditions: text('storage_conditions'),
  minimum_stock_level: integer('minimum_stock_level').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Visits table
export const visitsTable = pgTable('visits', {
  id: serial('id').primaryKey(),
  patient_id: integer('patient_id').notNull(),
  doctor_id: integer('doctor_id').notNull(),
  visit_date: timestamp('visit_date').notNull(),
  reason_for_visit: text('reason_for_visit').notNull(),
  diagnosis: text('diagnosis'),
  treatment_notes: text('treatment_notes'),
  vital_signs: text('vital_signs'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Prescriptions table
export const prescriptionsTable = pgTable('prescriptions', {
  id: serial('id').primaryKey(),
  visit_id: integer('visit_id').notNull(),
  doctor_id: integer('doctor_id').notNull(),
  patient_id: integer('patient_id').notNull(),
  status: prescriptionStatusEnum('status').default('pending').notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Prescription Items table
export const prescriptionItemsTable = pgTable('prescription_items', {
  id: serial('id').primaryKey(),
  prescription_id: integer('prescription_id').notNull(),
  medicine_id: integer('medicine_id').notNull(),
  quantity_prescribed: integer('quantity_prescribed').notNull(),
  quantity_dispensed: integer('quantity_dispensed').default(0).notNull(),
  dosage_instructions: text('dosage_instructions').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Payments table
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  prescription_id: integer('prescription_id'),
  patient_id: integer('patient_id').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  transaction_reference: text('transaction_reference'),
  notes: text('notes'),
  processed_by_user_id: integer('processed_by_user_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Inventory Transactions table
export const inventoryTransactionsTable = pgTable('inventory_transactions', {
  id: serial('id').primaryKey(),
  medicine_id: integer('medicine_id').notNull(),
  transaction_type: transactionTypeEnum('transaction_type').notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason').notNull(),
  reference_id: integer('reference_id'),
  reference_type: text('reference_type'),
  performed_by_user_id: integer('performed_by_user_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  doctorVisits: many(visitsTable, { relationName: 'doctor_visits' }),
  doctorPrescriptions: many(prescriptionsTable, { relationName: 'doctor_prescriptions' }),
  processedPayments: many(paymentsTable, { relationName: 'processed_payments' }),
  inventoryTransactions: many(inventoryTransactionsTable, { relationName: 'user_transactions' })
}));

export const patientsRelations = relations(patientsTable, ({ many }) => ({
  visits: many(visitsTable),
  prescriptions: many(prescriptionsTable),
  payments: many(paymentsTable)
}));

export const medicinesRelations = relations(medicinesTable, ({ many }) => ({
  prescriptionItems: many(prescriptionItemsTable),
  inventoryTransactions: many(inventoryTransactionsTable)
}));

export const visitsRelations = relations(visitsTable, ({ one, many }) => ({
  patient: one(patientsTable, {
    fields: [visitsTable.patient_id],
    references: [patientsTable.id]
  }),
  doctor: one(usersTable, {
    fields: [visitsTable.doctor_id],
    references: [usersTable.id],
    relationName: 'doctor_visits'
  }),
  prescriptions: many(prescriptionsTable)
}));

export const prescriptionsRelations = relations(prescriptionsTable, ({ one, many }) => ({
  visit: one(visitsTable, {
    fields: [prescriptionsTable.visit_id],
    references: [visitsTable.id]
  }),
  patient: one(patientsTable, {
    fields: [prescriptionsTable.patient_id],
    references: [patientsTable.id]
  }),
  doctor: one(usersTable, {
    fields: [prescriptionsTable.doctor_id],
    references: [usersTable.id],
    relationName: 'doctor_prescriptions'
  }),
  items: many(prescriptionItemsTable),
  payments: many(paymentsTable)
}));

export const prescriptionItemsRelations = relations(prescriptionItemsTable, ({ one }) => ({
  prescription: one(prescriptionsTable, {
    fields: [prescriptionItemsTable.prescription_id],
    references: [prescriptionsTable.id]
  }),
  medicine: one(medicinesTable, {
    fields: [prescriptionItemsTable.medicine_id],
    references: [medicinesTable.id]
  })
}));

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  prescription: one(prescriptionsTable, {
    fields: [paymentsTable.prescription_id],
    references: [prescriptionsTable.id]
  }),
  patient: one(patientsTable, {
    fields: [paymentsTable.patient_id],
    references: [patientsTable.id]
  }),
  processedBy: one(usersTable, {
    fields: [paymentsTable.processed_by_user_id],
    references: [usersTable.id],
    relationName: 'processed_payments'
  })
}));

export const inventoryTransactionsRelations = relations(inventoryTransactionsTable, ({ one }) => ({
  medicine: one(medicinesTable, {
    fields: [inventoryTransactionsTable.medicine_id],
    references: [medicinesTable.id]
  }),
  performedBy: one(usersTable, {
    fields: [inventoryTransactionsTable.performed_by_user_id],
    references: [usersTable.id],
    relationName: 'user_transactions'
  })
}));

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  patients: patientsTable,
  medicines: medicinesTable,
  visits: visitsTable,
  prescriptions: prescriptionsTable,
  prescriptionItems: prescriptionItemsTable,
  payments: paymentsTable,
  inventoryTransactions: inventoryTransactionsTable
};