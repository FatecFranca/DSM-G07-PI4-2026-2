import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider, CarrinhoProvider } from './contextos.jsx';
import './estilos.css';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <AuthProvider>
      <CarrinhoProvider>
        <App />
      </CarrinhoProvider>
    </AuthProvider>
  </StrictMode>,
);
