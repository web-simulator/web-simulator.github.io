import './styles.css';

const Input = ({ label, value, onChange }) => {
  return (
    // Div que contém o titulo e a entrada
    <div className="input-container">
      {/* Título */}
      <label>{label}</label>
      
      {/* Campo */}
      <input 
        type="number"     // Define que o campo aceita apenas números
        value={value}     // Define o valor atual do input
        onChange={onChange} // Função chamada quando o usuário altera o valor
      />
    </div>
  );
};

export default Input;
