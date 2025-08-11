import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  createPatientInputSchema,
  updatePatientInputSchema,
  createMedicineInputSchema,
  updateMedicineInputSchema,
  createVisitInputSchema,
  createPrescriptionInputSchema,
  createPaymentInputSchema,
  salesReportInputSchema,
  medicineUsageReportInputSchema,
  prescriptionStatusSchema,
  transactionTypeSchema
} from './schema';

// Import handlers
import { createUser, loginUser, getUsers } from './handlers/auth';
import { 
  createPatient, 
  getPatients, 
  getPatient, 
  updatePatient, 
  deletePatient, 
  searchPatients 
} from './handlers/patients';
import { 
  createMedicine, 
  getMedicines, 
  getMedicine, 
  updateMedicine, 
  deleteMedicine, 
  searchMedicines, 
  getLowStockAlerts, 
  updateMedicineStock 
} from './handlers/medicines';
import { 
  createVisit, 
  getVisits, 
  getVisit, 
  getPatientVisits, 
  getDoctorVisits, 
  updateVisit 
} from './handlers/visits';
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
} from './handlers/prescriptions';
import { 
  createPayment, 
  getPayments, 
  getPayment, 
  getPaymentsByPatient, 
  getPaymentsByPrescription, 
  getPaymentsByDateRange, 
  getTotalPaymentsByDate 
} from './handlers/payments';
import { 
  generateSalesReport, 
  generateMedicineUsageReport, 
  generateLowStockReport, 
  getDailySalesData, 
  getTopSellingMedicines, 
  getInventoryValuation 
} from './handlers/reports';
import { 
  createInventoryTransaction, 
  getInventoryTransactions, 
  getInventoryTransactionsByMedicine, 
  getInventoryTransactionsByDateRange, 
  adjustMedicineStock, 
  bulkUpdateStock 
} from './handlers/inventory';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    createUser: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => createUser(input)),
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => loginUser(input)),
    getUsers: publicProcedure
      .query(() => getUsers())
  }),

  // Patient management routes
  patients: router({
    create: publicProcedure
      .input(createPatientInputSchema)
      .mutation(({ input }) => createPatient(input)),
    getAll: publicProcedure
      .query(() => getPatients()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getPatient(input.id)),
    update: publicProcedure
      .input(updatePatientInputSchema)
      .mutation(({ input }) => updatePatient(input)),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deletePatient(input.id)),
    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(({ input }) => searchPatients(input.query))
  }),

  // Medicine management routes
  medicines: router({
    create: publicProcedure
      .input(createMedicineInputSchema)
      .mutation(({ input }) => createMedicine(input)),
    getAll: publicProcedure
      .query(() => getMedicines()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getMedicine(input.id)),
    update: publicProcedure
      .input(updateMedicineInputSchema)
      .mutation(({ input }) => updateMedicine(input)),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteMedicine(input.id)),
    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(({ input }) => searchMedicines(input.query)),
    getLowStock: publicProcedure
      .query(() => getLowStockAlerts()),
    updateStock: publicProcedure
      .input(z.object({ 
        medicineId: z.number(), 
        newStock: z.number(), 
        reason: z.string(), 
        userId: z.number() 
      }))
      .mutation(({ input }) => updateMedicineStock(input.medicineId, input.newStock, input.reason, input.userId))
  }),

  // Visit management routes
  visits: router({
    create: publicProcedure
      .input(createVisitInputSchema)
      .mutation(({ input }) => createVisit(input)),
    getAll: publicProcedure
      .query(() => getVisits()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getVisit(input.id)),
    getByPatient: publicProcedure
      .input(z.object({ patientId: z.number() }))
      .query(({ input }) => getPatientVisits(input.patientId)),
    getByDoctor: publicProcedure
      .input(z.object({ doctorId: z.number() }))
      .query(({ input }) => getDoctorVisits(input.doctorId)),
    update: publicProcedure
      .input(z.object({ 
        id: z.number(), 
        data: createVisitInputSchema.partial() 
      }))
      .mutation(({ input }) => updateVisit(input.id, input.data))
  }),

  // Prescription management routes
  prescriptions: router({
    create: publicProcedure
      .input(createPrescriptionInputSchema)
      .mutation(({ input }) => createPrescription(input)),
    getAll: publicProcedure
      .query(() => getPrescriptions()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getPrescription(input.id)),
    getByPatient: publicProcedure
      .input(z.object({ patientId: z.number() }))
      .query(({ input }) => getPrescriptionsByPatient(input.patientId)),
    getByDoctor: publicProcedure
      .input(z.object({ doctorId: z.number() }))
      .query(({ input }) => getPrescriptionsByDoctor(input.doctorId)),
    getPending: publicProcedure
      .query(() => getPendingPrescriptions()),
    updateStatus: publicProcedure
      .input(z.object({ 
        id: z.number(), 
        status: prescriptionStatusSchema 
      }))
      .mutation(({ input }) => updatePrescriptionStatus(input.id, input.status)),
    dispenseMedicine: publicProcedure
      .input(z.object({ 
        prescriptionId: z.number(), 
        medicineId: z.number(), 
        quantityDispensed: z.number(), 
        userId: z.number() 
      }))
      .mutation(({ input }) => dispenseMedicine(input.prescriptionId, input.medicineId, input.quantityDispensed, input.userId)),
    getItems: publicProcedure
      .input(z.object({ prescriptionId: z.number() }))
      .query(({ input }) => getPrescriptionItems(input.prescriptionId))
  }),

  // Payment management routes
  payments: router({
    create: publicProcedure
      .input(createPaymentInputSchema)
      .mutation(({ input }) => createPayment(input)),
    getAll: publicProcedure
      .query(() => getPayments()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getPayment(input.id)),
    getByPatient: publicProcedure
      .input(z.object({ patientId: z.number() }))
      .query(({ input }) => getPaymentsByPatient(input.patientId)),
    getByPrescription: publicProcedure
      .input(z.object({ prescriptionId: z.number() }))
      .query(({ input }) => getPaymentsByPrescription(input.prescriptionId)),
    getByDateRange: publicProcedure
      .input(z.object({ 
        startDate: z.coerce.date(), 
        endDate: z.coerce.date() 
      }))
      .query(({ input }) => getPaymentsByDateRange(input.startDate, input.endDate)),
    getTotalByDate: publicProcedure
      .input(z.object({ date: z.coerce.date() }))
      .query(({ input }) => getTotalPaymentsByDate(input.date))
  }),

  // Reporting routes
  reports: router({
    salesReport: publicProcedure
      .input(salesReportInputSchema)
      .query(({ input }) => generateSalesReport(input)),
    medicineUsageReport: publicProcedure
      .input(medicineUsageReportInputSchema)
      .query(({ input }) => generateMedicineUsageReport(input)),
    lowStockReport: publicProcedure
      .query(() => generateLowStockReport()),
    dailySalesData: publicProcedure
      .input(z.object({ 
        startDate: z.coerce.date(), 
        endDate: z.coerce.date() 
      }))
      .query(({ input }) => getDailySalesData(input.startDate, input.endDate)),
    topSellingMedicines: publicProcedure
      .input(z.object({ 
        startDate: z.coerce.date(), 
        endDate: z.coerce.date(), 
        limit: z.number().optional().default(10) 
      }))
      .query(({ input }) => getTopSellingMedicines(input.startDate, input.endDate, input.limit)),
    inventoryValuation: publicProcedure
      .query(() => getInventoryValuation())
  }),

  // Inventory management routes
  inventory: router({
    createTransaction: publicProcedure
      .input(z.object({
        medicineId: z.number(),
        transactionType: transactionTypeSchema,
        quantity: z.number(),
        reason: z.string(),
        userId: z.number(),
        referenceId: z.number().optional(),
        referenceType: z.string().optional()
      }))
      .mutation(({ input }) => createInventoryTransaction(
        input.medicineId, 
        input.transactionType, 
        input.quantity, 
        input.reason, 
        input.userId, 
        input.referenceId, 
        input.referenceType
      )),
    getTransactions: publicProcedure
      .query(() => getInventoryTransactions()),
    getTransactionsByMedicine: publicProcedure
      .input(z.object({ medicineId: z.number() }))
      .query(({ input }) => getInventoryTransactionsByMedicine(input.medicineId)),
    getTransactionsByDateRange: publicProcedure
      .input(z.object({ 
        startDate: z.coerce.date(), 
        endDate: z.coerce.date() 
      }))
      .query(({ input }) => getInventoryTransactionsByDateRange(input.startDate, input.endDate)),
    adjustStock: publicProcedure
      .input(z.object({ 
        medicineId: z.number(), 
        newStockLevel: z.number(), 
        reason: z.string(), 
        userId: z.number() 
      }))
      .mutation(({ input }) => adjustMedicineStock(input.medicineId, input.newStockLevel, input.reason, input.userId)),
    bulkUpdateStock: publicProcedure
      .input(z.object({
        updates: z.array(z.object({
          medicine_id: z.number(),
          quantity: z.number(),
          transaction_type: transactionTypeSchema,
          reason: z.string()
        })),
        userId: z.number()
      }))
      .mutation(({ input }) => bulkUpdateStock(input.updates, input.userId))
  })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();