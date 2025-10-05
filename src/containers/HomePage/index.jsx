import Button from '../../components/Button';
import './styles.css';

const HomePage = ({ onNavigate }) => {
  const models = [
    { // Mitchell-Schaeffer 1 estímulo
      id: 'single_stimulus', 
      title: 'Mitchell-Schaeffer (1 Estímulo)', 
      description: 'Simula a resposta de um único estímulo elétrico em uma célula cardíaca.',
      category: 'Modelos 0D' 
    },
    { // Mitchell-Schaeffer 8 estímulos
      id: 'multiple_stimuli', 
      title: 'Mitchell-Schaeffer (8 Estímulos)', 
      description: 'Observa a resposta celular a uma série de estímulos com intervalo fixo.',
      category: 'Modelos 0D' 
    },
    { // Protocolo S1-S2
      id: 's1_s2', 
      title: 'Protocolo S1-S2', 
      description: 'Protocolo padrão para investigar a refratariedade e a vulnerabilidade do tecido cardíaco.',
      category: 'Modelos 0D' 
    },
    { // Curvas de Restituição
      id: 'restitution_curve', 
      title: 'Curva de Restituição', 
      description: 'Analisa a relação entre o intervalo de acoplamento e a duração do potencial de ação, utilizando diferentes protocolos.',
      category: 'Modelos 0D' 
    },
    { // Bistable 1D
      id: 'bistable', 
      title: 'Bistable', 
      description: 'Modelo unidimensional que exibe comportamento biestável.',
      category: 'Modelos 1D' 
    },
    { // FitzHugh-Nagumo 1D
      id: 'fhn', 
      title: 'FitzHugh-Nagumo', 
      description: 'Modelo simplificado da excitabilidade cardíaca em uma dimensão.',
      category: 'Modelos 1D' 
    },
    { // Mitchell-Schaeffer 1D
      id: 'ms_1d', 
      title: 'Mitchell-Schaeffer', 
      description: 'Mitchell-Schaeffer estendido para uma dimensão espacial.',
      category: 'Modelos 1D' 
    },
    { // Modelo 2D
      id: 'model_2d',
      title: 'Modelo de Difusão 2D',
      description: 'Um modelo simples de difusão bidimensional.',
      category: 'Modelos 2D'
    }
  ];

  const modelsByCategory = models.reduce((acc, model) => {
    if (!acc[model.category]) {
      acc[model.category] = [];
    }
    acc[model.category].push(model);
    return acc;
  }, {});

  // Renderiza a página inicial com seções para cada categoria de modelo
  return (
    <div className="homepage-container">
      <header className="homepage-header">
        <h1>Simulador de Eletrofisiologia Cardíaca</h1>
      </header>
      
      <main className="models-sections">
        {Object.keys(modelsByCategory).map(category => (
          <section key={category} className="models-section">
            <h2>{category}</h2>
            <div className="models-grid">
              {modelsByCategory[category].map(model => (
                <div key={model.id} className="model-card">
                  <h3>{model.title}</h3>
                  <p>{model.description}</p>
                  <Button onClick={() => onNavigate(model.id)} className="launch-button">
                    Iniciar Simulação
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};

export default HomePage;