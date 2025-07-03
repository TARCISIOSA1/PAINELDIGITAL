import React from "react";

export default function Header({ legislaturaDesc, sessaoDesc }) {
  return (
    <header className="bg-blue-900 text-white flex items-center p-4 fixed top-0 left-0 right-0 z-50 shadow-md">
      <img
        src="/logo.jpg"
        alt="Logo Câmara"
        className="w-14 h-14 object-contain mr-4"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "https://via.placeholder.com/56x56?text=Logo";
        }}
      />
      <div>
        <h1 className="text-xl font-bold">Câmara Municipal de Santa Maria</h1>
        <p className="text-sm">
          {sessaoDesc} — {legislaturaDesc}
        </p>
      </div>
    </header>
  );
}
