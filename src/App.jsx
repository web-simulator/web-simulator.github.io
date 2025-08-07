import { useState } from 'react';
import HomePage from './containers/HomePage';
import SingleStimulusPage from './containers/SingleStimulusPage';
import MultipleStimuliPage from './containers/MultipleStimuliPage';
import S1S2Page from './containers/S1S2Page';
import RestitutionCurvePage from './containers/RestitutionCurvePage';
import MMSCurvePage from './containers/MMSCurvePage';
import './index.css';

function App() {
  const [page, setPage] = useState('home');

  // Função para mudar de página
  const navigateTo = (pageName) => {
    setPage(pageName);
  };

  const renderPage = () => {
    switch (page) {
      case 'single_stimulus':
        // Renderiza a página de estímulo único
        return <SingleStimulusPage onBack={() => navigateTo('home')} />;
      case 'multiple_stimuli':
        // Múltiplos estímulos
        return <MultipleStimuliPage onBack={() => navigateTo('home')} />;
      case 's1_s2':
        // Padrão S1-S2
        return <S1S2Page onBack={() => navigateTo('home')} />;
      case 'restitution_curve':
        // Curva de Restituição
        return <RestitutionCurvePage onBack={() => navigateTo('home')} />;
      case 'mms_restitution_curve':
        // Curva de Restituição (MMS)
        return <MMSCurvePage onBack={() => navigateTo('home')} />;
      default:
        return <HomePage onNavigate={navigateTo} />;
    }
  };
  // estrutura da página
  return (
    <div>
      {renderPage()}
    </div>
  );
}

export default App;