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

        {/* Simulação com n estímulos e BCL fixo */}
        <Button onClick={() => onNavigate('multiple_stimuli')}>
          Modelo Mitchell-Schaeffer (8 Estímulos - BCL Fixo)
        </Button>
        {/* Protocolo S1-S2 */}
        <Button onClick={() => onNavigate('s1_s2')}>
          Protocolo S1-S2
        </Button>
        {/* Curva de Restituição */}
        <Button onClick={() => onNavigate('restitution_curve')}>
          Curva de Restituição
        </Button>
        {/* Curva de Restituição MMS */}
        <Button onClick={() => onNavigate('mms_restitution_curve')}>
          Curva de Restituição (MMS)
        </Button>
        {/* Curva de Restituição sem gráfico de estimulos */}
        <Button onClick={() => onNavigate('mms_alternative_restitution_curve')}>
          Curva de Restituição (MMS - Gráfico Direto)
        </Button>
        {/* Protocolo Dinâmico */}
        <Button onClick={() => onNavigate('dynamic_protocol')}>
          Protocolo Dinâmico
        </Button>
      </div>
    </div>
  );
};

export default HomePage;