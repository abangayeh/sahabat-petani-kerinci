const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return match ? match[1] : "";
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value) {
  return base64url(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

async function hashPassword(password, salt = base64url(crypto.getRandomValues(new Uint8Array(16))), iterations = 210000) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${iterations}$${salt}$${base64url(bits)}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  return (await hashPassword(password, parts[2], iterations)) === stored;
}

async function adminValid(request, env) {
  const value = getCookie(request, "spk_admin");
  if (!value || !env.SESSION_SECRET) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(env.SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sig = Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
      c => c.charCodeAt(0)
    );
    const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return await crypto.subtle.verify("HMAC", key, sig, enc.encode(payload)) &&
      data.role === "admin" && data.exp > Date.now();
  } catch { return false; }
}

async function makeAdminToken(secret) {
  const payload = base64url(enc.encode(JSON.stringify({
    exp: Date.now() + 8 * 60 * 60 * 1000,
    role: "admin"
  })));
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = base64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return payload + "." + signature;
}

const adminCookie = (value, age) =>
  `spk_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const userCookie = (value, age) =>
  `spk_user=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;

async function currentUser(request, env) {
  const token = getCookie(request, "spk_user");
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT u.id,u.name,u.email,u.phone,u.role,u.status " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' LIMIT 1"
  ).bind(await sha256(token), new Date().toISOString()).first();
  return row || null;
}

async function createUserSession(env, userId) {
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (user_id,token_hash,expires_at) VALUES (?,?,?)"
  ).bind(userId, await sha256(token), expiry).run();
  return token;
}

const num = value => Number.isFinite(Number(value)) ? Number(value) : NaN;
const isMethod = (method, ...allowed) => allowed.includes(method);

