import React, { useState } from "react";
import FileUploader from "./components/FileUploader";
import OrgChartView from "./components/OrgChartView";
import Popup from "./components/Popup";
import "./index.css";
function App() {
   const [originalData, setOriginalData] = useState([]);
   const [displayData, setDisplayData] = useState([]);
   const [headers, setHeaders] = useState([]);
   const [selectedFields, setSelectedFields] = useState({ nameField: 'First_Name', titleField: 'Designation', extras: [] });
   const [department, setDepartment] = useState('');
   const [selectedEmployee, setSelectedEmployee] = useState(null);
   const handleBackToUpload = () => {
      setDisplayData([]);    // ✅ clears chart data
      setOriginalData([]);   // optional, clears uploaded dataset
      setSelectedEmployee(null);
   };
   const handleUpdateEmployeePhoto = (id, dataUrl) => {
      setOriginalData(prev => prev.map(r => String(r.ID) === String(id) ? { ...r, Photo: dataUrl } : r));
      setDisplayData(prev => prev.map(r => String(r.ID) === String(id) ? { ...r, Photo: dataUrl } : r));
      setSelectedEmployee(prev => (prev && String(prev.ID) === String(id)) ? { ...prev, Photo: dataUrl } : prev);
   };
   return (
      <div className="App">
         {displayData.length === 0 ? (
            <FileUploader
               setOriginalData={setOriginalData}
               setDisplayData={setDisplayData}
               setHeaders={setHeaders}
               setDepartment={setDepartment}
            />
         ) : (
            <OrgChartView
               data={displayData}
               originalData={originalData}
               setDisplayData={setDisplayData}
               setSelectedEmployee={setSelectedEmployee}
               onBackToUpload={handleBackToUpload}    // ✅ Back button works
               headers={headers}
               selectedFields={selectedFields}
               setSelectedFields={setSelectedFields}
               department={department}
            />
         )}
         {selectedEmployee && (
            <Popup
               employee={selectedEmployee}
               data={displayData}
               onClose={() => setSelectedEmployee(null)}
               onUpdateEmployeePhoto={handleUpdateEmployeePhoto}
            />
         )}
      </div>
   );
}
export default App;