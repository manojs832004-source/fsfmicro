# Manufacturing Production & Quality Management System (Project #20)

**Stack**: MEAN Stack (MongoDB / Mongoose Architecture with Auto-Fallback DAL, Express.js REST API, Angular 17 Standalone SPA, Node.js v24)  
**Theme**: Pure White Background (`#FFFFFF`) with Executive Professional Color Scheme

---

## 🏛️ Core Architectural Constraint: The 8-Modules-to-6-Collections Rule

The database strictly utilizes **ONLY 6 Major MongoDB Collections**:
1. `Suppliers`
2. `Materials`
3. `ProductionOrders` *(houses both Module 3: Production Planning and Module 4: Production Orders via lifecycle states `Draft-Plan` -> `Approved-Plan` -> `In-Production` -> `Completed`)*
4. `Batches`
5. `Machines`
6. `Inspections` *(houses both Module 7: Quality Inspection and Module 8: Defect Management via embedded `defects[]` subdocument array)*

No redundant collections are created; document lifecycle states and embedded subdocument arrays are leveraged as specified.

---

## 🔄 The 6-Step Transactional MES Flow

```
1. Procurement Flow
   Suppliers (Active) ───► Supplies Materials (In-Stock)

2. Planning Flow
   ProductionOrders ("Draft-Plan") checks Materials.currentStock >= requiredQty ───► Transitions to "Approved-Plan"

3. Order Release Trigger
   ProductionOrders ("Approved-Plan" ──► "In-Production") ───► Atomically decrements Materials.currentStock & triggers Reorder Alert Engine

4. Shop-Floor Execution Trigger
   Batches created ("In-Progress") ───► Locks Machines ("Idle" ──► "Running")

5. Batch Finish Trigger
   Batches ("In-Progress" ──► "Pending-QC") ───► Frees Machines ("Running" ──► "Idle")

6. Quality & Defect Trigger
   Inspections submitted:
   ├── If Result == "Pass": Batches.batchStatus = "Approved" ──► Increments ProductionOrders.producedQuantity
   └── If Result == "Fail": Embeds defects[] ──► Batches.batchStatus = "Rejected" ──► Automated Machine/Supplier Escalation
```

---

## 📦 Detailed Modules & Collections Mapping

| Module # | Functional Module | Major Collection | Key Operations & Submodules |
|---|---|---|---|
| **Module 1** | **Supplier Management** | `Suppliers` | Vendor onboarding & AVL directory, rating (1–5 scale), compliance gatekeeper (`Active`, `Suspended`, `Blacklisted`), backward defect attribution. |
| **Module 2** | **Raw-Material Management** | `Materials` | SKU cataloging, stock inward restock ledger (`POST /api/materials/:id/restock`), automated reorder alert engine (`In-Stock`, `Low-Stock`, `Out-of-Stock`). |
| **Module 3** | **Production Planning** | `ProductionOrders` (Planning) | Forecasting, BOM requirement mapping, material feasibility validator (`GET /api/plans/:id/check-feasibility`), plan approval (`POST /api/plans/:id/approve`). |
| **Module 4** | **Production Orders** | `ProductionOrders` (Execution) | Atomic order release (`POST /api/orders/:id/release`) with stock deduction, fulfillment tracking, order completion. |
| **Module 5** | **Machine Management** | `Machines` | Live state machine (`Idle`, `Running`, `Maintenance`, `Offline`), batch assignment locking, maintenance scheduler (`POST /api/machines/:id/maintenance`). |
| **Module 6** | **Batch Management** | `Batches` | Shop-floor production runs, machine locking on creation (`POST /api/batches`), run completion & release to `Pending-QC` (`POST /api/batches/:id/complete`). |
| **Module 7** | **Quality Inspection** | `Inspections` | `Pending-QC` queue manager (`GET /api/inspections/pending-qc`), audit verdicts (`Pass` / `Fail`), cross-collection batch approval/rejection. |
| **Module 8** | **Defect Management & CAPA** | `Inspections` (`defects[]`) | Embedded defect logging, CAPA status workflow (`Open`, `Sent-for-Rework`, `Scrapped`, `Resolved`), **End-to-End Backward Traceability Resolver** (`GET /api/defects/traceability/:id`). |
| **Module 9** | **Production-Quality Analysis** | *Computed Aggregation* | Real-time analytics engine (`GET /api/analytics/quality`): Total Batches, Inspected Batches, Defective Batches, Defect %, Yield Rate, Machine correlation. |

---

## 📊 Module 9: Production-Quality Analysis Formulation

$$\text{Defect Percentage} = \left(\frac{B_{\text{defective}}}{B_{\text{inspected}}}\right) \times 100$$

$$\text{Overall Batch Failure Rate} = \left(\frac{B_{\text{defective}}}{B_{\text{total}}}\right) \times 100$$

$$\text{Inspection Coverage Rate} = \left(\frac{B_{\text{inspected}}}{B_{\text{total}}}\right) \times 100$$

$$\text{First-Pass Yield Rate} = \left(\frac{B_{\text{passed}}}{B_{\text{inspected}}}\right) \times 100$$

---

## 🔍 End-to-End Backward Traceability Resolver

Given any defective `inspectionCode` or `batchCode`, the resolver traverses the full digital thread:
$$\text{Inspection} \longrightarrow \text{Batch} \longrightarrow \text{Machine} \quad \text{AND} \quad \text{ProductionOrder} \longrightarrow \text{Materials} \longrightarrow \text{Suppliers}$$

Access in UI: Click the **Trace** button on any batch, inspection, or defect card.

---

## 🚀 Running the Application

### Backend API Server
```powershell
cd "e:\Downloads\FSF MICROPROJECT\backend"
node server.js
```
- Endpoint: `http://localhost:5000`
- Quality Analytics: `http://localhost:5000/api/analytics/quality`
- System Telemetry: `http://localhost:5000/api/system/status`

### Frontend Application
```powershell
cd "e:\Downloads\FSF MICROPROJECT\frontend"
npm start -- --port 4200
```
- Dashboard: `http://localhost:4200`
