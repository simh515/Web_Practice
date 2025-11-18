let questions = [];
let currentIndex = -1;
let currentTemplate = 'classic';

const roomCode = new URLSearchParams(window.location.search).get("code");
const label = document.createElement("div");
label.className = "question-label";

function addQuestion() {
  const newQuestion = {
    type: "multiple",
    text: "",
    choices: ["", ""],
    image: "",
    name: "",
    time: 30,
    score: 100,
    correctAnswer: []
  };
  questions.push(newQuestion);
  currentIndex = questions.length - 1;
  renderQuestionList();
  loadQuestion(currentIndex);
}

function renderQuestionList() {
  const list = document.getElementById("question-list");
  list.innerHTML = "";

  questions.forEach((q, idx) => {
    const li = document.createElement("li");
    li.className = "question-item";
    li.setAttribute("draggable", "true");
    li.setAttribute("data-index", idx);

    const label = document.createElement("div");
    label.className = "question-label";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = q.name || `문제 ${idx + 1}`;
    label.appendChild(titleSpan);

    const editBtn = document.createElement("img");
    editBtn.src = "images/pencil.png";
    editBtn.className = "edit-icon";
    editBtn.title = "이름 수정";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      const newName = prompt("문제 이름을 입력하세요:", q.name || `문제 ${idx + 1}`);
      if (newName !== null) {
        q.name = newName;
        renderQuestionList();
      }
    };

    const deleteBtn = document.createElement("img");
    deleteBtn.src = "images/trash.png";
    deleteBtn.className = "delete-icon";
    deleteBtn.title = "문제 삭제";
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`문제 "${q.name || `문제 ${idx + 1}`}"을 삭제할까요?`)) {
    
        const publicId = questions[idx].publicId;
        if (publicId) {
          try {
            await fetch("/api/upload/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publicId })
            });
            console.log(`Cloudinary 이미지 삭제됨: ${publicId}`);
          } catch (err) {
            console.error("이미지 삭제 실패:", err);
          }
        }
    
        questions.splice(idx, 1);
        if (currentIndex >= idx) currentIndex--;
        if (questions.length === 0) {
          currentIndex = -1;
        } else if (currentIndex < 0) {
          currentIndex = 0;
        }
        renderQuestionList();
        if (currentIndex >= 0) loadQuestion(currentIndex);
      }
    };
    

    const iconBox = document.createElement("div");
    iconBox.style.display = "flex";
    iconBox.style.gap = "6px";
    iconBox.appendChild(editBtn);
    iconBox.appendChild(deleteBtn);
    label.appendChild(iconBox);

    li.appendChild(label);

    if (q.image) {
      const thumb = document.createElement("img");
      thumb.src = q.image;
      thumb.className = "thumbnail";
      li.appendChild(thumb);
    }

    li.onclick = () => loadQuestion(idx);
    list.appendChild(li);
  });

  initDragAndDrop();
}


function loadQuestion(index) {
  currentIndex = index;
  const q = questions[index];
  document.getElementById("question-type").value = q.type;
  document.getElementById("question-text").value = q.text;
  document.getElementById("question-time").value = q.time || 30;
  document.getElementById("question-score").value = q.score || 100;

  const previewImg = document.getElementById("custom-upload-button");
  if (previewImg) {
    previewImg.src = q.image || "images/noimg.png";
  }

  currentTemplate = (q.templateImageName || "classic.png").replace(".png", "");

  updateChoices();
  updateAnswerUI();
  renderPreview();
}

