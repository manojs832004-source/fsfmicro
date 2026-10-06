const { dataAccess } = require('../config/db');

// Helper to recalculate stock status
const calculateStockStatus = (currentStock, reorderLevel) => {
  if (currentStock <= 0) return 'Out-of-Stock';
  if (currentStock <= reorderLevel) return 'Low-Stock';
  return 'In-Stock';
};

// ============================================================================
// MODULE 1: SUPPLIER MANAGEMENT (Collection: Suppliers)
// ============================================================================
const supplierController = {
  getAll: (req, res) => {
    try {
      const suppliers = dataAccess.findAll('suppliers');
      const inspections = dataAccess.findAll('inspections');
      const batches = dataAccess.findAll('batches');
      const orders = dataAccess.findAll('productionOrders');
      const materials = dataAccess.findAll('materials');

      // Compute vendor quality rating & defect backward traceability count
      const enriched = suppliers.map(s => {
        // Find materials from this supplier
        const supplierMaterials = materials.filter(m => m.supplierId === s._id || m.supplierId === s.id);
        const matIds = supplierMaterials.map(m => m._id || m.id);

        // Find orders using these materials
        const supplierOrders = orders.filter(o => 
          o.requiredMaterials && o.requiredMaterials.some(rm => matIds.includes(rm.materialId))
        );
        const orderIds = supplierOrders.map(o => o._id || o.id);

        // Find batches for these orders
        const supplierBatches = batches.filter(b => orderIds.includes(b.orderId));
        const batchIds = supplierBatches.map(b => b._id || b.id);

        // Find failed inspections for these batches
        const failedInspections = inspections.filter(i => 
          batchIds.includes(i.batchId) && i.result === 'Fail' &&
          i.defects && i.defects.some(d => d.rootCauseCategory === 'Raw-Material-Defect')
        );

        return {
          ...s,
          materialsCount: supplierMaterials.length,
          defectiveBatchesTraced: failedInspections.length
        };
      });

      res.json({ success: true, count: enriched.length, data: enriched });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  getById: (req, res) => {
    try {
      const supplier = dataAccess.findById('suppliers', req.params.id);
      if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
      res.json({ success: true, data: supplier });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  create: (req, res) => {
    try {
      const payload = req.body;
      if (!payload.supplierCode) {
        payload.supplierCode = 'SUP-' + Math.floor(100 + Math.random() * 900);
      }
      payload.status = payload.status || 'Active';
      payload.rating = payload.rating || 4.5;
      payload.leadTimeDays = payload.leadTimeDays || 7;
      const created = dataAccess.create('suppliers', payload);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  update: (req, res) => {
    try {
      const updated = dataAccess.update('suppliers', req.params.id, req.body);
      if (!updated) return res.status(404).json({ success: false, message: 'Supplier not found' });
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  delete: (req, res) => {
    try {
      const materials = dataAccess.findAll('materials');
      const hasMaterials = materials.some(m => m.supplierId === req.params.id);
      if (hasMaterials) {
        // Soft delete / block hard deletion if raw materials are linked
        const updated = dataAccess.update('suppliers', req.params.id, { status: 'Suspended' });
        return res.json({
          success: true,
          message: 'Supplier has linked raw materials. Status toggled to Suspended to preserve traceability.'
        });
      }
      dataAccess.delete('suppliers', req.params.id);
      res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

// ============================================================================
// MODULE 2: RAW-MATERIAL MANAGEMENT (Collection: Materials)
// ============================================================================
const materialController = {
  getAll: (req, res) => {
    try {
      const materials = dataAccess.findAll('materials');
      res.json({ success: true, count: materials.length, data: materials });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  create: (req, res) => {
    try {
      const payload = req.body;
      // Validate linked supplier exists and is Active
      const supplier = dataAccess.findById('suppliers', payload.supplierId);
      if (!supplier) {
        return res.status(400).json({ success: false, message: 'Invalid supplierId: Supplier does not exist' });
      }
      if (supplier.status === 'Blacklisted') {
        return res.status(400).json({ success: false, message: 'Cannot source materials from a Blacklisted vendor' });
      }

      payload.supplierName = supplier.name;
      payload.currentStock = Number(payload.currentStock) || 0;
      payload.reorderLevel = Number(payload.reorderLevel) || 100;
      payload.unitCost = Number(payload.unitCost) || 10;
      payload.stockStatus = calculateStockStatus(payload.currentStock, payload.reorderLevel);

      const created = dataAccess.create('materials', payload);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  update: (req, res) => {
    try {
      const existing = dataAccess.findById('materials', req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Material not found' });

      const updates = { ...req.body };
      if (updates.currentStock !== undefined || updates.reorderLevel !== undefined) {
        const stock = updates.currentStock !== undefined ? Number(updates.currentStock) : existing.currentStock;
        const reorder = updates.reorderLevel !== undefined ? Number(updates.reorderLevel) : existing.reorderLevel;
        updates.stockStatus = calculateStockStatus(stock, reorder);
      }

      const updated = dataAccess.update('materials', req.params.id, updates);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  restock: (req, res) => {
    try {
      const { quantity } = req.body;
      const addQty = Number(quantity);
      if (!addQty || addQty <= 0) {
        return res.status(400).json({ success: false, message: 'Valid positive quantity required' });
      }

      const material = dataAccess.findById('materials', req.params.id);
      if (!material) return res.status(404).json({ success: false, message: 'Material not found' });

      // Check supplier status gatekeeper
      const supplier = dataAccess.findById('suppliers', material.supplierId);
      if (supplier && supplier.status === 'Blacklisted') {
        return res.status(400).json({ success: false, message: 'Restocking blocked: Linked supplier is Blacklisted' });
      }

      const newStock = material.currentStock + addQty;
      const newStatus = calculateStockStatus(newStock, material.reorderLevel);

      const updated = dataAccess.update('materials', req.params.id, {
        currentStock: newStock,
        stockStatus: newStatus
      });

      res.json({
        success: true,
        message: `Restocked ${addQty} ${material.unit}. New Stock: ${newStock}`,
        data: updated
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  delete: (req, res) => {
    try {
      const deleted = dataAccess.delete('materials', req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Material not found' });
      res.json({ success: true, message: 'Material deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

// ============================================================================
// MODULE 3 & 4: PRODUCTION ORDERS & PLANNING (Collection: ProductionOrders)
// ============================================================================
const orderController = {
  getAll: (req, res) => {
    try {
      const orders = dataAccess.findAll('productionOrders');
      res.json({ success: true, count: orders.length, data: orders });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  getById: (req, res) => {
    try {
      const order = dataAccess.findById('productionOrders', req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Production Order not found' });
      res.json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Module 3: Create Plan (Draft-Plan)
  createPlan: (req, res) => {
    try {
      const payload = req.body;
      if (!payload.orderNumber) {
        payload.orderNumber = 'PO-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
      }
      payload.orderStatus = 'Draft-Plan';
      payload.producedQuantity = 0;
      payload.plannedQuantity = Number(payload.plannedQuantity) || 100;
      payload.priority = payload.priority || 'Medium';
      payload.requiredMaterials = payload.requiredMaterials || [];

      // Populate material names and SKUs
      const materials = dataAccess.findAll('materials');
      payload.requiredMaterials = payload.requiredMaterials.map(rm => {
        const mat = materials.find(m => m._id === rm.materialId || m.id === rm.materialId);
        return {
          materialId: rm.materialId,
          sku: mat ? mat.sku : '',
          materialName: mat ? mat.name : '',
          requiredQty: Number(rm.requiredQty) || 1,
          unit: mat ? mat.unit : 'kg',
          isAllocated: false
        };
      });

      const created = dataAccess.create('productionOrders', payload);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // Module 3: Material Feasibility Validator
  checkFeasibility: (req, res) => {
    try {
      const order = dataAccess.findById('productionOrders', req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

      const materials = dataAccess.findAll('materials');
      const feasibilityReport = [];
      let isFeasible = true;

      (order.requiredMaterials || []).forEach(rm => {
        const mat = materials.find(m => m._id === rm.materialId || m.id === rm.materialId);
        const currentStock = mat ? mat.currentStock : 0;
        const shortage = Math.max(0, rm.requiredQty - currentStock);
        const itemFeasible = currentStock >= rm.requiredQty;

        if (!itemFeasible) isFeasible = false;

        feasibilityReport.push({
          materialId: rm.materialId,
          materialName: rm.materialName || (mat ? mat.name : 'Unknown Material'),
          requiredQty: rm.requiredQty,
          currentStock: currentStock,
          unit: rm.unit || (mat ? mat.unit : 'kg'),
          isFeasible: itemFeasible,
          shortageQty: shortage
        });
      });

      res.json({
        success: true,
        orderId: order._id || order.id,
        orderNumber: order.orderNumber,
        isFeasible,
        report: feasibilityReport
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Module 3: Approve Plan (Draft-Plan -> Approved-Plan)
  approvePlan: (req, res) => {
    try {
      const order = dataAccess.findById('productionOrders', req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

      // Run feasibility check
      const materials = dataAccess.findAll('materials');
      const shortages = [];
      (order.requiredMaterials || []).forEach(rm => {
        const mat = materials.find(m => m._id === rm.materialId || m.id === rm.materialId);
        if (!mat || mat.currentStock < rm.requiredQty) {
          shortages.push(`${rm.materialName || 'Material'}: need ${rm.requiredQty}, available ${mat ? mat.currentStock : 0}`);
        }
      });

      if (shortages.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot approve plan: Material shortage detected',
          shortages
        });
      }

      const updated = dataAccess.update('productionOrders', req.params.id, {
        orderStatus: 'Approved-Plan'
      });

      res.json({ success: true, message: 'Plan approved and queued for shop-floor release', data: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Module 4: Order Release & Atomic Inventory Deduction (Approved-Plan -> In-Production)
  releaseOrder: (req, res) => {
    try {
      const order = dataAccess.findById('productionOrders', req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

      if (order.orderStatus !== 'Approved-Plan') {
        return res.status(400).json({
          success: false,
          message: `Cannot release order: Current status is '${order.orderStatus}'. Only 'Approved-Plan' can be released.`
        });
      }

      // Atomic inventory deduction
      const materials = dataAccess.findAll('materials');
      const updatedMaterials = [];

      (order.requiredMaterials || []).forEach(rm => {
        const mat = materials.find(m => m._id === rm.materialId || m.id === rm.materialId);
        if (mat) {
          const newStock = Math.max(0, mat.currentStock - rm.requiredQty);
          const newStatus = calculateStockStatus(newStock, mat.reorderLevel);
          dataAccess.update('materials', mat._id || mat.id, {
            currentStock: newStock,
            stockStatus: newStatus
          });
          rm.isAllocated = true;
          updatedMaterials.push({ sku: mat.sku, deducted: rm.requiredQty, remaining: newStock });
        }
      });

      const updated = dataAccess.update('productionOrders', req.params.id, {
        orderStatus: 'In-Production',
        actualStartDate: new Date().toISOString(),
        requiredMaterials: order.requiredMaterials
      });

      res.json({
        success: true,
        message: 'Order successfully released to shop floor. Raw materials deducted from inventory.',
        allocatedMaterials: updatedMaterials,
        data: updated
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Module 4: Close/Complete Order
  completeOrder: (req, res) => {
    try {
      const order = dataAccess.findById('productionOrders', req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

      const updated = dataAccess.update('productionOrders', req.params.id, {
        orderStatus: 'Completed',
        actualEndDate: new Date().toISOString()
      });

      res.json({ success: true, message: 'Order marked as Completed', data: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  delete: (req, res) => {
    try {
      const deleted = dataAccess.delete('productionOrders', req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Order not found' });
      res.json({ success: true, message: 'Production Order deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

// ============================================================================
// MODULE 5: MACHINE MANAGEMENT (Collection: Machines)
// ============================================================================
const machineController = {
  getAll: (req, res) => {
    try {
      const machines = dataAccess.findAll('machines');
      res.json({ success: true, count: machines.length, data: machines });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  create: (req, res) => {
    try {
      const payload = req.body;
      if (!payload.machineCode) {
        payload.machineCode = 'MCH-' + Math.floor(100 + Math.random() * 900);
      }
      payload.status = payload.status || 'Idle';
      payload.capacityPerHour = Number(payload.capacityPerHour) || 30;
      payload.totalOperatingHours = Number(payload.totalOperatingHours) || 0;
      const created = dataAccess.create('machines', payload);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  update: (req, res) => {
    try {
      const updated = dataAccess.update('machines', req.params.id, req.body);
      if (!updated) return res.status(404).json({ success: false, message: 'Machine not found' });
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // Toggle Maintenance State
  toggleMaintenance: (req, res) => {
    try {
      const machine = dataAccess.findById('machines', req.params.id);
      if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });

      const newStatus = machine.status === 'Maintenance' ? 'Idle' : 'Maintenance';
      const updated = dataAccess.update('machines', req.params.id, {
        status: newStatus,
        lastMaintenanceDate: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Machine ${machine.name} status updated to '${newStatus}'`,
        data: updated
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  delete: (req, res) => {
    try {
      const deleted = dataAccess.delete('machines', req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Machine not found' });
      res.json({ success: true, message: 'Machine deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

// ============================================================================
// MODULE 6: BATCH MANAGEMENT (Collection: Batches)
// ============================================================================
const batchController = {
  getAll: (req, res) => {
    try {
      const batches = dataAccess.findAll('batches');
      res.json({ success: true, count: batches.length, data: batches });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  getById: (req, res) => {
    try {
      const batch = dataAccess.findById('batches', req.params.id);
      if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
      res.json({ success: true, data: batch });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Create Batch & Lock Machine
  create: (req, res) => {
    try {
      const payload = req.body;

      // Validate Order exists and is In-Production
      const order = dataAccess.findById('productionOrders', payload.orderId);
      if (!order) {
        return res.status(400).json({ success: false, message: 'Valid Production Order is required' });
      }
      if (order.orderStatus !== 'In-Production') {
        return res.status(400).json({
          success: false,
          message: `Cannot start batch: Production Order must be 'In-Production' (current: '${order.orderStatus}')`
        });
      }

      // Validate Machine is Idle
      const machine = dataAccess.findById('machines', payload.machineId);
      if (!machine) {
        return res.status(400).json({ success: false, message: 'Valid Machine is required' });
      }
      if (machine.status !== 'Idle') {
        return res.status(400).json({
          success: false,
          message: `Machine '${machine.name}' is currently '${machine.status}'. Only 'Idle' machines can accept new batches.`
        });
      }

      if (!payload.batchCode) {
        payload.batchCode = 'BCH-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
      }
      payload.orderNumber = order.orderNumber;
      payload.productName = order.productName;
      payload.machineName = machine.name;
      payload.batchStatus = 'In-Progress';
      payload.startTime = new Date().toISOString();
      payload.targetQuantity = Number(payload.targetQuantity) || 100;
      payload.quantityProduced = 0;

      const created = dataAccess.create('batches', payload);

      // Lock Machine -> Set status: 'Running', currentBatchId: batch._id
      dataAccess.update('machines', machine._id || machine.id, {
        status: 'Running',
        currentBatchId: created._id || created.id
      });

      res.status(201).json({
        success: true,
        message: `Batch ${created.batchCode} started on machine ${machine.name} (Machine locked to Running)`,
        data: created
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // Complete Batch & Free Machine -> Move to Pending-QC
  completeBatch: (req, res) => {
    try {
      const batch = dataAccess.findById('batches', req.params.id);
      if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

      const qty = req.body.quantityProduced !== undefined ? Number(req.body.quantityProduced) : batch.targetQuantity;

      // Update Batch -> Pending-QC
      const updatedBatch = dataAccess.update('batches', req.params.id, {
        batchStatus: 'Pending-QC',
        quantityProduced: qty,
        endTime: new Date().toISOString()
      });

      // Release Machine -> Idle
      if (batch.machineId) {
        dataAccess.update('machines', batch.machineId, {
          status: 'Idle',
          currentBatchId: null
        });
      }

      res.json({
        success: true,
        message: `Batch ${batch.batchCode} completed and submitted to Pending-QC queue. Assigned machine released back to Idle.`,
        data: updatedBatch
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  delete: (req, res) => {
    try {
      const batch = dataAccess.findById('batches', req.params.id);
      if (batch && batch.machineId) {
        dataAccess.update('machines', batch.machineId, {
          status: 'Idle',
          currentBatchId: null
        });
      }
      dataAccess.delete('batches', req.params.id);
      res.json({ success: true, message: 'Batch deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

// ============================================================================
// MODULE 7 & 8: QUALITY INSPECTION & DEFECT MANAGEMENT (Collection: Inspections)
// ============================================================================
const inspectionController = {
  // Pending-QC queue
  getPendingQC: (req, res) => {
    try {
      const batches = dataAccess.findAll('batches');
      const pending = batches.filter(b => b.batchStatus === 'Pending-QC');
      res.json({ success: true, count: pending.length, data: pending });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  getAll: (req, res) => {
    try {
      const inspections = dataAccess.findAll('inspections');
      res.json({ success: true, count: inspections.length, data: inspections });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  getById: (req, res) => {
    try {
      const inspection = dataAccess.findById('inspections', req.params.id);
      if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found' });
      res.json({ success: true, data: inspection });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Create Inspection Audit (with embedded defects if Fail)
  create: (req, res) => {
    try {
      const payload = req.body;
      const batch = dataAccess.findById('batches', payload.batchId);
      if (!batch) {
        return res.status(400).json({ success: false, message: 'Valid Batch is required for inspection' });
      }

      if (!payload.inspectionCode) {
        payload.inspectionCode = 'INS-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
      }
      payload.batchCode = batch.batchCode;
      payload.productName = batch.productName;
      payload.inspectionDate = payload.inspectionDate || new Date().toISOString();
      payload.sampleSizeChecked = Number(payload.sampleSizeChecked) || 20;

      // Enforce: If Fail, must have at least one defect
      if (payload.result === 'Fail') {
        if (!payload.defects || !Array.isArray(payload.defects) || payload.defects.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Failed inspections must include at least one defect specification in the defects[] array.'
          });
        }
      } else {
        payload.defects = [];
      }

      const created = dataAccess.create('inspections', payload);

      // Automated Batch & Order Status Propagation
      if (payload.result === 'Pass') {
        // 1. Update Batch -> Approved
        dataAccess.update('batches', batch._id || batch.id, {
          batchStatus: 'Approved'
        });

        // 2. Increment parent ProductionOrder producedQuantity
        if (batch.orderId) {
          const order = dataAccess.findById('productionOrders', batch.orderId);
          if (order) {
            const newProduced = (order.producedQuantity || 0) + (batch.quantityProduced || batch.targetQuantity);
            const isCompleted = newProduced >= order.plannedQuantity;
            dataAccess.update('productionOrders', batch.orderId, {
              producedQuantity: newProduced,
              orderStatus: isCompleted ? 'Completed' : order.orderStatus,
              actualEndDate: isCompleted ? new Date().toISOString() : order.actualEndDate
            });
          }
        }
      } else if (payload.result === 'Fail') {
        // 1. Update Batch -> Rejected
        dataAccess.update('batches', batch._id || batch.id, {
          batchStatus: 'Rejected'
        });

        // 2. Automated Upstream Escalation
        payload.defects.forEach(d => {
          // If Machine Fault and Critical -> Flag machine for maintenance
          if (d.rootCauseCategory === 'Machine-Fault' && d.severity === 'Critical' && batch.machineId) {
            dataAccess.update('machines', batch.machineId, {
              status: 'Maintenance'
            });
          }
          // If Raw Material Defect -> Flag upstream supplier
          if (d.rootCauseCategory === 'Raw-Material-Defect' && batch.orderId) {
            const order = dataAccess.findById('productionOrders', batch.orderId);
            if (order && order.requiredMaterials && order.requiredMaterials.length > 0) {
              const matId = order.requiredMaterials[0].materialId;
              const mat = dataAccess.findById('materials', matId);
              if (mat && mat.supplierId) {
                console.log(`[Escalation] Raw material defect logged against supplier ${mat.supplierName}`);
              }
            }
          }
        });
      }

      res.status(201).json({
        success: true,
        message: `Inspection recorded (${payload.result}). Batch marked as ${payload.result === 'Pass' ? 'Approved' : 'Rejected'}.`,
        data: created
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // Module 8: Get All Defects Flattened (Extracted from embedded defects[] in Inspections collection)
  getAllDefects: (req, res) => {
    try {
      const inspections = dataAccess.findAll('inspections');
      const allDefects = [];

      inspections.forEach(insp => {
        (insp.defects || []).forEach((def, index) => {
          allDefects.push({
            ...def,
            defectIndex: index,
            inspectionId: insp._id || insp.id,
            inspectionCode: insp.inspectionCode,
            batchId: insp.batchId,
            batchCode: insp.batchCode,
            productName: insp.productName,
            inspectorName: insp.inspectorName,
            inspectionDate: insp.inspectionDate
          });
        });
      });

      res.json({ success: true, count: allDefects.length, data: allDefects });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Module 8: Update Defect CAPA Resolution Status
  updateDefectStatus: (req, res) => {
    try {
      const { inspectionId, defectIndex } = req.params;
      const { resolutionStatus, correctiveAction } = req.body;

      const inspection = dataAccess.findById('inspections', inspectionId);
      if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found' });

      const idx = Number(defectIndex);
      if (!inspection.defects || !inspection.defects[idx]) {
        return res.status(404).json({ success: false, message: 'Defect item not found at index' });
      }

      if (resolutionStatus) inspection.defects[idx].resolutionStatus = resolutionStatus;
      if (correctiveAction) inspection.defects[idx].correctiveAction = correctiveAction;

      const updated = dataAccess.update('inspections', inspectionId, {
        defects: inspection.defects
      });

      res.json({
        success: true,
        message: 'Defect CAPA status updated successfully',
        data: updated
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Module 8: End-to-End Backward Traceability Resolver
  getTraceability: (req, res) => {
    try {
      const { identifier } = req.params;
      const batches = dataAccess.findAll('batches');
      const inspections = dataAccess.findAll('inspections');
      const orders = dataAccess.findAll('productionOrders');
      const machines = dataAccess.findAll('machines');
      const materials = dataAccess.findAll('materials');
      const suppliers = dataAccess.findAll('suppliers');

      // Find inspection or batch
      let inspection = inspections.find(i => 
        i._id === identifier || i.id === identifier || i.inspectionCode === identifier || i.batchId === identifier
      );
      let batch = null;

      if (inspection) {
        batch = batches.find(b => b._id === inspection.batchId || b.id === inspection.batchId);
      } else {
        batch = batches.find(b => b._id === identifier || b.id === identifier || b.batchCode === identifier);
        if (batch) {
          inspection = inspections.find(i => i.batchId === (batch._id || batch.id));
        }
      }

      if (!batch) {
        return res.status(404).json({ success: false, message: 'Traceability record not found for identifier' });
      }

      const machine = machines.find(m => m._id === batch.machineId || m.id === batch.machineId);
      const order = orders.find(o => o._id === batch.orderId || o.id === batch.orderId);

      const tracedMaterials = [];
      if (order && order.requiredMaterials) {
        order.requiredMaterials.forEach(rm => {
          const mat = materials.find(m => m._id === rm.materialId || m.id === rm.materialId);
          const sup = mat ? suppliers.find(s => s._id === mat.supplierId || s.id === mat.supplierId) : null;
          tracedMaterials.push({
            material: mat || { name: rm.materialName, sku: rm.sku },
            requiredQty: rm.requiredQty,
            supplier: sup || { name: 'Unknown Supplier', rating: 'N/A' }
          });
        });
      }

      res.json({
        success: true,
        traceability: {
          inspection: inspection || null,
          batch: batch,
          machine: machine || null,
          productionOrder: order || null,
          materialsAndSuppliers: tracedMaterials
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  delete: (req, res) => {
    try {
      const deleted = dataAccess.delete('inspections', req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Inspection not found' });
      res.json({ success: true, message: 'Inspection deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

// ============================================================================
// MODULE 9: PRODUCTION-QUALITY ANALYSIS (Aggregation & Analytics Engine)
// ============================================================================
const analyticsController = {
  getQualityAnalytics: (req, res) => {
    try {
      const batches = dataAccess.findAll('batches');
      const inspections = dataAccess.findAll('inspections');
      const machines = dataAccess.findAll('machines');
      const orders = dataAccess.findAll('productionOrders');
      const materials = dataAccess.findAll('materials');
      const suppliers = dataAccess.findAll('suppliers');

      // Core Batch KPIs
      const totalBatches = batches.length;

      // Unique inspected batches
      const inspectedBatchIds = new Set(inspections.map(i => i.batchId));
      const inspectedBatches = batches.filter(b => 
        inspectedBatchIds.has(b._id) || inspectedBatchIds.has(b.id) || b.batchStatus === 'Approved' || b.batchStatus === 'Rejected'
      ).length;

      const uninspectedBatches = Math.max(0, totalBatches - inspectedBatches);

      // Defective batches (where inspection result == Fail or batchStatus == Rejected)
      const failedBatchIds = new Set(inspections.filter(i => i.result === 'Fail').map(i => i.batchId));
      const defectiveBatches = batches.filter(b => 
        failedBatchIds.has(b._id) || failedBatchIds.has(b.id) || b.batchStatus === 'Rejected'
      ).length;

      // Defect Percentage (Primary - vs Inspected Batches)
      const defectPercentage = inspectedBatches > 0 
        ? Number(((defectiveBatches / inspectedBatches) * 100).toFixed(2)) 
        : 0;

      // Overall Batch Failure Rate (vs Total Batches)
      const overallFailureRate = totalBatches > 0 
        ? Number(((defectiveBatches / totalBatches) * 100).toFixed(2)) 
        : 0;

      // Inspection Coverage Rate
      const inspectionCoverageRate = totalBatches > 0 
        ? Number(((inspectedBatches / totalBatches) * 100).toFixed(2)) 
        : 0;

      const passedBatches = Math.max(0, inspectedBatches - defectiveBatches);
      const yieldRate = inspectedBatches > 0 
        ? Number(((passedBatches / inspectedBatches) * 100).toFixed(2)) 
        : 100;

      // Extract all embedded defects
      const allDefects = [];
      inspections.forEach(i => {
        (i.defects || []).forEach(d => allDefects.push(d));
      });

      // Defect Breakdown by Severity
      const severityBreakdown = {
        Critical: allDefects.filter(d => d.severity === 'Critical').length,
        Major: allDefects.filter(d => d.severity === 'Major').length,
        Minor: allDefects.filter(d => d.severity === 'Minor').length
      };

      // Defect Breakdown by Type (Pareto)
      const defectTypeMap = {};
      allDefects.forEach(d => {
        defectTypeMap[d.defectType] = (defectTypeMap[d.defectType] || 0) + 1;
      });
      const defectTypes = Object.entries(defectTypeMap).map(([type, count]) => ({ type, count }));

      // Defect Rate by Machine
      const machineYield = machines.map(m => {
        const mBatches = batches.filter(b => b.machineId === (m._id || m.id) || b.machineName === m.name);
        const mTotal = mBatches.length;
        const mDefective = mBatches.filter(b => 
          failedBatchIds.has(b._id) || failedBatchIds.has(b.id) || b.batchStatus === 'Rejected'
        ).length;
        const mPassed = Math.max(0, mTotal - mDefective);
        const mYield = mTotal > 0 ? Number(((mPassed / mTotal) * 100).toFixed(1)) : 100;

        return {
          machineId: m._id || m.id,
          code: m.machineCode,
          name: m.name,
          type: m.type,
          status: m.status,
          totalBatches: mTotal,
          passedBatches: mPassed,
          defectiveBatches: mDefective,
          yieldRate: mYield
        };
      });

      res.json({
        success: true,
        projectInfo: {
          projectNumber: 20,
          projectName: "Manufacturing Production & Quality Management System",
          collectionsCount: 6,
          collections: ["Suppliers", "Materials", "ProductionOrders", "Batches", "Machines", "Inspections"]
        },
        analysis: {
          totalBatches,
          inspectedBatches,
          uninspectedBatches,
          defectiveBatches,
          defectPercentage,
          overallFailureRate,
          inspectionCoverageRate,
          passedBatches,
          yieldRate,
          totalDefectsLogged: allDefects.length,
          totalDefectiveUnits: allDefects.reduce((sum, d) => sum + (Number(d.defectiveUnitCount) || 0), 0),
          activeMachinesCount: machines.filter(m => m.status === 'Running' || m.status === 'Idle').length,
          totalMachinesCount: machines.length,
          activeOrdersCount: orders.filter(o => o.orderStatus === 'In-Production').length,
          lowStockMaterialsCount: materials.filter(m => m.stockStatus !== 'In-Stock').length,
          activeSuppliersCount: suppliers.filter(s => s.status === 'Active').length
        },
        charts: {
          severityBreakdown,
          defectTypes,
          machineYield,
          statusDistribution: [
            { label: 'Passed / Approved', count: passedBatches, color: '#059669' },
            { label: 'Defective / Rejected', count: defectiveBatches, color: '#DC2626' },
            { label: 'Pending / In-Progress', count: uninspectedBatches, color: '#D97706' }
          ]
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = {
  supplierController,
  materialController,
  orderController,
  machineController,
  batchController,
  inspectionController,
  analyticsController
};
