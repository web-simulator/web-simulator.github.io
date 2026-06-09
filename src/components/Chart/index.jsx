import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

const LINE_COLORS = ['#059669', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];

const Chart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const keysInfo = useMemo(() => {
    const keys = new Set();
    
    data.forEach(d => {
      if (d) Object.keys(d).forEach(k => keys.add(k));
    });
    
    const allKeys = Array.from(keys);
    const xKey = allKeys.includes('tempo') ? 'tempo' : (allKeys.includes('time') ? 'time' : allKeys[0]);
    const dataKeys = allKeys.filter(key => key !== 'tempo' && key !== 'time');
    
    return { xKey, dataKeys };
  }, [data]);

  const { xKey, dataKeys } = keysInfo;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        
        <XAxis 
          dataKey={xKey} 
          stroke="#94a3b8" 
          fontSize={11} 
          tickLine={false}
        />
        
        <YAxis 
          stroke="#94a3b8" 
          fontSize={11} 
          tickLine={false}
          domain={['auto', 'auto']}
        />
        
        <Tooltip 
          contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
          labelStyle={{ fontWeight: 'bold', color: '#334155' }}
          formatter={(value) => {
            if (Math.abs(value) < 0.01 && value !== 0) {
              return Number(value).toExponential(2);
            }
            return Number(value).toFixed(2);
          }}
        />
        
        <Legend verticalAlign="top" height={36} iconType="circle" />
        
        {dataKeys.map((key, index) => {
          const isStimulus = key.toLowerCase().includes('estimulo') || key.toLowerCase().includes('stim');
          
          return (
            <Line
              key={key}
              type={isStimulus ? 'step' : 'monotone'}
              dataKey={key}
              stroke={LINE_COLORS[index % LINE_COLORS.length]}
              dot={false}
              strokeWidth={isStimulus ? 1.5 : 2}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          );
        })}
        
        <Brush 
          dataKey={xKey} 
          height={30} 
          stroke="#10b981" 
          fill="#f8fafc" 
          travellerWidth={10}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default Chart;