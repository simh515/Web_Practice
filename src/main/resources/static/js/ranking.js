const API_URL = "/api";
let roomCode = null;

document.addEventListener("DOMContentLoaded", async () => {
  roomCode = localStorage.getItem("roomCode");
  if (!roomCode) return;

  try {
    const res = await fetch(`${API_URL}/rooms/result-summary/${roomCode}`);
    const data = await res.json();

    if (!data.success) {
      console.error("결과 불러오기 실패:", data.message);
      return;
    }

    renderScoreRanking(data.ranking);
    renderFastest(data.fastest);
    renderCorrectRate(data.correctCount, data.incorrectCount);
  } catch (err) {
    console.error("에러 발생:", err);
  }
});

function renderScoreRanking(rankingList) {
  const container = document.getElementById("score-ranking");
  if (!container) return;

  container.innerHTML = "";
  rankingList.forEach((user, index) => {
    const div = document.createElement("div");
    div.className = "ranking-entry";
    div.innerHTML = `<strong>${index + 1}위</strong> ${user.nickname} - ${user.score}점`;
    container.appendChild(div);
  });
}

function renderFastest(fastestList) {
  const container = document.getElementById("fastest-users");
  if (!container) return;

  container.innerHTML = "";
  fastestList.forEach((user, index) => {
    const div = document.createElement("div");
    div.className = "fastest-entry";
    div.innerHTML = `<strong>${index + 1}등</strong> ${user.nickname} - ${(user.time / 1000).toFixed(2)}초`;
    container.appendChild(div);
  });
}

function renderCorrectRate(correct, incorrect) {
  const total = correct + incorrect;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const container = document.getElementById("correct-rate");

  if (!container) return;

  container.innerHTML = `<h3>정답률</h3><p>${percent}% (${correct}명 / ${total}명)</p>`;
}
