import { Component, OnInit, inject, HostListener, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, QualityAnalysisResponse } from './services/api.service';

declare var Chart: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  Math = Math; // Expose Math for template usage

  activeTab: string = 'analytics';
  searchTerm: string = '';
  statusFilter: string = 'ALL';

  // Data state
  analytics: QualityAnalysisResponse | null = null;
  suppliers: any[] = [];
  materials: any[] = [];
  plans: any[] = [];
  orders: any[] = [];
  machines: any[] = [];
  batches: any[] = [];
  inspections: any[] = [];
  pendingQCBatches: any[] = [];
  defects: any[] = [];
  systemStatus: any = null;

  isLoading: boolean = false;
  toastMessage: string | null = null;
  toastType: 'success' | 'error' | 'info' = 'success';

  // Modal controls
  activeModal: string | null = null;
  feasibilityReport: any = null;
  traceabilityResult: any = null;
  restockTarget: any = null;
  restockQuantity: number = 100;

  // === FEATURE 1: Dark/Light Mode ===
  darkMode: boolean = false;

  // === FEATURE 2: Command Palette (Ctrl+K) ===
  cmdPaletteOpen: boolean = false;
  cmdQuery: string = '';
  cmdResults: any[] = [];
  cmdHighlightIndex: number = 0;

  // === FEATURE 3: Traceability Graph ===
  traceNodes: any[] = [];
  traceFlyoutData: any = null;

  // === FEATURE 4: Quality Charts ===
  @ViewChild('paretoCanvas') paretoCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fpyGaugeCanvas') fpyGaugeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;
  private paretoChart: any = null;
  private fpyChart: any = null;
  private trendChart: any = null;

  // === FEATURE 5: QR Code Batch Traveler ===
  travelerBatch: any = null;
  @ViewChild('qrCanvas') qrCanvas!: ElementRef<HTMLCanvasElement>;

  // === FEATURE 6: Inspection Wizard ===
  wizardStep: number = 1;
  wizardSigned: boolean = false;

  // === FEATURE 7: Sort State ===
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // === FEATURE 8: Quick Filter Chips ===
  quickFilter: string = '';

  // New item form templates
  newSupplier: any = {
    supplierCode: '',
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    materialsSupplied: '',
    rating: 4.5,
    status: 'Active',
    leadTimeDays: 7
  };

  newMaterial: any = {
    sku: '',
    name: '',
    category: 'Metals & Alloys',
    supplierId: '',
    currentStock: 500,
    unit: 'kg',
    reorderLevel: 200,
    unitCost: 25,
    storageLocation: 'Bay 1 - Rack A'
  };

  newPlan: any = {
    orderNumber: '',
    customer: 'Internal Production',
    productName: '',
    productSKU: '',
    plannedQuantity: 500,
    priority: 'Medium',
    plannedStartDate: new Date().toISOString().split('T')[0],
    plannedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assignedLine: 'Line 1',
    planningNotes: '',
    requiredMaterials: []
  };

  newMachine: any = {
    machineCode: '',
    name: '',
    type: 'CNC Milling',
    productionLine: 'Line 1',
    capacityPerHour: 30,
    status: 'Idle',
    operatorInCharge: '',
    totalOperatingHours: 100
  };

  newBatch: any = {
    batchCode: '',
    orderId: '',
    machineId: '',
    operatorName: '',
    targetQuantity: 100
  };

  newInspection: any = {
    inspectionCode: '',
    batchId: '',
    batchCode: '',
    productName: '',
    inspectorName: 'Quality Specialist',
    sampleSizeChecked: 25,
    result: 'Pass',
    remarks: 'Compliant with technical manufacturing tolerances.',
    defect: {
      defectCode: '',
      defectType: 'Dimensional',
      severity: 'Major',
      defectiveUnitCount: 5,
      rootCauseCategory: 'Process-Deviation',
      rootCause: '',
      correctiveAction: 'Rework'
    }
  };

  ngOnInit() {
    this.loadTheme();
    this.refreshAllData();
  }

  ngAfterViewInit() {
    // Charts are rendered after data loads
  }

  // ========================================
  // FEATURE 1: DARK / LIGHT MODE TOGGLE
  // ========================================
  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
    localStorage.setItem('vortex-theme', this.darkMode ? 'dark' : 'light');
    // Rebuild charts with new theme colors
    setTimeout(() => this.renderQualityCharts(), 100);
  }

  private loadTheme(): void {
    const saved = localStorage.getItem('vortex-theme');
    this.darkMode = saved === 'dark';
    document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
  }

  // ========================================
  // FEATURE 2: COMMAND PALETTE (Ctrl+K)
  // ========================================
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.cmdPaletteOpen = !this.cmdPaletteOpen;
      this.cmdQuery = '';
      this.cmdResults = [];
      this.cmdHighlightIndex = 0;
    }
    if (event.key === 'Escape' && this.cmdPaletteOpen) {
      this.cmdPaletteOpen = false;
    }
    if (this.cmdPaletteOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.cmdHighlightIndex = Math.min(this.cmdHighlightIndex + 1, this.cmdResults.length - 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.cmdHighlightIndex = Math.max(this.cmdHighlightIndex - 1, 0);
      } else if (event.key === 'Enter' && this.cmdResults.length > 0) {
        event.preventDefault();
        this.cmdSelectResult(this.cmdResults[this.cmdHighlightIndex]);
      }
    }
  }

  cmdSearch(): void {
    const q = this.cmdQuery.trim().toLowerCase();
    if (!q) { this.cmdResults = []; return; }

    const results: any[] = [];

    this.suppliers.forEach(s => {
      if ((s.name?.toLowerCase().includes(q)) || (s.supplierCode?.toLowerCase().includes(q)))
        results.push({ type: 'supplier', tab: 'suppliers', icon: 'fa-handshake', bg: '#EFF6FF', color: '#2563EB', title: s.name, sub: `${s.supplierCode} • ${s.status}`, id: s._id || s.id });
    });
    this.materials.forEach(m => {
      if ((m.name?.toLowerCase().includes(q)) || (m.sku?.toLowerCase().includes(q)))
        results.push({ type: 'material', tab: 'materials', icon: 'fa-boxes-stacked', bg: '#F0F9FF', color: '#0284C7', title: m.name, sub: `${m.sku} • ${m.currentStock} ${m.unit}`, id: m._id || m.id });
    });
    this.batches.forEach(b => {
      if ((b.batchCode?.toLowerCase().includes(q)) || (b.productName?.toLowerCase().includes(q)))
        results.push({ type: 'batch', tab: 'batches', icon: 'fa-layer-group', bg: '#EEF2FF', color: '#4F46E5', title: b.batchCode, sub: `${b.productName} • ${b.batchStatus}`, id: b._id || b.id });
    });
    this.machines.forEach(m => {
      if ((m.name?.toLowerCase().includes(q)) || (m.machineCode?.toLowerCase().includes(q)))
        results.push({ type: 'machine', tab: 'machines', icon: 'fa-gears', bg: '#FFFBEB', color: '#D97706', title: m.name, sub: `${m.machineCode} • ${m.status}`, id: m._id || m.id });
    });
    this.inspections.forEach(i => {
      if ((i.inspectionCode?.toLowerCase().includes(q)) || (i.batchCode?.toLowerCase().includes(q)))
        results.push({ type: 'inspection', tab: 'inspections', icon: 'fa-microscope', bg: '#ECFDF5', color: '#059669', title: i.inspectionCode, sub: `${i.batchCode} • ${i.result}`, id: i._id || i.id });
    });
    this.defects.forEach(d => {
      if ((d.defectCode?.toLowerCase().includes(q)) || (d.defectType?.toLowerCase().includes(q)))
        results.push({ type: 'defect', tab: 'defects', icon: 'fa-bug', bg: '#FEF2F2', color: '#DC2626', title: d.defectCode, sub: `${d.defectType} • ${d.severity}`, id: d._id || d.id });
    });

    this.cmdResults = results.slice(0, 10);
    this.cmdHighlightIndex = 0;
  }

  cmdSelectResult(result: any): void {
    this.cmdPaletteOpen = false;
    this.setTab(result.tab);
    this.searchTerm = result.title;
    this.showToast(`Navigated to ${result.type}: ${result.title}`, 'info');
  }

  // ========================================
  // FEATURE 3: TRACEABILITY NODE GRAPH
  // ========================================
  buildTraceGraph(): void {
    if (!this.traceabilityResult) return;
    const t = this.traceabilityResult;
    this.traceNodes = [];

    // Supplier node
    if (t.materialsAndSuppliers?.[0]?.supplier) {
      this.traceNodes.push({
        layer: 'Supplier',
        icon: 'fa-truck',
        value: t.materialsAndSuppliers[0].supplier.name || 'N/A',
        status: t.materialsAndSuppliers[0].supplier.status === 'Active' ? 'pass' : 'fail',
        detail: t.materialsAndSuppliers[0].supplier
      });
    }
    // Material node
    if (t.materialsAndSuppliers?.[0]?.material) {
      this.traceNodes.push({
        layer: 'Raw Material',
        icon: 'fa-boxes-stacked',
        value: t.materialsAndSuppliers[0].material.sku || 'N/A',
        status: 'pass',
        detail: t.materialsAndSuppliers[0].material
      });
    }
    // Order node
    if (t.order) {
      this.traceNodes.push({
        layer: 'Production Order',
        icon: 'fa-file-invoice',
        value: t.order.orderNumber || 'N/A',
        status: 'pass',
        detail: t.order
      });
    }
    // Machine node
    if (t.machine) {
      this.traceNodes.push({
        layer: 'CNC Machine',
        icon: 'fa-gears',
        value: t.machine.machineCode || 'N/A',
        status: t.machine.status === 'Running' ? 'pass' : 'neutral',
        detail: t.machine
      });
    }
    // Batch node
    if (t.batch) {
      this.traceNodes.push({
        layer: 'Batch',
        icon: 'fa-layer-group',
        value: t.batch.batchCode || 'N/A',
        status: t.batch.batchStatus === 'Approved' ? 'pass' : (t.batch.batchStatus === 'Rejected' ? 'fail' : 'neutral'),
        detail: t.batch
      });
    }
    // Inspection node
    if (t.inspection) {
      this.traceNodes.push({
        layer: 'Inspection',
        icon: 'fa-microscope',
        value: t.inspection.inspectionCode || 'N/A',
        status: t.inspection.result === 'Pass' ? 'pass' : 'fail',
        detail: t.inspection
      });
    }
    // Defect node (if any)
    if (t.inspection?.defects?.length > 0) {
      const d = t.inspection.defects[0];
      this.traceNodes.push({
        layer: 'CAPA Defect',
        icon: 'fa-bug',
        value: d.defectCode || 'DEF',
        status: 'fail',
        detail: d
      });
    }
  }

  openTraceFlyout(node: any): void {
    this.traceFlyoutData = node;
  }

  closeTraceFlyout(): void {
    this.traceFlyoutData = null;
  }

  // ========================================
  // FEATURE 4: QUALITY CHARTS (Chart.js)
  // ========================================
  renderQualityCharts(): void {
    if (!this.analytics) return;

    const textColor = this.darkMode ? '#94A3B8' : '#475569';
    const gridColor = this.darkMode ? '#334155' : '#E2E8F0';

    // --- Pareto Chart ---
    if (this.paretoCanvas?.nativeElement) {
      if (this.paretoChart) this.paretoChart.destroy();
      const defectTypes = this.analytics.charts?.defectTypes || [];
      const sorted = [...defectTypes].sort((a, b) => b.count - a.count);
      const labels = sorted.map(d => d.type);
      const data = sorted.map(d => d.count);
      const total = data.reduce((a, b) => a + b, 0);
      const cumulative: number[] = [];
      let running = 0;
      data.forEach(v => { running += v; cumulative.push(total > 0 ? (running / total) * 100 : 0); });

      this.paretoChart = new Chart(this.paretoCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Defect Count',
              data,
              backgroundColor: ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'],
              borderRadius: 6,
              yAxisID: 'y'
            },
            {
              label: 'Cumulative %',
              data: cumulative,
              type: 'line',
              borderColor: '#EF4444',
              borderWidth: 2,
              pointBackgroundColor: '#EF4444',
              pointRadius: 4,
              fill: false,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: textColor, font: { size: 11 } } }
          },
          scales: {
            x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
            y1: { position: 'right', min: 0, max: 100, ticks: { color: '#EF4444', callback: (v: any) => v + '%' }, grid: { display: false } }
          }
        }
      });
    }

    // --- FPY Gauge ---
    if (this.fpyGaugeCanvas?.nativeElement) {
      if (this.fpyChart) this.fpyChart.destroy();
      const fpy = this.analytics.analysis?.yieldRate || 0;
      this.fpyChart = new Chart(this.fpyGaugeCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['First-Pass Yield', 'Defect Rate'],
          datasets: [{
            data: [fpy, 100 - fpy],
            backgroundColor: ['#22C55E', this.darkMode ? '#334155' : '#E2E8F0'],
            borderWidth: 0,
            circumference: 180,
            rotation: 270
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        }
      });
    }

    // --- Trend Sparkline ---
    if (this.trendCanvas?.nativeElement) {
      if (this.trendChart) this.trendChart.destroy();
      // Simulate last 7 shifts trend using batch data variance
      const trendData = [
        this.analytics.analysis?.yieldRate || 0,
        Math.max(0, (this.analytics.analysis?.yieldRate || 0) - 5 + Math.random() * 10),
        Math.max(0, (this.analytics.analysis?.yieldRate || 0) - 3 + Math.random() * 6),
        Math.max(0, (this.analytics.analysis?.yieldRate || 0) + Math.random() * 4),
        Math.max(0, (this.analytics.analysis?.yieldRate || 0) - 2 + Math.random() * 8),
        Math.max(0, (this.analytics.analysis?.yieldRate || 0) + Math.random() * 3),
        this.analytics.analysis?.yieldRate || 0
      ].map(v => Math.round(v * 10) / 10);

      this.trendChart = new Chart(this.trendCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: ['Shift 1', 'Shift 2', 'Shift 3', 'Shift 4', 'Shift 5', 'Shift 6', 'Shift 7'],
          datasets: [{
            label: 'Yield %',
            data: trendData,
            borderColor: '#3B82F6',
            backgroundColor: this.darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#3B82F6'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
            y: { min: 0, max: 100, ticks: { color: textColor, callback: (v: any) => v + '%' }, grid: { color: gridColor } }
          }
        }
      });
    }
  }

  // ========================================
  // FEATURE 5: QR CODE BATCH TRAVELER
  // ========================================
  openTravelerLabel(batch: any): void {
    this.travelerBatch = batch;
    this.activeModal = 'traveler';
    setTimeout(() => this.generateQRCode(batch), 100);
  }

  private generateQRCode(batch: any): void {
    if (!this.qrCanvas?.nativeElement) return;
    const canvas = this.qrCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = `BCH:${batch.batchCode}|ORD:${batch.orderNumber}|MCH:${batch.machineName}|QTY:${batch.targetQuantity}`;
    const size = 160;
    canvas.width = size;
    canvas.height = size;

    // Simple QR-like pattern generator (visual placeholder)
    const cellSize = 4;
    const grid = size / cellSize;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    // Deterministic pattern from data hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }

    ctx.fillStyle = '#0F172A';

    // Position detection patterns (top-left, top-right, bottom-left)
    const drawFinder = (x: number, y: number) => {
      ctx.fillRect(x, y, 28, 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 4, y + 4, 20, 20);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x + 8, y + 8, 12, 12);
    };
    drawFinder(0, 0);
    ctx.fillStyle = '#0F172A'; drawFinder(size - 28, 0);
    ctx.fillStyle = '#0F172A'; drawFinder(0, size - 28);

    // Data modules
    ctx.fillStyle = '#0F172A';
    let seed = Math.abs(hash);
    for (let row = 8; row < grid - 8; row++) {
      for (let col = 8; col < grid - 8; col++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        if (seed % 3 !== 0) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    // Timing patterns
    ctx.fillStyle = '#0F172A';
    for (let i = 8; i < grid - 8; i++) {
      if (i % 2 === 0) {
        ctx.fillRect(i * cellSize, 6 * cellSize, cellSize, cellSize);
        ctx.fillRect(6 * cellSize, i * cellSize, cellSize, cellSize);
      }
    }
  }

  printTraveler(): void {
    window.print();
  }

  // ========================================
  // FEATURE 6: INSPECTION WIZARD
  // ========================================
  setWizardStep(step: number): void {
    if (step <= this.wizardStep + 1) {
      this.wizardStep = step;
    }
  }

  signInspection(): void {
    this.wizardSigned = true;
    this.showToast('Digital signature applied by inspector.', 'success');
  }

  // ========================================
  // FEATURE 7: COLUMN SORTING
  // ========================================
  toggleSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  private sortArray(arr: any[], key: string): any[] {
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
      const va = a[key]; const vb = b[key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  // ========================================
  // FEATURE 8: QUICK FILTER CHIPS & EXPORT
  // ========================================
  setQuickFilter(filter: string): void {
    this.quickFilter = this.quickFilter === filter ? '' : filter;
  }

  exportCSV(dataType: string): void {
    let data: any[] = [];
    let filename = '';

    switch (dataType) {
      case 'materials': data = this.materials; filename = 'materials_export.csv'; break;
      case 'batches': data = this.batches; filename = 'batches_export.csv'; break;
      case 'inspections': data = this.inspections; filename = 'inspections_export.csv'; break;
      case 'defects': data = this.defects; filename = 'defects_export.csv'; break;
      default: return;
    }

    if (data.length === 0) { this.showToast('No data to export.', 'info'); return; }

    const headers = Object.keys(data[0]).filter(k => k !== '_id' && k !== '__v' && k !== 'id');
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    this.showToast(`Exported ${data.length} records to ${filename}`, 'success');
  }

  exportJSON(dataType: string): void {
    let data: any[] = [];
    let filename = '';
    switch (dataType) {
      case 'materials': data = this.materials; filename = 'materials_export.json'; break;
      case 'batches': data = this.batches; filename = 'batches_export.json'; break;
      case 'defects': data = this.defects; filename = 'defects_export.json'; break;
      default: return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    this.showToast(`Exported ${data.length} records to ${filename}`, 'success');
  }

  // ========================================
  // CORE APPLICATION LOGIC (preserved)
  // ========================================
  showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 4500);
  }

  refreshAllData() {
    this.isLoading = true;

    // Quality Analytics
    this.api.getQualityAnalytics().subscribe({
      next: (res) => {
        this.analytics = res;
        setTimeout(() => this.renderQualityCharts(), 300);
      },
      error: (err) => console.error('Analytics load error:', err)
    });

    // Module 1: Suppliers
    this.api.getSuppliers().subscribe({
      next: (res) => this.suppliers = res.data || []
    });

    // Module 2: Materials
    this.api.getMaterials().subscribe({
      next: (res) => this.materials = res.data || []
    });

    // Module 3: Plans
    this.api.getPlans().subscribe({
      next: (res) => this.plans = res.data || []
    });

    // Module 4: Orders
    this.api.getOrders().subscribe({
      next: (res) => this.orders = res.data || []
    });

    // Module 5: Machines
    this.api.getMachines().subscribe({
      next: (res) => this.machines = res.data || []
    });

    // Module 6: Batches
    this.api.getBatches().subscribe({
      next: (res) => this.batches = res.data || []
    });

    // Module 7: Inspections & Pending-QC
    this.api.getInspections().subscribe({
      next: (res) => this.inspections = res.data || []
    });
    this.api.getPendingQC().subscribe({
      next: (res) => this.pendingQCBatches = res.data || []
    });

    // Module 8: Defects
    this.api.getAllDefects().subscribe({
      next: (res) => this.defects = res.data || []
    });

    // System Status
    this.api.getSystemStatus().subscribe({
      next: (res) => {
        this.systemStatus = res;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  setTab(tab: string) {
    this.activeTab = tab;
    this.searchTerm = '';
    this.statusFilter = 'ALL';
    this.quickFilter = '';
    this.sortColumn = '';

    // Render charts when analytics tab is selected
    if (tab === 'analytics') {
      setTimeout(() => this.renderQualityCharts(), 300);
    }
  }

  openModal(modalType: string, prefill?: any) {
    this.activeModal = modalType;
    this.wizardStep = 1;
    this.wizardSigned = false;

    if (modalType === 'newSupplier') {
      this.newSupplier.supplierCode = 'SUP-' + Math.floor(100 + Math.random() * 900);
    } else if (modalType === 'newMaterial') {
      this.newMaterial.sku = 'MAT-' + Math.floor(100 + Math.random() * 900);
      if (this.suppliers.length > 0) this.newMaterial.supplierId = this.suppliers[0]._id || this.suppliers[0].id;
    } else if (modalType === 'newPlan') {
      this.newPlan.orderNumber = 'PO-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
      if (this.materials.length > 0) {
        this.newPlan.requiredMaterials = [
          { materialId: this.materials[0]._id || this.materials[0].id, requiredQty: 100 }
        ];
      }
    } else if (modalType === 'newMachine') {
      this.newMachine.machineCode = 'MCH-' + Math.floor(100 + Math.random() * 900);
    } else if (modalType === 'newBatch') {
      this.newBatch.batchCode = 'BCH-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
      const activeOrders = this.orders.filter(o => o.orderStatus === 'In-Production');
      if (activeOrders.length > 0) this.newBatch.orderId = activeOrders[0]._id || activeOrders[0].id;
      const idleMachines = this.machines.filter(m => m.status === 'Idle');
      if (idleMachines.length > 0) this.newBatch.machineId = idleMachines[0]._id || idleMachines[0].id;
    } else if (modalType === 'newInspection') {
      this.newInspection.inspectionCode = 'INS-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
      this.newInspection.defect.defectCode = 'DEF-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
      if (prefill) {
        this.newInspection.batchId = prefill._id || prefill.id;
        this.newInspection.batchCode = prefill.batchCode;
        this.newInspection.productName = prefill.productName;
        this.newInspection.sampleSizeChecked = Math.min(30, prefill.quantityProduced || prefill.targetQuantity || 30);
      }
    } else if (modalType === 'restock' && prefill) {
      this.restockTarget = prefill;
      this.restockQuantity = 100;
    }
  }

  closeModal() {
    this.activeModal = null;
    this.feasibilityReport = null;
    this.traceabilityResult = null;
    this.restockTarget = null;
    this.travelerBatch = null;
    this.traceFlyoutData = null;
    this.traceNodes = [];
  }

  // --- MODULE 1 ACTIONS ---
  submitNewSupplier() {
    if (typeof this.newSupplier.materialsSupplied === 'string') {
      this.newSupplier.materialsSupplied = this.newSupplier.materialsSupplied.split(',').map((s: string) => s.trim());
    }
    this.api.createSupplier(this.newSupplier).subscribe({
      next: () => {
        this.showToast(`Supplier ${this.newSupplier.name} onboarded successfully!`, 'success');
        this.closeModal();
        this.refreshAllData();
      },
      error: (err) => this.showToast('Failed to onboard supplier: ' + err.message, 'error')
    });
  }

  toggleSupplierStatus(supplier: any, newStatus: string) {
    this.api.updateSupplier(supplier._id || supplier.id, { status: newStatus }).subscribe({
      next: () => {
        this.showToast(`Supplier ${supplier.name} status updated to ${newStatus}`, 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Failed to update supplier: ' + err.message, 'error')
    });
  }

  deleteSupplier(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete supplier '${name}'?`)) return;
    this.api.deleteSupplier(id).subscribe({
      next: (res) => {
        this.showToast(res.message || 'Supplier deleted', 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Delete error: ' + err.message, 'error')
    });
  }

  // --- MODULE 2 ACTIONS ---
  submitNewMaterial() {
    this.api.createMaterial(this.newMaterial).subscribe({
      next: () => {
        this.showToast(`Material SKU ${this.newMaterial.sku} registered!`, 'success');
        this.closeModal();
        this.refreshAllData();
      },
      error: (err) => this.showToast('Failed to create material: ' + err.message, 'error')
    });
  }

  submitRestock() {
    if (!this.restockTarget) return;
    this.api.restockMaterial(this.restockTarget._id || this.restockTarget.id, this.restockQuantity).subscribe({
      next: (res) => {
        this.showToast(res.message, 'success');
        this.closeModal();
        this.refreshAllData();
      },
      error: (err) => this.showToast('Restock failed: ' + (err.error?.message || err.message), 'error')
    });
  }

  deleteMaterial(id: string, sku: string) {
    if (!confirm(`Delete material ${sku}?`)) return;
    this.api.deleteMaterial(id).subscribe({
      next: () => {
        this.showToast(`Material ${sku} removed`, 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Delete error: ' + err.message, 'error')
    });
  }

  // --- MODULE 3 & 4 ACTIONS ---
  addMaterialRowToPlan() {
    if (this.materials.length > 0) {
      this.newPlan.requiredMaterials.push({
        materialId: this.materials[0]._id || this.materials[0].id,
        requiredQty: 50
      });
    }
  }

  removeMaterialRowFromPlan(index: number) {
    this.newPlan.requiredMaterials.splice(index, 1);
  }

  submitNewPlan() {
    this.api.createPlan(this.newPlan).subscribe({
      next: () => {
        this.showToast(`Production Plan ${this.newPlan.orderNumber} created (Draft-Plan)!`, 'success');
        this.closeModal();
        this.refreshAllData();
      },
      error: (err) => this.showToast('Failed to create plan: ' + err.message, 'error')
    });
  }

  checkFeasibility(plan: any) {
    this.api.checkFeasibility(plan._id || plan.id).subscribe({
      next: (res) => {
        this.feasibilityReport = res;
        this.activeModal = 'feasibility';
      },
      error: (err) => this.showToast('Feasibility check failed: ' + err.message, 'error')
    });
  }

  approvePlan(planId: string) {
    this.api.approvePlan(planId).subscribe({
      next: (res) => {
        this.showToast(res.message, 'success');
        this.closeModal();
        this.refreshAllData();
      },
      error: (err) => this.showToast('Approval rejected: ' + (err.error?.message || err.message), 'error')
    });
  }

  releaseOrder(orderId: string) {
    this.api.releaseOrder(orderId).subscribe({
      next: (res) => {
        this.showToast(res.message, 'success');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Release failed: ' + (err.error?.message || err.message), 'error')
    });
  }

  completeOrder(orderId: string) {
    this.api.completeOrder(orderId).subscribe({
      next: (res) => {
        this.showToast(res.message, 'success');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Complete order failed: ' + err.message, 'error')
    });
  }

  deleteOrder(id: string, orderNumber: string) {
    if (!confirm(`Delete order ${orderNumber}?`)) return;
    this.api.deleteOrder(id).subscribe({
      next: () => {
        this.showToast(`Order ${orderNumber} deleted`, 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Delete error: ' + err.message, 'error')
    });
  }

  // --- MODULE 5 ACTIONS ---
  submitNewMachine() {
    this.api.createMachine(this.newMachine).subscribe({
      next: () => {
        this.showToast(`Machine ${this.newMachine.name} registered into Equipment Registry!`, 'success');
        this.closeModal();
        this.refreshAllData();
      },
      error: (err) => this.showToast('Failed to register machine: ' + err.message, 'error')
    });
  }

  toggleMachineMaintenance(machine: any) {
    this.api.toggleMaintenance(machine._id || machine.id).subscribe({
      next: (res) => {
        this.showToast(res.message, 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('State change failed: ' + err.message, 'error')
    });
  }

  deleteMachine(id: string, name: string) {
    if (!confirm(`Delete machine '${name}'?`)) return;
    this.api.deleteMachine(id).subscribe({
      next: () => {
        this.showToast(`Machine ${name} deleted`, 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Delete error: ' + err.message, 'error')
    });
  }

  // --- MODULE 6 ACTIONS ---
  submitNewBatch() {
    this.api.createBatch(this.newBatch).subscribe({
      next: (res) => {
        this.showToast(res.message, 'success');
        this.closeModal();
        this.refreshAllData();
      },
      error: (err) => this.showToast('Failed to start batch: ' + (err.error?.message || err.message), 'error')
    });
  }

  completeBatch(batch: any) {
    const qty = prompt(`Enter final units produced for batch ${batch.batchCode}:`, batch.targetQuantity);
    if (qty === null) return;
    this.api.completeBatch(batch._id || batch.id, Number(qty) || batch.targetQuantity).subscribe({
      next: (res) => {
        this.showToast(res.message, 'success');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Batch completion error: ' + err.message, 'error')
    });
  }

  deleteBatch(id: string, code: string) {
    if (!confirm(`Delete batch ${code}?`)) return;
    this.api.deleteBatch(id).subscribe({
      next: () => {
        this.showToast(`Batch ${code} deleted`, 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Delete error: ' + err.message, 'error')
    });
  }

  // --- MODULE 7 & 8 ACTIONS ---
  submitNewInspection() {
    const payload: any = {
      inspectionCode: this.newInspection.inspectionCode,
      batchId: this.newInspection.batchId,
      inspectorName: this.newInspection.inspectorName,
      sampleSizeChecked: this.newInspection.sampleSizeChecked,
      result: this.newInspection.result,
      remarks: this.newInspection.remarks
    };

    if (this.newInspection.result === 'Fail') {
      payload.defects = [
        {
          defectCode: this.newInspection.defect.defectCode,
          defectType: this.newInspection.defect.defectType,
          severity: this.newInspection.defect.severity,
          defectiveUnitCount: this.newInspection.defect.defectiveUnitCount,
          rootCauseCategory: this.newInspection.defect.rootCauseCategory,
          rootCause: this.newInspection.defect.rootCause || 'Quality tolerance violation',
          correctiveAction: this.newInspection.defect.correctiveAction,
          resolutionStatus: 'Open'
        }
      ];
    } else {
      payload.defects = [];
    }

    this.api.createInspection(payload).subscribe({
      next: (res) => {
        this.showToast(res.message, 'success');
        this.closeModal();
        this.refreshAllData();
      },
      error: (err) => this.showToast('Audit submission error: ' + (err.error?.message || err.message), 'error')
    });
  }

  updateDefectCAPA(defect: any, newStatus: string) {
    this.api.updateDefectStatus(defect.inspectionId, defect.defectIndex, newStatus).subscribe({
      next: (res) => {
        this.showToast(`Defect ${defect.defectCode} CAPA updated to ${newStatus}`, 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('CAPA update failed: ' + err.message, 'error')
    });
  }

  viewTraceability(identifier: string) {
    this.api.getTraceability(identifier).subscribe({
      next: (res) => {
        this.traceabilityResult = res.traceability;
        this.activeModal = 'traceability';
        this.buildTraceGraph();
      },
      error: (err) => this.showToast('Traceability lookup error: ' + err.message, 'error')
    });
  }

  deleteInspection(id: string, code: string) {
    if (!confirm(`Delete inspection record ${code}?`)) return;
    this.api.deleteInspection(id).subscribe({
      next: () => {
        this.showToast(`Inspection ${code} deleted`, 'info');
        this.refreshAllData();
      },
      error: (err) => this.showToast('Delete error: ' + err.message, 'error')
    });
  }

  resetFactoryData() {
    if (confirm('Reset system data strictly across the 6 major collections back to demonstration defaults?')) {
      this.api.resetSeedData().subscribe({
        next: () => {
          this.showToast('Factory seed data restored strictly across 6 major collections!', 'success');
          this.refreshAllData();
        }
      });
    }
  }

  printQualityReport() {
    window.print();
  }

  // --- Filtering Helpers (enhanced with quick filters & sorting) ---
  get filteredSuppliers() {
    let data = this.suppliers.filter(s => {
      const matchSearch = !this.searchTerm ||
        s.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        s.supplierCode.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        s.contactPerson.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || s.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
    if (this.sortColumn) data = this.sortArray(data, this.sortColumn);
    return data;
  }

  get filteredMaterials() {
    let data = this.materials.filter(m => {
      const matchSearch = !this.searchTerm ||
        m.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        m.sku.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        m.category.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || m.stockStatus === this.statusFilter;
      // Quick filter: Low Stock Alert
      if (this.quickFilter === 'low-stock' && m.currentStock > m.reorderLevel) return false;
      return matchSearch && matchStatus;
    });
    if (this.sortColumn) data = this.sortArray(data, this.sortColumn);
    return data;
  }

  get filteredPlans() {
    return this.plans.filter(p => {
      const matchSearch = !this.searchTerm ||
        p.orderNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        p.productName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        p.assignedLine.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || p.orderStatus === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  get filteredOrders() {
    return this.orders.filter(o => {
      const matchSearch = !this.searchTerm ||
        o.orderNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        o.customer.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        o.productName.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || o.orderStatus === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  get filteredMachines() {
    return this.machines.filter(m => {
      const matchSearch = !this.searchTerm ||
        m.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        m.machineCode.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        m.type.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || m.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  get filteredBatches() {
    let data = this.batches.filter(b => {
      const matchSearch = !this.searchTerm ||
        b.batchCode.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        b.orderNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        b.productName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        b.machineName.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || b.batchStatus === this.statusFilter;
      if (this.quickFilter === 'defective' && b.batchStatus !== 'Rejected') return false;
      if (this.quickFilter === 'pending-qc' && b.batchStatus !== 'Pending-QC') return false;
      return matchSearch && matchStatus;
    });
    if (this.sortColumn) data = this.sortArray(data, this.sortColumn);
    return data;
  }

  get filteredInspections() {
    return this.inspections.filter(i => {
      const matchSearch = !this.searchTerm ||
        i.inspectionCode.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        i.batchCode.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        i.productName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        i.inspectorName.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || i.result === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  get filteredDefects() {
    return this.defects.filter(d => {
      const matchSearch = !this.searchTerm ||
        d.defectCode.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        d.batchCode.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        d.defectType.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        d.rootCause.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || d.severity === this.statusFilter || d.resolutionStatus === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }
}
