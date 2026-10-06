const mongoose = require('mongoose');

// 1. Suppliers Collection Schema
const SupplierSchema = new mongoose.Schema({
  supplierCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  contactPerson: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, default: '' },
  materialsSupplied: [{ type: String }],
  rating: { type: Number, min: 1, max: 5, default: 4.5 },
  status: { type: String, enum: ['Active', 'Suspended', 'Blacklisted'], default: 'Active' },
  leadTimeDays: { type: Number, default: 7 },
  createdAt: { type: Date, default: Date.now }
});

// 2. Materials Collection Schema
const MaterialSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName: { type: String, default: '' },
  currentStock: { type: Number, required: true, min: 0, default: 0 },
  unit: { type: String, enum: ['kg', 'liters', 'meters', 'units'], default: 'kg' },
  reorderLevel: { type: Number, required: true, default: 100 },
  unitCost: { type: Number, required: true, min: 0 },
  stockStatus: { type: String, enum: ['In-Stock', 'Low-Stock', 'Out-of-Stock'], default: 'In-Stock' },
  storageLocation: { type: String, default: 'Warehouse Bay 1' },
  createdAt: { type: Date, default: Date.now }
});

// 3. Machines Collection Schema
const MachineSchema = new mongoose.Schema({
  machineCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true }, // e.g., "CNC Milling", "Injection Molding", "Assembly Line"
  productionLine: { type: String, default: 'Line 1' },
  capacityPerHour: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['Idle', 'Running', 'Maintenance', 'Offline'], default: 'Idle' },
  currentBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
  lastMaintenanceDate: { type: Date, default: Date.now },
  nextMaintenanceDue: { type: Date, default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
  operatorInCharge: { type: String, default: 'Unassigned' },
  totalOperatingHours: { type: Number, default: 100 },
  createdAt: { type: Date, default: Date.now }
});

// 4. ProductionOrders Collection Schema (Houses BOTH Production Planning and Production Orders)
const RequiredMaterialSubSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  sku: { type: String, default: '' },
  materialName: { type: String, default: '' },
  requiredQty: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'kg' },
  isAllocated: { type: Boolean, default: false }
}, { _id: false });

const ProductionOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  customer: { type: String, default: 'Internal Production' },
  productName: { type: String, required: true },
  productSKU: { type: String, default: '' },
  plannedQuantity: { type: Number, required: true, min: 1 },
  producedQuantity: { type: Number, default: 0, min: 0 },
  requiredMaterials: [RequiredMaterialSubSchema],
  plannedStartDate: { type: Date, required: true },
  plannedEndDate: { type: Date, required: true },
  actualStartDate: { type: Date, default: null },
  actualEndDate: { type: Date, default: null },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  orderStatus: {
    type: String,
    enum: ['Draft-Plan', 'Approved-Plan', 'In-Production', 'Completed', 'Cancelled'],
    default: 'Draft-Plan'
  },
  assignedLine: { type: String, default: 'Line 1' },
  planningNotes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// 5. Batches Collection Schema
const BatchSchema = new mongoose.Schema({
  batchCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder', required: true },
  orderNumber: { type: String, default: '' },
  productName: { type: String, default: '' },
  machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  machineName: { type: String, default: '' },
  operatorName: { type: String, required: true },
  targetQuantity: { type: Number, required: true, min: 1 },
  quantityProduced: { type: Number, default: 0, min: 0 },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: null },
  batchStatus: {
    type: String,
    enum: ['In-Progress', 'Pending-QC', 'Approved', 'Rejected', 'Rework'],
    default: 'In-Progress'
  },
  createdAt: { type: Date, default: Date.now }
});

// 6. Inspections Collection Schema (Houses BOTH Quality Inspection and Defect Management via embedded defects[])
const EmbeddedDefectSubSchema = new mongoose.Schema({
  defectCode: { type: String, required: true, uppercase: true },
  defectType: {
    type: String,
    enum: ['Dimensional', 'Surface-Finish', 'Structural', 'Material-Impurity', 'Assembly-Error'],
    required: true
  },
  severity: {
    type: String,
    enum: ['Minor', 'Major', 'Critical'],
    required: true
  },
  defectiveUnitCount: { type: Number, required: true, min: 1 },
  rootCauseCategory: {
    type: String,
    enum: ['Machine-Fault', 'Raw-Material-Defect', 'Operator-Error', 'Process-Deviation'],
    default: 'Process-Deviation'
  },
  rootCause: { type: String, required: true },
  correctiveAction: {
    type: String,
    enum: ['Scrap', 'Rework', 'Recalibrate-Machine', 'Flag-Supplier'],
    required: true
  },
  resolutionStatus: {
    type: String,
    enum: ['Open', 'Sent-for-Rework', 'Scrapped', 'Resolved'],
    default: 'Open'
  },
  loggedAt: { type: Date, default: Date.now }
}, { _id: true });

const InspectionSchema = new mongoose.Schema({
  inspectionCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  batchCode: { type: String, default: '' },
  productName: { type: String, default: '' },
  inspectorName: { type: String, required: true },
  inspectionDate: { type: Date, default: Date.now },
  sampleSizeChecked: { type: Number, required: true, min: 1 },
  result: { type: String, enum: ['Pass', 'Fail'], required: true },
  remarks: { type: String, default: '' },
  defects: [EmbeddedDefectSubSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Supplier: mongoose.model('Supplier', SupplierSchema),
  Material: mongoose.model('Material', MaterialSchema),
  Machine: mongoose.model('Machine', MachineSchema),
  ProductionOrder: mongoose.model('ProductionOrder', ProductionOrderSchema),
  Batch: mongoose.model('Batch', BatchSchema),
  Inspection: mongoose.model('Inspection', InspectionSchema)
};
