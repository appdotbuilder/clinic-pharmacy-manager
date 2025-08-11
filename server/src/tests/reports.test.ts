import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  patientsTable, 
  medicinesTable, 
  visitsTable,
  prescriptionsTable,
  prescriptionItemsTable,
  paymentsTable
} from '../db/schema';
import { 
  generateSalesReport,
  generateMedicineUsageReport,
  generateLowStockReport,
  getDailySalesData,
  getTopSellingMedicines,
  getInventoryValuation
} from '../handlers/reports';
import { type SalesReportInput, type MedicineUsageReportInput } from '../schema';

describe('Reports', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data creation helpers
  const createTestUser = async () => {
    const users = await db.insert(usersTable).values({
      username: 'doctor1',
      email: 'doctor@example.com',
      password_hash: 'hashed',
      role: 'doctor',
      first_name: 'John',
      last_name: 'Doe',
      phone: '1234567890'
    }).returning().execute();
    return users[0];
  };

  const createTestPatient = async () => {
    const patients = await db.insert(patientsTable).values({
      first_name: 'Jane',
      last_name: 'Smith',
      date_of_birth: '1990-01-01',
      gender: 'female',
      phone: '1234567890',
      address: '123 Main St'
    }).returning().execute();
    return patients[0];
  };

  const createTestMedicine = async (overrides = {}) => {
    const medicines = await db.insert(medicinesTable).values({
      name: 'Test Medicine',
      current_stock: 100,
      price: '25.50',
      minimum_stock_level: 10,
      ...overrides
    }).returning().execute();
    return medicines[0];
  };

  const createTestVisit = async (patientId: number, doctorId: number, visitDate?: Date) => {
    const visits = await db.insert(visitsTable).values({
      patient_id: patientId,
      doctor_id: doctorId,
      visit_date: visitDate || new Date(),
      reason_for_visit: 'Regular checkup'
    }).returning().execute();
    return visits[0];
  };

  const createTestPrescription = async (visitId: number, doctorId: number, patientId: number, createdAt?: Date) => {
    const prescriptions = await db.insert(prescriptionsTable).values({
      visit_id: visitId,
      doctor_id: doctorId,
      patient_id: patientId,
      total_amount: '50.00',
      created_at: createdAt || new Date()
    }).returning().execute();
    return prescriptions[0];
  };

  describe('generateSalesReport', () => {
    it('should generate sales report with correct totals', async () => {
      const user = await createTestUser();
      const patient = await createTestPatient();

      // Create payments in date range
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      await db.insert(paymentsTable).values([
        {
          patient_id: patient.id,
          amount: '100.00',
          payment_method: 'cash',
          processed_by_user_id: user.id,
          created_at: new Date('2024-01-15')
        },
        {
          patient_id: patient.id,
          amount: '50.00',
          payment_method: 'card',
          processed_by_user_id: user.id,
          created_at: new Date('2024-01-20')
        },
        {
          patient_id: patient.id,
          amount: '75.00',
          payment_method: 'cash',
          processed_by_user_id: user.id,
          created_at: new Date('2024-02-01') // Outside date range
        }
      ]).execute();

      const input: SalesReportInput = { start_date: startDate, end_date: endDate };
      const report = await generateSalesReport(input);

      expect(report.total_sales).toBe(150.00);
      expect(report.total_transactions).toBe(2);
      expect(report.daily_breakdown).toHaveLength(2);
      
      // Check daily breakdown structure
      report.daily_breakdown.forEach(day => {
        expect(day.date).toBeDefined();
        expect(typeof day.sales).toBe('number');
        expect(typeof day.transactions).toBe('number');
      });
    });

    it('should handle empty date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const input: SalesReportInput = { start_date: startDate, end_date: endDate };
      const report = await generateSalesReport(input);

      expect(report.total_sales).toBe(0);
      expect(report.total_transactions).toBe(0);
      expect(report.daily_breakdown).toHaveLength(0);
    });
  });

  describe('generateMedicineUsageReport', () => {
    it('should generate usage report for all medicines', async () => {
      const user = await createTestUser();
      const patient = await createTestPatient();
      const medicine1 = await createTestMedicine({ name: 'Medicine A', current_stock: 50 });
      const medicine2 = await createTestMedicine({ name: 'Medicine B', current_stock: 30 });
      
      const testDate = new Date('2024-06-15');
      const visit = await createTestVisit(patient.id, user.id, testDate);
      const prescription = await createTestPrescription(visit.id, user.id, patient.id, testDate);

      // Create prescription items (dispensed quantities)
      await db.insert(prescriptionItemsTable).values([
        {
          prescription_id: prescription.id,
          medicine_id: medicine1.id,
          quantity_prescribed: 10,
          quantity_dispensed: 8,
          dosage_instructions: '2x daily',
          unit_price: '25.50',
          total_price: '204.00'
        },
        {
          prescription_id: prescription.id,
          medicine_id: medicine2.id,
          quantity_prescribed: 5,
          quantity_dispensed: 5,
          dosage_instructions: '1x daily',
          unit_price: '15.00',
          total_price: '75.00'
        }
      ]).execute();

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const input: MedicineUsageReportInput = { start_date: startDate, end_date: endDate };

      const reports = await generateMedicineUsageReport(input);

      expect(reports).toHaveLength(2);
      
      const medicineAReport = reports.find(r => r.medicine_name === 'Medicine A');
      expect(medicineAReport).toBeDefined();
      expect(medicineAReport!.total_dispensed).toBe(8);
      expect(medicineAReport!.current_stock).toBe(50);
      expect(medicineAReport!.usage_breakdown).toHaveLength(1);

      const medicineBReport = reports.find(r => r.medicine_name === 'Medicine B');
      expect(medicineBReport).toBeDefined();
      expect(medicineBReport!.total_dispensed).toBe(5);
    });

    it('should generate usage report for specific medicine', async () => {
      const user = await createTestUser();
      const patient = await createTestPatient();
      const medicine1 = await createTestMedicine({ name: 'Medicine A' });
      const medicine2 = await createTestMedicine({ name: 'Medicine B' });
      
      const testDate = new Date('2024-06-15');
      const visit = await createTestVisit(patient.id, user.id, testDate);
      const prescription = await createTestPrescription(visit.id, user.id, patient.id, testDate);

      await db.insert(prescriptionItemsTable).values([
        {
          prescription_id: prescription.id,
          medicine_id: medicine1.id,
          quantity_prescribed: 10,
          quantity_dispensed: 8,
          dosage_instructions: '2x daily',
          unit_price: '25.50',
          total_price: '204.00'
        },
        {
          prescription_id: prescription.id,
          medicine_id: medicine2.id,
          quantity_prescribed: 5,
          quantity_dispensed: 5,
          dosage_instructions: '1x daily',
          unit_price: '15.00',
          total_price: '75.00'
        }
      ]).execute();

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const input: MedicineUsageReportInput = { 
        start_date: startDate, 
        end_date: endDate,
        medicine_id: medicine1.id
      };

      const reports = await generateMedicineUsageReport(input);

      expect(reports).toHaveLength(1);
      expect(reports[0].medicine_name).toBe('Medicine A');
      expect(reports[0].total_dispensed).toBe(8);
    });
  });

  describe('generateLowStockReport', () => {
    it('should identify medicines with low stock', async () => {
      await createTestMedicine({
        name: 'Low Stock Medicine',
        current_stock: 5,
        minimum_stock_level: 10
      });

      await createTestMedicine({
        name: 'Normal Stock Medicine',
        current_stock: 20,
        minimum_stock_level: 10
      });

      await createTestMedicine({
        name: 'Critical Stock Medicine',
        current_stock: 1,
        minimum_stock_level: 15
      });

      const alerts = await generateLowStockReport();

      expect(alerts).toHaveLength(2);
      
      // Should be ordered by shortage (highest shortage first)
      expect(alerts[0].medicine_name).toBe('Critical Stock Medicine');
      expect(alerts[0].shortage).toBe(14);
      expect(alerts[0].current_stock).toBe(1);
      expect(alerts[0].minimum_stock_level).toBe(15);

      expect(alerts[1].medicine_name).toBe('Low Stock Medicine');
      expect(alerts[1].shortage).toBe(5);
    });

    it('should return empty array when no low stock items', async () => {
      await createTestMedicine({
        name: 'Well Stocked Medicine',
        current_stock: 100,
        minimum_stock_level: 10
      });

      const alerts = await generateLowStockReport();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('getDailySalesData', () => {
    it('should return daily sales breakdown', async () => {
      const user = await createTestUser();
      const patient = await createTestPatient();

      await db.insert(paymentsTable).values([
        {
          patient_id: patient.id,
          amount: '100.00',
          payment_method: 'cash',
          processed_by_user_id: user.id,
          created_at: new Date('2024-01-15')
        },
        {
          patient_id: patient.id,
          amount: '50.00',
          payment_method: 'card',
          processed_by_user_id: user.id,
          created_at: new Date('2024-01-15')
        },
        {
          patient_id: patient.id,
          amount: '75.00',
          payment_method: 'cash',
          processed_by_user_id: user.id,
          created_at: new Date('2024-01-16')
        }
      ]).execute();

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const dailyData = await getDailySalesData(startDate, endDate);

      expect(dailyData).toHaveLength(2);
      
      const day1 = dailyData.find(d => d.date === '2024-01-15');
      expect(day1).toBeDefined();
      expect(day1!.sales).toBe(150.00);
      expect(day1!.transactions).toBe(2);

      const day2 = dailyData.find(d => d.date === '2024-01-16');
      expect(day2).toBeDefined();
      expect(day2!.sales).toBe(75.00);
      expect(day2!.transactions).toBe(1);
    });
  });

  describe('getTopSellingMedicines', () => {
    it('should return top selling medicines by quantity', async () => {
      const user = await createTestUser();
      const patient = await createTestPatient();
      const medicine1 = await createTestMedicine({ name: 'Popular Medicine' });
      const medicine2 = await createTestMedicine({ name: 'Less Popular Medicine' });
      
      const testDate = new Date('2024-06-15');
      const visit = await createTestVisit(patient.id, user.id, testDate);
      const prescription = await createTestPrescription(visit.id, user.id, patient.id, testDate);

      await db.insert(prescriptionItemsTable).values([
        {
          prescription_id: prescription.id,
          medicine_id: medicine1.id,
          quantity_prescribed: 20,
          quantity_dispensed: 20,
          dosage_instructions: '2x daily',
          unit_price: '10.00',
          total_price: '200.00'
        },
        {
          prescription_id: prescription.id,
          medicine_id: medicine2.id,
          quantity_prescribed: 5,
          quantity_dispensed: 5,
          dosage_instructions: '1x daily',
          unit_price: '25.00',
          total_price: '125.00'
        }
      ]).execute();

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const topMedicines = await getTopSellingMedicines(startDate, endDate, 5);

      expect(topMedicines).toHaveLength(2);
      
      // Should be ordered by quantity dispensed (highest first)
      expect(topMedicines[0].medicine_name).toBe('Popular Medicine');
      expect(topMedicines[0].total_dispensed).toBe(20);
      expect(topMedicines[0].revenue).toBe(200.00);

      expect(topMedicines[1].medicine_name).toBe('Less Popular Medicine');
      expect(topMedicines[1].total_dispensed).toBe(5);
      expect(topMedicines[1].revenue).toBe(125.00);
    });

    it('should respect limit parameter', async () => {
      const user = await createTestUser();
      const patient = await createTestPatient();
      
      // Create multiple medicines
      const medicines = await Promise.all([
        createTestMedicine({ name: 'Medicine 1' }),
        createTestMedicine({ name: 'Medicine 2' }),
        createTestMedicine({ name: 'Medicine 3' })
      ]);
      
      const testDate = new Date('2024-06-15');
      const visit = await createTestVisit(patient.id, user.id, testDate);
      const prescription = await createTestPrescription(visit.id, user.id, patient.id, testDate);

      // Create prescription items for all medicines
      await db.insert(prescriptionItemsTable).values(
        medicines.map((medicine, index) => ({
          prescription_id: prescription.id,
          medicine_id: medicine.id,
          quantity_prescribed: 10 - index, // Decreasing quantities
          quantity_dispensed: 10 - index,
          dosage_instructions: '1x daily',
          unit_price: '10.00',
          total_price: `${(10 - index) * 10}.00`
        }))
      ).execute();

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const topMedicines = await getTopSellingMedicines(startDate, endDate, 2);

      expect(topMedicines).toHaveLength(2);
      expect(topMedicines[0].medicine_name).toBe('Medicine 1');
      expect(topMedicines[1].medicine_name).toBe('Medicine 2');
    });
  });

  describe('getInventoryValuation', () => {
    it('should calculate inventory statistics correctly', async () => {
      await createTestMedicine({
        name: 'Medicine 1',
        current_stock: 50,
        price: '20.00',
        minimum_stock_level: 10
      });

      await createTestMedicine({
        name: 'Low Stock Medicine',
        current_stock: 5,
        price: '15.00',
        minimum_stock_level: 10
      });

      await createTestMedicine({
        name: 'Expired Medicine',
        current_stock: 20,
        price: '10.00',
        minimum_stock_level: 5,
        expiry_date: '2020-01-01' // Past date
      });

      const valuation = await getInventoryValuation();

      expect(valuation.total_medicines).toBe(3);
      expect(valuation.total_stock_value).toBe(1275.00); // 50*20 + 5*15 + 20*10
      expect(valuation.low_stock_items).toBe(1);
      expect(valuation.expired_items).toBe(1);
    });

    it('should handle empty inventory', async () => {
      const valuation = await getInventoryValuation();

      expect(valuation.total_medicines).toBe(0);
      expect(valuation.total_stock_value).toBe(0);
      expect(valuation.low_stock_items).toBe(0);
      expect(valuation.expired_items).toBe(0);
    });

    it('should handle medicines without expiry dates', async () => {
      await createTestMedicine({
        name: 'Medicine without expiry',
        current_stock: 100,
        price: '25.00',
        minimum_stock_level: 10,
        expiry_date: null
      });

      const valuation = await getInventoryValuation();

      expect(valuation.total_medicines).toBe(1);
      expect(valuation.expired_items).toBe(0); // Should not count null expiry dates
    });
  });
});