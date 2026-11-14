import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { FoodProvider } from './context/FoodContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FoodProvider>
          <App />
          <Toaster position="top-right" richColors closeButton />
        </FoodProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
