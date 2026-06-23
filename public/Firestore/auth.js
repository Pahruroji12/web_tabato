import { auth, signInWithEmailAndPassword } from "../firebase-config.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function getPassword() {
  return ""; 
}

export async function setPassword(newPassword) {
  // Ditangani langsung via Firebase Auth updatePassword di settings.js
}

export function bindAuthEvents(onLoginSuccess) {
  const loginBtn = document.getElementById("loginBtn");

  onAuthStateChanged(auth, (user) => {
    if (user) {
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("appShell").style.display = "block";
      onLoginSuccess();
    } else {
      document.getElementById("loginScreen").style.display = "flex";
      document.getElementById("appShell").style.display = "none";
    }
  });

  async function doLogin() {
    const pw = document.getElementById("passwordInput").value;
    if (!pw) return;

    loginBtn.disabled = true;
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = `<span class="spinner"></span> Loading...`;

    try {
      // Login secara senyap menggunakan email dummy admin@tabato.com
      await signInWithEmailAndPassword(auth, "admin@tabato.com", pw);
      document.getElementById("passwordInput").value = "";
    } catch (error) {
      console.error("Login gagal:", error);
      document.getElementById("loginError").style.display = "block";
      setTimeout(
        () => (document.getElementById("loginError").style.display = "none"),
        3000,
      );
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalText;
    }
  }

  loginBtn.addEventListener("click", doLogin);
  document.getElementById("passwordInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
      await signOut(auth);
      document.getElementById("passwordInput").value = "";
    } catch (e) {
      console.error("Gagal logout:", e);
    }
  });
}