export async function onRequest({ request, env, params }) {
  const path = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  const [resource, id] = path.split("/");
  const method = request.method.toUpperCase();

  if (!env.DB) return json({ error: "Database D1 belum terhubung." }, 503);

  try {
    const isAdmin = await adminValid(request, env);

    // ADMIN LOGIN / LOGOUT / SESSION
    if (resource === "login" && method === "POST") {
      const body = await readBody(request);
      if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
        return json({ error: "Secret ADMIN_PASSWORD dan SESSION_SECRET belum dipasang." }, 503);
      }
      if (typeof body.password !== "string" || body.password !== env.ADMIN_PASSWORD) {
        return json({ error: "Kata sandi salah." }, 401);
      }
      return json({ ok: true }, 200, {
        "set-cookie": adminCookie(await makeAdminToken(env.SESSION_SECRET), 28800)
      });
    }
    if (resource === "logout" && method === "POST") {
      return json({ ok: true }, 200, { "set-cookie": adminCookie("", 0) });
    }
    if (resource === "me" && method === "GET") {
      return isAdmin ? json({ authenticated: true }) : json({ error: "Belum masuk." }, 401);
    }

    // CUSTOMER / FARMER AUTHENTICATION
    if (resource === "auth" && id === "register" && method === "POST") {
      const body = await readBody(request);
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const password = typeof body.password === "string" ? body.password : "";
      if (name.length < 2 || name.length > 100 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          password.length < 8 || password.length > 200) {
        return json({ error: "Isi nama, email valid, dan kata sandi minimal 8 karakter." }, 400);
      }
      const existing = await env.DB.prepare("SELECT id FROM users WHERE email=? LIMIT 1").bind(email).first();
      if (existing) return json({ error: "Email sudah terdaftar." }, 409);
      const passwordHash = await hashPassword(password);
      const result = await env.DB.prepare(
        "INSERT INTO users (name,email,phone,password_hash,role,status) VALUES (?,?,?,?,'buyer','active')"
      ).bind(name, email, phone.slice(0, 30), passwordHash).run();
      const token = await createUserSession(env, result.meta.last_row_id);
      return json({
        ok: true,
        user: { id: result.meta.last_row_id, name, email, role: "buyer" }
      }, 201, { "set-cookie": userCookie(token, 604800) });
    }

    if (resource === "auth" && id === "login" && method === "POST") {
      const body = await readBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      const user = await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();
      if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) {
        return json({ error: "Email atau kata sandi salah." }, 401);
      }
      const token = await createUserSession(env, user.id);
      return json({
        ok: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      }, 200, { "set-cookie": userCookie(token, 604800) });
    }

    if (resource === "auth" && id === "logout" && method === "POST") {
      const token = getCookie(request, "spk_user");
      if (token) {
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
      }
      return json({ ok: true }, 200, { "set-cookie": userCookie("", 0) });
    }

    if (resource === "auth" && id === "me" && method === "GET") {
      const user = await currentUser(request, env);
      return user ? json({ user }) : json({ error: "Belum masuk." }, 401);
    }

    if (resource === "auth" && id === "become-seller" && method === "POST") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
      await env.DB.prepare("UPDATE users SET role='seller' WHERE id=? AND role='buyer'").bind(user.id).run();
      const updated = await currentUser(request, env);
      return json({ ok: true, user: updated });
    }

    // LEGACY PRICE API - EXISTING D1 TABLE IS PRESERVED
    if (resource === "prices") {
      if (method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id,commodity,price,unit,date,location,source,created_at FROM prices ORDER BY date DESC,id DESC LIMIT 300"
        ).all();
        const latest = Object.values((results || []).reduce((map, row) => {
          if (!map[row.commodity] || row.date > map[row.commodity].date ||
              (row.date === map[row.commodity].date && row.id > map[row.commodity].id)) {
            map[row.commodity] = row;
          }
          return map;
        }, {}));
        return json({
          items: latest.sort((a, b) => a.commodity.localeCompare(b.commodity)),
          history: results || []
        });
      }
      if (!isAdmin) return json({ error: "Sesi admin tidak valid." }, 401);
      if (method === "POST" || (id && method === "PUT")) {
        const body = await readBody(request);
        const price = num(body.price);
        if (!body.commodity || !Number.isFinite(price) || price < 0 ||
            !body.date || !body.location || !body.source) {
          return json({ error: "Lengkapi komoditas, harga, tanggal, wilayah, dan sumber." }, 400);
        }
        const values = [
          String(body.commodity).slice(0, 100), price,
          String(body.unit || "kg").slice(0, 20), String(body.date),
          String(body.location).slice(0, 100), String(body.source).slice(0, 200)
        ];
        if (method === "POST") {
          await env.DB.prepare(
            "INSERT INTO prices (commodity,price,unit,date,location,source) VALUES (?,?,?,?,?,?)"
          ).bind(...values).run();
          return json({ ok: true }, 201);
        }
        const result = await env.DB.prepare(
          "UPDATE prices SET commodity=?,price=?,unit=?,date=?,location=?,source=? WHERE id=?"
        ).bind(...values, Number(id)).run();
        return result.meta.changes ? json({ ok: true }) : json({ error: "Data harga tidak ditemukan." }, 404);
      }
      if (id && method === "DELETE") {
        const result = await env.DB.prepare("DELETE FROM prices WHERE id=?").bind(Number(id)).run();
        return result.meta.changes ? json({ ok: true }) : json({ error: "Data harga tidak ditemukan." }, 404);
      }
    }

    // LEGACY CROPS API
    if (resource === "crops") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM crops ORDER BY name,variety").all();
        return json({ items: results || [] });
      }
      if (!isAdmin) return json({ error: "Sesi admin tidak valid." }, 401);
      const body = await readBody(request);
      if (method === "POST") {
        if (!body.name) return json({ error: "Nama komoditas wajib diisi." }, 400);
        await env.DB.prepare(
          "INSERT INTO crops (name,variety,description,status) VALUES (?,?,?,?)"
        ).bind(
          String(body.name).slice(0, 80), String(body.variety || "").slice(0, 100),
          String(body.description || "").slice(0, 5000),
          body.status === "published" ? "published" : "draft"
        ).run();
        return json({ ok: true }, 201);
      }
      if (id && method === "PUT") {
        const result = await env.DB.prepare(
          "UPDATE crops SET name=?,variety=?,description=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(
          String(body.name || "").slice(0, 80), String(body.variety || "").slice(0, 100),
          String(body.description || "").slice(0, 5000),
          body.status === "published" ? "published" : "draft", Number(id)
        ).run();
        return result.meta.changes ? json({ ok: true }) : json({ error: "Komoditas tidak ditemukan." }, 404);
      }
      if (id && method === "DELETE") {
        const result = await env.DB.prepare("DELETE FROM crops WHERE id=?").bind(Number(id)).run();
        return result.meta.changes ? json({ ok: true }) : json({ error: "Komoditas tidak ditemukan." }, 404);
      }
    }

    // LEGACY NEWS API
    if (resource === "news") {
      if (method === "GET") {
        const query = isAdmin
          ? "SELECT * FROM news ORDER BY date DESC,id DESC LIMIT 100"
          : "SELECT * FROM news WHERE status='published' ORDER BY date DESC,id DESC LIMIT 50";
        const { results } = await env.DB.prepare(query).all();
        return json({ items: results || [] });
      }
      if (!isAdmin) return json({ error: "Sesi admin tidak valid." }, 401);
      const body = await readBody(request);
      if (method === "POST") {
        if (!body.title || !body.summary || !body.date) {
          return json({ error: "Judul, ringkasan, dan tanggal wajib diisi." }, 400);
        }
        await env.DB.prepare(
          "INSERT INTO news (title,summary,date,status) VALUES (?,?,?,?)"
        ).bind(
          String(body.title).slice(0, 180), String(body.summary).slice(0, 2000),
          String(body.date), body.status === "published" ? "published" : "draft"
        ).run();
        return json({ ok: true }, 201);
      }
      if (id && method === "PUT") {
        const result = await env.DB.prepare(
          "UPDATE news SET title=?,summary=?,date=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(
          String(body.title || "").slice(0, 180), String(body.summary || "").slice(0, 2000),
          String(body.date || ""), body.status === "published" ? "published" : "draft", Number(id)
        ).run();
        return result.meta.changes ? json({ ok: true }) : json({ error: "Berita tidak ditemukan." }, 404);
      }
      if (id && method === "DELETE") {
        const result = await env.DB.prepare("DELETE FROM news WHERE id=?").bind(Number(id)).run();
        return result.meta.changes ? json({ ok: true }) : json({ error: "Berita tidak ditemukan." }, 404);
      }
    }

    if (resource === "stats" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT commodity,price,unit,date,location,source FROM prices ORDER BY date ASC,id ASC LIMIT 2000"
      ).all();
      return json({ history: results || [] });
    }

    // PUBLIC MARKETPLACE CATALOG
    if (resource === "products" && method === "GET") {
      if (id) {
        const product = await env.DB.prepare(
          "SELECT p.*,u.name AS seller_name FROM products p JOIN users u ON u.id=p.seller_id " +
          "WHERE p.id=? AND p.status='published' LIMIT 1"
        ).bind(Number(id)).first();
        if (!product) return json({ error: "Produk tidak ditemukan." }, 404);
        const { results: images } = await env.DB.prepare(
          "SELECT id,image_url FROM product_images WHERE product_id=? ORDER BY id"
        ).bind(Number(id)).all();
        return json({ product, images: images || [] });
      }
      const { results } = await env.DB.prepare(
        "SELECT p.id,p.seller_id,p.name,p.category,p.description,p.price,p.unit,p.stock,p.location,p.created_at,u.name AS seller_name " +
        "FROM products p JOIN users u ON u.id=p.seller_id " +
        "WHERE p.status='published' ORDER BY p.created_at DESC LIMIT 100"
      ).all();
      return json({ items: results || [] });
    }

    if (resource === "my-products" && method === "GET") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
      const { results } = await env.DB.prepare(
        "SELECT * FROM products WHERE seller_id=? ORDER BY created_at DESC"
      ).bind(user.id).all();
      return json({ items: results || [] });
    }

    if (resource === "products" && !["GET", "HEAD"].includes(method)) {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
      if (!["seller", "admin"].includes(user.role)) return json({ error: "Akun belum memiliki hak penjual." }, 403);

      if (method === "POST" && !id) {
        const body = await readBody(request);
        const price = num(body.price), stock = num(body.stock);
        if (!body.name || !body.category || !Number.isFinite(price) || price < 0 ||
            !Number.isFinite(stock) || stock < 0) {
          return json({ error: "Lengkapi nama, kategori, harga, dan stok yang valid." }, 400);
        }
        const result = await env.DB.prepare(
          "INSERT INTO products (seller_id,name,category,description,price,unit,stock,location,status) " +
          "VALUES (?,?,?,?,?,?,?,?, 'pending')"
        ).bind(
          user.id, String(body.name).slice(0, 150), String(body.category).slice(0, 80),
          String(body.description || "").slice(0, 5000), price,
          String(body.unit || "kg").slice(0, 20), stock, String(body.location || "").slice(0, 150)
        ).run();
        return json({ ok: true, id: result.meta.last_row_id, status: "pending" }, 201);
      }

      if (id && method === "PUT") {
        const body = await readBody(request);
        const price = num(body.price), stock = num(body.stock);
        if (!body.name || !body.category || !Number.isFinite(price) || price < 0 ||
            !Number.isFinite(stock) || stock < 0) {
          return json({ error: "Lengkapi nama, kategori, harga, dan stok yang valid." }, 400);
        }
        const result = await env.DB.prepare(
          "UPDATE products SET name=?,category=?,description=?,price=?,unit=?,stock=?,location=?," +
          "status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND seller_id=?"
        ).bind(
          String(body.name).slice(0, 150), String(body.category).slice(0, 80),
          String(body.description || "").slice(0, 5000), price,
          String(body.unit || "kg").slice(0, 20), stock,
          String(body.location || "").slice(0, 150), Number(id), user.id
        ).run();
        return result.meta.changes ? json({ ok: true, status: "pending" }) : json({ error: "Produk tidak ditemukan." }, 404);
      }

      if (id && method === "DELETE") {
        const result = await env.DB.prepare(
          "DELETE FROM products WHERE id=? AND seller_id=?"
        ).bind(Number(id), user.id).run();
        return result.meta.changes ? json({ ok: true }) : json({ error: "Produk tidak ditemukan." }, 404);
      }
    }

    // ADMIN PRODUCT MODERATION// ADMIN PRODUCT MODERATION
    if (resource === "admin-products") {
      if (!isAdmin) return json({ error: "Sesi admin tidak valid." }, 401);

      if (method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT p.*,u.name AS seller_name,u.email AS seller_email " +
          "FROM products p JOIN users u ON u.id=p.seller_id " +
          "ORDER BY p.created_at DESC LIMIT 200"
        ).all();
        return json({ items: results || [] });
      }

      if (id && method === "PUT") {
        const body = await readBody(request);
        const status = String(body.status || "");
        if (!["pending", "published", "rejected"].includes(status)) {
          return json({ error: "Status tidak valid." }, 400);
        }
        const result = await env.DB.prepare(
          "UPDATE products SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(status, Number(id)).run();
        return result.meta.changes
          ? json({ ok: true, status })
          : json({ error: "Produk tidak ditemukan." }, 404);
      }

      if (id && method === "DELETE") {
        const result = await env.DB.prepare(
          "DELETE FROM products WHERE id=?"
        ).bind(Number(id)).run();
        return result.meta.changes
          ? json({ ok: true })
          : json({ error: "Produk tidak ditemukan." }, 404);
      }
    }

    // FAVORITES
    if (resource === "favorites") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "Silakan masuk terlebih dahulu." }, 401);

      if (method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT p.*,u.name AS seller_name " +
          "FROM favorites f JOIN products p ON p.id=f.product_id " +
          "JOIN users u ON u.id=p.seller_id " +
          "WHERE f.user_id=? ORDER BY f.created_at DESC"
        ).bind(user.id).all();
        return json({ items: results || [] });
      }

      if (method === "POST") {
        const body = await readBody(request);
        const productId = Number(body.product_id);
        if (!Number.isInteger(productId) || productId <= 0) {
          return json({ error: "ID produk tidak valid." }, 400);
        }
        const product = await env.DB.prepare(
          "SELECT id FROM products WHERE id=? AND status='published'"
        ).bind(productId).first();
        if (!product) return json({ error: "Produk tidak ditemukan." }, 404);

        await env.DB.prepare(
          "INSERT OR IGNORE INTO favorites (user_id,product_id) VALUES (?,?)"
        ).bind(user.id, productId).run();
        return json({ ok: true });
      }

      if (method === "DELETE") {
        const productId = Number(id);
        if (!Number.isInteger(productId) || productId <= 0) {
          return json({ error: "ID produk tidak valid." }, 400);
        }
        await env.DB.prepare(
          "DELETE FROM favorites WHERE user_id=? AND product_id=?"
        ).bind(user.id, productId).run();
        return json({ ok: true });
      }
    }

    // PRIVATE MESSAGES
    if (resource === "messages") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "Silakan masuk terlebih dahulu." }, 401);

      if (method === "GET") {
        const otherId = Number(id);
        if (!Number.isInteger(otherId) || otherId <= 0) {
          return json({ error: "ID pengguna tidak valid." }, 400);
        }
        const { results } = await env.DB.prepare(
          "SELECT m.*,s.name AS sender_name,r.name AS receiver_name " +
          "FROM messages m " +
          "JOIN users s ON s.id=m.sender_id " +
          "JOIN users r ON r.id=m.receiver_id " +
          "WHERE (m.sender_id=? AND m.receiver_id=?) " +
          "OR (m.sender_id=? AND m.receiver_id=?) " +
          "ORDER BY m.created_at ASC LIMIT 200"
        ).bind(user.id, otherId, otherId, user.id).all();
        return json({ items: results || [] });
      }

      if (method === "POST") {
        const body = await readBody(request);
        const receiverId = Number(body.receiver_id);
        const productId = body.product_id ? Number(body.product_id) : null;
        const message = String(body.message || "").trim();

        if (!Number.isInteger(receiverId) || receiverId <= 0 ||
            receiverId === user.id || !message || message.length > 2000) {
          return json({ error: "Penerima atau isi pesan tidak valid." }, 400);
        }

        const receiver = await env.DB.prepare(
          "SELECT id FROM users WHERE id=? AND status='active'"
        ).bind(receiverId).first();
        if (!receiver) return json({ error: "Pengguna penerima tidak ditemukan." }, 404);

        if (productId !== null) {
          const product = await env.DB.prepare(
            "SELECT id FROM products WHERE id=? AND status='published'"
          ).bind(productId).first();
          if (!product) return json({ error: "Produk tidak ditemukan." }, 404);
        }

        await env.DB.prepare(
          "INSERT INTO messages (sender_id,receiver_id,product_id,message) VALUES (?,?,?,?)"
        ).bind(user.id, receiverId, productId, message).run();

        return json({ ok: true }, 201);
      }
    }

    // ORDERS
    if (resource === "orders") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "Silakan masuk terlebih dahulu." }, 401);

      if (method === "GET") {
        if (user.role === "admin") {
          const { results } = await env.DB.prepare(
            "SELECT o.*,u.name AS buyer_name " +
            "FROM orders o JOIN users u ON u.id=o.buyer_id " +
            "ORDER BY o.created_at DESC LIMIT 200"
          ).all();
          return json({ items: results || [] });
        }

        const { results } = await env.DB.prepare(
          "SELECT DISTINCT o.*,u.name AS buyer_name " +
          "FROM orders o JOIN users u ON u.id=o.buyer_id " +
          "LEFT JOIN order_items oi ON oi.order_id=o.id " +
          "WHERE o.buyer_id=? OR oi.seller_id=? " +
          "ORDER BY o.created_at DESC LIMIT 200"
        ).bind(user.id, user.id).all();

        return json({ items: results || [] });
      }

      if (method === "POST") {
        const body = await readBody(request);
        const productId = Number(body.product_id);
        const quantity = num(body.quantity);
        const address = String(body.delivery_address || "").trim();
        const notes = String(body.notes || "").trim();

        if (!Number.isInteger(productId) || productId <= 0 ||
            !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 ||
            !address || address.length > 1000 || notes.length > 2000) {
          return json({ error: "Data pesanan tidak valid." }, 400);
        }

        const product = await env.DB.prepare(
          "SELECT id,seller_id,name,price,stock,status " +
          "FROM products WHERE id=? AND status='published'"
        ).bind(productId).first();

        if (!product) return json({ error: "Produk tidak ditemukan." }, 404);
        if (product.seller_id === user.id) {
          return json({ error: "Kamu tidak dapat membeli produk sendiri." }, 400);
        }
        if (Number(product.stock) < quantity) {
          return json({ error: "Stok produk tidak mencukupi." }, 400);
        }

        const price = Number(product.price);
        const total = price * quantity;

        if (!Number.isFinite(total) || total <= 0) {
          return json({ error: "Harga produk tidak valid." }, 400);
        }

        const stockUpdate = await env.DB.prepare(
          "UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP " +
          "WHERE id=? AND stock>=? AND status='published'"
        ).bind(quantity, productId, quantity).run();

        if (!stockUpdate.meta.changes) {
          return json({ error: "Stok baru saja berubah. Silakan coba lagi." }, 409);
        }

        try {
          const orderResult = await env.DB.prepare(
            "INSERT INTO orders (buyer_id,total,status,delivery_address,notes) " +
            "VALUES (?,?, 'pending',?,?)"
          ).bind(user.id, total, address, notes).run();

          const orderId = orderResult.meta.last_row_id;

          await env.DB.prepare(
            "INSERT INTO order_items (order_id,product_id,seller_id,quantity,price,subtotal) " +
            "VALUES (?,?,?,?,?,?)"
          ).bind(
            orderId, productId, product.seller_id, quantity, price, total
          ).run();

          return json({
            ok: true,
            order_id: orderId,
            total,
            status: "pending"
          }, 201);
        } catch (error) {
          await env.DB.prepare(
            "UPDATE products SET stock=stock+? WHERE id=?"
          ).bind(quantity, productId).run();
          throw error;
        }
      }
    }

    return json({ error: "Endpoint tidak ditemukan." }, 404);

  } catch (error) {
    console.error("SPK API error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
