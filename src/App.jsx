// src/App.jsx
import { useState } from 'react';
import HomePage from './containers/HomePage';
import SingleStimulusPage from './containers/SingleStimulusPage';
import MultipleStimuliPage from './containers/MultipleStimuliPage';
import './index.css';

function App() {
  const [page, setPage] = useState('home');

  const navigateTo = (pageName) => {
    setPage(pageName);
  };

  const renderPage = () => {
    switch (page) {
      case 'single_stimulus':
        return <SingleStimulusPage onBack={() => navigateTo('home')} />;
      case 'multiple_stimuli':
        return <MultipleStimuliPage onBack={() => navigateTo('home')} />;
      default:
        return <HomePage onNavigate={navigateTo} />;
    }
  };

  return (
    <div>
      {renderPage()}
    </div>
  );
}

export default App;