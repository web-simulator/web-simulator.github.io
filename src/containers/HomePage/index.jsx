// src/containers/HomePage/index.jsx
import Button from '../../components/Button';
import './styles.css';

const HomePage = ({ onNavigate }) => {
  return (
    <div className="homepage-container">
      <h1>Simulador de Eletrofisiologia Cardíaca</h1>
      <div className="options-container">
        <Button onClick={() => onNavigate('single_stimulus')}>
          Modelo Mitchell-Schaeffer (1 Estímulo)
        </Button>
        <Button onClick={() => onNavigate('multiple_stimuli')}>
          Modelo Mitchell-Schaeffer (8 Estímulos - BCL Fixo)
        </Button>
      </div>
    </div>
  );
};

export default HomePage;