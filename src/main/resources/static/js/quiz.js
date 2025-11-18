const API_URL = "/api";
Chart.register(ChartDataLabels);
let roomCode = null;
let currentQuestionIndex = 0;
let questions = [];
let isHost = false;
let professorEmail = "";
let stompClient = null;
let timerInterval = null;
let isTimeOver = false;
let correctChart = null;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[DEBUG] DOMContentLoaded fired");

  const params = new URLSearchParams(window.location.search);
  roomCode = params.get("code");

  if (!roomCode) {
    alert("잘못된 접근입니다. 방 코드가 없습니다.");
    return;
  }

  document.getElementById("roomCode").textContent = roomCode;

  await fetchRoomData();
  await fetchRoomStatus();
  setupLobbyEvents();
  startLobbyPolling();
  connectWebSocket();
  setupMobileChatEvents();
  setupMobileChatSend();

  document.getElementById("submitAnswerBtn").addEventListener("click", submitAnswer);
  document.getElementById("prevQuestionBtn").addEventListener("click", showPreviousQuestion);

  if (isHost) {
    document.getElementById("showResultBtn").addEventListener("click", async () => {
      await showResult();
      document.getElementById("showResultBtn").style.display = "none";
    });

    const endBtn = document.getElementById("endQuizBtn");
    if (endBtn) {
      endBtn.addEventListener("click", () => {
        stompClient.send(`/app/room/${roomCode}/endQuiz`, {}, JSON.stringify({
          type: "quizEnded"
        }));

        window.location.href = `/ranking.html?code=${roomCode}`;
      });
    }
  }

  const closeBtn = document.getElementById("closeResultBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("resultModal").style.display = "none";

      if (isHost && currentQuestionIndex === questions.length - 1) {
        const endBtn = document.getElementById("endQuizBtn");
        if (endBtn) {
          endBtn.style.display = "inline-block";
        }
      }
    });
  }
});

