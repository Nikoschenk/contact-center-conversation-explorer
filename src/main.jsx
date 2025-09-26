import React from 'react'
import { createRoot } from 'react-dom/client'
import ConversationExplorer from './ConversationExplorer.jsx'

const rootEl = document.getElementById('root')
createRoot(rootEl).render(<ConversationExplorer />)

