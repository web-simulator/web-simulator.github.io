
import { useState } from 'react';
import HomePage from './containers/HomePage';
import SingleStimulusPage from './containers/SingleStimulusPage';
import MultipleStimuliPage from './containers/MultipleStimuliPage';
import BCLSeriesPage from './containers/BCLSeriesPage';

import './index.css';

function App() {
  const [page, setPage] = useState('home'); // Controla qual página está sendo exibida

  // Função para mudar de página
  const navigateTo = (pageName) => {
    setPage(pageName);
  };

  const renderPage = () => {
    switch (page) {
      case 'single_stimulus':
        // Renderiza a página de estímulo único
        return <SingleStimulusPage onBack={() => navigateTo('home')} />; // função de retorno a página inicial
      case 'multiple_stimuli':
        // Múltiplos estímulos
        return <MultipleStimuliPage onBack={() => navigateTo('home')} />;
      case 'bcl_series':
        // BCL decrescente
        return <BCLSeriesPage onBack={() => navigateTo('home')} />;
      default:
        return <HomePage onNavigate={navigateTo} />; // Renderiza a página inicial
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