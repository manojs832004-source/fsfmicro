const mongoose = require('mongoose');
const {
  seedSuppliers,
  seedMaterials,
  seedMachines,
  seedProductionOrders,
  seedBatches,
  seedInspections
} = require('../data/seedData');

// In-Memory store strictly managing the 6 Major Collections
const memoryStore = {
  suppliers: JSON.parse(JSON.stringify(seedSuppliers)),
  materials: JSON.parse(JSON.stringify(seedMaterials)),
  machines: JSON.parse(JSON.stringify(seedMachines)),
  productionOrders: JSON.parse(JSON.stringify(seedProductionOrders)),
  batches: JSON.parse(JSON.stringify(seedBatches)),
  inspections: JSON.parse(JSON.stringify(seedInspections))
};

let isMongoConnected = false;

const connectDB = async () => {
  if (process.env.CONNECT_MONGO === 'true' && process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 2000
      });
      isMongoConnected = true;
      console.log(`[Database] MongoDB Connected Successfully: ${process.env.MONGODB_URI}`);
    } catch (err) {
      isMongoConnected = false;
      console.log(`[Database] MongoDB connection failed (${err.message}). Using Local In-Memory Store.`);
    }
  } else {
    isMongoConnected = false;
    console.log(`[Database] Mode: In-Memory DAL (Strictly 6 Collections: Suppliers, Materials, ProductionOrders, Batches, Machines, Inspections)`);
    console.log(`[Database] Ready for MEAN stack demonstration. Set MONGODB_URI anytime to enable persistent MongoDB.`);
  }
};

const dataAccess = {
  isMongoActive: () => isMongoConnected,
  getStore: (collectionKey) => memoryStore[collectionKey],

  findAll: (collection) => {
    return memoryStore[collection] || [];
  },

  findById: (collection, id) => {
    const items = memoryStore[collection] || [];
    return items.find(item => item._id === id || item.id === id);
  },

  create: (collection, doc) => {
    if (!memoryStore[collection]) memoryStore[collection] = [];
    const newId = doc._id || doc.id || new mongoose.Types.ObjectId().toString();
    const newDoc = {
      _id: newId,
      id: newId,
      createdAt: new Date().toISOString(),
      ...doc
    };
    memoryStore[collection].unshift(newDoc);
    return newDoc;
  },

  update: (collection, id, updates) => {
    const items = memoryStore[collection] || [];
    const index = items.findIndex(item => item._id === id || item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    return items[index];
  },

  delete: (collection, id) => {
    const items = memoryStore[collection] || [];
    const index = items.findIndex(item => item._id === id || item.id === id);
    if (index === -1) return false;
    memoryStore[collection].splice(index, 1);
    return true;
  },

  resetSeed: () => {
    memoryStore.suppliers = JSON.parse(JSON.stringify(seedSuppliers));
    memoryStore.materials = JSON.parse(JSON.stringify(seedMaterials));
    memoryStore.machines = JSON.parse(JSON.stringify(seedMachines));
    memoryStore.productionOrders = JSON.parse(JSON.stringify(seedProductionOrders));
    memoryStore.batches = JSON.parse(JSON.stringify(seedBatches));
    memoryStore.inspections = JSON.parse(JSON.stringify(seedInspections));
    return true;
  }
};

module.exports = {
  connectDB,
  dataAccess,
  memoryStore
};