async function fetchRoomStatus() {
  const res = await fetch(`${API_URL}/rooms/status?code=${roomCode}`);
  const data = await res.json();

  if (!data.success) return;

  const isQuizStarted = data.isStarted;
  const userEmail = await getDecryptedEmail();

  const infoRes = await fetch(`${API_URL}/rooms/info?code=${roomCode}`);
  const infoData = await infoRes.json();

  professorEmail = infoData.professorEmail;
  isHost = userEmail === professorEmail;

  const nicknameKey = userEmail.replace(/\./g, "_");
  const nickname = infoData.participants?.[nicknameKey];

  const hasConfirmedNickname = nickname && nickname.trim().length > 0;

  if (hasConfirmedNickname) {
    localStorage.setItem("nickname", nickname);
  }

  if (isQuizStarted && hasConfirmedNickname) {
    currentQuestionIndex = data.currentQuestionIndex;
    showQuizScreen();
  } else {
    document.getElementById("lobbyScreen").style.display = "block";
    document.getElementById("quizScreen").style.display = "none";
  }
}
function setupLobbyEvents() {
  document.getElementById("confirmNicknameBtn").addEventListener("click", async () => {
    const nickname = document.getElementById("nicknameInput").value.trim();
    const userEmail = await getDecryptedEmail();

    if (!nickname || !userEmail) {
      alert("닉네임 또는 로그인 정보가 없습니다.");
      return;
    }

    const res = await fetch(`${API_URL}/rooms/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: roomCode,
        userId: userEmail,
        nickname: nickname
      })
    });

    const data = await res.json();
    if (data.success) {
      document.getElementById("nicknameInput").disabled = true;
      document.getElementById("confirmNicknameBtn").disabled = true;
      localStorage.setItem("nickname", nickname);
    } else {
      alert(data.message || "닉네임 설정 실패");
    }
  });

  document.getElementById("startQuizBtn").addEventListener("click", async () => {
    const res = await fetch(`${API_URL}/rooms/start/${roomCode}`, {
      method: "PUT"
    });

    const data = await res.json();
    if (data.success) {
      showQuizScreen();
      sendQuestionIndex(0);
      const now = Date.now();
      const remainTime = Math.floor((data.endTime - now) / 1000);
      startTimer(remainTime, data.endTime);

      if (stompClient && stompClient.connected) {
        stompClient.send(`/app/room/${roomCode}/startQuiz`, {}, JSON.stringify({
          type: "startQuiz"
        }));
      }
    } else {
      alert("퀴즈 시작에 실패했습니다.");
    }
  });
}

function startLobbyPolling() {
  updateParticipantList();
  setInterval(updateParticipantList, 3000);
}

async function updateParticipantList() {
  const res = await fetch(`${API_URL}/rooms/info?code=${roomCode}`);
  const data = await res.json();

  if (!data.success) return;

  const participants = data.participants || {};
  const list = document.getElementById("participantsList");
  list.innerHTML = "";

  let confirmedCount = 0;
  Object.values(participants).forEach(nickname => {
    if (nickname && nickname.trim()) {
      confirmedCount++;
      const li = document.createElement("li");
      li.textContent = nickname;
      list.appendChild(li);
    }
  });

  document.getElementById("playerCount").textContent = confirmedCount;
}

//문제관련
function renderQuestion() {
  if (questions.length === 0 || currentQuestionIndex >= questions.length) {
    document.getElementById("questionText").textContent = "퀴즈가 종료되었거나 문제가 없습니다.";
    document.getElementById("choicesList").innerHTML = "";
    document.getElementById("questionImage").style.display = "none";
    return;
  }

  const question = questions[currentQuestionIndex];
  document.getElementById("questionText").textContent = question.questionText || "문제 없음";
  document.getElementById("questionNumber").textContent = currentQuestionIndex + 1;
  document.getElementById("totalQuestions").textContent = questions.length;

  updateNavigationButtons();

  const templateBg = question.templateImageName || "classic.png";
  const templateBox = document.getElementById("templateBackground");
  templateBox.style.backgroundImage = `url('/images/${templateBg}')`;

  const questionImage = document.getElementById("questionImage");
  if (question.questionImage) {
    questionImage.src = question.questionImage;
    questionImage.style.display = "block";
  } else {
    questionImage.style.display = "none";
  }

  const choicesList = document.getElementById("choicesList");
  choicesList.innerHTML = "";

  const shortBox = document.querySelector(".short-answer-box");
  shortBox.innerHTML = "";
  shortBox.style.display = "none";

  if (question.type === "ox") {
    choicesList.className = "choices-list choice-count-2 ox-choices";

    ["O", "X"].forEach((label) => {
      const li = document.createElement("li");
      li.classList.add("ox-choice-item");
      li.style.backgroundImage = `url('/images/${label.toLowerCase()}.png')`;
      li.dataset.value = label;

      li.addEventListener("click", () => {
        document.querySelectorAll(".ox-choice-item").forEach(el => {
          el.classList.remove("ox-choice-selected");
        });
        li.classList.add("ox-choice-selected");
      });

      choicesList.appendChild(li);
    });

  } else if (question.type === "short") {
    const box = document.createElement("div");
    box.classList.add("sentence-box");

    const bg = document.createElement("img");
    bg.src = "/images/sentence.png";
    bg.classList.add("sentence-bg");

    const wrapper = document.createElement("div");
    wrapper.classList.add("sentence-center");

    const input = document.createElement("input");
    input.type = "text";
    input.classList.add("sentence-input");
    input.id = "shortAnswerInput";
    input.placeholder = "정답을 입력하세요";

    wrapper.appendChild(input);
    box.appendChild(bg);
    box.appendChild(wrapper);

    shortBox.style.display = "block";
    shortBox.appendChild(box);

  } else if (question.choices && question.choices.length > 0) {
    const countClass = `choice-count-${question.choices.length}`;
    choicesList.className = `choices-list ${countClass}`;

    question.choices.forEach((choice, idx) => {
      const li = document.createElement("li");
      li.classList.add("choice-item");
      li.dataset.index = idx;
      const textSpan = document.createElement("span");
      textSpan.classList.add("choice-text");
      textSpan.textContent = choice;

      li.appendChild(textSpan);
      li.style.backgroundImage = `url('/images/choice${idx + 1}.png')`;
      li.addEventListener("click", () => {
        li.classList.toggle("selected");
      });

      choicesList.appendChild(li);
    });
  } else {
    choicesList.innerHTML = "<li>선택지가 없습니다.</li>";
  }

  // 버튼 제어
  const resultBtn = document.getElementById("showResultBtn");
  const nextBtn = document.getElementById("nextQuestionBtn");

  if (isHost) {
    resultBtn.style.display = "inline-block";
    nextBtn.style.display = "none";
  } else {
    resultBtn.style.display = "none";
    nextBtn.style.display = "none";
  }
}


function setHostEventListeners() {
  document.getElementById("nextQuestionBtn").addEventListener("click", async () => {
    if (currentQuestionIndex + 1 >= questions.length) {
      alert("마지막 문제입니다.");
      return;
    }

    const newIndex = currentQuestionIndex + 1;
    const res = await fetch(`${API_URL}/ws/questionIndex/${roomCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentQuestionIndex: newIndex })
    });

    const data = await res.json();
    if (data.success) {
      currentQuestionIndex = newIndex;
      renderQuestion();
      sendQuestionIndex(newIndex);
    } else {
      alert("문제를 넘길 수 없습니다.");
    }
  });
}