function updateChoices() {
  const container = document.getElementById("choices-container");
  const type = document.getElementById("question-type").value;
  const q = questions[currentIndex];
  q.type = type;
  container.innerHTML = "";

  if (type === "ox") {
    q.choices = ["O", "X"];
  } else if (type === "short") {
    q.choices = [];
  } else {
    if (!q.choices || q.choices.length < 2) q.choices = ["", ""];
    q.choices.forEach((choice, idx) => {
      const input = document.createElement("input");
      input.value = choice;
      input.placeholder = `보기 ${idx + 1}`;
      input.oninput = e => {
        q.choices[idx] = e.target.value;
        renderPreview();
      };
      container.appendChild(input);
    });

    if (q.choices.length < 4) {
      const addBtn = document.createElement("button");
      addBtn.textContent = "보기 추가";
      addBtn.onclick = () => {
        q.choices.push("");
        updateChoices();
      };
      container.appendChild(addBtn);
    }
  }

  updateAnswerUI();
  renderPreview();
}

document.getElementById("question-type").addEventListener("change", updateChoices);
document.getElementById("question-text").addEventListener("input", e => {
  if (currentIndex >= 0) {
    questions[currentIndex].text = e.target.value;
    renderPreview();
  }
});
document.getElementById("question-time").addEventListener("input", e => {
  if (currentIndex >= 0) {
    questions[currentIndex].time = parseInt(e.target.value) || 30;
    renderPreview();
  }
});
document.getElementById("question-score").addEventListener("input", e => {
  if (currentIndex >= 0) {
    questions[currentIndex].score = parseInt(e.target.value) || 100;
  }
});

function updateAnswerUI() {
  const container = document.getElementById("answer-settings");
  container.innerHTML = "";
  const q = questions[currentIndex];
  if (!q) return;

  if (q.type === "multiple") {
    const label = document.createElement("label");
    label.textContent = "정답 개수";
    const select = document.createElement("select");
    [1, 2, 3, 4].forEach(n => {
      const option = document.createElement("option");
      option.value = n;
      option.textContent = n;
      select.appendChild(option);
    });
    container.appendChild(label);
    container.appendChild(select);

    const inputArea = document.createElement("div");
    inputArea.className = "answer-number-boxes";
    container.appendChild(inputArea);

    function renderInputs(count) {
      inputArea.innerHTML = "";
      if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length !== count) {
        let existing = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
        q.correctAnswer = new Array(count);
        for (let i = 0; i < count; i++) {
          q.correctAnswer[i] = existing[i];
        }
      }
      for (let i = 0; i < count; i++) {
        const input = document.createElement("input");
        input.type = "number";
        input.min = 1;
        input.max = 4;
        input.placeholder = `정답 ${i + 1}`;
        if (q.correctAnswer[i] !== undefined && q.correctAnswer[i] !== null) {
          input.value = q.correctAnswer[i] + 1;
        }
        input.oninput = e => {
          q.correctAnswer[i] = parseInt(e.target.value) - 1;
        };
        inputArea.appendChild(input);
      }
    }

    const answerCount = Array.isArray(q.correctAnswer) && q.correctAnswer.length > 0 
                        ? q.correctAnswer.length 
                        : 1;
    select.value = answerCount;
    renderInputs(answerCount);

    select.addEventListener("change", e => {
      renderInputs(parseInt(e.target.value));
    });
  } else if (q.type === "ox") {
    const input = document.createElement("input");
    input.placeholder = "정답 (O 또는 X)";
    input.maxLength = 1;
    if (typeof q.correctAnswer === "string") {
      input.value = q.correctAnswer;
    }
    input.oninput = e => {
      q.correctAnswer = e.target.value.toUpperCase();
    };
    container.appendChild(input);
  } else if (q.type === "short") {
    const textarea = document.createElement("textarea");
    textarea.placeholder = "정답 텍스트 입력";
    if (typeof q.correctAnswer === "string") {
      textarea.value = q.correctAnswer;
    }
    textarea.oninput = e => {
      q.correctAnswer = e.target.value;
    };
    container.appendChild(textarea);
  }
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file || currentIndex < 0) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload/image", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.secure_url) {
      questions[currentIndex].image = data.secure_url;
      questions[currentIndex].publicId = data.public_id;

      const previewImg = document.getElementById("custom-upload-button");
      if (previewImg) {
        previewImg.src = data.secure_url;
      }

      renderPreview();
      renderQuestionList();
    } else {
      alert("이미지 업로드 실패: " + JSON.stringify(data));
    }
  } catch (err) {
    console.error("이미지 업로드 오류:", err);
    alert("이미지 업로드 중 오류 발생");
  }
}

