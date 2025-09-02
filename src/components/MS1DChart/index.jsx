import { memo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const MS1DChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>Aguardando simulação...</p>;
  }

  const chartData = {
    labels: data.map(d => d.x.toFixed(2)),
    datasets: [
      {
        label: 'Potencial v',
        data: data.map(d => d.v),
        borderColor: 'rgb(136, 132, 216)',
        backgroundColor: 'rgba(136, 132, 216, 0.5)',
        pointRadius: 0,
        tension: 0.1,
      },
      {
        label: 'Variável h',
        data: data.map(d => d.h),
        borderColor: 'rgb(130, 202, 157)',
        backgroundColor: 'rgba(130, 202, 157, 0.5)',
        pointRadius: 0,
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    animation: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Modelo Mitchell-Schaeffer 1D',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Posição (x)',
        },
        type: 'category',
        ticks: {
          autoSkip: true,
          maxTicksLimit: 10,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Valor',
        },
        min: -0.9,
        max: 1.2,
      },
    },
  };

  return <Line options={options} data={chartData} />;
};

export default memo(MS1DChart);