import Button from '../../components/Button';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

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
    },
    { // Source-Sink Mismatch
      id: 'source_sink',
      title: 'home.models.source_sink.title',
      description: 'home.models.source_sink.desc',
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
      <LanguageSwitcher />
      
      {/* parte de cima */}
      <header className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-16 px-4 shadow-lg mb-10">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">
            {t('home.title')}
          </h1>
          <p className="text-base md:text-xl text-emerald-100 max-w-2xl mx-auto font-light">
            Explore modelos matemáticos avançados de eletrofisiologia cardíaca em um ambiente interativo.
          </p>
        </div>
      </header>
      
      {/* Conteúdo principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {Object.keys(modelsByCategory).map(categoryKey => (
          <section key={categoryKey} className="animate-fade-in-up">
            <div className="flex items-center mb-6 border-b border-slate-200 pb-2">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 uppercase tracking-wide">
                {t(categoryKey)}
              </h2>
              <div className="ml-4 h-1 flex-grow bg-gradient-to-r from-emerald-500 to-transparent rounded-full opacity-30"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modelsByCategory[categoryKey].map(model => (
                <div 
                  key={model.id} 
                  className="bg-white rounded-xl shadow hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col group h-full"
                >
                  <div className="p-6 flex-grow flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                        <i class="bi bi-lightning-charge"></i>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-emerald-700 transition-colors">
                      {t(model.title)}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-grow">
                      {t(model.description)}
                    </p>
                    
                    <div className="mt-auto pt-4 border-t border-slate-50 w-full">
                      <Button 
                        onClick={() => onNavigate(model.id)} 
                        className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium py-2 rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2"
                      >
                        {t('home.btn_start')}
                        <i class="bi bi-arrow-right"></i>
                      </Button>
                    </div>
                  </div>
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