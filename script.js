// 入力欄の表示切替
const modeRadios = document.querySelectorAll('input[name="mode"]');
const principalGroup = document.getElementById('principal-group');
const monthlyGroup = document.getElementById('monthly-group');
modeRadios.forEach(radio => {
  radio.addEventListener('change', function() {
    if (this.value === 'toMonthly') {
      principalGroup.style.display = '';
      monthlyGroup.style.display = 'none';
      document.getElementById('principal').required = true;
      document.getElementById('monthly').required = false;
    } else {
      principalGroup.style.display = 'none';
      monthlyGroup.style.display = '';
      document.getElementById('principal').required = false;
      document.getElementById('monthly').required = true;
    }
  });
});

// 繰り上げ返済の表示切替
const extraRepaymentRadios = document.querySelectorAll('input[name="extraRepayment"]');
const extraRepaymentGroup = document.getElementById('extraRepaymentGroup');
const extraAmountGroup = document.getElementById('extraAmountGroup');
const customTimingGroup = document.getElementById('customTimingGroup');
extraRepaymentRadios.forEach(radio => {
  radio.addEventListener('change', function() {
    if (this.value === 'none') {
      extraRepaymentGroup.style.display = 'none';
      extraAmountGroup.style.display = 'none';
      customTimingGroup.style.display = 'none';
    } else if (this.value === 'custom') {
      extraRepaymentGroup.style.display = '';
      extraAmountGroup.style.display = 'none';
      customTimingGroup.style.display = '';
    } else {
      extraRepaymentGroup.style.display = '';
      extraAmountGroup.style.display = '';
      customTimingGroup.style.display = 'none';
    }
  });
});

// 繰り上げ返済タイミング追加UI
if (document.getElementById('addExtra')) {
  document.getElementById('addExtra').onclick = function() {
    const extraList = document.getElementById('extraList');
    const div = document.createElement('div');
    div.className = 'extra-item';
    div.innerHTML = `
      <label>年<input type="number" class="customTiming" min="1" max="30" value="1"></label>
      <label>月<input type="number" class="customTimingMonth" min="1" max="12" value="1"></label>
      <label>金額（円）<input type="number" class="customAmount" value="0"></label>
      <label>方式：
        <select class="customType">
          <option value="shorten">期間短縮型</option>
          <option value="reduce">返済額軽減型</option>
        </select>
      </label>
      <button type="button" class="removeExtra">削除</button>
    `;
    extraList.appendChild(div);
    div.querySelector('.removeExtra').onclick = function() {
      div.remove();
    };
  };
}

// 金利変更タイミング追加UI
if (document.getElementById('addInterest')) {
  document.getElementById('addInterest').onclick = function() {
    const interestList = document.getElementById('interestList');
    const div = document.createElement('div');
    div.className = 'interest-item';
    div.innerHTML = `
      <label>年<input type="number" class="interestTiming" min="1" max="30" value="1"></label>
      <label>月<input type="number" class="interestTimingMonth" min="1" max="12" value="1"></label>
      <label>新金利（年利%）<input type="number" class="interestValue" step="0.001" value=""></label>
      <button type="button" class="removeInterest">削除</button>
    `;
    interestList.appendChild(div);
    div.querySelector('.removeInterest').onclick = function() {
      div.remove();
    };
  };
}

