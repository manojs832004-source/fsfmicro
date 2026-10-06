const { dataAccess } = require('../config/db');

// Factory to create standardized controllers for each collection
const createController = (collectionName, codePrefix) => {
  return {
    getAll: (req, res) => {
      try {
        const items = dataAccess.findAll(collectionName);
        res.json({ success: true, count: items.length, data: items });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    getById: (req, res) => {
      try {
        const item = dataAccess.findById(collectionName, req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: `${collectionName} record not found` });
        }
        res.json({ success: true, data: item });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    create: (req, res) => {
      try {
        const payload = req.body;
        // Auto-generate code if missing
        if (codePrefix && !payload[`${codePrefix.toLowerCase()}Code`]) {
          const rand = Math.floor(100 + Math.random() * 900);
          payload[`${codePrefix.toLowerCase()}Code`] = `${codePrefix}-${rand}`;
        }
        const created = dataAccess.create(collectionName, payload);

        // Special workflow automation:
        // 1. If an inspection is logged, update the linked batch status!
        if (collectionName === 'inspections') {
          const batches = dataAccess.findAll('batches');
          const linkedBatch = batches.find(b => b.batchNumber === created.batchNumber);
          if (linkedBatch) {
            const isDefective = created.status === 'Rejected' || created.hasDefects;
            dataAccess.update('batches', linkedBatch.id, {
              isInspected: true,
              isDefective: isDefective,
              status: isDefective ? 'Inspected - Defective' : 'Inspected - Passed'
            });
          }
        }

        // 2. If a defect is logged, ensure batch is marked defective and quarantined/hold
        if (collectionName === 'defects') {
          const batches = dataAccess.findAll('batches');
          const linkedBatch = batches.find(b => b.batchNumber === created.batchNumber);
          if (linkedBatch) {
            dataAccess.update('batches', linkedBatch.id, {
              isInspected: true,
              isDefective: true,
              defectCount: (linkedBatch.defectCount || 0) + (Number(created.defectiveUnits) || 1),
              status: 'Inspected - Defective'
            });
          }
        }

        res.status(201).json({ success: true, data: created });
      } catch (err) {
        res.status(400).json({ success: false, message: err.message });
      }
    },

    update: (req, res) => {
      try {
        const updated = dataAccess.update(collectionName, req.params.id, req.body);
        if (!updated) {
          return res.status(404).json({ success: false, message: `${collectionName} record not found` });
        }
        res.json({ success: true, data: updated });
      } catch (err) {
        res.status(400).json({ success: false, message: err.message });
      }
    },

    delete: (req, res) => {
      try {
        const deleted = dataAccess.delete(collectionName, req.params.id);
        if (!deleted) {
          return res.status(404).json({ success: false, message: `${collectionName} record not found` });
        }
        res.json({ success: true, message: `${collectionName} record deleted successfully` });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  };
};

module.exports = {
  supplierController: createController('suppliers', 'SUP'),
  materialController: createController('materials', 'MAT'),
  planController: createController('plans', 'PLAN'),
  orderController: createController('orders', 'PO'),
  batchController: createController('batches', 'LOT'),
  machineController: createController('machines', 'MCH'),
  inspectionController: createController('inspections', 'QC'),
  defectController: createController('defects', 'DEF')
};
