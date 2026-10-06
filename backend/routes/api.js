const express = require('express');
const router = express.Router();
const {
  supplierController,
  materialController,
  orderController,
  machineController,
  batchController,
  inspectionController,
  analyticsController
} = require('../controllers/mesController');
const { dataAccess } = require('../config/db');

// --- Module 9: Production-Quality Analysis (Executive Engine) ---
router.get('/analytics/quality', analyticsController.getQualityAnalytics);

// --- Module 1: Supplier Management (Collection: Suppliers) ---
router.get('/suppliers', supplierController.getAll);
router.get('/suppliers/:id', supplierController.getById);
router.post('/suppliers', supplierController.create);
router.put('/suppliers/:id', supplierController.update);
router.delete('/suppliers/:id', supplierController.delete);

// --- Module 2: Raw-Material Management (Collection: Materials) ---
router.get('/materials', materialController.getAll);
router.post('/materials', materialController.create);
router.put('/materials/:id', materialController.update);
router.post('/materials/:id/restock', materialController.restock);
router.delete('/materials/:id', materialController.delete);

// --- Module 3: Production Planning (Collection: ProductionOrders [Planning Phase]) ---
router.get('/plans', (req, res) => {
  // Returns all plans (Draft-Plan & Approved-Plan)
  try {
    const orders = dataAccess.findAll('productionOrders');
    const plans = orders.filter(o => o.orderStatus === 'Draft-Plan' || o.orderStatus === 'Approved-Plan');
    res.json({ success: true, count: plans.length, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post('/plans', orderController.createPlan);
router.get('/plans/:id/check-feasibility', orderController.checkFeasibility);
router.post('/plans/:id/approve', orderController.approvePlan);

// --- Module 4: Production Orders (Collection: ProductionOrders [Execution Phase]) ---
router.get('/orders', orderController.getAll);
router.get('/orders/:id', orderController.getById);
router.post('/orders', orderController.createPlan);
router.post('/orders/:id/release', orderController.releaseOrder);
router.post('/orders/:id/complete', orderController.completeOrder);
router.delete('/orders/:id', orderController.delete);

// --- Module 5: Machine Management (Collection: Machines) ---
router.get('/machines', machineController.getAll);
router.post('/machines', machineController.create);
router.put('/machines/:id', machineController.update);
router.post('/machines/:id/maintenance', machineController.toggleMaintenance);
router.delete('/machines/:id', machineController.delete);

// --- Module 6: Batch Management (Collection: Batches) ---
router.get('/batches', batchController.getAll);
router.get('/batches/:id', batchController.getById);
router.post('/batches', batchController.create);
router.post('/batches/:id/complete', batchController.completeBatch);
router.delete('/batches/:id', batchController.delete);

// --- Module 7: Quality Inspection (Collection: Inspections) ---
router.get('/inspections/pending-qc', inspectionController.getPendingQC);
router.get('/inspections', inspectionController.getAll);
router.get('/inspections/:id', inspectionController.getById);
router.post('/inspections', inspectionController.create);
router.delete('/inspections/:id', inspectionController.delete);

// --- Module 8: Defect Management & CAPA (Collection: Inspections -> Embedded defects[]) ---
router.get('/defects', inspectionController.getAllDefects);
router.put('/defects/:inspectionId/:defectIndex/status', inspectionController.updateDefectStatus);
router.get('/defects/traceability/:identifier', inspectionController.getTraceability);

// --- System Telemetry & Reset Utilities ---
router.get('/system/status', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Manufacturing Production & Quality Management System',
    project: 'Project #20',
    architecturalRule: '8 Modules + 1 Analytics mapped to strictly 6 Major MongoDB Collections',
    collections: {
      Suppliers: dataAccess.findAll('suppliers').length,
      Materials: dataAccess.findAll('materials').length,
      ProductionOrders: dataAccess.findAll('productionOrders').length,
      Batches: dataAccess.findAll('batches').length,
      Machines: dataAccess.findAll('machines').length,
      Inspections: dataAccess.findAll('inspections').length
    },
    databaseMode: dataAccess.isMongoActive() ? 'MongoDB Cluster' : 'In-Memory DAL (Mongo-Ready Fallback)'
  });
});

router.post('/system/reset', (req, res) => {
  dataAccess.resetSeed();
  res.json({
    success: true,
    message: 'System reset to factory seed data strictly across the 6 major collections.'
  });
});

module.exports = router;
