<template>
  <div class="test-report card">
    <h2>测试报告图表</h2>
    <div class="chart-container">
      <canvas ref="myChart"></canvas>
    </div>
  </div>
</template>

<script>
import Chart from 'chart.js/auto';

export default {
  name: 'TestReport',
  data() {
    return {
      chart: null
    }
  },
  mounted() {
    this.createChart();
  },
  methods: {
    createChart() {
      const ctx = this.$refs.myChart.getContext('2d');
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['网元A', '网元B', '网元C', '网元D', '网元E'],
          datasets: [{
            label: '测试通过率',
            data: [95, 88, 92, 97, 85],
            backgroundColor: [
              'rgba(75, 192, 192, 0.6)',
              'rgba(255, 159, 64, 0.6)',
              'rgba(255, 205, 86, 0.6)',
              'rgba(54, 162, 235, 0.6)',
              'rgba(153, 102, 255, 0.6)'
            ],
            borderColor: [
              'rgb(75, 192, 192)',
              'rgb(255, 159, 64)',
              'rgb(255, 205, 86)',
              'rgb(54, 162, 235)',
              'rgb(153, 102, 255)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 100
            }
          }
        }
      });
    }
  }
}
</script>

<style scoped>
.chart-container {
  height: 400px;
}
</style>