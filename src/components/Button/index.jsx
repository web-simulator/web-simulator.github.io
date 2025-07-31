import './styles.css';
//Componente de botão 
const Button = ({ children, onClick, disabled }) => {
  return (
    <button className="custom-button" onClick={onClick} disabled={disabled}>
      {children} {/* Renderiza o conteúdo do botão*/}
    </button>
  );
};

export default Button;