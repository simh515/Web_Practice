const API_URL = "/api/auth";

async function login() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
        alert("이메일과 비밀번호를 입력하세요.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            alert("로그인 성공!");
            await storeEncryptedEmail(email);
             localStorage.setItem("loggedInUser", data.displayName);
            window.location.href = "index.html";
        } else {
            alert("로그인 실패: " + data.message);
        }
    } catch (error) {
        console.error("로그인 오류:", error);
    }
}

//회원가입
async function register() {
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm").value;
    const displayName = document.getElementById("register-nickname").value.trim();
    const emailCode = document.getElementById("register-email-code").value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("올바른 이메일 형식이 아닙니다.");
        return;
    }

    const verified = await verifyEmailCode(email, emailCode);
    if (!verified) {
        alert("이메일 인증 코드가 올바르지 않습니다.");
        return;
    }

    if (displayName.length < 2 || displayName.length > 10 || /\s/.test(displayName)) {
        alert("닉네임은 2~10자 이내, 공백 없이 입력하세요.");
        return;
    }

    const duplicate = await checkNicknameDuplicate(displayName);
    if (duplicate) {
        alert("이미 사용 중인 닉네임입니다.");
        return;
    }

    const pwValid = password.length >= 8 && /[^A-Za-z0-9]/.test(password);
    if (!pwValid) {
        alert("비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.");
        return;
    }

    if (password !== confirmPassword) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

    fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert("회원가입 성공!");
            toggleRegister();
        } else {
            alert("회원가입 실패: " + data.message);
        }
    })
    .catch(err => {
        console.error("회원가입 오류:", err);
        alert("오류가 발생했습니다.");
    });
}

//회원가입 페이지 전환
function goToStep(stepNumber) {
  const steps = document.querySelectorAll(".register-step");
  steps.forEach((step, idx) => {
    step.classList.toggle("hidden", idx !== stepNumber - 1);
  });
}

//회원가입 페이지 전환2
async function handleCodeNext() {
  const email = document.getElementById("register-email").value.trim();
  const code = document.getElementById("register-email-code").value.trim();

  const verified = await verifyEmailCode(email, code);
  if (!verified) {
    alert("인증 코드가 올바르지 않습니다.");
    return;
  }

  document.getElementById("final-email").textContent = email;
  goToStep(3);
}

//회원가입 이메일 페이지 전환
async function handleEmailNext() {
  const email = document.getElementById("register-email").value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    alert("올바른 이메일 형식이 아닙니다.");
    return;
  }

  const emailExists = await checkEmailExists(email);
  if (emailExists) {
    alert("이미 가입된 이메일입니다.");
    return;
  }

  sendEmailCode();

  const displayEmailEl = document.getElementById("display-email");
  if (displayEmailEl) {
    displayEmailEl.textContent = email;
  }

  goToStep(2);
}


//이메일 인증
async function verifyEmailCode(email, code) {
    const res = await fetch("/api/auth/verify-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    return data.verified;
}

//이메일 전송
function sendEmailCode() {
    const email = document.getElementById("register-email").value.trim();
    if (!email) {
        alert("이메일을 입력하세요.");
        return;
    }

    fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert("인증 코드가 이메일로 전송되었습니다.");
        } else {
            alert("전송 실패: " + data.message);
        }
    })
    .catch(err => {
        console.error("이메일 전송 오류:", err);
        alert("이메일 전송 중 오류가 발생했습니다.");
    });
}