document.getElementById("quizStartControlBtn").addEventListener("click", async () => {
  const res = await fetch(`${API_URL}/rooms/start/${roomCode}`, {
    method: "PUT"
  });

  const data = await res.json();
  if (data.success) {
    showQuizScreen();
    sendQuestionIndex(0);
  } else {
    alert("퀴즈 시작에 실패했습니다.");
  }
});


async function fetchRoomData() {
  const res = await fetch(`${API_URL}/rooms/info?code=${roomCode}`);
  const data = await res.json();

  if (!data.success) {
    alert("방 정보를 불러오는 데 실패했습니다.");
    return;
  }

  questions = data.testQuestions || [];
  professorEmail = data.professorEmail;
  currentQuestionIndex = data.currentQuestionIndex || 0;

  const userEmail = await getDecryptedEmail();
  isHost = userEmail && userEmail === professorEmail;

  if (isHost) {
    document.getElementById("startQuizBtn").style.display = "inline-block";
  } else {
    document.getElementById("startQuizBtn").style.display = "none";
  }

  renderQuestion();

  const now = Date.now();
  const remainTime = Math.floor((data.endTime - now) / 1000);
  startTimer(remainTime, data.endTime);
}

function connectWebSocket() {
  const socket = new SockJS("/ws");
  stompClient = Stomp.over(socket);

  stompClient.connect({}, async () => {
    console.log("[WebSocket] Connected!");

    const statusRes = await fetch(`${API_URL}/rooms/status?code=${roomCode}`);
    const statusData = await statusRes.json();
    const infoRes = await fetch(`${API_URL}/rooms/info?code=${roomCode}`);
    const infoData = await infoRes.json();

    const userEmail = localStorage.getItem("loggedInUser");
    const nicknameKey = userEmail.replace(/\./g, "_");
    const nickname = infoData.participants?.[nicknameKey];
    const hasConfirmedNickname = nickname && nickname.trim().length > 0;

    if (statusData.isStarted && hasConfirmedNickname) {
      console.log("[WebSocket] 퀴즈가 이미 시작됨 → showQuizScreen 실행");
      currentQuestionIndex = statusData.currentQuestionIndex;
      showQuizScreen();
    }

    stompClient.subscribe(`/topic/room/${roomCode}`, (message) => {
      const data = JSON.parse(message.body);
      console.log("[WebSocket] 수신됨:", data);

      if (data.type === "startQuiz") {
        currentQuestionIndex = data.currentQuestionIndex || 0;
        showQuizScreen();

        const now = Date.now();
        const remainTime = Math.floor((data.endTime - now) / 1000);
        startTimer(remainTime, data.endTime);
      }

      if (data.type === "questionIndex") {
        currentQuestionIndex = data.currentQuestionIndex;
        renderQuestion();

        const now = Date.now();
        const remainTime = Math.floor((data.endTime - now) / 1000);
        startTimer(remainTime, data.endTime);
      }

      if (data.type === "showResult") {
        updateResultModal(data);
      }

      if (data.type === "closeResult") {
        document.getElementById("resultModal").style.display = "none";
      }

      if (data.type === "quizEnded") {
        window.location.href = `/ranking.html?code=${roomCode}`;
      }

      if (data.type === "chat") {
        const nickname = data.nickname;
        const message = data.message;

        const chatBox = document.getElementById("chatMessages");
        const msgDiv = document.createElement("div");
        msgDiv.classList.add("chat-message");
        msgDiv.innerHTML = `<strong>${nickname}</strong><br>${message}`;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        const mobileBox = document.getElementById("mobileChatMessages");
        if (mobileBox) {
          const mobileMsg = document.createElement("div");
          mobileMsg.classList.add("chat-message");
          mobileMsg.innerHTML = `<strong>${nickname}</strong><br>${message}`;
          mobileBox.appendChild(mobileMsg);
          mobileBox.scrollTop = mobileBox.scrollHeight;
        }
      }
    });
  });
}

