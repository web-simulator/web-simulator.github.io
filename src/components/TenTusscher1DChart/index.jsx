import { memo } from 'react';
import { Line } from 'react-chartjs-2';
import { t } from 'i18next';
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

const TenTusscher1DChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>{t('common.simulating', 'Simulando...')}</p>;
  }

  const chartData = {
    labels: data.map(d => d.x.toFixed(2)),
    datasets: [
      {
        label: t('chart.potential_unit', 'Potencial (mV)'),
        data: data.map(d => d.v),
        borderColor: 'rgb(136, 132, 216)',
        backgroundColor: 'rgba(220, 38, 38, 0.5)',
        pointRadius: 0,
        tension: 0.1,
      }
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
        text: t('common.tentusscher_model', 'Ten Tusscher - 1D'),
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: t('chart.position_unit', 'Posição (mm)'),
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
          text: t('chart.potential_unit', 'Potencial (mV)'),
        },
        min: -95.0,
        max: 50.0,
      },
    },
  };

  return <Line options={options} data={chartData} />;
};

export default memo(TenTusscher1DChart);
