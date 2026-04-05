import React from 'react';
import { createRoot } from 'react-dom/client';
import PdfViewer from './components/PdfViewer';

const App = () => {
  // Demo PDF url for testing purposes
  const samplePdfUrl = "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf";

  return (
    <div>
      <header style={{ padding: '10px', backgroundColor: '#2c3e50', color: 'white' }}>
        <h1>pdfiuh Web Reader</h1>
      </header>
      <main style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
        <PdfViewer fileUrl={samplePdfUrl} />
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('app'));
root.render(<App />);