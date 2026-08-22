
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Agentation } from 'agentation';
import { AISSH } from './components/AISSH';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AISSH />
    {import.meta.env.DEV && <Agentation />}
  </React.StrictMode>
);
