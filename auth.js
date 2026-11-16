// ========================================
// SUPABASE CONFIGURATION
// ========================================

const SUPABASE_URL = "https://pzgjlotpgdmbqfqouihk.supabase.co";
const SUPABASE_KEY = "sb_publishable_YVctx86LRETCyp8LFE-xPg_DRtOm2dq";

// ========================================
// PROSES PENDAFTARAN
// ========================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = registerForm.querySelector('button[type="submit"]');

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const role = document.getElementById("role").value;

        button.disabled = true;
        button.textContent = "Memproses...";

        try {
            const response = await fetch(
                `${SUPABASE_URL}/auth/v1/signup`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": SUPABASE_KEY
                    },
                    body: JSON.stringify({
                        email,
                        password,
                        data: {
                            full_name: name,
                            role: role
                        }
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.msg ||
                    result.message ||
                    result.error_description ||
                    "Pendaftaran gagal."
                );
            }

            const user = result.user || result;

if (!user.id) {
    throw new Error("Data pengguna tidak ditemukan.");
}

            alert(
                result.session
                    ? "Pendaftaran berhasil! Silakan masuk."
                    : "Pendaftaran berhasil! Silakan periksa email untuk verifikasi."
            );

            window.location.href = "login.html";

        } catch (error) {
            console.error("Registration Error:", error);
            alert("Pendaftaran gagal: " + error.message);

        } finally {
            button.disabled = false;
            button.textContent = "Daftar";
        }
    });
}

// ========================================
// PROSES LOGIN
// ========================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = loginForm.querySelector('button[type="submit"]');

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        button.disabled = true;
        button.textContent = "Memproses...";

        try {
            const response = await fetch(
                `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": SUPABASE_KEY
                    },
                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.msg ||
                    result.message ||
                    result.error_description ||
                    "Login gagal."
                );
            }

            localStorage.setItem("access_token", result.access_token);
            localStorage.setItem("user", JSON.stringify(result.user));

            alert("Login berhasil!");

const role = result.user.user_metadata?.role;

if (role === "seller") {
    window.location.href = "dashboard-penjual.html";
} else {
    window.location.href = "../index.html";
}
        } catch (error) {
            console.error("Login Error:", error);
            alert("Login gagal: " + error.message);

        } finally {
            button.disabled = false;
            button.textContent = "Masuk";
        }
    });
}
