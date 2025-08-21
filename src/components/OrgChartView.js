import React, { useEffect, useRef, useState, useCallback } from "react";
import OrgChart from "@balkangraph/orgchart.js";
import Controls from "./Controls";
import "./OrgChartView.css";
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';

function OrgChartView({ data, originalData, setDisplayData, setSelectedEmployee, onBackToUpload, headers = [], selectedFields = { nameField: 'First_Name', titleField: 'Designation' }, setSelectedFields, department = '' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const exportRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Template selection state: keep only the requested templates
  const templates = [
    { key: 'ana', label: 'Ana' },
    { key: 'olivia', label: 'Olivia' },
    { key: 'belinda', label: 'Belinda' },
    { key: 'rony', label: 'Rony' },
    { key: 'mery', label: 'Mery' },
    { key: 'polina', label: 'Polina' },
    { key: 'diva', label: 'Diva' },
    { key: 'isla', label: 'Isla' }
  ];

  const [selectedTemplate, setSelectedTemplate] = useState(templates[0].key);
  // local fallback for selected fields if parent doesn't provide setter
  const [localSelected, setLocalSelected] = useState({ nameField: 'First_Name', titleField: 'Designation', extras: [] });
  const [localDepartment, setLocalDepartment] = useState(department || '');
  const effectiveSelected = (selectedFields && setSelectedFields) ? ({ ...selectedFields, extras: selectedFields.extras || [] }) : localSelected;
  // map a data row to a chart node object using only name and up to 2 extras for title
  const mapRowToNode = useCallback((row) => {
    const nameKey = effectiveSelected.nameField || 'First_Name';
    const extras = Array.isArray(effectiveSelected.extras) ? effectiveSelected.extras.slice(0, 2) : [];
    const extraParts = extras.map(k => row[k] || '').filter(Boolean);

    return {
      id: row.ID,
      pid: row["Parent ID"] || null,
      name: row[nameKey] || '',
      title: extraParts.join(' - '),
      img: row.Photo
    };
  }, [effectiveSelected.nameField, effectiveSelected.extras]);

  // Helper: color nodes based on Status column values
  const colorNodes = (chartObj, rows) => {
    if (!chartObj || !rows || !Array.isArray(rows)) return;
    const getColorForStatus = (status) => {
      if (!status) return null;
      const s = String(status).toLowerCase();
      if (s.includes("active")) return "#1e4489"; 
      if (s.includes("notice")) return "#bd2331"; 
      if (s.includes("vacant") || s.includes("vacency")) return "#ef6724"; 
      return null; // leave default
    };
    try {
      for (const r of rows) {
        const id = (r.ID == null) ? null : String(r.ID);
        const color = getColorForStatus(r.Status || r.status);
        if (!color) continue;
        // get element by API first, fall back to searching DOM by data-id
        let el = null;
        if (id && typeof chartObj.getNodeElement === "function") el = chartObj.getNodeElement(id);
        if (!el && chartObj && chartObj.element) {
          // attempt to find node wrapper by common attributes used by the lib
          el = chartObj.element.querySelector(`[data-id="${id}"]`) || chartObj.element.querySelector(`#${id}`) || chartObj.element.querySelector(`[data-node-id="${id}"]`) || chartObj.element.querySelector(`[data-n-id="${id}"]`);
        }
        if (!el) continue;
        // Try several selectors used by templates to apply visible color
        const candidates = [];
        try { candidates.push(el.querySelector && (el.querySelector('.boc-node') || el.querySelector('.boc-node-content') || el.querySelector('.boc-node-inner'))); } catch(e){ }
        try { candidates.push(el.querySelector && el.querySelector('.node')); } catch(e){}
        try { candidates.push(el.querySelector && el.querySelector('.chart-node')); } catch(e){}
        // include the element itself last
        candidates.push(el);
        for (const target of candidates) {
          if (!target || !target.style) continue;
          // primary background
          target.style.setProperty('background-color', color, 'important');
          target.style.backgroundColor = color;
          // for svg rects inside node templates, set fill
          const rects = target.querySelectorAll ? target.querySelectorAll('rect') : [];
          for (const rct of rects) {
            try { rct.setAttribute('fill', color); } catch(e) {}
          }
          // for elements that use box-shadow or pseudo elements, also set borderColor where applicable
          try { target.style.borderColor = color; } catch(e) {}
        }
      }
    } catch (e) {
      // non-fatal
    }
  };

  // Helper: inject a small status badge into each node (top-right)
  const addStatusBadges = (chartObj, rows) => {
    if (!chartObj || !chartObj.element || !rows || !Array.isArray(rows)) return;
    const getColorForStatus = (status) => {
      if (!status) return null;
      const s = String(status).toLowerCase();
      if (s.includes("active")) return "#1e4489"; 
      if (s.includes("notice")) return "#bd2331"; 
      if (s.includes("vacant") || s.includes("vacency")) return "#e74c3c";
      return null;
    };
    try {
      for (const r of rows) {
        const id = (r.ID == null) ? null : String(r.ID);
        const color = getColorForStatus(r.Status || r.status);
        if (!id) continue;
        // find node element
        let el = null;
        if (typeof chartObj.getNodeElement === 'function') el = chartObj.getNodeElement(id);
        if (!el && chartObj.element) el = chartObj.element.querySelector(`[data-n-id="${id}"]`) || chartObj.element.querySelector(`[data-id="${id}"]`) || chartObj.element.querySelector(`#${id}`) || chartObj.element.querySelector(`[data-node-id="${id}"]`);
        if (!el) continue;
        // find or create badge
        let badge = el.querySelector('.status-badge');
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'status-badge';
          // insert at end of node wrapper so absolute positioning works
          el.appendChild(badge);
        }
        // set color or hide
        if (color) {
          badge.style.backgroundColor = color;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      // ignore
    }
  };
  useEffect(() => {
    // derive department from uploaded data if not explicitly provided
    if (!department) {
      try {
        const possibleKeys = ['Department', 'department', 'Dept', 'dept', 'Department Name', 'DepartmentName'];
        let found = '';
        if (Array.isArray(originalData) && originalData.length > 0) {
          // try headers first
          const headerKey = (headers || []).find(h => possibleKeys.includes(h));
          if (headerKey) {
            // take the most common non-empty value
            const counts = {};
            for (const r of originalData) {
              const v = (r[headerKey] || '').toString().trim();
              if (!v) continue;
              counts[v] = (counts[v] || 0) + 1;
            }
            const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
            if (entries.length) found = entries[0][0];
          } else {
            // fallback: scan rows for any of the possible keys
            for (const key of possibleKeys) {
              const v = originalData[0][key] || '';
              if (v && v.toString().trim()) { found = v.toString().trim(); break; }
            }
          }
        }
        if (found) setLocalDepartment(found);
      } catch(e) {}
    } else {
      setLocalDepartment(department);
    }

  if (!data || data.length === 0 || !chartContainerRef.current) return;
  const nodes = data.map(row => mapRowToNode(row));

    // Ana Style
  OrgChart.templates.dynamic = Object.assign({}, OrgChart.templates.ana);
  // increase node size so larger white text fits without overlapping
  OrgChart.templates.dynamic.size = [420, 260];
    OrgChart.templates.ana.plus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>' +
      '<line x1="15" y1="10" x2="15" y2="20" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.ana.minus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.ana.link = '<path stroke-linejoin="round" stroke="#1e4489" stroke-width="2px" fill="none" d="{rounded}" />'; 

    // Olivia Style
  OrgChart.templates.dynamic = Object.assign({}, OrgChart.templates.olivia);
  // increase node size so larger white text fits without overlapping
  OrgChart.templates.dynamic.size = [420, 260];
    OrgChart.templates.olivia.plus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>' +
      '<line x1="15" y1="10" x2="15" y2="20" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.olivia.minus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.olivia.link = '<path stroke-linejoin="round" stroke="#1e4489" stroke-width="2px" fill="none" d="{rounded}" />'; 

    // Belinda Style
  OrgChart.templates.dynamic = Object.assign({}, OrgChart.templates.belinda);
  // increase node size so larger white text fits without overlapping
  OrgChart.templates.dynamic.size = [420, 260];
    OrgChart.templates.belinda.plus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>' +
      '<line x1="15" y1="10" x2="15" y2="20" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.belinda.minus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.belinda.link = '<path stroke-linejoin="round" stroke="#1e4489" stroke-width="2px" fill="none" d="{rounded}" />'; 

    // Rony Style
  OrgChart.templates.dynamic = Object.assign({}, OrgChart.templates.rony);
  // increase node size so larger white text fits without overlapping
  OrgChart.templates.dynamic.size = [420, 260];
    OrgChart.templates.rony.plus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>' +
      '<line x1="15" y1="10" x2="15" y2="20" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.rony.minus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.rony.link = '<path stroke-linejoin="round" stroke="#1e4489" stroke-width="2px" fill="none" d="{rounded}" />'; 
  
    // Mery Style
  OrgChart.templates.dynamic = Object.assign({}, OrgChart.templates.mery);
  // increase node size so larger white text fits without overlapping
  OrgChart.templates.dynamic.size = [420, 260];
    OrgChart.templates.mery.plus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>' +
      '<line x1="15" y1="10" x2="15" y2="20" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.mery.minus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.mery.link = '<path stroke-linejoin="round" stroke="#1e4489" stroke-width="2px" fill="none" d="{rounded}" />'; 

    // Polina Style
  OrgChart.templates.dynamic = Object.assign({}, OrgChart.templates.polina);
  // increase node size so larger white text fits without overlapping
  OrgChart.templates.dynamic.size = [420, 260];
    OrgChart.templates.polina.plus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>' +
      '<line x1="15" y1="10" x2="15" y2="20" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.polina.minus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.polina.link = '<path stroke-linejoin="round" stroke="#1e4489" stroke-width="2px" fill="none" d="{rounded}" />'; 

    // Diva Style
  OrgChart.templates.dynamic = Object.assign({}, OrgChart.templates.diva);
  // increase node size so larger white text fits without overlapping
  OrgChart.templates.dynamic.size = [420, 260];
    OrgChart.templates.diva.plus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>' +
      '<line x1="15" y1="10" x2="15" y2="20" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.diva.minus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.diva.link = '<path stroke-linejoin="round" stroke="#1e4489" stroke-width="2px" fill="none" d="{rounded}" />'; 

    // Isla Style
  OrgChart.templates.dynamic = Object.assign({}, OrgChart.templates.isla);
  // increase node size so larger white text fits without overlapping
  OrgChart.templates.dynamic.size = [420, 260];
    OrgChart.templates.isla.plus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>' +
      '<line x1="15" y1="10" x2="15" y2="20" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.isla.minus =
      '<circle cx="15" cy="15" r="10" fill="orange" stroke="#000" stroke-width="1"></circle>' +
      '<line x1="10" y1="15" x2="20" y2="15" stroke="#000" stroke-width="2"></line>';
    OrgChart.templates.isla.link = '<path stroke-linejoin="round" stroke="#1e4489" stroke-width="2px" fill="none" d="{rounded}" />'; 

  const chart = new OrgChart(chartContainerRef.current, {
      nodes,
      nodeBinding: {
        field_0: "name",
        field_1: "title",
        img_0: "img"
      },
      scaleInitial: OrgChart.match.boundary,
      template: selectedTemplate,
      layout: OrgChart.mixed,
      nodeMouseClick: OrgChart.none,
      nodeMouseDbClick: OrgChart.none,
      enableSearch: false,
  // increase spacing so larger nodes don't overlap
  spacing: 140,
  levelSeparation: 140,
      nodeMenu: null,
      editForm: { readOnly: true },
      collapse: { level: 9999 }
    });
    try {
      if (!chart.editUI) chart.editUI = {};
      // ensure content is an object (not null) so property reads are safe
      if (chart.editUI.content == null) chart.editUI.content = {};
      // ensure show/hide are callable
      if (typeof chart.editUI.show !== "function") chart.editUI.show = () => {};
      if (typeof chart.editUI.hide !== "function") chart.editUI.hide = () => {};
    } catch (e) {
      // swallowing intentionally - this is a defensive runtime patch
      // if it fails, the original error will still surface and should be
      // investigated separately.
    }
    chart.on("click", (sender, args) => {
      const emp = data.find(r => r.ID.toString() === args.node.id.toString());
      if (emp) setSelectedEmployee(emp);
    });
    // reapply colors after any internal redraw
    if (typeof chart.on === 'function') {
      chart.on('redraw', () => {
        try {
          // chart.config.nodes contains the currently rendered nodes (id, pid, ...)
          const visibleIds = Array.isArray(chart.config && chart.config.nodes) ? chart.config.nodes.map(n => String(n.id)) : [];
          const rowsToColor = (originalData || []).filter(r => visibleIds.includes(String(r.ID)));
          colorNodes(chart, rowsToColor);
          addStatusBadges(chart, rowsToColor);
        } catch (e) {
          // ignore
        }
      });
    }
  // colorNodes helper is defined at component scope; call it after creation
  chartRef.current = chart;

  // chartInstanceRef.current = chart;
  // color initial nodes (delay to allow internal rendering)
  setTimeout(() => { colorNodes(chart, data); addStatusBadges(chart, data); }, 300);
    return () => chart.destroy();
  }, [data, originalData, setSelectedEmployee, selectedTemplate, effectiveSelected.nameField, effectiveSelected.extras, department, headers, mapRowToNode]);
  const handleExportImage = () => {
  if (chartRef.current) {
    chartRef.current.exportPNG({ filename: "orgchart.png" });
  }
};


  // note: selectedTemplate is included in the effect deps so changing it will recreate the chart
  const handleRefresh = () => {
    setDisplayData(originalData);
    if (chartInstanceRef.current) {
  chartInstanceRef.current.load(originalData.map(row => mapRowToNode(row)), () => {
        colorNodes(chartInstanceRef.current, originalData);
    addStatusBadges(chartInstanceRef.current, originalData);
    chartInstanceRef.current.fit();
      });
    }
    setSearchQuery("");
  };
  const handleBack = () => {
    if (onBackToUpload) onBackToUpload();
  };
  const handlePrint = () => window.print();
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query) {
      // reload full chart
  chartInstanceRef.current.load(originalData.map(row => mapRowToNode(row)));
      chartInstanceRef.current.fit();
      return;
    }
    // find first partial match
    const root = originalData.find(emp =>
      emp.First_Name.toLowerCase().includes(query.toLowerCase())
    );
    if (!root) return;
    // collect subtree recursively
    const collectSubtree = (id) => {
      const children = originalData.filter(e => e["Parent ID"] === id);
      return [
        ...children,
        ...children.flatMap(child => collectSubtree(child.ID))
      ];
    };
    const subtreeNodes = [root, ...collectSubtree(root.ID)];
    chartInstanceRef.current.load(subtreeNodes.map(row => ({
  ...mapRowToNode(row)
    })), () => {
  colorNodes(chartInstanceRef.current, subtreeNodes);
  addStatusBadges(chartInstanceRef.current, subtreeNodes);
  chartInstanceRef.current.fit();
    });
  };

  // Toggle an extra field checkbox (limit to 2 selected extras)
  const toggleExtra = (field) => {
    try {
      const curr = Array.isArray(effectiveSelected.extras) ? [...effectiveSelected.extras] : [];
      let next = [];
      if (curr.includes(field)) {
        next = curr.filter(f => f !== field);
      } else {
        if (curr.length >= 2) return; // silently ignore beyond 2
        next = [...curr, field];
      }
      const newVal = setSelectedFields ? ({ ...effectiveSelected, extras: next }) : ({ ...localSelected, extras: next });
      if (setSelectedFields) setSelectedFields(newVal); else setLocalSelected(newVal);
    } catch (e) {
      // ignore
    }
  };
  return (
    <>
      <div className="print-header" style={{ display: "none" }}>
        <img src="/onlylogo.png" alt="Logo" />
        <h1>Suprajit</h1>
        <span className="print-department">{localDepartment ? `Department name: ${localDepartment}` : ''}</span>g
      </div>
      <div className="orgchart-view">
        <header className="header">SUPRAJIT ENGINEERING LIMITED</header>
        <Controls
          searchQuery={searchQuery}
          setSearchQuery={handleSearch}   // custom search handler
          onRefresh={handleRefresh}
          onBack={handleBack}
          onPrint={handlePrint}
          templates={templates}
          onSelectTemplate={setSelectedTemplate}
          selectedTemplate={selectedTemplate}
          // onExportPDF={handleExportPDF}     
          onExportImage={handleExportImage}
        />
        <div className="orgchart-container">
          <div className="field-selectors" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0px 8px' }}>
            <label style={{ marginRight: 6 }}></label>
            <span style={{ color: 'black', marginRight: 12 }}>Name is mandatory, You can upload or set Photo for each node in the details popup.<br/>
              Click on a person to open the popup then click '+' icon to upload Photo of a person
            </span>

            <label style={{ marginRight: 6, marginLeft: 6 }}>Select up to 2 additional fields to show:</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflow: 'auto', padding: 6, border: '1px solid #ddd', borderRadius: 4 }}>
              {/* render headers as checkboxes; exclude Photo/Designation/Name */}
              {(headers || [])
                .filter(h => { const key = String(h).toLowerCase(); return key !== 'photo' && key !== 'image' && key !== 'designation' && key !== (effectiveSelected.nameField || 'first_name').toLowerCase(); })
                .map(h => {
                  const checked = Array.isArray(effectiveSelected.extras) && effectiveSelected.extras.includes(h);
                  return (
                    <label key={h} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleExtra(h)} />
                      <span>{h}</span>
                    </label>
                  );
                })}
              <span style={{ color: '#666' }}></span>
            </div>
          </div>
          <div className="print-label" ref={exportRef}>
              <div className={`chart-container template-${selectedTemplate}`} id="orgChart" ref={chartContainerRef}></div>
          </div>        
        </div>
      </div>
    </>
  );
}
export default OrgChartView;