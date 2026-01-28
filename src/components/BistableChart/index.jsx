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
import { t } from 'i18next';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const BistableChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>{t('common.simulating')}</p>;
  }

  const chartData = {
    labels: data.map(d => d.x.toFixed(2)),
    datasets: [
      {
        label: t('bistableChart.potential_unit'),
        data: data.map(d => d.v),
        borderColor: 'rgb(136, 132, 216)',
        backgroundColor: 'rgba(136, 132, 216, 0.5)',
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
        text: t('bistableChart.title'),
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: t('bistableChart.position_unit'),
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
          text: t('bistableChart.potential_unit'),
        },
        min: -0.2,
        max: 1.2,
      },
    },
  };

  return <Line options={options} data={chartData} />;
};

export default BistableChart;