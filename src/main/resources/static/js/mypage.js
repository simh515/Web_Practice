document.addEventListener("DOMContentLoaded", async () => {
  const email = await getDecryptedEmail();
  if (!email) {
    alert("로그인이 필요합니다.");
    location.href = "login.html";
    return;
  }

  const res = await fetch(`/api/auth/user/info?email=${encodeURIComponent(email)}`);
  const data = await res.json();

  if (data.success) {
    document.getElementById("email").value = data.email;
    document.getElementById("nickname").value = data.displayName;
  } else {
    alert("사용자 정보를 불러올 수 없습니다.");
  }

  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }
});

function handleLogout() {
  sessionStorage.removeItem("userEmail");
  localStorage.removeItem("loggedInUser");
  alert("로그아웃되었습니다.");
  window.location.href = "index.html";
}

function showDeletePasswordInput() {
  document.getElementById("delete-step1").classList.add("hidden");
  document.getElementById("delete-step2").classList.remove("hidden");
}

async function verifyDeletePassword() {
  const email = await getDecryptedEmail();
  const password = document.getElementById("delete-password").value;
  const errorBox = document.getElementById("delete-error");

  if (!password) {
    alert("비밀번호를 입력해주세요.");
    return;
  }

  const res = await fetch("/api/auth/verify-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.valid) {
    const confirmRes = await fetch("/api/auth/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const deleteResult = await confirmRes.json();

    if (deleteResult.success) {
      alert("탈퇴가 완료되었습니다.");
      sessionStorage.removeItem("userEmail");
      localStorage.removeItem("loggedInUser");
      location.href = "login.html";
    } else {
      alert("탈퇴 실패: " + deleteResult.message);
    }
  } else {
    errorBox.classList.remove("hidden");
  }
}

function showCurrentPasswordInput() {
  document.getElementById("step1").classList.add("hidden");
  document.getElementById("step2").classList.remove("hidden");
}

async function verifyCurrentPassword() {
  const email = await getDecryptedEmail();
  const current = document.getElementById("current-password").value;

  const res = await fetch("/api/auth/verify-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: current })
  });
  const data = await res.json();

  const errorText = document.getElementById("step2-error");

  if (data.valid) {
    document.getElementById("step2").classList.add("hidden");
    document.getElementById("step3").classList.remove("hidden");
    errorText.classList.add("hidden");
  } else {
    errorText.classList.remove("hidden");
  }
}

function validateNewPassword() {
  const pw = document.getElementById("new-password").value;
  const feedback = document.getElementById("pw-feedback");

  const isLongEnough = pw.length >= 8;
  const hasSpecialChar = /[^A-Za-z0-9]/.test(pw);

  if (!isLongEnough || !hasSpecialChar) {
    feedback.textContent = "비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.";
  } else {
    feedback.textContent = "";
  }
}

async function submitNewPassword() {
  const email = await getDecryptedEmail();
  const current = document.getElementById("current-password").value;
  const newPw = document.getElementById("new-password").value;
  const confirmPw = document.getElementById("confirm-password").value;

  const valid = newPw.length >= 8 && /[^A-Za-z0-9]/.test(newPw);
  if (!valid) {
    alert("비밀번호 형식을 확인하세요.");
    return;
  }

  if (newPw !== confirmPw) {
    alert("비밀번호 확인이 일치하지 않습니다.");
    return;
  }

  const res = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      currentPassword: current,
      newPassword: newPw
    })
  });

  const data = await res.json();
  alert(data.message);
}

function showNicknamePasswordInput() {
  document.getElementById("nickname-step1").classList.add("hidden");
  document.getElementById("nickname-step2").classList.remove("hidden");
}

async function verifyNicknamePassword() {
  const email = await getDecryptedEmail();
  const password = document.getElementById("nickname-password").value;
  const errorText = document.getElementById("nickname-step2-error");

  const res = await fetch("/api/auth/verify-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.valid) {
    document.getElementById("nickname-step2").classList.add("hidden");
    document.getElementById("nickname-step3").classList.remove("hidden");
    errorText.classList.add("hidden");
  } else {
    errorText.classList.remove("hidden");
  }
}

async function checkNicknameDuplicate() {
  const newNickname = document.getElementById("new-nickname").value.trim();
  const feedback = document.getElementById("nickname-check-feedback");
  const saveBtn = document.getElementById("save-nickname-btn");

  if (!newNickname) {
    feedback.textContent = "닉네임을 입력해주세요.";
    feedback.classList.remove("success-text");
    feedback.classList.add("error-text");
    saveBtn.classList.add("hidden");
    return;
  }

  try {
    const res = await fetch(`/api/auth/check-nickname?name=${encodeURIComponent(newNickname)}`);
    const data = await res.json();

    if (!data.exists) {
      feedback.textContent = "사용 가능한 닉네임입니다.";
      feedback.classList.remove("error-text");
      feedback.classList.add("success-text");
      saveBtn.classList.remove("hidden");
    } else {
      feedback.textContent = "이미 사용 중인 닉네임입니다.";
      feedback.classList.remove("success-text");
      feedback.classList.add("error-text");
      saveBtn.classList.add("hidden");
    }
  } catch (error) {
    feedback.textContent = "오류가 발생했습니다.";
    feedback.classList.remove("success-text");
    feedback.classList.add("error-text");
    saveBtn.classList.add("hidden");
  }
}

async function submitNewNickname() {
  const email = await getDecryptedEmail();
  const newNickname = document.getElementById("new-nickname").value;

  const res = await fetch("/api/auth/change-nickname", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, newNickname })
  });

  const data = await res.json();
  if (data.success) {
    alert("닉네임이 변경되었습니다.");
    document.getElementById("nickname").value = newNickname;
    location.reload();
  } else {
    alert("닉네임 변경 실패: " + data.message);
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  menu.classList.toggle("active");
}
