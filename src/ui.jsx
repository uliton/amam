import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Dialog({ title, children, close, className = "" }) {
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Закрити" onClick={close}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
