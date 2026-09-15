import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import StartupManager from './components/startup/StartupManager.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        {/* StartupManager never touches the URL, so whatever route the user
            landed on (including a teacher's /submit-result/<token> link) is
            preserved and rendered as soon as the backend responds. */}
        <StartupManager>
          <AuthProvider>
            <App />
          </AuthProvider>
        </StartupManager>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
