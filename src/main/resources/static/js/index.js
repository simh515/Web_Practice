const API_URL = "/api";

const slidesData = [
  "images/banner1.png",
  "images/banner2.png",
  "images/banner3.png",
  "images/banner4.png",
  "images/banner5.png"
];

document.addEventListener("DOMContentLoaded", async () => {
  await initAuth();
  loadRooms();
  initCarousel();
  initSwiper();
  initJoinModal(); 
});

/* ===========================
   인증 관련
=========================== */
async function initAuth() {
  const authButton = document.getElementById("authButton");
  const mobileAuthButton = document.getElementById("mobileAuthButton");
  const userGreeting = document.getElementById("userGreeting");
  const loginTextButton = document.getElementById("loginTextButton");

  const loggedInUser = await getDecryptedEmail();

  if (loggedInUser) {
    try {
      const res = await fetch(`${API_URL}/auth/user/info?email=${encodeURIComponent(loggedInUser)}`);
      const data = await res.json();
      if (data.success) {
        userGreeting.textContent = `안녕하세요 ${data.displayName} 님`;
      } else {
        userGreeting.textContent = "";
      }
    } catch (err) {
      console.error("닉네임 불러오기 실패", err);
      userGreeting.textContent = "";
    }

    authButton.textContent = "로그아웃";
    mobileAuthButton.textContent = "로그아웃";
    authButton.className = "logout-btn";
    loginTextButton.style.display = "none";
  } else {
    authButton.textContent = "로그인";
    mobileAuthButton.textContent = "로그인";
    authButton.className = "login-btn";
    userGreeting.textContent = "";
    loginTextButton.style.display = window.innerWidth <= 768 ? "inline-block" : "none";
  }
}

async function handleAuth() {
  const loggedInUser = await getDecryptedEmail();
  if (loggedInUser) {
    sessionStorage.removeItem("userEmail");
    alert("로그아웃되었습니다.");
    location.reload();
  } else {
    window.location.href = "login.html";
  }
}

/* ===========================
   방 관련
=========================== */
async function joinRoom() {
  const roomCode = document.getElementById("room-code").value.trim();
  const roomPassword = document.getElementById("room-password").value.trim();
  const loggedInUser = await getDecryptedEmail();

  if (!roomCode || !roomPassword) {
    alert("방 코드와 비밀번호를 모두 입력하세요!");
    return;
  }

  if (!loggedInUser) {
    alert("로그인 후 참여 가능합니다.");
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch(`${API_URL}/rooms/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: roomCode,
        password: roomPassword,
        userId: loggedInUser
      })
    });
    const data = await res.json();
    if (data.success) {
      alert("방에 참여하였습니다!");
      sessionStorage.setItem("roomPassword", roomPassword);
      window.location.href = `quiz.html?code=${roomCode}`;
    } else {
      alert("방 참여 실패: " + data.message);
    }
  } catch (err) {
    console.error("방 참여 오류:", err);
  }
}

function joinRoomWithCode(code) {
  const password = prompt("비밀번호를 입력하세요:");
  if (password) {
    document.getElementById("room-code").value = code;
    document.getElementById("room-password").value = password;
    joinRoom();
  }
}

function loadRooms() {
  fetch(`${API_URL}/rooms/list`)
    .then(res => res.json())
    .then(data => {
      const roomsList = document.getElementById("rooms");
      roomsList.innerHTML = "";

      if (!data || data.length === 0) {
        roomsList.innerHTML = "<li>방이 존재하지 않습니다.</li>";
        return;
      }

      data.reverse().slice(0, 5).forEach(room => {
        const li = document.createElement("li");
        li.textContent = `방 이름: ${room.name} / 코드: ${room.code}`;
        li.style.cursor = "pointer";
        li.onclick = () => joinRoomWithCode(room.code);
        roomsList.appendChild(li);
      });
    })
    .catch(err => console.error("방 목록 불러오기 오류:", err));
}

/* ===========================
   캐러셀
=========================== */
function initCarousel() {
  const track = document.getElementById("carousel-track");
  const prevBtn = document.querySelector(".carousel-button.prev");
  const nextBtn = document.querySelector(".carousel-button.next");

  if (!track) return;

  slidesData.forEach(src => {
    const slide = document.createElement("div");
    slide.className = "carousel-slide";

    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";

    const img = document.createElement("img");
    img.src = src;
    img.alt = "슬라이드 이미지";
    img.className = "centered-image";

    wrapper.appendChild(img);
    slide.appendChild(wrapper);
    track.appendChild(slide);
  });

  const slides = document.querySelectorAll(".carousel-slide");
  let currentIndex = 0;

  const updateSlidePosition = () => {
    const offset = -currentIndex * 100;
    track.style.transform = `translateX(${offset}%)`;
  };

  prevBtn?.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateSlidePosition();
  });

  nextBtn?.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateSlidePosition();
  });

  setInterval(() => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateSlidePosition();
  }, 5000);
}

/* ===========================
   Swiper 소개 슬라이드
=========================== */
function initSwiper() {
  new Swiper('.swiper', {
    loop: true,
    autoplay: {
      delay: 2500,
      disableOnInteraction: false,
    },
    slidesPerView: 3,
    spaceBetween: 20,
    breakpoints: {
      320: {
        slidesPerView: 1,
        spaceBetween: 10,
      },
      480: {
        slidesPerView: 2,
        spaceBetween: 15,
      },
      769: {
        slidesPerView: 3,
        spaceBetween: 20,
      }
    }
  });
}

/* ===========================
   모바일 메뉴
=========================== */
function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  menu.classList.toggle("active");
}

/* ===========================
   모달 제어
=========================== */
function initJoinModal() {
  const joinModal = document.getElementById("joinModal");
  const joinBtn = document.getElementById("join-toggle-btn");
  const closeModal = document.getElementById("closeModal");

  if (!joinModal || !joinBtn || !closeModal) {
    console.warn("모달 관련 요소가 없습니다.");
    return;
  }

  joinBtn.addEventListener("click", () => {
    joinModal.classList.add("show");
    joinModal.classList.remove("hidden");
  });

  closeModal.addEventListener("click", () => {
    joinModal.classList.remove("show");
    joinModal.classList.add("hidden");
  });

  window.addEventListener("click", (e) => {
    if (e.target === joinModal) {
      joinModal.classList.remove("show");
      joinModal.classList.add("hidden");
    }
  });
}