//이메일 중복확인
async function checkEmailExists(email) {
  const res = await fetch("/api/auth/check-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  return data.exists;
}

//이메일 인증버튼
async function verifyEmailCodeUI() {
  const email = document.getElementById("register-email").value.trim();
  const code = document.getElementById("register-email-code").value.trim();
  const resultBox = document.getElementById("email-verify-result");

  const verified = await verifyEmailCode(email, code);

  resultBox.textContent = verified ? "✅ 인증 성공!" : "❌ 인증 실패";
  resultBox.style.color = verified ? "green" : "red";
}

//닉네임 중복 확인 UI
async function checkNickname() {
    const nickname = document.getElementById("register-nickname").value.trim();
    if (!nickname) {
        alert("닉네임을 입력하세요.");
        return;
    }
    const exists = await checkNicknameDuplicate(nickname);
    if (exists) {
        alert("이미 사용 중인 닉네임입니다.");
    } else {
        alert("사용 가능한 닉네임입니다.");
    }
}

//닉네임 중복 검사 API
async function checkNicknameDuplicate(nickname) {
    const res = await fetch(`/api/auth/check-nickname?name=${encodeURIComponent(nickname)}`);
    const data = await res.json();
    return data.exists;
}

function toggleRegister() {
  const loginContainer = document.querySelector(".login-container");
  const registerContainer = document.querySelector(".register-container");

  const isRegistering = registerContainer.classList.contains("hidden");

  if (isRegistering) {
    loginContainer.classList.add("hidden");
    registerContainer.classList.remove("hidden");
    goToStep(1);
  } else {
    loginContainer.classList.remove("hidden");
    registerContainer.classList.add("hidden");
  }
}

//비밀번호 체크
function validatePassword() {
  const pw = document.getElementById("register-password").value;
  const feedback = document.getElementById("password-feedback");

  const isLongEnough = pw.length >= 8;
  const hasSpecialChar = /[^A-Za-z0-9]/.test(pw);

  feedback.innerHTML = `
    <span style="color: ${isLongEnough ? 'green' : 'red'};">✔ 8자 이상</span>
    <span style="color: ${hasSpecialChar ? 'green' : 'red'};">✔ 특수문자 포함</span>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
    const authButton = document.getElementById("authButton");
    const userGreeting = document.getElementById("userGreeting");

    const loggedInUser = localStorage.getItem("loggedInUser");

    if (loggedInUser) {
        if (authButton) {
            authButton.textContent = "로그아웃";
            authButton.className = "logout-btn";
            authButton.onclick = logout;
        }
        if (userGreeting) {
            userGreeting.textContent = `안녕하세요 ${loggedInUser} 님`;
        }
    } else {
        if (authButton) {
            authButton.textContent = "로그인";
            authButton.className = "login-btn";
            authButton.onclick = () => window.location.href = "login.html";
        }
        if (userGreeting) {
            userGreeting.textContent = "";
        }
    }
});


function logout() {
  sessionStorage.removeItem("userEmail");
    localStorage.removeItem("loggedInUser");
    alert("로그아웃되었습니다.");
    location.reload();
}

//비밀번호 찾기
function toggleFind() {
  document.querySelector(".login-container").classList.add("hidden");
  document.querySelector(".register-container").classList.add("hidden");
  document.querySelector(".find-container").classList.remove("hidden");
  goToFindStep(1);
}

function goToFindStep(step) {
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`find-step${i}`).classList.add("hidden");
  }
  document.getElementById(`find-step${step}`).classList.remove("hidden");
}

function backToLogin() {
  document.querySelector(".login-container").classList.remove("hidden");
  document.querySelector(".register-container").classList.add("hidden");
  document.querySelector(".find-container").classList.add("hidden");
}

async function sendFindCode() {
  const email = document.getElementById("find-email").value.trim();
  if (!email) {
    alert("이메일을 입력하세요.");
    return;
  }

  const emailExists = await checkEmailExists(email);
  if (!emailExists) {
    alert("해당 이메일로 가입된 계정이 없습니다.");
    return;
  }

  const res = await fetch("/api/auth/send-email-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await res.json();
  if (data.success) {
    document.getElementById("find-display-email").textContent = email;
    goToFindStep(2);
  } else {
    alert("1분 후 다시 시도해주세요.");
  }
}

async function verifyFindCode() {
  const email = document.getElementById("find-email").value.trim();
  const code = document.getElementById("find-code").value.trim();
  if (!code) {
    alert("인증코드를 입력하세요.");
    return;
  }

  const res = await fetch("/api/auth/verify-email-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code })
  });

  const data = await res.json();
  if (data.verified) {
    goToFindStep(3);
  } else {
    alert("인증코드가 잘못되었습니다.");
  }
}

function validateFindPassword() {
  const pw = document.getElementById("find-new-password").value;
  const feedback = document.getElementById("find-password-feedback");

  const isLongEnough = pw.length >= 8;
  const hasSpecialChar = /[^A-Za-z0-9]/.test(pw);

  if (!isLongEnough || !hasSpecialChar) {
    feedback.textContent = "비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.";
  } else {
    feedback.textContent = "";
  }
}

//비밀번호 초기화
async function resetPassword() {
  const email = document.getElementById("find-email").value;
  const newPassword = document.getElementById("find-new-password").value;
  const confirmPassword = document.getElementById("find-confirm-password").value;
  const feedback = document.getElementById("find-password-feedback");

  const isValid = newPassword.length >= 8 && /[^A-Za-z0-9]/.test(newPassword);
  if (!isValid) {
    feedback.textContent = "비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.";
    return;
  }

  if (newPassword !== confirmPassword) {
    feedback.textContent = "비밀번호 확인이 일치하지 않습니다.";
    return;
  }

  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      newPassword
    })
  });

  const data = await res.json();

  if (data.success) {
    alert("비밀번호가 성공적으로 변경되었습니다. 다시 로그인해 주세요.");
    location.href = "login.html";
  } else {
    alert("비밀번호 변경 실패: " + data.message);
  }
}

//엔터키 로그인
document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
});