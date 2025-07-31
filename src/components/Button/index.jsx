import './styles.css';

const Button = ({ children, onClick, disabled }) => {
  return (
    <button className="custom-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

export default Button;