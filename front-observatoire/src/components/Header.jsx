import React, { useState, useEffect } from 'react';
import './Header.css'; // On créera ce fichier juste après

const Header = ({ isDarkMode, setIsDarkMode }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Mise à jour de l'horloge chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Optionnel : Basculer une classe sur le document body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }, [isDarkMode]);

  return (
    <header className="header-container">
      <div className="header-left">
        <span className="brand">VeloControl</span>
        <span className="location">Lyon / Station Monitor</span>
      </div>
      <div className="header-right">
        <div 
          className={`theme-toggle-switch ${isDarkMode ? 'dark' : 'light'}`}
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          {/* Sun icon on the left (background) */}
          <div className="switch-icon-bg sun">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          </div>
          
          {/* Moon icon on the right (background) */}
          <div className="switch-icon-bg moon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </div>

          {/* Sliding thumb containing active state icon */}
          <div className="switch-thumb">
            {isDarkMode ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
          </div>
        </div>
        <span className="clock">CLOCK: {time}</span>
        <button className="export-btn">Export Snapshot</button>
      </div>
    </header>
  );
};

export default Header;