// 計算処理
document.getElementById('loan-form').addEventListener('submit', function(e) {
  e.preventDefault();

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const rate = parseFloat(document.getElementById('rate').value) / 100; // 年利
  const years = parseInt(document.getElementById('years').value, 10);
  const bonus = parseInt(document.getElementById('bonus').value, 10) || 0;
  const repaymentType = document.querySelector('input[name="repaymentType"]:checked').value;
  const extraRepayment = document.querySelector('input[name="extraRepayment"]:checked').value;
  const extraType = document.querySelector('input[name="extraType"]:checked')?.value || 'shorten';
  let customExtras = [];
  if (extraRepayment === 'custom') {
    customExtras = Array.from(document.querySelectorAll('#extraList .extra-item')).map(item => ({
      year: parseInt(item.querySelector('.customTiming').value, 10) || 1,
      month: parseInt(item.querySelector('.customTimingMonth').value, 10) || 1,
      amount: parseInt(item.querySelector('.customAmount').value, 10) || 0,
      type: item.querySelector('.customType')?.value || 'shorten'
    }));
  }
  const extraAmount = parseInt(document.getElementById('extraAmount').value, 10) || 0;
  const monthlyRate = rate / 12;
  const months = years * 12;
  const bonusMonths = [6, 12];

  // 金利変更タイミング取得
  let interestChanges = [];
  interestChanges = Array.from(document.querySelectorAll('#interestList .interest-item')).map(item => ({
    year: parseInt(item.querySelector('.interestTiming').value, 10) || 1,
    month: parseInt(item.querySelector('.interestTimingMonth').value, 10) || 1,
    rate: parseFloat(item.querySelector('.interestValue').value) / 100
  })).filter(e => !isNaN(e.rate) && e.rate > 0);

  let resultHtml = '';

  if (mode === 'toMonthly') {
    const principal = parseInt(document.getElementById('principal').value, 10);
    let monthlyPayment = 0;
    let schedule = [];
    let balance = principal;
    let totalPayment = 0;
    let year = 1;
    let month = 1;
    let monthsLeft = months;

    if (repaymentType === 'annuity') {
      // 元利均等返済
      if (monthlyRate > 0) {
        monthlyPayment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
      } else {
        monthlyPayment = principal / months;
      }
      // --- 任意繰り上げ返済 ---
      if (extraRepayment === 'custom' && customExtras.length > 0) {
        let schedule = [];
        let balance = principal;
        let totalPayment = 0;
        let year = 1;
        let month = 1;
        let remainMonths = months;
        let payment = monthlyPayment; // 最初の返済額
        const sortedExtras = customExtras.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));
        let extraIdx = 0;
        let currentRate = monthlyRate;
        let currentAnnualRate = rate * 100;
        const sortedInterest = interestChanges.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));
        let interestChangeIdx = 0;
        while (remainMonths > 0 && balance > 0) {
          // 金利変更タイミングに到達したら金利・月利を更新し、返済額も再計算
          if (interestChangeIdx < sortedInterest.length && year === sortedInterest[interestChangeIdx].year && month === sortedInterest[interestChangeIdx].month) {
            currentAnnualRate = sortedInterest[interestChangeIdx].rate * 100;
            currentRate = sortedInterest[interestChangeIdx].rate / 12;
            // 金利変更時に返済額を再計算
            if (currentRate > 0) {
              payment = (balance * currentRate) / (1 - Math.pow(1 + currentRate, -remainMonths));
            } else {
              payment = balance / remainMonths;
            }
            interestChangeIdx++;
          }
          // 利息計算は必ずcurrentRateを使う
          let interest = balance * currentRate;
          let principalPayment = payment - interest;
          let bonusPayment = 0;
          if (bonus > 0 && bonusMonths.includes(month)) {
            bonusPayment = Math.min(bonus, balance - principalPayment);
          }
          let extraPayment = 0;
          let thisExtraType = null;
          if (extraIdx < sortedExtras.length && year === sortedExtras[extraIdx].year && month === sortedExtras[extraIdx].month && sortedExtras[extraIdx].amount > 0) {
            extraPayment = Math.min(sortedExtras[extraIdx].amount, balance - principalPayment - bonusPayment);
            thisExtraType = sortedExtras[extraIdx].type;
            extraIdx++;
          }
          let totalThisPayment = payment + bonusPayment + extraPayment;
          if (totalThisPayment > balance + interest) {
            totalThisPayment = balance + interest;
            principalPayment = balance;
            bonusPayment = 0;
            extraPayment = 0;
          }
          balance -= (principalPayment + bonusPayment + extraPayment);
          if (balance < 0) balance = 0;
          totalPayment += totalThisPayment;
          schedule.push({
            year: year,
            month: month,
            payment: Math.round(totalThisPayment),
            principal: Math.round(principalPayment + bonusPayment + extraPayment),
            interest: Math.round(interest),
            balance: Math.round(balance),
            rate: currentAnnualRate.toFixed(3)
          });
          remainMonths--;
          // 繰り上げ返済があったら、その方式で再計算
          if (extraPayment > 0 && balance > 0 && remainMonths > 0 && thisExtraType) {
            if (thisExtraType === 'reduce') {
              // 返済額軽減型のみ返済額を再計算
              if (currentRate > 0) {
                payment = (balance * currentRate) / (1 - Math.pow(1 + currentRate, -remainMonths));
              } else {
                payment = balance / remainMonths;
              }
            }
            // 期間短縮型（shorten）は金利変更時のみ返済額を再計算
          }
          month++;
          if (month > 12) {
            month = 1;
            year++;
          }
          if (balance <= 0) break;
        }
        // 返済額変動履歴を作成
        let paymentHistory = [];
        let prevPayment = null;
        let startIdx = 0;
        for (let i = 0; i < schedule.length; i++) {
          // ボーナス月以外の返済額
          const row = schedule[i];
          // ボーナス月以外のみ
          if (!bonusMonths.includes(row.month)) {
            if (prevPayment === null) {
              prevPayment = row.payment;
              startIdx = i;
            } else if (row.payment !== prevPayment) {
              paymentHistory.push({
                start: schedule[startIdx],
                end: schedule[i - 1],
                payment: prevPayment
              });
              prevPayment = row.payment;
              startIdx = i;
            }
          }
        }
        // 最後の区間
        if (prevPayment !== null && startIdx < schedule.length) {
          paymentHistory.push({
            start: schedule[startIdx],
            end: schedule[schedule.length - 1],
            payment: prevPayment
          });
        }
        let resultHtml = `<h2>結果</h2>`;
        resultHtml += `<p>毎月の返済額（ボーナス月以外）：<br>`;
        paymentHistory.forEach(h => {
          resultHtml += `${h.start.year}年${h.start.month}月〜${h.end.year}年${h.end.month}月：<strong>${h.payment.toLocaleString()}円</strong><br>`;
        });
        resultHtml += `</p>`;
        resultHtml += `<p>総返済額：<strong>${Math.round(totalPayment).toLocaleString()}円</strong></p>`;
        // 折りたたみボタン付き返済スケジュール
        const scheduleId = 'repayScheduleTable';
        resultHtml += `<h3 style="display:inline-block;">返済スケジュール</h3>`;
        resultHtml += `<button type="button" class="toggle-btn" id="toggleScheduleBtn">▼</button>`;
        resultHtml += `<div id="scheduleWrapper">
          <table id="${scheduleId}" border="1" style="border-collapse:collapse;width:100%"><tr><th>年</th><th>月</th><th>返済額</th><th>元金</th><th>利息</th><th>残債</th><th>金利(%)</th></tr>`;
        schedule.forEach(row => {
          resultHtml += `<tr><td>${row.year}</td><td>${row.month}</td><td>${row.payment.toLocaleString()}円</td><td>${row.principal.toLocaleString()}円</td><td>${row.interest.toLocaleString()}円</td><td>${row.balance.toLocaleString()}円</td><td>${row.rate}</td></tr>`;
        });
        resultHtml += `</table></div>`;
        if (schedule.length > 0) {
          resultHtml += `<p>最終残債：<strong>${schedule[schedule.length-1].balance.toLocaleString()}円</strong></p>`;
        }
        document.getElementById('result').innerHTML = resultHtml;
        // 折りたたみボタンの動作
        const btn = document.getElementById('toggleScheduleBtn');
        const wrapper = document.getElementById('scheduleWrapper');
        let collapsed = false;
        btn.onclick = function() {
          collapsed = !collapsed;
          if (collapsed) {
            wrapper.classList.add('schedule-collapsed');
            btn.textContent = '▲';
          } else {
            wrapper.classList.remove('schedule-collapsed');
            btn.textContent = '▼';
          }
        };
        // グラフ描画
        drawLoanChart(schedule, interestChanges);
        return;
      }
      // --- 毎年・毎月繰り上げ返済 ---
      // 方式はextraTypeで一括指定
      let recalc = false;
      let recalcMonth = 0;
      let recalcYear = 0;
      let recalcBalance = 0;
      let recalcTotalMonths = 0;
      for (let i = 1; i <= months; i++) {
        let interest = balance * monthlyRate;
        let principalPayment = monthlyPayment - interest;
        let bonusPayment = 0;
        if (bonus > 0 && bonusMonths.includes(month)) {
          bonusPayment = Math.min(bonus, balance - principalPayment);
        }
        let extraPayment = 0;
        if (extraRepayment !== 'none' && extraRepayment !== 'custom' && extraAmount > 0) {
          if (extraRepayment === 'yearly' && month === 12) {
            extraPayment = Math.min(extraAmount, balance - principalPayment - bonusPayment);
          } else if (extraRepayment === 'monthly') {
            extraPayment = Math.min(extraAmount, balance - principalPayment - bonusPayment);
          }
        }
        let payment = monthlyPayment + bonusPayment + extraPayment;
        if (payment > balance + interest) {
          payment = balance + interest;
          principalPayment = balance;
          bonusPayment = 0;
          extraPayment = 0;
        }
        balance -= (principalPayment + bonusPayment + extraPayment);
        if (balance < 0) balance = 0;
        totalPayment += payment;
        schedule.push({
          year: year,
          month: month,
          payment: Math.round(payment),
          principal: Math.round(principalPayment + bonusPayment + extraPayment),
          interest: Math.round(interest),
          balance: Math.round(balance),
          rate: (monthlyRate * 12 * 100).toFixed(3)
        });
        // 返済額軽減型の場合、繰り上げ返済が発生したら再計算
        if (extraRepayment !== 'none' && extraRepayment !== 'custom' && extraType === 'reduce' && extraPayment > 0 && !recalc) {
          recalc = true;
          recalcMonth = month;
          recalcYear = year;
          recalcBalance = balance;
          recalcTotalMonths = months - i;
          break;
        }
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
        if (balance <= 0) break;
      }
      // 返済額軽減型の再計算（毎年・毎月のみ）
      if (extraRepayment !== 'none' && extraRepayment !== 'custom' && extraType === 'reduce' && recalc && recalcBalance > 0 && recalcTotalMonths > 0) {
        let newMonthlyPayment = 0;
        if (monthlyRate > 0) {
          newMonthlyPayment = (recalcBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -recalcTotalMonths));
        } else {
          newMonthlyPayment = recalcBalance / recalcTotalMonths;
        }
        let year2 = recalcYear;
        let month2 = recalcMonth + 1;
        if (month2 > 12) {
          month2 = 1;
          year2++;
        }
        let balance2 = recalcBalance;
        for (let j = 1; j <= recalcTotalMonths; j++) {
          let interest2 = balance2 * monthlyRate;
          let principalPayment2 = newMonthlyPayment - interest2;
          let bonusPayment2 = 0;
          if (bonus > 0 && bonusMonths.includes(month2)) {
            bonusPayment2 = Math.min(bonus, balance2 - principalPayment2);
          }
          let payment2 = newMonthlyPayment + bonusPayment2;
          if (payment2 > balance2 + interest2) {
            payment2 = balance2 + interest2;
            principalPayment2 = balance2;
            bonusPayment2 = 0;
          }
          balance2 -= (principalPayment2 + bonusPayment2);
          if (balance2 < 0) balance2 = 0;
          totalPayment += payment2;
          schedule.push({
            year: year2,
            month: month2,
            payment: Math.round(payment2),
            principal: Math.round(principalPayment2 + bonusPayment2),
            interest: Math.round(interest2),
            balance: Math.round(balance2),
            rate: (monthlyRate * 12 * 100).toFixed(3)
          });
          month2++;
          if (month2 > 12) {
            month2 = 1;
            year2++;
          }
          if (balance2 <= 0) break;
        }
        monthlyPayment = newMonthlyPayment;
      }
      // 返済額変動履歴を作成
      let paymentHistory = [];
      let prevPayment = null;
      let startIdx = 0;
      for (let i = 0; i < schedule.length; i++) {
        // ボーナス月以外の返済額
        const row = schedule[i];
        // ボーナス月以外のみ
        if (!bonusMonths.includes(row.month)) {
          if (prevPayment === null) {
            prevPayment = row.payment;
            startIdx = i;
          } else if (row.payment !== prevPayment) {
            paymentHistory.push({
              start: schedule[startIdx],
              end: schedule[i - 1],
              payment: prevPayment
            });
            prevPayment = row.payment;
            startIdx = i;
          }
        }
      }
      // 最後の区間
      if (prevPayment !== null && startIdx < schedule.length) {
        paymentHistory.push({
          start: schedule[startIdx],
          end: schedule[schedule.length - 1],
          payment: prevPayment
        });
      }
      let resultHtml = `<h2>結果</h2>`;
      resultHtml += `<p>毎月の返済額（ボーナス月以外）：<br>`;
      paymentHistory.forEach(h => {
        resultHtml += `${h.start.year}年${h.start.month}月〜${h.end.year}年${h.end.month}月：<strong>${h.payment.toLocaleString()}円</strong><br>`;
      });
      resultHtml += `</p>`;
      resultHtml += `<p>総返済額：<strong>${Math.round(totalPayment).toLocaleString()}円</strong></p>`;
      resultHtml += `<h3 style="display:inline-block;">返済スケジュール</h3>`;
      resultHtml += `<button type="button" class="toggle-btn" id="toggleScheduleBtn">▼</button>`;
      resultHtml += `<div id="scheduleWrapper">
        <table id="repayScheduleTable" border="1" style="border-collapse:collapse;width:100%"><tr><th>年</th><th>月</th><th>返済額</th><th>元金</th><th>利息</th><th>残債</th><th>金利(%)</th></tr>`;
      schedule.forEach(row => {
        resultHtml += `<tr><td>${row.year}</td><td>${row.month}</td><td>${row.payment.toLocaleString()}円</td><td>${row.principal.toLocaleString()}円</td><td>${row.interest.toLocaleString()}円</td><td>${row.balance.toLocaleString()}円</td><td>${row.rate}</td></tr>`;
      });
      resultHtml += `</table></div>`;
      if (schedule.length > 0) {
        resultHtml += `<p>最終残債：<strong>${schedule[schedule.length-1].balance.toLocaleString()}円</strong></p>`;
      }
      document.getElementById('result').innerHTML = resultHtml;
      // 折りたたみボタンの動作
      const btn = document.getElementById('toggleScheduleBtn');
      const wrapper = document.getElementById('scheduleWrapper');
      let collapsed = false;
      btn.onclick = function() {
        collapsed = !collapsed;
        if (collapsed) {
          wrapper.classList.add('schedule-collapsed');
          btn.textContent = '▲';
        } else {
          wrapper.classList.remove('schedule-collapsed');
          btn.textContent = '▼';
        }
      };
      // グラフ描画
      drawLoanChart(schedule, interestChanges);
      return;
    }
    // ...（元金均等返済など他の分岐も同様に実装）...
  }
  // ...（toPrincipalモードの実装も同様に追加）...
});

