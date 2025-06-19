// 各プランの計算結果を保存するグローバル変数
let planResults = {
    plan1: null,
    plan2: null,
    plan3: null
};

function getEarlyRepayments(planNumber) {
    const container = document.getElementById(`earlyRepayment${planNumber}`);
    const rows = container.querySelectorAll('.early-repayment-row');
    const repayments = [];
    rows.forEach(row => {
        const month = parseInt(row.querySelector('.early-month').value);
        const amount = parseFloat(row.querySelector('.early-amount').value) * 10000; // 万円→円
        const type = row.querySelector('.early-type').value;
        if (month > 0 && amount > 0) {
            repayments.push({ month, amount, type });
        }
    });
    // 月順にソート
    repayments.sort((a, b) => a.month - b.month);
    return repayments;
}

function calculateLoan(planNumber) {
    // 入力値を取得
    const loanAmount = parseFloat(document.getElementById(`loanAmount${planNumber}`).value) * 10000; // 万円から円に変換
    const loanTerm = parseInt(document.getElementById(`loanTerm${planNumber}`).value);
    const interestRate = parseFloat(document.getElementById(`interestRate${planNumber}`).value) / 100; // パーセントから小数に変換
    const bonusPayment = parseFloat(document.getElementById(`bonusPayment${planNumber}`).value) * 10000; // 万円から円に変換
    const earlyRepayments = getEarlyRepayments(planNumber);
    
    // 月々の返済額を計算（元金均等返済）
    const monthlyRate = interestRate / 12;
    const totalMonths = loanTerm * 12;
    
    let monthlyPayment;
    if (interestRate === 0) {
        monthlyPayment = loanAmount / totalMonths;
    } else {
        monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    }
    
    // ボーナス返済による月々返済額の減額計算
    let adjustedMonthlyPayment = monthlyPayment;
    if (bonusPayment > 0) {
        const annualBonusPayment = bonusPayment * 2;
        const monthlyBonusEquivalent = annualBonusPayment / 12;
        adjustedMonthlyPayment = monthlyPayment - monthlyBonusEquivalent;
    }

    // 返済スケジュールを計算
    let schedule = [];
    let remainingPrincipal = loanAmount;
    let totalInterest = 0;
    let totalBonusPayment = 0;
    let currentMonth = 1;
    let earlyIdx = 0;
    let currentMonthlyPayment = adjustedMonthlyPayment;
    let currentTotalMonths = totalMonths;

    while (currentMonth <= currentTotalMonths && remainingPrincipal > 0) {
        // 繰り上げ返済がこの月にあるか
        let early = earlyRepayments[earlyIdx];
        if (early && early.month === currentMonth) {
            if (early.type === 'shorten') {
                // 期間短縮型: 残元本から繰り上げ返済額を引き、残期間で再計算
                remainingPrincipal -= early.amount;
                if (remainingPrincipal < 0) remainingPrincipal = 0;
                // 残期間で再計算
                const remainMonths = currentTotalMonths - currentMonth + 1;
                if (interestRate === 0) {
                    currentMonthlyPayment = remainingPrincipal / remainMonths;
                } else {
                    currentMonthlyPayment = remainingPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, remainMonths)) / (Math.pow(1 + monthlyRate, remainMonths) - 1);
                }
            } else if (early.type === 'reduce') {
                // 返済額軽減型: 残期間はそのまま、残元本で再計算
                remainingPrincipal -= early.amount;
                if (remainingPrincipal < 0) remainingPrincipal = 0;
                const remainMonths = currentTotalMonths - currentMonth + 1;
                if (interestRate === 0) {
                    currentMonthlyPayment = remainingPrincipal / remainMonths;
                } else {
                    currentMonthlyPayment = remainingPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, remainMonths)) / (Math.pow(1 + monthlyRate, remainMonths) - 1);
                }
            }
            earlyIdx++;
        }

        // 通常返済
        const interest = remainingPrincipal * monthlyRate;
        let principalPayment = currentMonthlyPayment - interest;
        // ボーナス返済の追加（6月と12月）
        let currentBonusPayment = 0;
        if ((currentMonth % 6 === 0) && bonusPayment > 0) {
            currentBonusPayment = Math.min(bonusPayment, remainingPrincipal - principalPayment);
            principalPayment += currentBonusPayment;
            totalBonusPayment += currentBonusPayment;
        }
        if (principalPayment > remainingPrincipal) {
            principalPayment = remainingPrincipal;
        }
        remainingPrincipal -= principalPayment;
        totalInterest += interest;
        schedule.push({
            month: currentMonth,
            year: Math.ceil(currentMonth / 12),
            payment: currentMonthlyPayment + currentBonusPayment,
            principal: principalPayment,
            interest: interest,
            bonusPayment: currentBonusPayment,
            earlyRepayment: (early && early.month === currentMonth) ? early.amount : 0,
            earlyType: (early && early.month === currentMonth) ? early.type : '',
            remainingPrincipal: Math.max(0, remainingPrincipal)
        });
        currentMonth++;
        // 期間短縮型で元本が0になったら終了
        if (remainingPrincipal <= 0) break;
    }

    // 結果を保存
    const totalPayment = schedule.reduce((sum, s) => sum + s.payment, 0);
    planResults[`plan${planNumber}`] = {
        loanAmount: loanAmount,
        loanTerm: loanTerm,
        interestRate: interestRate * 100,
        bonusPayment: bonusPayment,
        monthlyPayment: adjustedMonthlyPayment,
        originalMonthlyPayment: monthlyPayment,
        totalPayment: totalPayment,
        totalInterest: totalInterest,
        totalBonusPayment: totalBonusPayment,
        schedule: schedule,
        earlyRepayments: earlyRepayments
    };
    // 結果を表示
    displayResults(schedule, adjustedMonthlyPayment, planNumber);
    // 比較結果を更新
    updateComparisonResults();
}

