import React from 'react'
import ReactDOM from 'react-dom/client'
import OptionsApp from './options/OptionsApp'
import './styles.css'
import './options/options.css'

ReactDOM.createRoot(document.getElementById('options-root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
)
