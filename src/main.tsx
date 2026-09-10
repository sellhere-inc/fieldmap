import { StrictMode } from 'react';
import { IconContext } from '@phosphor-icons/react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles.css';
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconContext.Provider value={{ weight: 'bold' }}>
      <App />
    </IconContext.Provider>
  </StrictMode>
);
