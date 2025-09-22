import './styles.css';

//Componente de botão 
const Button = ({ children, onClick, disabled, className }) => {
  return (
    <button className={`custom-button ${className}`} onClick={onClick} disabled={disabled}>
      {children} {/* Renderiza o conteúdo do botão*/}
    </button>
  );
};

export default Button;