import React, { useEffect, useRef, memo, useState } from 'react';
import './styles.css';
import { useTranslation } from 'react-i18next';

const vsSource = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    // In WebGL, textures are usually flipped vertically compared to canvas 2D
    // so we flip the Y coordinate to match the previous Canvas2D behaviour
    v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}
`;

const fsSource = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_data;
uniform sampler2D u_fibrosis;
uniform float u_max_value;
uniform float u_fib_conductivity;
uniform bool u_has_fibrosis;
out vec4 outColor;

vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

void main() {
    // texture lookups
    float val = texture(u_data, v_texCoord).r;
    float fib = texture(u_fibrosis, v_texCoord).r;

    // Check for fibrosis
    if (u_has_fibrosis && abs(fib - u_fib_conductivity) < 1e-9 && u_fib_conductivity < 1e-9) {
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    if (val < 0.0) {
        // Not activated
        outColor = vec4(40.0/255.0, 40.0/255.0, 40.0/255.0, 1.0);
        return;
    }

    float norm = 0.0;
    if (u_max_value > 0.0) {
        norm = clamp(val / u_max_value, 0.0, 1.0);
    }
    
    float hue = (1.0 - norm) * 240.0 / 360.0;
    vec3 rgb = hsl2rgb(vec3(hue, 1.0, 0.5));
    outColor = vec4(rgb, 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const HeatmapChart = ({ data, nCols, maxValue = 1, onPointClick, fibrosisMap, fibrosisConductivity, unit = 'V', tooltipLabel }) => {
  const canvasRef = useRef(null);
  const { t } = useTranslation();
  const glRef = useRef(null);
  
  const [tooltip, setTooltip] = useState({
    visible: false, x: 0, y: 0, value: 0, isValid: true
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) {
        console.error("WebGL2 is not supported");
        return;
    }
    
    gl.getExtension("EXT_color_buffer_float");
    
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0
    ]), gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    // V flip handled in vertex shader so we pass standard coords
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0
    ]), gl.STATIC_DRAW);
    
    const dataTexture = gl.createTexture();
    const fibrosisTexture = gl.createTexture();
    
    glRef.current = {
        gl, program, positionBuffer, texCoordBuffer, dataTexture, fibrosisTexture,
        fibUploaded: false, prevFibMap: null
    };

    return () => {
        gl.deleteProgram(program);
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(texCoordBuffer);
        gl.deleteTexture(dataTexture);
        gl.deleteTexture(fibrosisTexture);
    };
  }, []);

  useEffect(() => {
    if (!data || !nCols || !glRef.current) return;
    
    const { gl, program, positionBuffer, texCoordBuffer, dataTexture, fibrosisTexture } = glRef.current;
    
    const nRows = Math.ceil(data.length / nCols);
    if (canvasRef.current.width !== nCols || canvasRef.current.height !== nRows) {
        canvasRef.current.width = nCols;
        canvasRef.current.height = nRows;
        gl.viewport(0, 0, nCols, nRows);
        glRef.current.fibUploaded = false;
    }
    
    gl.useProgram(program);
    
    const uMaxVal = gl.getUniformLocation(program, "u_max_value");
    gl.uniform1f(uMaxVal, maxValue);
    
    const uHasFib = gl.getUniformLocation(program, "u_has_fibrosis");
    const uFibCond = gl.getUniformLocation(program, "u_fib_conductivity");
    
    if (fibrosisMap) {
        gl.uniform1i(uHasFib, 1);
        gl.uniform1f(uFibCond, fibrosisConductivity);
        
        if (!glRef.current.fibUploaded || glRef.current.prevFibMap !== fibrosisMap) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, fibrosisTexture);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nCols, nRows, 0, gl.RED, gl.FLOAT, fibrosisMap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            glRef.current.fibUploaded = true;
            glRef.current.prevFibMap = fibrosisMap;
        }
    } else {
        gl.uniform1i(uHasFib, 0);
    }
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dataTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nCols, nRows, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    gl.uniform1i(gl.getUniformLocation(program, "u_data"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_fibrosis"), 1);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    
    const texLoc = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
  }, [data, nCols, maxValue, fibrosisMap, fibrosisConductivity]);

  // Tooltip
  const handleMouseMove = (event) => {
    if (!data || data.length === 0 || !nCols) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX; 
    const y = (event.clientY - rect.top) * scaleY; 
    const j = Math.floor(x);
    const i = Math.floor(y);
    const index = i * nCols + j;
    if (index >= 0 && index < data.length) {
      const value = data[index];
      const isValid = !isNaN(value) && value >= 0;
      const displayValue = isValid ? value.toFixed(2) : '-';

      setTooltip({
        visible: true, x: event.clientX + 15, y: event.clientY, value: displayValue, isValid: isValid
      });
    } else {
      // Mouse fora dos limites
      handleMouseLeave();
    }
  };

  // Esconde o tooltip
  const handleMouseLeave = () => {
    setTooltip({ ...tooltip, visible: false });
  };
  
  // Abre o modal ao clicar no gráfico
  const handleCanvasClick = (event) => {
    if (!data || !onPointClick || !nCols) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // Calcula qual foi clicada
    const j = Math.floor(x);
    const i = Math.floor(y);
    const index = i * nCols + j;

    if (index >= 0 && index < data.length) {
      onPointClick({ i, j });
    }
  };

 // Estrutura do gráfico
  return (
    <div className="heatmap-container" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }} 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave} 
        onClick={handleCanvasClick} 
      ></canvas>

      {/* Mostra o tooltip de acordo com a unidade passada */}
      {tooltip.visible && (
        <div className="heatmap-tooltip" style={{ top: `${tooltip.y}px`, left: `${tooltip.x}px` }}>
          {tooltipLabel || t('chart.tooltip')} {tooltip.value} {tooltip.isValid ? unit : ''}
        </div>
      )}
    </div>
  );
};

export default memo(HeatmapChart);