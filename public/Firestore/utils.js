// ============================================================
// ADMIN: UTILS
// Helper format angka/tanggal, badge status, toast notifikasi,
// dan buka/tutup modal generik.
// ============================================================

export function formatRp(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return (
    d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  );
}

export function formatDateShort(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function statusBadge(status) {
  const map = {
    baru: "badge-new",
    menunggu_verifikasi: "badge-menunggu-verifikasi",
    proses: "badge-proses",
    selesai: "badge-selesai",
    batal: "badge-batal",
  };
  const label = {
    baru: "Baru",
    menunggu_verifikasi: "Menunggu Verifikasi",
    proses: "Diproses",
    selesai: "Selesai",
    batal: "Dibatal",
  };
  return `<span class="badge ${map[status] || "badge-new"}">${label[status] || status}</span>`;
}

export function showToast(msg, icon = "bx-info-circle") {
  const t = document.getElementById("toast");
  t.innerHTML = `<i class='bx ${icon}'></i><span>${msg}</span>`;
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 2600);
}

export function openModal(id) {
  document.getElementById(id).classList.add("active");
}

export function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

export function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

