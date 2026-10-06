import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface QualityAnalysisResponse {
  success: boolean;
  projectInfo: {
    projectNumber: number;
    projectName: string;
    teamMembers: string[];
    collectionsCount: number;
    collections: string[];
  };
  analysis: {
    totalBatches: number;
    inspectedBatches: number;
    uninspectedBatches: number;
    defectiveBatches: number;
    defectPercentage: number;
    overallFailureRate: number;
    inspectionCoverageRate: number;
    passedBatches: number;
    yieldRate: number;
    totalDefectsLogged: number;
    totalDefectiveUnits: number;
    activeMachinesCount: number;
    totalMachinesCount: number;
    activeOrdersCount: number;
    lowStockMaterialsCount: number;
    activeSuppliersCount: number;
  };
  charts: {
    severityBreakdown: {
      Critical: number;
      Major: number;
      Minor: number;
    };
    defectTypes: Array<{ type: string; count: number }>;
    machineYield: Array<{
      machineId: string;
      code: string;
      name: string;
      type: string;
      status: string;
      totalBatches: number;
      passedBatches: number;
      defectiveBatches: number;
      yieldRate: number;
    }>;
    statusDistribution: Array<{
      label: string;
      count: number;
      color: string;
    }>;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:5000/api';

  // Module 9: Production-Quality Analysis
  getQualityAnalytics(): Observable<QualityAnalysisResponse> {
    return this.http.get<QualityAnalysisResponse>(`${this.baseUrl}/analytics/quality`);
  }

  // Module 1: Suppliers
  getSuppliers(): Observable<any> {
    return this.http.get(`${this.baseUrl}/suppliers`);
  }
  createSupplier(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/suppliers`, data);
  }
  updateSupplier(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/suppliers/${id}`, data);
  }
  deleteSupplier(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/suppliers/${id}`);
  }

  // Module 2: Raw Materials
  getMaterials(): Observable<any> {
    return this.http.get(`${this.baseUrl}/materials`);
  }
  createMaterial(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/materials`, data);
  }
  updateMaterial(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/materials/${id}`, data);
  }
  restockMaterial(id: string, quantity: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/materials/${id}/restock`, { quantity });
  }
  deleteMaterial(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/materials/${id}`);
  }

  // Module 3: Production Planning (ProductionOrders - Planning Phase)
  getPlans(): Observable<any> {
    return this.http.get(`${this.baseUrl}/plans`);
  }
  createPlan(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/plans`, data);
  }
  checkFeasibility(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/plans/${id}/check-feasibility`);
  }
  approvePlan(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/plans/${id}/approve`, {});
  }

  // Module 4: Production Orders (ProductionOrders - Execution Phase)
  getOrders(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders`);
  }
  releaseOrder(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${id}/release`, {});
  }
  completeOrder(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${id}/complete`, {});
  }
  deleteOrder(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/orders/${id}`);
  }

  // Module 5: Machines
  getMachines(): Observable<any> {
    return this.http.get(`${this.baseUrl}/machines`);
  }
  createMachine(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/machines`, data);
  }
  updateMachine(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/machines/${id}`, data);
  }
  toggleMaintenance(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/machines/${id}/maintenance`, {});
  }
  deleteMachine(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/machines/${id}`);
  }

  // Module 6: Batches
  getBatches(): Observable<any> {
    return this.http.get(`${this.baseUrl}/batches`);
  }
  createBatch(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/batches`, data);
  }
  completeBatch(id: string, quantityProduced?: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/batches/${id}/complete`, { quantityProduced });
  }
  deleteBatch(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/batches/${id}`);
  }

  // Module 7: Quality Inspection
  getPendingQC(): Observable<any> {
    return this.http.get(`${this.baseUrl}/inspections/pending-qc`);
  }
  getInspections(): Observable<any> {
    return this.http.get(`${this.baseUrl}/inspections`);
  }
  createInspection(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/inspections`, data);
  }
  deleteInspection(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/inspections/${id}`);
  }

  // Module 8: Defect Management & CAPA
  getAllDefects(): Observable<any> {
    return this.http.get(`${this.baseUrl}/defects`);
  }
  updateDefectStatus(inspectionId: string, defectIndex: number, status: string, correctiveAction?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/defects/${inspectionId}/${defectIndex}/status`, {
      resolutionStatus: status,
      correctiveAction
    });
  }
  getTraceability(identifier: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/defects/traceability/${identifier}`);
  }

  // System Diagnostics & Seed Reset
  getSystemStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/system/status`);
  }
  resetSeedData(): Observable<any> {
    return this.http.post(`${this.baseUrl}/system/reset`, {});
  }
}
