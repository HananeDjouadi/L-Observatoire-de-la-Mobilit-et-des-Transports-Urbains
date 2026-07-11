import React, { useState, useEffect } from 'react';
import './Header.css'; // On créera ce fichier juste après

const Header = () => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Mise à jour de l'horloge chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="header-container">
      <div className="header-left">
        <span className="brand">VeloControl</span>
        <span className="location">Lyon / Station Monitor</span>
      </div>
      <div className="header-right">
        <span className="clock">CLOCK: {time}</span>
        <button className="export-btn">Export Snapshot</button>
      </div>
    </header>
  );
};

export default Header;