function displayResults(schedule, monthlyPayment, planNumber) {
    if (schedule.length === 0) {
        document.getElementById(`results${planNumber}`).innerHTML = '<p>計算できませんでした。</p>';
        return;
    }
    
    const plan = planResults[`plan${planNumber}`];
    const totalPayment = schedule.reduce((sum, s) => sum + s.payment, 0);
    const totalInterest = schedule.reduce((sum, s) => sum + s.interest, 0);
    const totalBonusPayment = schedule.reduce((sum, s) => sum + s.bonusPayment, 0);
    
    const resultsHtml = `
        <div class="results-section">
            <h3>計算結果</h3>
            <div class="result-summary">
                <p><strong>借入金額:</strong> ${(plan.loanAmount / 10000).toLocaleString()}万円</p>
                <p><strong>借入期間:</strong> ${plan.loanTerm}年</p>
                <p><strong>金利:</strong> ${plan.interestRate}%</p>
                <p><strong>ボーナス返済:</strong> ${(plan.bonusPayment / 10000).toLocaleString()}万円/回（年2回）</p>
                <p><strong>毎月の返済額:</strong> ${Math.round(monthlyPayment).toLocaleString()}円</p>
                <p><strong>返済総額:</strong> ${Math.round(totalPayment).toLocaleString()}円</p>
                <p><strong>総支払利息:</strong> ${Math.round(totalInterest).toLocaleString()}円</p>
            </div>
            
            <h4>返済予定表（全${schedule.length}ヶ月）</h4>
            <div class="schedule-container">
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th>年</th>
                            <th>月</th>
                            <th>返済額</th>
                            <th>元金返済</th>
                            <th>利息</th>
                            <th>ボーナス</th>
                            <th>繰り上げ返済</th>
                            <th>繰り上げ返済種類</th>
                            <th>残債</th>
                        </tr>
                    </thead>
                    <tbody id="scheduleBody${planNumber}">
                        ${schedule.slice(0, 6).map(s => `
                            <tr>
                                <td>${s.year}</td>
                                <td>${s.month % 12 || 12}</td>
                                <td>${Math.round(s.payment).toLocaleString()}</td>
                                <td>${Math.round(s.principal).toLocaleString()}</td>
                                <td>${Math.round(s.interest).toLocaleString()}</td>
                                <td>${s.bonusPayment > 0 ? Math.round(s.bonusPayment).toLocaleString() : '-'}</td>
                                <td>${s.earlyRepayment > 0 ? Math.round(s.earlyRepayment / 10000).toLocaleString() + '万円' : '-'}</td>
                                <td>${s.earlyType ? s.earlyType : '-'}</td>
                                <td>${Math.round(s.remainingPrincipal).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="schedule-controls">
                    <button type="button" onclick="toggleSchedule(${planNumber})" id="toggleBtn${planNumber}" class="toggle-btn">
                        残り${schedule.length - 6}ヶ月を表示
                    </button>
                </div>
                
                <div id="remainingSchedule${planNumber}" class="remaining-schedule" style="display: none;">
                    <table class="schedule-table">
                        <tbody>
                            ${schedule.slice(6).map(s => `
                                <tr>
                                    <td>${s.year}</td>
                                    <td>${s.month % 12 || 12}</td>
                                    <td>${Math.round(s.payment).toLocaleString()}</td>
                                    <td>${Math.round(s.principal).toLocaleString()}</td>
                                    <td>${Math.round(s.interest).toLocaleString()}</td>
                                    <td>${s.bonusPayment > 0 ? Math.round(s.bonusPayment).toLocaleString() : '-'}</td>
                                    <td>${s.earlyRepayment > 0 ? Math.round(s.earlyRepayment / 10000).toLocaleString() + '万円' : '-'}</td>
                                    <td>${s.earlyType ? s.earlyType : '-'}</td>
                                    <td>${Math.round(s.remainingPrincipal).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById(`results${planNumber}`).innerHTML = resultsHtml;
}

function toggleSchedule(planNumber) {
    const remainingSchedule = document.getElementById(`remainingSchedule${planNumber}`);
    const toggleBtn = document.getElementById(`toggleBtn${planNumber}`);
    
    if (remainingSchedule.style.display === 'none') {
        remainingSchedule.style.display = 'block';
        toggleBtn.textContent = '残りの期間を隠す';
    } else {
        remainingSchedule.style.display = 'none';
        toggleBtn.textContent = '残りの期間を表示';
    }
}

function updateComparisonResults() {
    const comparisonResults = document.getElementById('comparison-results');
    
    // 少なくとも1つのプランが計算されているかチェック
    const calculatedPlans = Object.values(planResults).filter(plan => plan !== null);
    
    if (calculatedPlans.length === 0) {
        comparisonResults.innerHTML = '';
        return;
    }
    
    const comparisonHtml = `
        <div class="comparison-results">
            <h2>プラン比較表</h2>
            <div class="comparison-table-container">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>項目</th>
                            <th>プランA</th>
                            <th>プランB</th>
                            <th>プランC</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>借入金額</td>
                            <td>${planResults.plan1 ? (planResults.plan1.loanAmount / 10000).toLocaleString() + '万円' : '-'}</td>
                            <td>${planResults.plan2 ? (planResults.plan2.loanAmount / 10000).toLocaleString() + '万円' : '-'}</td>
                            <td>${planResults.plan3 ? (planResults.plan3.loanAmount / 10000).toLocaleString() + '万円' : '-'}</td>
                        </tr>
                        <tr>
                            <td>借入期間</td>
                            <td>${planResults.plan1 ? planResults.plan1.loanTerm + '年' : '-'}</td>
                            <td>${planResults.plan2 ? planResults.plan2.loanTerm + '年' : '-'}</td>
                            <td>${planResults.plan3 ? planResults.plan3.loanTerm + '年' : '-'}</td>
                        </tr>
                        <tr>
                            <td>金利</td>
                            <td>${planResults.plan1 ? planResults.plan1.interestRate + '%' : '-'}</td>
                            <td>${planResults.plan2 ? planResults.plan2.interestRate + '%' : '-'}</td>
                            <td>${planResults.plan3 ? planResults.plan3.interestRate + '%' : '-'}</td>
                        </tr>
                        <tr>
                            <td>ボーナス返済</td>
                            <td>${planResults.plan1 ? (planResults.plan1.bonusPayment / 10000).toLocaleString() + '万円/回' : '-'}</td>
                            <td>${planResults.plan2 ? (planResults.plan2.bonusPayment / 10000).toLocaleString() + '万円/回' : '-'}</td>
                            <td>${planResults.plan3 ? (planResults.plan3.bonusPayment / 10000).toLocaleString() + '万円/回' : '-'}</td>
                        </tr>
                        <tr>
                            <td>繰り上げ返済回数</td>
                            <td>${planResults.plan1 ? planResults.plan1.earlyRepayments.length + '回' : '-'}</td>
                            <td>${planResults.plan2 ? planResults.plan2.earlyRepayments.length + '回' : '-'}</td>
                            <td>${planResults.plan3 ? planResults.plan3.earlyRepayments.length + '回' : '-'}</td>
                        </tr>
                        <tr>
                            <td>繰り上げ返済合計</td>
                            <td>${planResults.plan1 ? (planResults.plan1.earlyRepayments.reduce((sum, r) => sum + r.amount, 0) / 10000).toLocaleString() + '万円' : '-'}</td>
                            <td>${planResults.plan2 ? (planResults.plan2.earlyRepayments.reduce((sum, r) => sum + r.amount, 0) / 10000).toLocaleString() + '万円' : '-'}</td>
                            <td>${planResults.plan3 ? (planResults.plan3.earlyRepayments.reduce((sum, r) => sum + r.amount, 0) / 10000).toLocaleString() + '万円' : '-'}</td>
                        </tr>
                        <tr class="highlight">
                            <td>毎月の返済額</td>
                            <td>${planResults.plan1 ? Math.round(planResults.plan1.monthlyPayment).toLocaleString() + '円' : '-'}</td>
                            <td>${planResults.plan2 ? Math.round(planResults.plan2.monthlyPayment).toLocaleString() + '円' : '-'}</td>
                            <td>${planResults.plan3 ? Math.round(planResults.plan3.monthlyPayment).toLocaleString() + '円' : '-'}</td>
                        </tr>
                        <tr>
                            <td>返済総額</td>
                            <td>${planResults.plan1 ? Math.round(planResults.plan1.totalPayment).toLocaleString() + '円' : '-'}</td>
                            <td>${planResults.plan2 ? Math.round(planResults.plan2.totalPayment).toLocaleString() + '円' : '-'}</td>
                            <td>${planResults.plan3 ? Math.round(planResults.plan3.totalPayment).toLocaleString() + '円' : '-'}</td>
                        </tr>
                        <tr>
                            <td>総支払利息</td>
                            <td>${planResults.plan1 ? Math.round(planResults.plan1.totalInterest).toLocaleString() + '円' : '-'}</td>
                            <td>${planResults.plan2 ? Math.round(planResults.plan2.totalInterest).toLocaleString() + '円' : '-'}</td>
                            <td>${planResults.plan3 ? Math.round(planResults.plan3.totalInterest).toLocaleString() + '円' : '-'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    comparisonResults.innerHTML = comparisonHtml;
}

// 繰り上げ返済入力欄の動的追加・削除
function addEarlyRepayment(planNumber) {
    const container = document.getElementById(`earlyRepayment${planNumber}`);
    const idx = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'early-repayment-row';
    div.innerHTML = `
        <span>月: <input type="number" min="1" max="600" value="1" class="early-month" style="width:60px;"> </span>
        <span>金額(万円): <input type="number" min="1" value="100" class="early-amount" style="width:80px;"> </span>
        <span>種類: 
            <select class="early-type">
                <option value="shorten">期間短縮型</option>
                <option value="reduce">返済額軽減型</option>
            </select>
        </span>
        <button type="button" onclick="removeEarlyRepayment(this)">削除</button>
    `;
    container.appendChild(div);
}

function removeEarlyRepayment(btn) {
    btn.parentNode.remove();
} 
