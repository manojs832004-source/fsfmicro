const { dataAccess } = require('../config/db');

// Production Quality Analysis Controller
const getQualityAnalytics = (req, res) => {
  try {
    const batches = dataAccess.findAll('batches');
    const inspections = dataAccess.findAll('inspections');
    const defects = dataAccess.findAll('defects');
    const machines = dataAccess.findAll('machines');
    const orders = dataAccess.findAll('orders');
    const materials = dataAccess.findAll('materials');
    const suppliers = dataAccess.findAll('suppliers');

    // Required Primary Calculations
    const totalBatches = batches.length;
    
    // Inspected batches count
    const inspectedBatchesList = batches.filter(b => b.isInspected || inspections.some(i => i.batchNumber === b.batchNumber));
    const inspectedBatches = inspectedBatchesList.length;

    // Defective batches count
    const defectiveBatchesList = batches.filter(b => 
      b.isDefective || 
      b.status.toLowerCase().includes('defective') || 
      b.status.toLowerCase().includes('quarantine') ||
      defects.some(d => d.batchNumber === b.batchNumber)
    );
    const defectiveBatches = defectiveBatchesList.length;

    // Defect percentage based on inspected batches
    const defectPercentage = inspectedBatches > 0 
      ? Number(((defectiveBatches / inspectedBatches) * 100).toFixed(2)) 
      : 0;

    // Passed batches count and Pass Percentage (Yield Rate)
    const passedBatches = Math.max(0, inspectedBatches - defectiveBatches);
    const passPercentage = inspectedBatches > 0 
      ? Number(((passedBatches / inspectedBatches) * 100).toFixed(2)) 
      : 100;

    const pendingInspectionBatches = totalBatches - inspectedBatches;

    // Defect Severity Breakdown (Critical, Major, Minor)
    const severityBreakdown = {
      Critical: defects.filter(d => d.severity === 'Critical').length,
      Major: defects.filter(d => d.severity === 'Major').length,
      Minor: defects.filter(d => d.severity === 'Minor').length
    };

    // Defect Type Breakdown
    const typeMap = {};
    defects.forEach(d => {
      typeMap[d.defectType] = (typeMap[d.defectType] || 0) + 1;
    });
    const defectTypes = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

    // Machine Yield Performance
    const machineYield = machines.map(m => {
      const machineBatches = batches.filter(b => b.machineId === m.id || b.machineName === m.name);
      const mTotal = machineBatches.length;
      const mDefective = machineBatches.filter(b => b.isDefective || defects.some(d => d.batchNumber === b.batchNumber)).length;
      const mPassed = Math.max(0, mTotal - mDefective);
      const yieldPct = mTotal > 0 ? Number(((mPassed / mTotal) * 100).toFixed(1)) : 100;
      return {
        machineId: m.id,
        name: m.name,
        code: m.machineCode,
        category: m.category,
        healthScore: m.healthScore,
        status: m.status,
        totalBatches: mTotal,
        defectiveBatches: mDefective,
        passedBatches: mPassed,
        yieldRate: yieldPct
      };
    });

    // Summary KPIs
    res.json({
      success: true,
      analysis: {
        totalBatches,
        inspectedBatches,
        defectiveBatches,
        defectPercentage,
        passedBatches,
        passPercentage,
        pendingInspectionBatches,
        totalDefectsLogged: defects.length,
        totalDefectiveUnits: defects.reduce((sum, d) => sum + (Number(d.defectiveUnits) || 0), 0),
        activeMachinesCount: machines.filter(m => m.status === 'Operational').length,
        totalMachinesCount: machines.length,
        totalActiveOrders: orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length,
        lowStockMaterialsCount: materials.filter(m => m.status === 'Low Stock' || m.currentStock <= m.minimumStock).length,
        activeSuppliersCount: suppliers.filter(s => s.status === 'Active').length
      },
      charts: {
        severityBreakdown,
        defectTypes,
        machineYield,
        inspectionStatusDistribution: [
          { label: 'Passed Batches', count: passedBatches, color: '#10B981' },
          { label: 'Defective Batches', count: defectiveBatches, color: '#EF4444' },
          { label: 'Pending Inspection', count: pendingInspectionBatches, color: '#F59E0B' }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getQualityAnalytics
};
