import Button from '../../components/Button';
import './styles.css';

// Componente principal da página inicial
const HomePage = ({ onNavigate }) => {
  return (
    // Div principal da página inicial
    <div className="homepage-container">
      {/* Título principal*/}
      <h1>Simulador de Eletrofisiologia Cardíaca</h1>

      {/* Botões de opções de simulação */}
      <div className="options-container">
        
        {/*Simulação com um único estímulo */}
        <Button onClick={() => onNavigate('single_stimulus')}>
          Modelo Mitchell-Schaeffer (1 Estímulo)
        </Button>

        {/* Simulação com 8 estímulos e BCL fixo */}
        <Button onClick={() => onNavigate('multiple_stimuli')}>
          Modelo Mitchell-Schaeffer (8 Estímulos - BCL Fixo)
        </Button>

        {/* Série de simulações com BCL decrescente */}
        <Button onClick={() => onNavigate('bcl_series')}>
          Série de Simulações com BCL Decrescente
        </Button>
      </div>
    </div>
  );
};

export default HomePage;
