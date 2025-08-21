import React, { useRef } from "react";

function Popup({ employee, data, onClose, onUpdateEmployeePhoto }) {
    const manager = data.find(r => String(r.ID) === String(employee["Parent ID"]));
    const fileInputRef = useRef(null);

    const handleClickUpload = (e) => {
       e.stopPropagation();
       if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
       const f = e.target.files && e.target.files[0];
       if (!f) return;
       const reader = new FileReader();
       reader.onload = () => {
          const dataUrl = reader.result;
          if (typeof onUpdateEmployeePhoto === 'function') onUpdateEmployeePhoto(employee.ID, dataUrl);
       };
       reader.readAsDataURL(f);
    };

    return (
         <div className="popup" onClick={onClose}>
             <div className="popup-content" onClick={e => e.stopPropagation()}>
                  <span className="close" onClick={onClose}>&times;</span>
                  {/* top-right plus icon to upload/replace photo */}
                  <button className="photo-plus" onClick={handleClickUpload} title="Upload / Replace photo">+</button>
                  <div style={{ position: 'relative', paddingTop: 8 }}>
                     {employee.Photo ? (
                        <img src={employee.Photo} alt={employee.First_Name} className="emp-photo" />
                     ) : (
                        <div className="emp-photo-placeholder" aria-hidden="true"></div>
                     )}
                     {/* hidden file input for upload */}
                     <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                  </div>
                  <div className="popup-field"><strong>ID:</strong> {employee.ID}</div>
                  <div className="popup-field"><strong>Name:</strong> {employee.First_Name}</div>
                  <div className="popup-field"><strong>Designation:</strong> {employee.Designation}</div>
                  <div className="popup-field"><strong>Manager:</strong> {manager ? manager.First_Name : "None"}</div>
                  <div className="popup-field"><strong>Department:</strong> {employee.Department || ""}</div>
             </div>
         </div>
    );
}

export default Popup;