function renderPreview() {
  if (currentIndex < 0) return;
  const q = questions[currentIndex];

  document.getElementById("preview-time").textContent = `${q.time || 30}초`;
  document.getElementById("preview-score").textContent = `배점: ${q.score || 100}점`;
  document.getElementById("preview-text").textContent = q.text;

  const img = document.getElementById("preview-image");
  img.style.display = q.image ? "block" : "none";
  img.src = q.image || "";

  const container = document.getElementById("preview-choices");
  container.innerHTML = "";

  if (q.type === "short") {
    const wrapper = document.createElement("div");
    wrapper.className = "short-answer-wrapper";
  
    const inputBox = document.createElement("input");
    inputBox.type = "text";
    inputBox.placeholder = "정답을 입력하세요...";
    inputBox.className = "short-answer-on-sentence";
  
    wrapper.appendChild(inputBox);
    container.appendChild(wrapper);
  }   
  else {
    const grid = document.createElement("div");
    grid.className = "answer-grid";
    const choicesToRender = q.type === "ox" ? ["O", "X"] : q.choices;

    choicesToRender.forEach((choice, idx) => {
      const choiceDiv = document.createElement("div");
      const label = document.createElement("div");
      label.className = "choice-label";
      label.textContent = choice;

      if (q.type === "ox") {
        choiceDiv.className = "choice-box ox-choice-box";
        choiceDiv.style.backgroundImage = `url('images/${choice.toLowerCase()}.png')`;
        label.style.display = "none";
      } else {
        choiceDiv.className = "choice-box";
        choiceDiv.style.backgroundImage = `url('images/choice${idx + 1}.png')`;
      }

      choiceDiv.appendChild(label);
      grid.appendChild(choiceDiv);
    });

    container.appendChild(grid);
  }

  // 배경 템플릿
  const previewBox = document.getElementById("preview-box");
  previewBox.style.backgroundImage = `url('/images/${currentTemplate}.png')`;
  previewBox.style.backgroundSize = "cover";
  previewBox.style.backgroundPosition = "center";
  previewBox.style.backgroundRepeat = "no-repeat";
}


function selectTemplate(templateName) {
  currentTemplate = templateName;
  if (currentIndex >= 0) {
    questions[currentIndex].templateImageName = templateName + ".png";
  }
  renderPreview();
}


function initDragAndDrop() {
  const listItems = document.querySelectorAll(".question-item");
  let dragStartIndex;
  listItems.forEach(item => {
    item.addEventListener("dragstart", () => {
      dragStartIndex = +item.dataset.index;
      item.classList.add("dragging");
    });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      item.classList.add("drag-over");
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });
    item.addEventListener("drop", () => {
      const dropIndex = +item.dataset.index;
      reorderQuestions(dragStartIndex, dropIndex);
      item.classList.remove("drag-over");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });
  });
}

function reorderQuestions(from, to) {
  if (from === to) return;
  const moved = questions.splice(from, 1)[0];
  questions.splice(to, 0, moved);
  renderQuestionList();
  if (currentIndex === from) currentIndex = to;
  else if (from < currentIndex && currentIndex <= to) currentIndex--;
  else if (from > currentIndex && currentIndex >= to) currentIndex++;
  loadQuestion(currentIndex);
}

function convertQuestionsToQueFormat() {
  return questions.map(q => {
    let formattedAnswer;
    if (q.type === "multiple") {
      formattedAnswer = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
    } else if (q.type === "ox" || q.type === "short") {
      formattedAnswer = typeof q.correctAnswer === "string" ? q.correctAnswer : "";
    } else {
      formattedAnswer = "";
    }
    return {
      type: q.type || "multiple",
      name: q.name || "",
      questionText: q.text,
      questionImage: q.image,
      choices: q.choices,
      correctAnswer: formattedAnswer,
      time: q.time || 30,
      score: q.score || 100,
      templateImageName: q.templateImageName || "classic.png"
    };
  });
}

