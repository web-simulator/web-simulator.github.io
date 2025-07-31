import './styles.css';

const Input = ({ label, value, onChange }) => {
  return (
    <div className="input-container">
      <label>{label}</label>
      <input type="number" value={value} onChange={onChange} />
    </div>
  );
};

export default Input;