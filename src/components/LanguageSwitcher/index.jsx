import { useTranslation } from 'react-i18next';
import Button from '../Button';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => { 
    i18n.changeLanguage(lng);
  };

  const isPt = i18n.language.startsWith('pt');

  return (
    <div className="absolute top-5 right-6 flex items-center gap-3 z-50">
      {/* Botão de Feedback */}
      <a href={isPt ? "https://forms.gle/X7a9MnJTL1E1S7ZY6" : "https://forms.gle/mFHo5gaVpZTUhXKx5"} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 no-underline backdrop-blur-sm">
        <i className="bi bi-chat-text text-emerald-800 group-hover:text-emerald-700 transition-colors"></i>
        <span>{isPt ? "Deixe seu feedback" : "Leave your feedback"}</span>
      </a>

      {/* Separador Vertical Sutil */}
      <div className="h-6 w-px bg-slate-300/50 mx-1 hidden sm:block"></div>

      {/* Botões de Idioma */}
      <div className="flex bg-white backdrop-blur-sm rounded-xl p-1 border border-emerald-100 shadow-sm">
        <button onClick={() => changeLanguage('pt')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all duration-200 ${isPt ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}>
          PT
        </button>
        <button onClick={() => changeLanguage('en')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all duration-200 ${!isPt ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}>
          EN
        </button>
      </div>
    </div>
  );
};

export default LanguageSwitcher;