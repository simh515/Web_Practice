const API_URL = "/api";
let currentImageTargetCode = null;

document.addEventListener("DOMContentLoaded", async () => {
  const userGreeting = document.getElementById("userGreeting");
  const loggedInUser = await getDecryptedEmail();

  if (!loggedInUser) {
    alert("로그인 후 이용 가능합니다.");
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch(`${API_URL}/auth/user/info?email=${encodeURIComponent(loggedInUser)}`);
    const data = await res.json();

    if (data.success && userGreeting) {
      userGreeting.style.display = "inline-block";
      userGreeting.textContent = `안녕하세요 ${data.displayName} 님`;
    }
  } catch (error) {
    console.error("닉네임 불러오기 실패", error);
    if (userGreeting) {
      userGreeting.style.display = "inline-block";
      userGreeting.textContent = `안녕하세요 ${loggedInUser} 님`;
    }
  }

  loadRooms(loggedInUser);

  const imageInput = document.getElementById("imageInput");
  imageInput.addEventListener("change", handleImageChange);
});

async function handleImageChange(e) {
  const file = e.target.files[0];
  if (!file || !currentImageTargetCode) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    alert("업로드 중입니다...");
    const res = await fetch("/api/upload/image", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.secure_url && data.public_id) {
      const updateRes = await fetch(`${API_URL}/rooms/updateImage/${currentImageTargetCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: data.secure_url,
          imagePublicId: data.public_id
        })
      });
      const updateData = await updateRes.json();
      if (updateData.success) {
        alert("이미지가 업로드되었습니다!");
        const loggedInUser = await getDecryptedEmail();
        loadRooms(loggedInUser);
      } else {
        alert("이미지 저장 실패: " + updateData.message);
      }
    } else {
      alert("Cloudinary 업로드 실패");
    }
  } catch (err) {
    console.error("이미지 업로드 오류:", err);
    alert("이미지 업로드 중 오류 발생");
  }
}

async function handleLogout() {
  sessionStorage.removeItem("userEmail");
  alert("로그아웃되었습니다.");
  window.location.href = "login.html";
}

async function createRoom() {
  const roomName = document.getElementById("room-name").value.trim();
  const roomPassword = document.getElementById("room-password").value.trim();
  const professorEmail = await getDecryptedEmail();

  if (!roomName || !roomPassword) {
    alert("방 이름과 비밀번호를 입력하세요!");
    return;
  }

  fetch(`${API_URL}/rooms/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: roomName, password: roomPassword, professorEmail })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert(`방 생성 성공! 코드: ${data.roomCode}`);
        window.location.href = `room-template.html?code=${data.roomCode}`;
      } else {
        alert("방 생성 실패: " + data.message);
      }
    })
    .catch(error => console.error("방 생성 오류:", error));
}

async function loadRooms(loggedInUser) {
  fetch(`${API_URL}/rooms/list`)
    .then(response => response.json())
    .then(data => {
      const roomGrid = document.getElementById("room-grid");
      roomGrid.innerHTML = "";

      const myRooms = data.filter(room => room.professorEmail === loggedInUser);

      if (myRooms.length === 0) {
        const noRoomText = document.createElement("div");
        noRoomText.textContent = "생성한 방이 없습니다.";
        noRoomText.style.marginTop = "20px";
        roomGrid.appendChild(noRoomText);
        return;
      }

      myRooms.forEach(room => {
        const card = document.createElement("div");
        card.className = "room-card";

        const imgWrapper = document.createElement("div");
        imgWrapper.className = "room-image-wrapper";

        const img = document.createElement("img");
        img.src = room.imageUrl || "images/noduck.png";
        img.alt = "Room Image";
        img.className = "room-image";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        const trashImg = document.createElement("img");
        trashImg.src = "images/trash.png";
        trashImg.alt = "삭제";
        deleteBtn.appendChild(trashImg);

        deleteBtn.onclick = (event) => {
          event.stopPropagation();
          deleteRoom(room.code, room.imagePublicId);
        };

        imgWrapper.appendChild(img);
        imgWrapper.appendChild(deleteBtn);

        const info = document.createElement("div");
        info.className = "room-info";
        const title = document.createElement("div");
        title.textContent = room.name;
        const code = document.createElement("div");
        code.textContent = `코드: ${room.code}`;
        info.appendChild(title);
        info.appendChild(code);

        const btnGroup = document.createElement("div");
        btnGroup.className = "room-buttons";

        const imageBtn = document.createElement("button");
        imageBtn.textContent = "이미지 변경";
        imageBtn.onclick = (event) => {
          event.stopPropagation();
          currentImageTargetCode = room.code;
          document.getElementById("imageInput").click();
        };

        const qrBtn = document.createElement("button");
        qrBtn.textContent = "QR";
        qrBtn.onclick = (event) => {
          event.stopPropagation();
          showQRCode(room.code);
        };

        const quizStateBtn = document.createElement("button");
        quizStateBtn.textContent = "퀴즈 리셋";
        quizStateBtn.onclick = async (event) => {
          event.stopPropagation();
          if (confirm("정말 이 방을 초기화하시겠습니까?")) {
            const res = await fetch(`${API_URL}/rooms/reset/${room.code}`, {
              method: "PUT"
            });
            const data = await res.json();
            if (data.success) {
              alert("방 데이터가 초기화되었습니다.");
              const user = await getDecryptedEmail();
              loadRooms(user);
            } else {
              alert("초기화 실패: " + data.message);
            }
          }
        };

        btnGroup.appendChild(imageBtn);
        btnGroup.appendChild(qrBtn);
        btnGroup.appendChild(quizStateBtn);

        card.appendChild(imgWrapper);
        card.appendChild(info);
        card.appendChild(btnGroup);

        card.onclick = () => {
          window.location.href = `room-template.html?code=${room.code}`;
        };

        roomGrid.appendChild(card);
      });
    })
    .catch(error => console.error("방 목록 불러오기 오류:", error));
}

async function deleteRoom(code, publicId) {
  if (!confirm("정말 이 방을 삭제하시겠습니까?")) return;

  if (publicId) {
    fetch(`/api/upload/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId })
    })
      .then(res => res.json())
      .then(data => {
        console.log("이미지 삭제 결과:", data);
      })
      .catch(err => console.error("이미지 삭제 실패:", err));
  }

  fetch(`${API_URL}/rooms/delete/${code}`, { method: "DELETE" })
    .then(response => response.json())
    .then(async data => {
      if (data.success) {
        alert("방 삭제 성공!");
        const user = await getDecryptedEmail();
        loadRooms(user);
      } else {
        alert("방 삭제 실패: " + data.message);
      }
    })
    .catch(error => console.error("방 삭제 오류:", error));
}

function showQRCode(roomCode) {
  const modal = document.getElementById("qrModal");
  const qrCodeDiv = document.getElementById("qrCode");
  const roomCodeText = document.getElementById("roomCodeText");

  const qr = qrcode(0, 'M');
  qr.addData(`${window.location.origin}/quiz.html?code=${roomCode}`);
  qr.make();

  qrCodeDiv.innerHTML = qr.createImgTag(8);
  roomCodeText.textContent = `방 코드: ${roomCode}`;

  modal.style.display = "block";

  const closeBtn = modal.querySelector(".close");
  closeBtn.onclick = function () {
    modal.style.display = "none";
  };

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
}

function toggleMobileMenu() {
  document.getElementById('mobileMenu').classList.toggle('active');
}
