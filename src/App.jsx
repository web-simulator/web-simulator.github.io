import { useState } from 'react';
import HomePage from './containers/HomePage';
import SingleStimulusPage from './containers/SingleStimulusPage';
import MultipleStimuliPage from './containers/MultipleStimuliPage';
import S1S2Page from './containers/S1S2Page';
import RestitutionCurvePage from './containers/RestitutionCurvePage';
import BistablePage from './containers/BistablePage';
import FitzHughNagumoPage from './containers/FitzHughNagumoPage';
import MitchellSchaeffer1DPage from './containers/MitchellSchaeffer1DPage';
import Model2DPage from './containers/Model2DPage';
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
      case 'bistable': 
        // Protocolo Bistable
        return <BistablePage onBack={() => navigateTo('home')} />;
      case 'fhn': 
        // FitzHughNagumo
        return <FitzHughNagumoPage onBack={() => navigateTo('home')} />;
      case 'ms_1d':
        // Mitchell-Schaeffer 1D
        return <MitchellSchaeffer1DPage onBack={() => navigateTo('home')} />;
      case 'model_2d':
        // Modelo 2D
        return <Model2DPage onBack={() => navigateTo('home')} />;
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