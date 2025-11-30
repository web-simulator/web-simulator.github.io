import Button from '../../components/Button';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import './styles.css';

const HomePage = ({ onNavigate }) => {
  const { t } = useTranslation();

  const models = [
    { // Mitchell-Schaeffer 1 estímulo
      id: 'single_stimulus', 
      title: 'home.models.single_stimulus.title', 
      description: 'home.models.single_stimulus.desc',
      category: 'home.categories.0d' 
    },
    { // Mitchell-Schaeffer 8 estímulos
      id: 'multiple_stimuli', 
      title: 'home.models.multiple_stimuli.title', 
      description: 'home.models.multiple_stimuli.desc',
      category: 'home.categories.0d' 
    },
    { // Protocolo S1-S2
      id: 's1_s2', 
      title: 'home.models.s1_s2.title', 
      description: 'home.models.s1_s2.desc',
      category: 'home.categories.0d' 
    },
    { // Curvas de Restituição
      id: 'restitution_curve', 
      title: 'home.models.restitution_curve.title', 
      description: 'home.models.restitution_curve.desc',
      category: 'home.categories.0d' 
    },
    { // Bistable 1D
      id: 'bistable', 
      title: 'home.models.bistable.title', 
      description: 'home.models.bistable.desc',
      category: 'home.categories.1d' 
    },
    { // FitzHugh-Nagumo 1D
      id: 'fhn', 
      title: 'home.models.fhn.title', 
      description: 'home.models.fhn.desc',
      category: 'home.categories.1d' 
    },
    { // Mitchell-Schaeffer 1D
      id: 'ms_1d', 
      title: 'home.models.ms_1d.title', 
      description: 'home.models.ms_1d.desc',
      category: 'home.categories.1d' 
    },
    { // Modelo 2D
      id: 'model_2d',
      title: 'home.models.model_2d.title',
      description: 'home.models.model_2d.desc',
      category: 'home.categories.2d'
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
      <LanguageSwitcher />
      <header className="homepage-header">
        <h1>{t('home.title')}</h1>
      </header>
      
      <main className="models-sections">
        {Object.keys(modelsByCategory).map(categoryKey => (
          <section key={categoryKey} className="models-section">
            <h2>{t(categoryKey)}</h2>
            <div className="models-grid">
              {modelsByCategory[categoryKey].map(model => (
                <div key={model.id} className="model-card">
                  <h3>{t(model.title)}</h3>
                  <p>{t(model.description)}</p>
                  <Button onClick={() => onNavigate(model.id)} className="launch-button">
                    {t('home.btn_start')}
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