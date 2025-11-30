import { useTranslation } from 'react-i18next';
import Button from '../Button';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => { 
    i18n.changeLanguage(lng);
  };

  return (
    <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: '5px', zIndex: 1000 }}>
      {/* Botões para trocar o idioma entre Português e Inglês */}
      <Button onClick={() => changeLanguage('pt')} style={{ padding: '8px 12px', fontSize: '14px', backgroundColor: i18n.language.startsWith('pt') ? '#2E7D32' : '#4CAF50' }}>
        PT
      </Button>
      <Button onClick={() => changeLanguage('en')} style={{ padding: '8px 12px', fontSize: '14px', backgroundColor: i18n.language.startsWith('en') ? '#2E7D32' : '#4CAF50' }}>
        EN
      </Button>
    </div>
  );
};

export default LanguageSwitcher;