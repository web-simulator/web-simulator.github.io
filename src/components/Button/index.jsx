import './styles.css';

const Button = ({ children, onClick, disabled, className = '', style }) => {
  const isTailwind = className.includes('bg-');
  
  return (
    <button 
      className={`${isTailwind ? '' : 'custom-button'} ${className}`} 
      onClick={onClick} 
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
};

export default Button;