// --- 月初を1回だけ赤線で描画する helper ---
function createMonthlyChart(canvasId, labels, data) {
  return new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { labels, datasets: [{ data, borderWidth: 2, tension: 0.2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: {
            color: function(ctx) {
              // 月初かどうかチェック
              const label = ctx.tick.label; // YYYY-MM-DD
              if (!label) return 'rgba(200,200,200,0.2)';
              
              // drawnDays はこの chart ごとに初期化
              if (!this.drawnDays) this.drawnDays = new Set();
              
              const day = Number(label.slice(8, 10));
              if (day === 1 && !this.drawnDays.has(label)) {
                this.drawnDays.add(label);
                return 'rgba(255,0,0,0.8)';
              }
              return 'rgba(200,200,200,0.2)';
            },
            lineWidth: function(ctx) {
              const label = ctx.tick.label;
              if (!label) return 1;
              if (!this.drawnDays) this.drawnDays = new Set();
              const day = Number(label.slice(8, 10));
              return (day === 1 && !this.drawnDays.has(label)) ? 2 : 1;
            }
          }
        }
      }
    }
  });
}
