// ============================================================
// ADMIN: SETTINGS
// Form pengaturan toko (nama, tagline, ambang batas stok minimum)
// dan ganti password admin.
// ============================================================

import { adminSettings, saveAdminSettings } from "../admin/state.js";
import { showToast } from "./utils.js";
import { auth, signInWithEmailAndPassword, updatePassword } from "../firebase-config.js";

export function loadSettings() {
  document.getElementById("settingNamaToko").value =
    adminSettings.namaToko || "Tabato";
  document.getElementById("settingTagline").value =
    adminSettings.tagline || "Tahu Baso Toping";
  document.getElementById("settingMinStok").value = adminSettings.minStok || 10;
}

export function saveSettings() {
  const updated = {
    ...adminSettings,
    namaToko: document.getElementById("settingNamaToko").value,
    tagline: document.getElementById("settingTagline").value,
    minStok: parseInt(document.getElementById("settingMinStok").value) || 10,
  };
  saveAdminSettings(updated);
  showToast("Pengaturan disimpan", "bx-check-circle");
}

export async function changePassword() {
  const oldPw = document.getElementById("oldPw").value;
  const newPw = document.getElementById("newPw").value;
  const confirmPw = document.getElementById("confirmPw").value;

  if (!oldPw || !newPw || !confirmPw) {
    showToast("Semua kolom password wajib diisi", "bx-error-circle");
    return;
  }
  if (newPw.length < 6) {
    showToast("Password baru minimal 6 karakter", "bx-error-circle");
    return;
  }
  if (newPw !== confirmPw) {
    showToast("Konfirmasi password tidak sama", "bx-error-circle");
    return;
  }

  const changeBtn = document.querySelector("button[onclick='changePassword()']");
  const originalText = changeBtn ? changeBtn.innerHTML : "";
  if (changeBtn) {
    changeBtn.disabled = true;
    changeBtn.innerHTML = `<span class="spinner"></span> Mengubah...`;
  }

  try {
    // Re-verifikasi password lama dengan masuk ulang secara senyap
    await signInWithEmailAndPassword(auth, "admin@tabato.com", oldPw);

    // Lakukan update password di Firebase Auth
    if (auth.currentUser) {
      await updatePassword(auth.currentUser, newPw);
      document.getElementById("oldPw").value = "";
      document.getElementById("newPw").value = "";
      document.getElementById("confirmPw").value = "";
      showToast("Password berhasil diubah", "bx-check-circle");
    } else {
      showToast("Tidak ada user aktif", "bx-error-circle");
    }
  } catch (e) {
    console.error("Gagal mengubah password:", e);
    showToast("Gagal mengubah password. Pastikan password lama benar.", "bx-error-circle");
  } finally {
    if (changeBtn) {
      changeBtn.disabled = false;
      changeBtn.innerHTML = originalText;
    }
  }
}