document.getElementById("endQuizBtn").addEventListener("click", () => {
  if (isHost && stompClient) {
    stompClient.send(`/app/room/${roomCode}/quizEnded`, {}, JSON.stringify({
      type: "quizEnded"
    }));
  }
});
  
function sendQuestionIndex(index) {
  if (stompClient && stompClient.connected) {
    stompClient.send(`/app/room/${roomCode}/sendIndex`, {}, JSON.stringify({
      type: "questionIndex",
      currentQuestionIndex: index
    }));
  }
}

//정답확인
async function submitAnswer(isAuto = false) {
  const userEmail = await getDecryptedEmail();
  const question = questions[currentQuestionIndex];

  if (submitAnswer.submitted?.[currentQuestionIndex]) {
    if (!isAuto) alert("이미 제출한 문제입니다.");
    return;
  }

  const payload = {
    userId: userEmail,
    questionIndex: currentQuestionIndex
  };

  const submitBtn = document.getElementById("submitAnswerBtn");
  submitBtn.disabled = true;
  submitBtn.style.backgroundColor = "#ccc";
  submitBtn.style.cursor = "not-allowed";

  if (question.type === "multiple") {
    const selectedEls = document.querySelectorAll(".choice-item.selected");
    if (selectedEls.length === 0 && !isAuto) {
      alert("정답을 선택해주세요.");
      resetSubmitButtonStyle(submitBtn);
      return;
    }
    payload.selectedIndexes = [...selectedEls].map(el => parseInt(el.dataset.index));

  } else if (question.type === "ox") {
    const selected = document.querySelector(".ox-choice-item.ox-choice-selected");
    if (!selected && !isAuto) {
      alert("정답을 선택해주세요.");
      resetSubmitButtonStyle(submitBtn);
      return;
    }
    payload.selectedAnswer = selected?.dataset?.value || "";

  } else if (question.type === "short") {
    const input = document.getElementById("shortAnswerInput");
    const answerText = input?.value.trim();
    if (!answerText && !isAuto) {
      alert("정답을 입력해주세요.");
      resetSubmitButtonStyle(submitBtn);
      return;
    }
    payload.shortAnswer = answerText || "";

  } else {
    alert("지원되지 않는 문제 유형입니다.");
    resetSubmitButtonStyle(submitBtn);
    return;
  }

  try {
    const res = await fetch(`/api/rooms/submit/${roomCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      submitAnswer.submitted = submitAnswer.submitted || {};
      submitAnswer.submitted[currentQuestionIndex] = true;

      const isCorrect = data.correct;

      if (!isHost) {
        alert(isCorrect ? "정답입니다! 🎉" : "틀렸습니다. ❌");
      }

      if (isHost) {
        document.getElementById("showResultBtn").style.display = "inline-block";
      }

    } else {
      alert("제출 실패: " + (data.message || "서버 오류"));
    }

  } catch (err) {
    console.error("제출 중 오류:", err);
    alert("서버 오류로 제출에 실패했습니다.");
  }
}

function resetSubmitButtonStyle(btn) {
  btn.disabled = false;
  btn.style.backgroundColor = "";
  btn.style.cursor = "pointer";
}

//타이머
function startTimer(limitSeconds, endTime) {
  clearInterval(timerInterval);
  const timerText = document.getElementById("timerText");

  const update = () => {
    const now = Date.now();
    let remaining;

    if (endTime) {
      remaining = Math.floor((endTime - now) / 1000);
    } else {
      remaining = limitSeconds;
    }

    if (remaining < 0) remaining = 0;

    const min = String(Math.floor(remaining / 60)).padStart(2, "0");
    const sec = String(remaining % 60).padStart(2, "0");
    timerText.textContent = `${min}:${sec}`;

    if (remaining === 1) { 
      if (!submitAnswer.submitted?.[currentQuestionIndex]) {
        submitAnswer(true);
      } else {
        disableSubmitButton();
      }
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerText.textContent = `00:00`;
    } else {
      limitSeconds--;
    }
  };

  enableSubmitButton();
  update();
  timerInterval = setInterval(update, 1000);
}

function disableSubmitButton() {
  const btn = document.getElementById("submitAnswerBtn");
  if (btn) {
    btn.disabled = true;
    btn.style.backgroundColor = "#ccc";
    btn.style.cursor = "not-allowed";
  }
}

function enableSubmitButton() {
  const btn = document.getElementById("submitAnswerBtn");
  if (btn) {
    btn.disabled = false;
    btn.style.backgroundColor = "";
    btn.style.cursor = "pointer";
  }
}

function renderCurrentChart(index) {
  if (index === 1) {
    const correctRate = parseFloat(document.getElementById("correctRateText").textContent) || 0;
    const totalParticipants = document.querySelectorAll("#scoreRankingList li").length;
    const correctCount = Math.round((correctRate / 100) * totalParticipants);
    const incorrectCount = totalParticipants - correctCount;
    renderCorrectRateChart(correctCount, incorrectCount);
  }
}

// 결과 모달 업데이트 함수
let multipleChart = null;
let multipleCorrectChart = null;
let oxChart = null;
let oxCorrectChart = null;

function updateResultModal(data) {
  const question = questions[currentQuestionIndex];
  const type = question?.type;

  ["result-multiple", "result-ox", "result-short"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display    = "none";
      el.style.position   = "absolute";
      el.style.top        = "-9999px";
      el.style.left       = "-9999px";
      el.style.visibility = "hidden";
      el.classList.remove("active", "next", "prev");
    }
  });

  let activeSectionId = "";
  if (type === "multiple") {
    activeSectionId = "result-multiple";
    renderMultipleCharts(data, question);
  } else if (type === "ox") {
    activeSectionId = "result-ox";
    renderOXCharts(data, question);
  } else if (type === "short") {
    activeSectionId = "result-short";
    renderShortAnswerResults(data);
  }

  if (activeSectionId) {
    const el = document.getElementById(activeSectionId);
    el.style.display    = "block";
    el.style.position   = "relative";
    el.style.top        = "auto";
    el.style.left       = "auto";
    el.style.visibility = "visible";
    el.classList.add("active");
    el.classList.remove("next", "prev");
  }

  const prevBtn = document.getElementById("prevSlideBtn");
  const nextBtn = document.getElementById("nextSlideBtn");

  if (type === "short") {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  } else {
    prevBtn.style.display = "block";
    nextBtn.style.display = "block";
  }

  document.getElementById("closeResultBtn").style.display = isHost ? "inline-block" : "none";
  document.getElementById("resultModal").style.display = "block";

  if (window.innerWidth <= 768) {
    if (type === "multiple") {
      setupMultipleMobileSlides();
    } else if (type === "ox") {
      initializeOXMobileSlides();
    } else {
      initializeMobileSlides();
    }
  }
}

function renderMultipleCharts(data, question) {
  const canvas2 = document.getElementById("multipleCorrectChart");

  if (multipleCorrectChart) multipleCorrectChart.destroy();
  const barsContainer = document.querySelector(".multiple-bars");
  barsContainer.innerHTML = "";

  const allIndexes = question.choices.map((_, idx) => idx);
  const counts = allIndexes.map(idx => data.choiceCounts?.[idx] ?? 0);
  const total = counts.reduce((sum, c) => sum + c, 0);
  const safeTotal = total > 0 ? total : 1;

  allIndexes.forEach(idx => {
    const count = data.choiceCounts?.[idx] ?? 0;
    const percent = Math.round((count / safeTotal) * 100);
    const bar = document.createElement("div");
    bar.className = "multiple-bar";
    const labelDiv = document.createElement("div");
    labelDiv.className = "multiple-bar-label";
    labelDiv.textContent = `${idx + 1}번\n(${count}명)`;
    const graphDiv = document.createElement("div");
    graphDiv.className = "multiple-bar-graph";
    const fillDiv = document.createElement("div");
    fillDiv.className = "multiple-bar-fill";
    if (percent > 0) {
      fillDiv.style.width = `${percent}%`;
    } else {
      fillDiv.style.width = "1cm";
    }

    graphDiv.appendChild(fillDiv);
    bar.appendChild(labelDiv);
    bar.appendChild(graphDiv);
    barsContainer.appendChild(bar);
  });

  const correct = data.correctCount || 0;
  const wrong = data.incorrectCount || 0;
  multipleCorrectChart = new Chart(canvas2.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["정답자", "오답자"],
      datasets: [{
        data: [correct, wrong],
        backgroundColor: ["#4CAF50", "#F44336"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.raw}명`
          }
        }
      }
    }
  });
}

