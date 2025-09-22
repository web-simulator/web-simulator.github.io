import Button from '../../components/Button';
import './styles.css';

// Componente principal da página inicial
const HomePage = ({ onNavigate }) => {
  const models = [
    { 
      id: 'single_stimulus', 
      title: 'Mitchell-Schaeffer (1 Estímulo)', 
      description: 'Simula a resposta de um único estímulo elétrico em uma célula cardíaca.',
      category: 'Modelos 0D' 
    },
    { 
      id: 'multiple_stimuli', 
      title: 'Mitchell-Schaeffer (8 Estímulos)', 
      description: 'Observa a resposta celular a uma série de estímulos com intervalo fixo.',
      category: 'Modelos 0D' 
    },
    { 
      id: 's1_s2', 
      title: 'Protocolo S1-S2', 
      description: 'Protocolo padrão para investigar a refratariedade e a vulnerabilidade do tecido cardíaco.',
      category: 'Modelos 0D' 
    },
    { 
      id: 'restitution_curve', 
      title: 'Curva de Restituição', 
      description: 'Analisa a relação entre o intervalo de acoplamento e a duração do potencial de ação.',
      category: 'Modelos 0D' 
    },
    { 
      id: 'mms_restitution_curve', 
      title: 'Curva de Restituição (MMS)', 
      description: 'Gera a curva de restituição usando o modelo de Mitchell-Schaeffer modificado.',
      category: 'Modelos 0D' 
    },
    { 
      id: 'dynamic_protocol', 
      title: 'Protocolo Dinâmico', 
      description: 'Um protocolo de estimulação que se adapta dinamicamente para mapear a restituição.',
      category: 'Modelos 0D' 
    },
    { 
      id: 'bistable', 
      title: 'Bistable 1D', 
      description: 'Um modelo unidimensional que exibe comportamento biestável.',
      category: 'Modelos 1D' 
    },
    { 
      id: 'fhn', 
      title: 'Modelo FitzHugh-Nagumo 1D', 
      description: 'Um modelo simplificado da excitabilidade neuronal e cardíaca em uma dimensão.',
      category: 'Modelos 1D' 
    },
    { 
      id: 'ms_1d', 
      title: 'Modelo Mitchell-Schaeffer 1D', 
      description: 'O modelo de Mitchell-Schaeffer estendido para uma dimensão espacial.',
      category: 'Modelos 1D' 
    }
  ];

  const modelsByCategory = models.reduce((acc, model) => {
    if (!acc[model.category]) {
      acc[model.category] = [];
    }
    acc[model.category].push(model);
    return acc;
  }, {});

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