// グラフ描画用関数
function drawLoanChart(schedule, interestChanges) {
  const ctx = document.getElementById('loanChart').getContext('2d');
  if (window.loanChartInstance) {
    window.loanChartInstance.destroy();
  }
  const labels = schedule.map(row => `${row.year}/${row.month}`);
  const balanceData = schedule.map(row => row.balance);
  const principalData = schedule.map(row => row.principal - row.interest);
  const interestData = schedule.map(row => row.interest);
  const paymentData = schedule.map(row => row.payment);

  // 金利変動タイミングのアノテーション
  let annotations = {};
  if (Array.isArray(interestChanges) && interestChanges.length > 0) {
    interestChanges.forEach(change => {
      const idx = labels.findIndex(l => l === `${change.year}/${change.month}`);
      if (idx !== -1) {
        annotations[`line${idx}`] = {
          type: 'line',
          xMin: idx,
          xMax: idx,
          borderColor: 'rgba(255, 159, 64, 0.8)',
          borderWidth: 2,
          label: {
            content: `金利${(change.rate*100).toFixed(2)}%`,
            enabled: true,
            position: 'start',
            backgroundColor: 'rgba(255, 159, 64, 0.8)',
            color: '#fff',
            font: {size: 10}
          }
        };
      }
    });
  }

  window.loanChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'line',
          label: '残高',
          data: balanceData,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          yAxisID: 'y',
          tension: 0.1,
          order: 1,
          borderWidth: 2
        },
        {
          type: 'line',
          label: '返済額',
          data: paymentData,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          yAxisID: 'y1',
          tension: 0.1,
          order: 1,
          borderWidth: 4 // 太線で強調
        },
        {
          type: 'bar',
          label: '元金返済額',
          data: principalData,
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          yAxisID: 'y1',
          order: 2
        },
        {
          type: 'bar',
          label: '利息額',
          data: interestData,
          backgroundColor: 'rgba(255, 205, 86, 0.5)',
          borderColor: 'rgba(255, 205, 86, 1)',
          yAxisID: 'y1',
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      stacked: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'ローン返済推移グラフ' },
        annotation: { annotations }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: '残高（円）' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: '返済額・元金・利息（円）' }
        }
      }
    }
  });
}