function renderOXCharts(data, question) {
  const correctCanvas = document.getElementById("oxCorrectChart");
  const oCount = data.choiceCounts?.O || 0;
  const xCount = data.choiceCounts?.X || 0;
  const oCountElement = document.getElementById("oxOCount");
  const xCountElement = document.getElementById("oxXCount");
  if (oCountElement) oCountElement.textContent = `${oCount}명`;
  if (xCountElement) xCountElement.textContent = `${xCount}명`;

  if (oxCorrectChart) oxCorrectChart.destroy();

  if (correctCanvas) {
    oxCorrectChart = new Chart(correctCanvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["정답자", "오답자"],
        datasets: [{
          data: [data.correctCount || 0, data.incorrectCount || 0],
          backgroundColor: ["#4CAF50", "#F44336"],
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        animation: {
          duration: 600,
          easing: 'easeOutCubic'
        },
        plugins: {
          legend: {
            display: true,
            position: "bottom"
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${ctx.raw}명`
            }
          }
        }
      }
    });
  }
}

function renderShortAnswerResults(data) {
  const container = document.getElementById("shortPostits");
  container.innerHTML = "";

  const wrongAnswers = data.wrongAnswers || [];
  const shuffled = wrongAnswers.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 10);

  while (selected.length < 10) {
    selected.push("❌");
  }

  selected.forEach(answer => {
    const div = document.createElement("div");
    div.className = "postit";
    div.textContent = answer;
    container.appendChild(div);
  });

  renderShortGaugeBar(data.correctCount || 0, data.incorrectCount || 0);
}


//주관식 막대 그래프
function renderShortGaugeBar(correctCount, incorrectCount) {
  const total = correctCount + incorrectCount;
  const safeTotal = total > 0 ? total : 1;

  const correctRatio = (correctCount / safeTotal) * 100;
  const wrongRatio = 100 - correctRatio;

  const correctBar = document.getElementById("gauge-correct");
  const wrongBar = document.getElementById("gauge-wrong");
  const rateBox = document.getElementById("shortGaugeRate");

  correctBar.style.width = `${correctRatio}%`;
  wrongBar.style.width = `${wrongRatio}%`;

  const roundedRate = total > 0 ? Math.round(correctRatio) : 0;

  if (rateBox) {
    rateBox.textContent = `정답률: ${roundedRate}%`;
  }
}

// 모바일 슬라이드 초기화 함수
function initializeMobileSlides() {
  if (questions[currentQuestionIndex]?.type === "multiple") return;

  const sections = document.querySelectorAll('.result-section');
  let currentIndex = 0;

  sections.forEach((section, index) => {
    section.classList.remove('active', 'next', 'prev');
    if (index === 0) {
      section.classList.add('active');
    }
  });

  document.getElementById('prevSlideBtn').onclick = () => {
    if (currentIndex > 0) {
      sections[currentIndex].classList.remove('active');
      sections[currentIndex].classList.add('next');
      currentIndex--;
      sections[currentIndex].classList.remove('prev');
      sections[currentIndex].classList.add('active');
    }
  };

  document.getElementById('nextSlideBtn').onclick = () => {
    if (currentIndex < sections.length - 1) {
      sections[currentIndex].classList.remove('active');
      sections[currentIndex].classList.add('prev');
      currentIndex++;
      sections[currentIndex].classList.remove('next');
      sections[currentIndex].classList.add('active');
    }
  };
}

//결과보기 함수
async function showResult() {
  try {
    const userEmail = await getDecryptedEmail();

    const res = await fetch(`${API_URL}/rooms/result/${roomCode}/${currentQuestionIndex}?userId=${userEmail}`);
    const data = await res.json();

    if (!data.success) {
      alert("결과 불러오기 실패");
      return;
    }

    console.log("[DEBUG] result data:", data);

    const question = questions[currentQuestionIndex];

    const correctCount = data.correctRate
      ? Math.round(data.correctRate / 100 * (data.ranking?.length || 1))
      : 0;
    const total = data.ranking?.length || 0;
    const incorrectCount = total - correctCount;

    // 공통 필드로 설정
    data.correctCount = correctCount;
    data.incorrectCount = incorrectCount;

    if (question.type === "multiple" || question.type === "ox") {
      data.choiceCounts = data.choiceCounts || {};
    }

    if (question.type === "short") {
      data.wrongAnswers = data.shortAnswers || [];
    }

    // 결과 모달 업데이트
    updateResultModal(data);

    // WebSocket 전송 (방장만)
    if (isHost && stompClient?.connected) {
      stompClient.send(`/app/room/${roomCode}/showResult`, {}, JSON.stringify({
        type: "showResult",
        ...data
      }));
    }

    if (isHost) {
      document.getElementById("nextQuestionBtn").style.display = "inline-block";
    }

  } catch (error) {
    console.error("결과 불러오기 중 오류:", error);
    alert("서버 오류로 결과를 불러오지 못했습니다.");
  }
}

function renderCorrectRateChart(correctCount, wrongCount) {
  const canvas = document.getElementById("correctRateChart");
  if (!canvas) return;

  // 최소 1명은 존재하도록 보정 (그래프가 아예 비어 있으면 오류 발생 방지)
  if (correctCount === 0 && wrongCount === 0) {
    correctCount = 1;
    wrongCount = 0;
  }

  const ctx = canvas.getContext("2d");

  if (correctChart) {
    correctChart.destroy();
  }

  correctChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["정답자", "오답자"],
      datasets: [{
        data: [correctCount, wrongCount],
        backgroundColor: ["#4CAF50", "#F44336"],
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          display: true,
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.raw || 0;
              return `${label}: ${value}명`;
            }
          }
        }
      }
    }
  });
}

//상단 버튼
function showQuizScreen() {
  document.getElementById("lobbyScreen").style.display = "none";
  document.getElementById("quizScreen").style.display = "block";
  renderQuestion();

  const nextBtn = document.getElementById("nextQuestionBtn");
  const startBtn = document.getElementById("quizStartControlBtn");
  const resultBtn = document.getElementById("showResultBtn");
  const topControls = document.getElementById("topControls");
  const exitBtn = document.getElementById("exitQuizBtn");

  // 퀴즈 나가기 버튼은 모든 사용자에게 표시
  exitBtn.style.display = "inline-block";
  topControls.style.display = "flex";

  if (isHost) {
    nextBtn.style.display = "none";
    startBtn.style.display = "inline-block";
    resultBtn.style.display = "inline-block";
    setHostEventListeners();
  } else {
    nextBtn.style.display = "none";
    startBtn.style.display = "none";
    resultBtn.style.display = "none";
  }
}

//결과보기 버튼
document.getElementById("closeResultBtn").addEventListener("click", () => {
  document.getElementById("resultModal").style.display = "none";

  if (isHost && stompClient) {
    stompClient.send(`/app/room/${roomCode}/showResult`, {}, JSON.stringify({
      type: "closeResult"
    }));
    document.getElementById("nextQuestionBtn").style.display = "inline-block";
  }
});

//채팅전송
document.getElementById("sendChatBtn").addEventListener("click", () => {
  const messageInput = document.getElementById("chatInput");
  const message = messageInput.value.trim();
  const nickname = localStorage.getItem("nickname") || "익명";

  if (!message) return;

  stompClient.send(`/app/room/${roomCode}/sendChat`, {}, JSON.stringify({
    nickname,
    message
  }));

  messageInput.value = "";
});

//익명 채팅
function appendChatMessage(nickname, message, isMe = false) {
  const chatMessages = document.getElementById("chatMessages");
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("chat-message");
  if (isMe) msgDiv.classList.add("me");

  msgDiv.innerHTML = `<strong>${nickname}</strong><br>${message}`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 채팅 전송 함수
const messageInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
function sendChatMessage() {
  const message = messageInput.value.trim();
  const nickname = localStorage.getItem("nickname") || "익명";

  if (!message) return;

  stompClient.send(`/app/room/${roomCode}/sendChat`, {}, JSON.stringify({
    nickname,
    message
  }));

  messageInput.value = "";
}
sendChatBtn.addEventListener("click", sendChatMessage);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

//객관식 슬라이드 모바일
function setupMultipleMobileSlides() {
  const pie  = document.querySelector("#result-multiple .multiple-pie");
  const bars = document.querySelector("#result-multiple .multiple-bars");
  const leftBtn = document.getElementById("prevSlideBtn");
  const rightBtn = document.getElementById("nextSlideBtn");

  if (!pie || !bars || !leftBtn || !rightBtn) return;

  let currentPage = 0;

  function updateSlides() {
    if (currentPage === 0) {
      pie.classList.add("active");
      pie.classList.remove("next", "prev");

      bars.classList.remove("active");
      bars.classList.add("next");

      leftBtn.style.display = "none";
      rightBtn.style.display = "block";
    } else {
      bars.classList.add("active");
      bars.classList.remove("next", "prev");

      pie.classList.remove("active");
      pie.classList.add("prev");

      leftBtn.style.display = "block";
      rightBtn.style.display = "none";
    }
  }

  currentPage = 0;
  updateSlides();

  rightBtn.onclick = () => {
    currentPage = 1;
    updateSlides();
  };

  leftBtn.onclick = () => {
    currentPage = 0;
    updateSlides();
  };
}

//주관식 슬라이드 모바일
function initializeOXMobileSlides() {
  const oxWrapper = document.querySelector("#result-ox .result-ox-wrapper");
  const sections = Array.from(oxWrapper.querySelectorAll(".ox-column"));
  let currentIndex = 1; // 중앙(차트)부터 시작

  // ✅ 각 ox-column에 .ox-image 없으면 자동 생성
  sections.forEach((column, index) => {
    let imageDiv = column.querySelector('.ox-image');
    if (!imageDiv) {
      imageDiv = document.createElement('div');
      imageDiv.classList.add('ox-image');
      column.insertBefore(imageDiv, column.firstChild);
    }
  });

  // ✅ 슬라이드 보여주기
  function showSlide(index) {
    sections.forEach((el, i) => {
      el.classList.remove("active", "prev", "next");
      if (i === index) el.classList.add("active");
      else if (i < index) el.classList.add("prev");
      else el.classList.add("next");
    });
  }

  showSlide(currentIndex);

  const prevBtn = document.getElementById("prevSlideBtn");
  const nextBtn = document.getElementById("nextSlideBtn");

  prevBtn.onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      showSlide(currentIndex);
    }
  };

  nextBtn.onclick = () => {
    if (currentIndex < sections.length - 1) {
      currentIndex++;
      showSlide(currentIndex);
    }
  };
}

//모바일 채팅 팝업 열기/닫기 이벤트 처리
function setupMobileChatEvents() {
  const mobileChatBtn = document.getElementById("mobileChatBtn");
  const mobileChatPopup = document.getElementById("mobileChatPopup");
  const closeMobileChat = document.getElementById("closeMobileChat");

  if (mobileChatBtn && mobileChatPopup) {
    mobileChatBtn.addEventListener("click", () => {
      mobileChatPopup.style.display = "flex";
      mobileChatBtn.style.display = "none";
    });
  }

  if (closeMobileChat && mobileChatBtn && mobileChatPopup) {
    closeMobileChat.addEventListener("click", () => {
      mobileChatPopup.style.display = "none";
      mobileChatBtn.style.display = "block";
    });
  }
}

//모바일 채팅 메시지 전송 함수
function setupMobileChatSend() {
  const mobileChatInput = document.getElementById("mobileChatInput");
  const sendMobileChatBtn = document.getElementById("sendMobileChatBtn");

  function sendMobileChat() {
    const message = mobileChatInput.value.trim();
    const nickname = localStorage.getItem("nickname") || "익명";

    if (!message || !stompClient?.connected) return;

    stompClient.send(`/app/room/${roomCode}/sendChat`, {}, JSON.stringify({
      nickname,
      message
    }));

    mobileChatInput.value = "";
  }

  if (sendMobileChatBtn) {
    sendMobileChatBtn.addEventListener("click", sendMobileChat);
  }

  if (mobileChatInput) {
    mobileChatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMobileChat();
      }
    });
  }
}

// 퀴즈 나가기 버튼 이벤트 리스너
document.getElementById("exitQuizBtn").addEventListener("click", () => {
  if (confirm("퀴즈를 나가시겠습니까? 진행 중인 퀴즈는 저장되지 않습니다.")) {
    window.location.href = "/";
  }
});

// 이전 문제 버튼 클릭 이벤트 핸들러
function showPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    const newIndex = currentQuestionIndex - 1;
    if (isHost) {
      fetch(`${API_URL}/ws/questionIndex/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentQuestionIndex: newIndex })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            currentQuestionIndex = newIndex;
            renderQuestion();
            updateNavigationButtons();
            sendQuestionIndex(newIndex);
          } else {
            alert("문제를 넘길 수 없습니다.");
          }
        })
        .catch(error => {
          console.error("문제 인덱스 변경 오류:", error);
          alert("서버 오류로 문제를 넘길 수 없습니다.");
        });
    }
  }
}

// 이전/다음 문제 버튼 표시 상태 업데이트
function updateNavigationButtons() {
  const prevBtn = document.getElementById("prevQuestionBtn");
  const nextBtn = document.getElementById("nextQuestionBtn");
  const resultBtn = document.getElementById("showResultBtn");

  if (isHost) {
    prevBtn.style.display = currentQuestionIndex > 0 ? "inline-block" : "none";
    nextBtn.style.display = currentQuestionIndex < questions.length - 1 ? "inline-block" : "none";
    resultBtn.style.display = currentQuestionIndex === questions.length - 1 ? "inline-block" : "none";
  } else {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    resultBtn.style.display = "none";
  }
}