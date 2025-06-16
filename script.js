// 入力欄の表示切替
const modeRadios = document.querySelectorAll('input[name="mode"]');
const principalGroup = document.getElementById('principal-group');
const monthlyGroup = document.getElementById('monthly-group');

// 繰り上げ返済の方式を追跡する変数を追加
let isExtraRepaymentReduceType = false;
let extraPaymentAppliedAmount = 0; // 繰り上げ返済の適用額を追跡する変数を追加
let extraPayment = 0; // 繰り上げ返済額を追跡する変数を追加

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
      <button type="button" class="removeExtra" onclick="this.parentNode.remove()">削除</button>
    `;
    extraList.appendChild(div);
    div.querySelector('.removeExtra').onclick = function() {
      div.remove();
    };
  };
}

// 金利変更タイミング追加ボタンのイベント
const addInterestBtn = document.getElementById('addInterest');
if (addInterestBtn) {
  addInterestBtn.addEventListener('click', function() {
    const div = document.createElement('div');
    div.className = 'interest-item';
    div.innerHTML = `
      <label>年<input type="number" class="interestTiming" min="1" max="30" value="1"></label>
      <label>月<input type="number" class="interestTimingMonth" min="1" max="12" value="1"></label>
      <label>新金利（年利%）<input type="number" class="interestValue" step="0.001" value=""></label>
      <button type="button" class="removeInterest" onclick="this.parentNode.remove()">削除</button>
    `;
    document.getElementById('interestList').appendChild(div);
  });
}

// 金利変更情報の取得ロジック
function getInterestChanges() {
  const interestItems = document.querySelectorAll('#interestList .interest-item');
  const interestChanges = [];
  interestItems.forEach(item => {
    const year = parseInt(item.querySelector('.interestTiming').value, 10);
    const month = parseInt(item.querySelector('.interestTimingMonth').value, 10);
    const rate = parseFloat(item.querySelector('.interestValue').value) / 100;
    if (!isNaN(year) && !isNaN(month) && !isNaN(rate)) {
      interestChanges.push({ year, month, rate });
    }
  });
  return interestChanges;
}

// 計算処理

document.getElementById('loan-form').addEventListener('submit', function(e) {
  e.preventDefault();

  // 金利変更情報の初期化
  const interestChanges = getInterestChanges();
  
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

  let resultHtml = '';

  if (mode === 'toMonthly') {
    const principal = parseInt(document.getElementById('principal').value, 10);
    // ボーナス返済併用型の正しい計算
    let bonusCount = years * 2; // 年2回×年数
    let totalBonus = bonus * bonusCount;
    let monthlyPayment = 0;
    let totalPayment = 0;
    let schedule = [];
    let balance = principal;
    let year = 1;
    let month = 1;
    let monthsLeft = months;

    if (repaymentType === 'annuity') {
      // 元利均等返済
      // ボーナス返済分を差し引いた元本で毎月返済額を計算する（ボーナス併用払い）
      let basePrincipalForMonthly = Math.max(0, principal - totalBonus);
      if (monthlyRate > 0) {
        monthlyPayment = (basePrincipalForMonthly * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
      } else {
        monthlyPayment = basePrincipalForMonthly / months;
      }
    } else {
      // 元金均等返済
      // ボーナス返済分を差し引いた元本で月々の元金返済額を計算
      let basePrincipalForMonthly = Math.max(0, principal - totalBonus);
      const monthlyPrincipal = basePrincipalForMonthly / months;
      // 元金均等返済の初期 monthlyPayment は月々元金返済額と初月の利息
      monthlyPayment = monthlyPrincipal + (principal * monthlyRate);
    }

    // === 元金均等返済用初期設定 ===
    let principalRepaymentBaseAmount = 0;
    if (repaymentType === 'principal') {
      principalRepaymentBaseAmount = Math.max(0, principal - totalBonus) / months;
    }

    // 返済スケジュールの計算
    if (repaymentType === 'annuity') {
      // 元利均等返済の返済スケジュール
      let currentRate = monthlyRate;
      let currentAnnualRate = rate * 100;
      const sortedInterest = interestChanges.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));
      let interestChangeIdx = 0;
      let extraIdx = 0;
      const sortedExtras = customExtras.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));

      for (let i = 1; i <= months; i++) {
        // 各月の計算開始時にフラグと金額をリセット
        extraPaymentAppliedAmount = 0;
        extraPayment = 0;
        isExtraRepaymentReduceType = false;

        // 金利変更タイミングに到達したら金利・月利を更新し、返済額も再計算
        if (interestChangeIdx < sortedInterest.length && year === sortedInterest[interestChangeIdx].year && month === sortedInterest[interestChangeIdx].month) {
          currentAnnualRate = sortedInterest[interestChangeIdx].rate * 100;
          currentRate = sortedInterest[interestChangeIdx].rate / 12;

          // 再計算時の残り支払い回数 (現在の月を含む)
          const remainingPaymentsForFormula = months - i + 1;

          // 残りのボーナス返済額を計算
          let countOfRemainingBonusPayments = 0;
          let tempCurrentYear = year;
          let tempCurrentMonth = month;
          for (let j = 0; j < remainingPaymentsForFormula; j++) {
            if (bonusMonths.includes(tempCurrentMonth)) {
              countOfRemainingBonusPayments++;
            }
            tempCurrentMonth++;
            if (tempCurrentMonth > 12) {
              tempCurrentMonth = 1;
              tempCurrentYear++;
            }
          }
          let futureBonusPaymentsAmount = countOfRemainingBonusPayments * bonus;

          // 新しい月額返済額の元本を計算
          let principalForNewMonthlyPayment = Math.max(0, balance - futureBonusPaymentsAmount);

          if (currentRate > 0) {
            monthlyPayment = (principalForNewMonthlyPayment * currentRate) / (1 - Math.pow(1 + currentRate, -remainingPaymentsForFormula));
          } else {
            monthlyPayment = principalForNewMonthlyPayment / remainingPaymentsForFormula;
          }
          interestChangeIdx++;
        }
        let interest = balance * currentRate;
        // 元金充当額は0未満にならないように調整
        let principalPayment = Math.max(0, monthlyPayment - interest);
        let bonusPayment = 0;
        
        // ボーナス月の場合
        if (bonus > 0 && bonusMonths.includes(month)) {
          // ボーナス返済は元本を追加で減らすだけ。月々返済額や残り期間は変更しない。
          // ここでのbonusPaymentは、その月の元本充当額として扱われる
          bonusPayment = Math.min(bonus, balance - principalPayment);
        }

        // 繰り上げ返済の処理
        if (extraRepayment === 'custom' && extraIdx < sortedExtras.length && year === sortedExtras[extraIdx].year && month === sortedExtras[extraIdx].month) {
          extraPaymentAppliedAmount = Math.min(sortedExtras[extraIdx].amount, balance);
          balance -= extraPaymentAppliedAmount; // ★繰り上げ返済額を即座に残債から差し引く
          if (sortedExtras[extraIdx].type === 'reduce') {
            isExtraRepaymentReduceType = true;
            // 返済額軽減型の場合、繰り上げ返済額を元本に適用し、その後の月額返済額を再計算
            const remainingPaymentsForRecalc = months - i + 1;

            let countOfRemainingBonusPayments = 0;
            let tempCurrentYear = year;
            let tempCurrentMonth = month;
            for (let j = 0; j < remainingPaymentsForRecalc; j++) {
              if (bonusMonths.includes(tempCurrentMonth)) {
                countOfRemainingBonusPayments++;
              }
              tempCurrentMonth++;
              if (tempCurrentMonth > 12) {
                tempCurrentMonth = 1;
                tempCurrentYear++;
              }
            }
            let futureBonusPaymentsAmount = countOfRemainingBonusPayments * bonus;

            // monthlyPaymentは更新されたbalanceから計算する
            let principalForNewMonthlyPayment = Math.max(0, balance - futureBonusPaymentsAmount);

            if (currentRate > 0) {
              monthlyPayment = (principalForNewMonthlyPayment * currentRate) / (1 - Math.pow(1 + currentRate, -remainingPaymentsForRecalc));
            } else {
              monthlyPayment = principalForNewMonthlyPayment / remainingPaymentsForRecalc;
            }
            extraPayment = extraPaymentAppliedAmount; // スケジュールに繰り上げ返済額を記録
          } else { // shorten type
            monthsLeft = Math.max(0, monthsLeft - Math.round(extraPaymentAppliedAmount / (monthlyPayment + interest)));
            extraPayment = extraPaymentAppliedAmount; // スケジュールに繰り上げ返済額を記録
          }
          extraIdx++;
        } else if (extraRepayment === 'regular' && extraAmount > 0 && ((i % 12 === 0) || (i % 12 === 6))) {
          extraPaymentAppliedAmount = Math.min(extraAmount, balance);
          balance -= extraPaymentAppliedAmount; // ★繰り上げ返済額を即座に残債から差し引く
          if (extraType === 'reduce') {
            isExtraRepaymentReduceType = true;
            const remainingPaymentsForRecalc = months - i + 1;

            let countOfRemainingBonusPayments = 0;
            let tempCurrentYear = year;
            let tempCurrentMonth = month; // 現在の月から開始
            for (let j = 0; j < remainingPaymentsForRecalc; j++) {
                if (bonusMonths.includes(tempCurrentMonth)) {
                    countOfRemainingBonusPayments++;
                }
                tempCurrentMonth++;
                if (tempCurrentMonth > 12) {
                    tempCurrentMonth = 1;
                    tempCurrentYear++;
                }
            }
            let futureBonusPaymentsAmount = countOfRemainingBonusPayments * bonus;

            // monthlyPaymentは更新されたbalanceから計算する
            let principalForNewMonthlyPayment = Math.max(0, balance - futureBonusPaymentsAmount);

            if (currentRate > 0) {
              monthlyPayment = (principalForNewMonthlyPayment * currentRate) / (1 - Math.pow(1 + currentRate, -remainingPaymentsForRecalc));
            } else {
              monthlyPayment = principalForNewMonthlyPayment / remainingPaymentsForRecalc;
            }
            extraPayment = extraPaymentAppliedAmount; // スケジュールに繰り上げ返済額を記録
          } else { // shorten type
            monthsLeft = Math.max(0, monthsLeft - Math.round(extraPaymentAppliedAmount / (monthlyPayment + interest)));
            extraPayment = extraPaymentAppliedAmount; // スケジュールに繰り上げ返済額を記録
          }
        }
        
        principalPayment = Math.max(0, monthlyPayment - interest); // 再計算後の月額から利息を引く

        // totalPaymentForDisplay は、グラフの「返済額」ラインに表示される金額
        let totalPaymentForDisplay = monthlyPayment; // 基本の月額返済額

        // ボーナス月の場合、totalPaymentForDisplay にボーナス額を加算
        if (bonus > 0 && bonusMonths.includes(month)) {
            totalPaymentForDisplay += bonusPayment; // ボーナス月の返済額にボーナスを加算
        }

        // 繰り上げ返済額を totalPaymentForDisplay に加算（軽減型・短縮型両方）
        totalPaymentForDisplay += extraPaymentAppliedAmount;

        // 最終回で残高が0未満になる場合は返済額を調整（過払い計算）
        if (i === months && balance - (principalPayment + bonusPayment + extraPaymentAppliedAmount) < 0) {
          let overPay = (principalPayment + bonusPayment + extraPaymentAppliedAmount) - balance;
          if (overPay > 0) {
            // First, try to reduce bonusPayment
            if (bonusPayment > 0) {
                const reduceBy = Math.min(overPay, bonusPayment);
                bonusPayment -= reduceBy;
                overPay -= reduceBy;
            }

            // Next, try to reduce extraPaymentAppliedAmount
            if (overPay > 0 && extraPaymentAppliedAmount > 0) {
                const reduceBy = Math.min(overPay, extraPaymentAppliedAmount);
                extraPaymentAppliedAmount -= reduceBy;
                overPay -= reduceBy;
            }
            
            // Finally, reduce principalPayment
            if (overPay > 0) {
                principalPayment -= overPay;
                principalPayment = Math.max(0, principalPayment); // Ensure it doesn't go below 0
            }
            
            // 調整後の totalPaymentForDisplay を計算
            totalPaymentForDisplay = principalPayment + interest;
            if (bonus > 0 && bonusMonths.includes(month)) {
                totalPaymentForDisplay += bonusPayment;
            }
            totalPaymentForDisplay += extraPaymentAppliedAmount;
          }
        }
        
        // 最終的な月の支払いが残高＋利息を超えないように調整（支払額上限設定）
        if (totalPaymentForDisplay > balance + interest) {
          let excessAmount = totalPaymentForDisplay - (balance + interest);

          // 1. Adjust extraPaymentAppliedAmount
          if (excessAmount > 0) {
              const reduceBy = Math.min(excessAmount, extraPaymentAppliedAmount);
              extraPaymentAppliedAmount -= reduceBy;
              excessAmount -= reduceBy;
          }

          // 2. Adjust bonusPayment
          if (excessAmount > 0) {
              const reduceBy = Math.min(excessAmount, bonusPayment);
              bonusPayment -= reduceBy;
              excessAmount -= reduceBy;
          }

          // 3. Adjust principalPayment
          if (excessAmount > 0) {
              principalPayment -= excessAmount;
              principalPayment = Math.max(0, principalPayment);
          }

          // Recalculate totalPaymentForDisplay based on adjusted components
          totalPaymentForDisplay = principalPayment + interest;
          if (bonus > 0 && bonusMonths.includes(month)) {
              totalPaymentForDisplay += bonusPayment;
          }
          totalPaymentForDisplay += extraPaymentAppliedAmount;

          // Ensure totalPaymentForDisplay does not exceed balance + interest after adjustment
          totalPaymentForDisplay = Math.min(totalPaymentForDisplay, balance + interest);
        }
        
        // 残債の更新は純粋な元金返済部分のみで行う
        balance -= (principalPayment + bonusPayment); // extraPaymentAppliedAmountはここで引かない

        // 残高が0以下になったらループを終了し、最終行を調整
        if (balance <= 0) {
          // 最終月の調整
          let lastInterest = (balance + principalPayment + bonusPayment + extraPaymentAppliedAmount) * currentRate;
          let finalTotalPayment = principalPayment + lastInterest;
          if (bonus > 0 && bonusMonths.includes(month)) {
              finalTotalPayment += bonusPayment;
          }
          finalTotalPayment += extraPaymentAppliedAmount;
          totalPayment += finalTotalPayment;
          balance = 0;
          schedule.push({
            year,
            month,
            principal: principalPayment + extraPaymentAppliedAmount, // 元金返済＋繰り上げ返済
            interest: lastInterest,
            bonus: bonusPayment,
            extra: extraPaymentAppliedAmount,
            total: finalTotalPayment,
            balance: balance,
            rate: currentAnnualRate
          });
          break;
        }
        
        schedule.push({
          year,
          month,
          principal: principalPayment + extraPaymentAppliedAmount, // 元金返済＋繰り上げ返済
          interest,
          bonus: bonusPayment,
          extra: extraPaymentAppliedAmount,
          total: totalPaymentForDisplay,
          balance: balance,
          rate: currentAnnualRate
        });

        // 総返済額に加算（二重加算を防ぐため、ここで一度だけ加算）
        totalPayment += totalPaymentForDisplay;

        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
    } else {
      // 元金均等返済
      let currentRate = monthlyRate;
      let currentAnnualRate = rate * 100;
      const sortedInterest = interestChanges.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));
      let interestChangeIdx = 0;
      let extraIdx = 0;
      const sortedExtras = customExtras.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));

      for (let i = 1; i <= months; i++) {
        // 各月の計算開始時にフラグと金額をリセット
        extraPaymentAppliedAmount = 0;
        extraPayment = 0;
        isExtraRepaymentReduceType = false;

        // 金利変更タイミングに到達したら金利・月利を更新し、月々の元金返済額を再計算
        if (interestChangeIdx < sortedInterest.length && year === sortedInterest[interestChangeIdx].year && month === sortedInterest[interestChangeIdx].month) {
          currentAnnualRate = sortedInterest[interestChangeIdx].rate * 100;
          currentRate = sortedInterest[interestChangeIdx].rate / 12;
          
          // 残りのボーナス返済額を計算 (現在の月の次の月からの残り期間)
          let countOfRemainingBonusPayments = 0;
          let tempCurrentYear = year;
          let tempCurrentMonth = month; // 現在の月から開始
          // ボーナス計算対象期間は現在の月を含む残り期間
          const remainingPaymentsForFormula = months - i + 1; // ここでのmonthsは元の期間のままなので注意
          for (let j = 0; j < remainingPaymentsForFormula; j++) {
              if (bonusMonths.includes(tempCurrentMonth)) {
                  countOfRemainingBonusPayments++;
              }
              tempCurrentMonth++;
              if (tempCurrentMonth > 12) {
                  tempCurrentMonth = 1;
                  tempCurrentYear++;
              }
          }
          let futureBonusPaymentsAmount = countOfRemainingBonusPayments * bonus;
          
          // 新しい月額返済額の元本を計算 (現在の残債から将来のボーナス返済額を引く)
          principalRepaymentBaseAmount = Math.max(0, balance - futureBonusPaymentsAmount) / remainingPaymentsForFormula;
          interestChangeIdx++;
        }
        let interest = balance * currentRate;

        let principalPayment = Math.max(0, principalRepaymentBaseAmount);
        let bonusPayment = 0;
        if (bonus > 0 && bonusMonths.includes(month)) {
          bonusPayment = Math.min(bonus, balance - principalRepaymentBaseAmount);
        }

        // 繰り上げ返済の処理
        if (extraRepayment === 'custom' && extraIdx < sortedExtras.length && year === sortedExtras[extraIdx].year && month === sortedExtras[extraIdx].month) {
          extraPaymentAppliedAmount = Math.min(sortedExtras[extraIdx].amount, balance);
          balance -= extraPaymentAppliedAmount; // ★繰り上げ返済額を即座に残債から差し引く
          if (sortedExtras[extraIdx].type === 'reduce') {
            isExtraRepaymentReduceType = true;
            // 返済額軽減型の場合、繰り上げ返済額を元本に適用し、月々の元金返済額を再計算
            const remainingPaymentsForRecalc = months - i + 1; // 残りの支払い回数 (現在の月を含む)
            if (remainingPaymentsForRecalc > 0) {
                let countOfRemainingBonusPaymentsForRecalc = 0;
                let tempRecalcYear = year;
                let tempRecalcMonth = month; // 現在の月から開始
                for (let j = 0; j < remainingPaymentsForRecalc; j++) {
                    if (bonusMonths.includes(tempRecalcMonth)) {
                        countOfRemainingBonusPaymentsForRecalc++;
                    }
                    tempRecalcMonth++;
                    if (tempRecalcMonth > 12) {
                        tempRecalcMonth = 1;
                        tempRecalcYear++;
                    }
                }
                let futureBonusPaymentsAmountForRecalc = countOfRemainingBonusPaymentsForRecalc * bonus;
                principalRepaymentBaseAmount = Math.max(0, balance - futureBonusPaymentsAmountForRecalc) / remainingPaymentsForRecalc;
            } else {
                principalRepaymentBaseAmount = balance; // All remaining principal in this last month
            }
            extraPayment = extraPaymentAppliedAmount; // スケジュールに繰り上げ返済額を記録
          } else { // shorten type
            monthsLeft = Math.max(0, monthsLeft - Math.round(extraPaymentAppliedAmount / principalRepaymentBaseAmount));
            extraPayment = extraPaymentAppliedAmount; // スケジュールに繰り上げ返済額を記録
          }
          extraIdx++;
        } else if (extraRepayment === 'regular' && extraAmount > 0 && ((i % 12 === 0) || (i % 12 === 6))) {
          extraPaymentAppliedAmount = Math.min(extraAmount, balance);
          balance -= extraPaymentAppliedAmount; // ★繰り上げ返済額を即座に残債から差し引く
          if (extraType === 'reduce') {
            isExtraRepaymentReduceType = true;
            const remainingPaymentsForRecalc = months - i + 1;

            if (remainingPaymentsForRecalc > 0) {
                let countOfRemainingBonusPaymentsForRecalc = 0;
                let tempRecalcYear = year;
                let tempRecalcMonth = month; // 現在の月から開始
                for (let j = 0; j < remainingPaymentsForRecalc; j++) {
                    if (bonusMonths.includes(tempRecalcMonth)) {
                        countOfRemainingBonusPaymentsForRecalc++;
                    }
                    tempRecalcMonth++;
                    if (tempRecalcMonth > 12) {
                        tempRecalcMonth = 1;
                        tempRecalcYear++;
                    }
                }
                let futureBonusPaymentsAmountForRecalc = countOfRemainingBonusPaymentsForRecalc * bonus;
                principalRepaymentBaseAmount = Math.max(0, balance - futureBonusPaymentsAmountForRecalc) / remainingPaymentsForRecalc;
            } else {
                principalRepaymentBaseAmount = balance;
            }
            extraPayment = extraPaymentAppliedAmount; // スケジュールに繰り上げ返済額を記録
          } else { // shorten type
            monthsLeft = Math.max(0, monthsLeft - Math.round(extraPaymentAppliedAmount / principalRepaymentBaseAmount));
            extraPayment = extraPaymentAppliedAmount; // スケジュールに繰り上げ返済額を記録
          }
        }

        // その月の元金充当額は、基本元金返済額
        principalPayment = Math.max(0, principalRepaymentBaseAmount);

        // その月の元金、ボーナス、繰り上げ返済額の合計（残債減少とテーブル表示用）
        let totalPrincipalForTableDisplay = principalPayment + bonusPayment + extraPaymentAppliedAmount;
        totalPrincipalForTableDisplay = Math.min(totalPrincipalForTableDisplay, balance); // 残高を超えないように調整

        // totalPaymentForDisplay は、グラフの「返済額」ラインに表示される金額
        let totalPaymentForDisplay = principalPayment + interest; // 元金均等返済の基本は元金 + 利息

        // ボーナス月の場合、totalPaymentForDisplay にボーナス額を加算
        if (bonus > 0 && bonusMonths.includes(month)) {
            totalPaymentForDisplay += bonusPayment; // ボーナス月の返済額にボーナスを加算
        }

        // 繰り上げ返済額を totalPaymentForDisplay に加算（軽減型・短縮型両方）
        totalPaymentForDisplay += extraPaymentAppliedAmount;

        // 最終回で残高が0未満になる場合は返済額を調整（過払い計算）
        if (i === months && balance - totalPrincipalForTableDisplay < 0) {
          let overPay = totalPrincipalForTableDisplay - balance;
          if (overPay > 0) {
            // ここでの調整は totalPrincipalForTableDisplay の構成要素を調整
            if (extraPaymentAppliedAmount >= overPay) {
                extraPaymentAppliedAmount -= overPay;
                overPay = 0;
            } else if (extraPaymentAppliedAmount > 0) {
                overPay -= extraPaymentAppliedAmount;
                extraPaymentAppliedAmount = 0;
            }

            if (bonusPayment >= overPay) {
              bonusPayment -= overPay;
              overPay = 0;
            } else if (bonusPayment > 0) {
              overPay -= bonusPayment;
              bonusPayment = 0;
            }

            if (principalPayment >= overPay) {
              principalPayment -= overPay;
            } else {
              principalPayment = 0;
            }
            // 調整後の totalPaymentForDisplay を計算
            totalPaymentForDisplay = principalPayment + interest;
            if (bonus > 0 && bonusMonths.includes(month)) {
                totalPaymentForDisplay += bonusPayment;
            }
            totalPaymentForDisplay += extraPaymentAppliedAmount;
          }
        }
        
        // 最終的な月の支払いが残高＋利息を超えないように調整（支払額上限設定）
        if (totalPaymentForDisplay > balance + interest) {
          let excessAmount = totalPaymentForDisplay - (balance + interest);

          // extraPaymentAppliedAmount は reduce type の場合は既に 0 なので、この順序で調整
          if (!isExtraRepaymentReduceType && excessAmount > 0) { // excessAmount を使用
              const reduceBy = Math.min(excessAmount, extraPaymentAppliedAmount);
              extraPaymentAppliedAmount -= reduceBy;
              excessAmount -= reduceBy;
          }

          // 2. Adjust bonusPayment
          if (excessAmount > 0) {
              const reduceBy = Math.min(excessAmount, bonusPayment);
              bonusPayment -= reduceBy;
              excessAmount -= reduceBy;
          }

          // 3. Adjust principalPayment
          if (excessAmount > 0) {
              principalPayment -= excessAmount;
              principalPayment = Math.max(0, principalPayment); // Ensure it doesn't go below 0
          }

          // Recalculate totalPaymentForDisplay based on adjusted components
          totalPaymentForDisplay = principalPayment + interest;
          if (bonus > 0 && bonusMonths.includes(month)) {
              totalPaymentForDisplay += bonusPayment;
          }
          totalPaymentForDisplay += extraPaymentAppliedAmount;

          // ただし、計算結果が balance + interest を超えないようにする
          totalPaymentForDisplay = Math.min(totalPaymentForDisplay, balance + interest);
        }

        // 残債の更新は純粋な元金返済部分のみで行う
        balance -= totalPrincipalForTableDisplay; 

        // 残高が0以下になったらループを終了し、最終行を調整
        if (balance <= 0) {
          // 最終月の調整
          let lastInterest = (balance + totalPrincipalForTableDisplay) * currentRate;
          let finalTotalPayment = principalPayment + lastInterest;
          if (bonus > 0 && bonusMonths.includes(month)) {
              finalTotalPayment += bonusPayment;
          }
          finalTotalPayment += extraPaymentAppliedAmount;
          totalPayment += finalTotalPayment;
          balance = 0;
          schedule.push({
            year,
            month,
            principal: totalPrincipalForTableDisplay,
            interest: lastInterest,
            bonus: 0, // 最終月はボーナスなし
            extra: extraPaymentAppliedAmount, // 最終月も繰り上げ返済があれば表示
            total: finalTotalPayment,
            balance: 0,
            rate: currentAnnualRate
          });
          break;
        }
        
        schedule.push({
          year,
          month,
          principal: totalPrincipalForTableDisplay,
          interest,
          bonus: bonusPayment,
          extra: extraPaymentAppliedAmount,
          total: totalPaymentForDisplay,
          balance: balance,
          rate: currentAnnualRate
        });

        // 総返済額に加算（二重加算を防ぐため、ここで一度だけ加算）
        totalPayment += totalPaymentForDisplay;

        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
    }

    resultHtml += `<h2>結果</h2>`;
    resultHtml += `<p>毎月の返済額（ボーナス月以外）：<strong>${Math.round(monthlyPayment).toLocaleString()}円</strong></p>`;
    resultHtml += `<p>総返済額：<strong>${Math.round(totalPayment).toLocaleString()}円</strong></p>`;
    resultHtml += `<h3>返済スケジュール</h3>`;
    resultHtml += `<table class="schedule-table">`;
    resultHtml += `<tr><th>年月</th><th>返済額</th><th>元金</th><th>利息</th><th>残高</th><th>金利</th></tr>`;
    
    // スケジュールの表示（最初の12ヶ月のみ表示）
    const displayMonths = 12;
    schedule.forEach((item, index) => {
      if (index < displayMonths) {
        resultHtml += `<tr>
          <td>${item.year}年${item.month}月</td>
          <td>${item.total.toLocaleString()}円</td>
          <td>${item.principal.toLocaleString()}円</td>
          <td>${item.interest.toLocaleString()}円</td>
          <td>${item.balance.toLocaleString()}円</td>
          <td>${item.rate.toFixed(3)}%</td>
        </tr>`;
      }
    });

    // 残りのスケジュールを折りたたみ可能なセクションとして追加
    if (schedule.length > displayMonths) {
      resultHtml += `<tr id="toggleRow"><td colspan="6">
        <button type="button" class="toggle-btn" onclick="toggleSchedule()">残りのスケジュールを表示</button>
      </td></tr>`;
      
      resultHtml += `<tbody id="remainingSchedule" class="schedule-collapsed">`;
      for (let i = displayMonths; i < schedule.length; i++) {
        const item = schedule[i];
        resultHtml += `<tr>
          <td>${item.year}年${item.month}月</td>
          <td>${item.total.toLocaleString()}円</td>
          <td>${item.principal.toLocaleString()}円</td>
          <td>${item.interest.toLocaleString()}円</td>
          <td>${item.balance.toLocaleString()}円</td>
          <td>${item.rate.toFixed(3)}%</td>
        </tr>`;
      }
      resultHtml += `</tbody>`;
    }
    
    resultHtml += `</table>`;
    resultHtml += `<p>最終残債：<strong>${schedule[schedule.length-1].balance.toLocaleString()}円</strong></p>`;

    // グラフの描画
    const ctx = document.getElementById('loanChart').getContext('2d');
    
    // 既存のグラフを破棄
    if (typeof window.loanChart !== 'undefined' && window.loanChart instanceof Chart) {
      window.loanChart.destroy();
    }

    const labels = schedule.map(item => `${item.year}年${item.month}月`);
    const balanceData = schedule.map(item => item.balance);
    const paymentData = schedule.map(item => item.total);
    const interestData = schedule.map(item => item.interest);
    const principalData = schedule.map(item => item.principal);

    // 新しいグラフを作成
    window.loanChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '残高',
            data: balanceData,
            borderColor: '#0078d7',
            backgroundColor: 'rgba(0, 120, 215, 0.1)',
            fill: true
          },
          {
            label: '返済額',
            data: paymentData,
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            fill: true
          },
          {
            label: '利息',
            data: interestData,
            borderColor: '#ffd93d',
            backgroundColor: 'rgba(255, 217, 61, 0.1)',
            fill: true
          },
          {
            label: '元金',
            data: principalData,
            borderColor: '#4ecdc4',
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: '返済スケジュールグラフ'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: '返済期間'
            }
          },
          y: {
            title: {
              display: true,
              text: '金額（円）'
            },
            beginAtZero: true
          }
        }
      }
    });

    // 返済額軽減型の計算修正
    if (isExtraRepaymentReduceType) {
      totalPaymentForDisplay = monthlyPayment; // 返済額軽減型の場合は更新された月額返済額を使用
    } else {
      totalPaymentForDisplay = monthlyPayment + extraPaymentAppliedAmount; // 期間短縮型の場合は繰り上げ返済額を加算
    }

    document.getElementById('result').innerHTML = resultHtml;
  } else {
    // 月額返済額→借入可能額
    const monthly = parseInt(document.getElementById('monthly').value, 10);
    let principal = 0;
    if (repaymentType === 'annuity') {
      // 元利均等返済
      if (monthlyRate > 0) {
        principal = monthly * (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate;
      } else {
        principal = monthly * months;
      }
    } else {
      // 元金均等返済
      principal = (monthly * months) / (1 + (months + 1) * monthlyRate / 2);
    }
    resultHtml += `<h2>結果</h2>`;
    resultHtml += `<p>借入可能額（概算）：<strong>${Math.floor(principal).toLocaleString()}円</strong></p>`;
    resultHtml += `<p>※ボーナス返済額は考慮していません。より正確な計算は「借入額から月額返済額を計算」モードをご利用ください。</p>`;
  }

  document.getElementById('result').innerHTML = resultHtml;
});

// スケジュールの折りたたみ機能
function toggleSchedule() {
  const remainingSchedule = document.getElementById('remainingSchedule');
  const toggleBtn = document.querySelector('.toggle-btn');
  
  if (remainingSchedule.classList.contains('schedule-collapsed')) {
    remainingSchedule.classList.remove('schedule-collapsed');
    toggleBtn.textContent = 'スケジュールを折りたたむ';
  } else {
    remainingSchedule.classList.add('schedule-collapsed');
    toggleBtn.textContent = '残りのスケジュールを表示';
  }
}

// 返済スケジュール計算関数
function calculateLoanSchedule({ principal, years, rate, bonus, bonusMonths, interestChanges, customExtras, extraRepayment, extraType, extraAmount, repaymentType }) {
  const months = years * 12;
  let schedule = [];
  let balance = principal;
  let year = 1;
  let month = 1;
  let monthlyRate = rate / 12;
  let currentRate = monthlyRate;
  let currentAnnualRate = rate * 100;
  let interestChangeIdx = 0;
  let extraIdx = 0;
  const sortedInterest = interestChanges.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));
  const sortedExtras = customExtras.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));
  let monthlyPayment = 0;
  let principalRepaymentBaseAmount = 0;
  let totalPayment = 0;
  let monthsLeft = months;

  // 初期月額返済額計算
  let bonusCount = years * bonusMonths.length;
  let totalBonus = bonus * bonusCount;
  if (repaymentType === 'annuity') {
    let basePrincipalForMonthly = Math.max(0, principal - totalBonus);
    if (monthlyRate > 0) {
      monthlyPayment = (basePrincipalForMonthly * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    } else {
      monthlyPayment = basePrincipalForMonthly / months;
    }
  } else {
    let basePrincipalForMonthly = Math.max(0, principal - totalBonus);
    principalRepaymentBaseAmount = basePrincipalForMonthly / months;
    monthlyPayment = principalRepaymentBaseAmount + (principal * monthlyRate);
  }

  for (let i = 1; i <= months; i++) {
    // 金利変更タイミング
    if (interestChangeIdx < sortedInterest.length && year === sortedInterest[interestChangeIdx].year && month === sortedInterest[interestChangeIdx].month) {
      currentAnnualRate = sortedInterest[interestChangeIdx].rate * 100;
      currentRate = sortedInterest[interestChangeIdx].rate / 12;
      // 残り期間で再計算
      const remainingPayments = months - i + 1;
      let countOfRemainingBonusPayments = 0;
      let tempYear = year;
      let tempMonth = month;
      for (let j = 0; j < remainingPayments; j++) {
        if (bonusMonths.includes(tempMonth)) countOfRemainingBonusPayments++;
        tempMonth++;
        if (tempMonth > 12) { tempMonth = 1; tempYear++; }
      }
      let futureBonusPaymentsAmount = countOfRemainingBonusPayments * bonus;
      let principalForNewMonthlyPayment = Math.max(0, balance - futureBonusPaymentsAmount);
      if (repaymentType === 'annuity') {
        if (currentRate > 0) {
          monthlyPayment = (principalForNewMonthlyPayment * currentRate) / (1 - Math.pow(1 + currentRate, -remainingPayments));
        } else {
          monthlyPayment = principalForNewMonthlyPayment / remainingPayments;
        }
      } else {
        principalRepaymentBaseAmount = principalForNewMonthlyPayment / remainingPayments;
      }
      interestChangeIdx++;
    }

    // 利息計算
    let interest = balance * currentRate;
    let principalPayment = repaymentType === 'annuity' ? Math.max(0, monthlyPayment - interest) : Math.max(0, principalRepaymentBaseAmount);
    let bonusPayment = 0;
    let extraPaymentAppliedAmount = 0;
    let isBonusMonth = bonus > 0 && bonusMonths.includes(month);

    // ボーナス月
    if (isBonusMonth) {
      bonusPayment = Math.min(bonus, balance - principalPayment);
    }

    // 繰り上げ返済
    if (extraRepayment === 'custom' && extraIdx < sortedExtras.length && year === sortedExtras[extraIdx].year && month === sortedExtras[extraIdx].month) {
      extraPaymentAppliedAmount = Math.min(sortedExtras[extraIdx].amount, balance - principalPayment - bonusPayment);
      if (sortedExtras[extraIdx].type === 'reduce') {
        // 軽減型: 残り期間で再計算
        const remainingPayments = months - i + 1;
        let countOfRemainingBonusPayments = 0;
        let tempYear = year;
        let tempMonth = month;
        for (let j = 0; j < remainingPayments; j++) {
          if (bonusMonths.includes(tempMonth)) countOfRemainingBonusPayments++;
          tempMonth++;
          if (tempMonth > 12) { tempMonth = 1; tempYear++; }
        }
        let futureBonusPaymentsAmount = countOfRemainingBonusPayments * bonus;
        let principalForNewMonthlyPayment = Math.max(0, balance - principalPayment - bonusPayment - extraPaymentAppliedAmount - futureBonusPaymentsAmount);
        if (repaymentType === 'annuity') {
          if (currentRate > 0) {
            monthlyPayment = (principalForNewMonthlyPayment * currentRate) / (1 - Math.pow(1 + currentRate, -remainingPayments));
          } else {
            monthlyPayment = principalForNewMonthlyPayment / remainingPayments;
          }
        } else {
          principalRepaymentBaseAmount = principalForNewMonthlyPayment / remainingPayments;
        }
      }
      extraIdx++;
    }
    // 定期繰り上げ返済（例：毎年6月・12月）
    if (extraRepayment === 'regular' && extraAmount > 0 && (month === 6 || month === 12)) {
      extraPaymentAppliedAmount = Math.min(extraAmount, balance - principalPayment - bonusPayment);
      if (extraType === 'reduce') {
        // 軽減型: 残り期間で再計算
        const remainingPayments = months - i + 1;
        let countOfRemainingBonusPayments = 0;
        let tempYear = year;
        let tempMonth = month;
        for (let j = 0; j < remainingPayments; j++) {
          if (bonusMonths.includes(tempMonth)) countOfRemainingBonusPayments++;
          tempMonth++;
          if (tempMonth > 12) { tempMonth = 1; tempYear++; }
        }
        let futureBonusPaymentsAmount = countOfRemainingBonusPayments * bonus;
        let principalForNewMonthlyPayment = Math.max(0, balance - principalPayment - bonusPayment - extraPaymentAppliedAmount - futureBonusPaymentsAmount);
        if (repaymentType === 'annuity') {
          if (currentRate > 0) {
            monthlyPayment = (principalForNewMonthlyPayment * currentRate) / (1 - Math.pow(1 + currentRate, -remainingPayments));
          } else {
            monthlyPayment = principalForNewMonthlyPayment / remainingPayments;
          }
        } else {
          principalRepaymentBaseAmount = principalForNewMonthlyPayment / remainingPayments;
        }
      }
    }

    // 返済額合計
    let totalPaymentForDisplay = monthlyPayment;
    if (isBonusMonth) totalPaymentForDisplay += bonusPayment;
    totalPaymentForDisplay += extraPaymentAppliedAmount;

    // 残高の更新（元金返済＋ボーナス＋繰り上げ返済）
    balance -= (principalPayment + bonusPayment + extraPaymentAppliedAmount);
    if (balance < 0) balance = 0;

    schedule.push({
      year,
      month,
      principal: principalPayment + extraPaymentAppliedAmount,
      interest,
      bonus: bonusPayment,
      extra: extraPaymentAppliedAmount,
      total: totalPaymentForDisplay,
      balance: balance,
      rate: currentAnnualRate
    });
    totalPayment += totalPaymentForDisplay;

    month++;
    if (month > 12) { month = 1; year++; }
    if (balance <= 0) break;
  }
  return { schedule, totalPayment };
} 
