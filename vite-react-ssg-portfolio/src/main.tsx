// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.tsx'

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )



// src/main.tsx
import './index.css'
import { ViteReactSSG } from 'vite-react-ssg/single-page'
import App from './App.tsx'

export const createRoot = ViteReactSSG(<App />)
