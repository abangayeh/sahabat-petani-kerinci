// ========================================
// SAHABAT PETANI KERINCI
// AUTENTIKASI CLOUDFLARE D1
// ========================================

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

    if (password.length < 8) {
        alert("Kata sandi minimal 8 karakter.");
        return;
    }

    button.disabled = true;
    button.textContent = "Memproses...";

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                name,
                email,
                password,
                role
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Pendaftaran gagal."
            );
        }

        alert("Pendaftaran berhasil! Silakan masuk.");

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
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                email,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Login gagal."
            );
        }

        alert("Login berhasil!");

        if (result.user.role === "seller") {
            window.location.href = "/pages/dashboard-penjual.html";
        } else {
            window.location.href = "/index.html";
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