document.getElementById("remove-image-button").addEventListener("click", async () => {
  if (currentIndex < 0) return;

  const currentQuestion = questions[currentIndex];
  const publicId = currentQuestion.publicId;
  if (publicId) {
    try {
      const res = await fetch("/api/upload/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ publicId })
      });
      const data = await res.json();
      console.log("Cloudinary 삭제 응답:", data);
    } catch (err) {
      console.error("Cloudinary 이미지 삭제 실패:", err);
    }
  }

  currentQuestion.image = "";
  currentQuestion.publicId = "";

  const previewImg = document.getElementById("custom-upload-button");
  if (previewImg) {
    previewImg.src = "images/noimg.png";
  }

  renderPreview();
  renderQuestionList();
});



document.getElementById("save-button").addEventListener("click", () => {
  const queList = convertQuestionsToQueFormat();
  if (!roomCode) {
    alert("방 코드가 없습니다.");
    return;
  }
  fetch(`/api/rooms/${roomCode}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queList)
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) alert("저장되었습니다!");
      else alert("저장 실패: " + data.message);
    })
    .catch(err => {
      console.error(err);
      alert("저장 중 오류가 발생했습니다.");
    });
});

document.getElementById("exit-button").addEventListener("click", () => {
  window.location.href = "/roomop.html";
});

window.addEventListener("DOMContentLoaded", async () => {
  const loggedInUser = await getDecryptedEmail();
  const roomCode = new URLSearchParams(window.location.search).get("code");

  console.log("복호화된 이메일:", loggedInUser);
  console.log("URL 파라미터로 받은 방 코드:", roomCode);

  if (!loggedInUser) {
    alert("로그인이 필요합니다.");
    window.location.href = "/login.html";
    return;
  }

  if (!roomCode) {
    alert("방 코드가 없습니다.");
    window.location.href = "/roomop.html";
    return;
  }

  try {
    const res = await fetch(`/api/rooms/info?code=${roomCode}`);
    const data = await res.json();

    console.log("백엔드 응답:", data);
    console.log("백엔드 방장 이메일:", data.professorEmail);
    console.log("복호화된 사용자 이메일:", loggedInUser);

    if (!data.success) {
      alert("방 정보를 불러오지 못했습니다.");
      window.location.href = "/roomop.html";
      return;
    }

    if (data.professorEmail !== loggedInUser) {
      alert("이 방을 수정할 권한이 없습니다.");
      window.location.href = "/roomop.html";
      return;
    }

    if (Array.isArray(data.testQuestions) && data.testQuestions.length > 0) {
      console.log("받은 testQuestions 배열:", data.testQuestions);

      questions = data.testQuestions
        .filter(Boolean)
        .map(q => {
          if (!q) return null;

          let parsedAnswer = q.correctAnswer;
          if (typeof parsedAnswer === "string" || Array.isArray(parsedAnswer)) {
          } else if (typeof parsedAnswer === "number") {
            parsedAnswer = [parsedAnswer];
          } else {
            parsedAnswer = [];
          }

          return {
            type: q.type || "multiple",
            text: q.questionText || "",
            image: q.questionImage || "",
            choices: q.choices || [],
            correctAnswer: parsedAnswer,
            name: q.name || "",
            time: q.time || 30,
            score: q.score || 100,
            templateImageName: q.templateImageName || "classic.png"
          };
        })
        .filter(Boolean);

      currentIndex = 0;
      renderQuestionList();
      loadQuestion(currentIndex);
    } else {
      console.warn("testQuestions가 비어 있음 또는 존재하지 않음");
      questions = [];
      currentIndex = -1;
      renderQuestionList();
    }
  } catch (err) {
    console.error("방 정보 로딩 중 오류:", err);
    alert("데이터 처리 중 오류가 발생했습니다.");
    window.location.href = "/roomop.html";
  }
});
