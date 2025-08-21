import React from "react";
function Controls({ searchQuery, setSearchQuery, onRefresh, onBack, onPrint, onExportImage, templates = [], onSelectTemplate, selectedTemplate }) {
   return (
      <div className="top-bar">    {/* was controls */}
         {/* Template selection buttons */}
         {templates && templates.length > 0 && (
            <div className="template-controls">
               {templates.map(t => (
                  <button
                     key={t.key}
                     className={`template-btn ${selectedTemplate === t.key ? 'active' : ''}`}
                     onClick={() => onSelectTemplate && onSelectTemplate(t.key)}
                     title={`Use ${t.label} template`}
                  >{t.label}</button>
               ))}
            </div>
         )}
         <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Name..."
         />
         <button className="refresh" onClick={onRefresh}>Refresh</button>
         <button className="back" onClick={onBack}>Back</button>
         <button className="print" onClick={onPrint}>Print</button>
         {/* <button className="export-pdf" onClick={onExportPDF}>Export PDF</button> */}
         <button className="export-img" onClick={onExportImage}>Export Image</button>

      </div>
   );
}
export default Controls;