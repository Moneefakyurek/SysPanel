from flask import Flask, render_template, jsonify, request, redirect, url_for, session
import sqlite3, os, platform
from datetime import datetime
from functools import wraps

# محاولة استيراد psutil - اختياري
try:
    import psutil
    HAS_PSUTIL = True
except:
    HAS_PSUTIL = False

app = Flask(__name__)
app.secret_key = "syspanel-munif-2024"
DB = os.path.join(os.path.dirname(__file__), "syspanel.db")

# ══════════════════════════════════════════
#  قاعدة البيانات
# ══════════════════════════════════════════
def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            last_login TEXT,
            status TEXT DEFAULT 'offline'
        );
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT DEFAULT 'info',
            message TEXT NOT NULL,
            user TEXT DEFAULT 'System',
            timestamp TEXT
        );
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            port TEXT,
            status TEXT DEFAULT 'running',
            last_active TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)
    # بيانات افتراضية
    try:
        conn.execute("INSERT INTO users (name,username,password,role,status) VALUES (?,?,?,?,?)",
                     ("Munif Hejab","munif","munif@2026","admin","online"))
        conn.execute("INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)",
                     ("Ahmed Khalid","ahmed","user123","user"))
        # خدمات افتراضية
        services = [
            ("SSH","22","running"),("Nginx","80, 443","running"),
            ("MySQL","3306","running"),("FTP","21","running"),
            ("DNS","53","running"),("Samba","445","stopped"),
        ]
        for s in services:
            conn.execute("INSERT INTO services (name,port,status,last_active) VALUES (?,?,?,?)",
                         (s[0],s[1],s[2],datetime.now().strftime("%Y-%m-%d %H:%M")))
        # إعدادات افتراضية
        defaults = [
            ("server_name","munif-server"),("timezone","Asia/Riyadh"),
            ("firewall","on"),("auto_update","on"),
            ("notifications","on"),("ssh_password","off"),("save_logs","on"),
        ]
        for k,v in defaults:
            conn.execute("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)",(k,v))
        # سجلات افتراضية
        logs = [
            ("ok","تهيئة النظام بنجاح","System"),
            ("ok","تسجيل دخول — Munif Hejab","Munif"),
            ("warn","استخدام RAM تجاوز 75%","System"),
            ("error","محاولة دخول فاشلة — IP: 192.168.1.55","مجهول"),
            ("ok","إضافة مستخدم Ahmed Khalid","Munif"),
            ("info","تحديث إعدادات جدار الحماية","Munif"),
            ("warn","مساحة Disk تجاوزت 40%","System"),
            ("error","فشل خدمة SSH — إعادة تشغيل تلقائي","System"),
        ]
        for l in logs:
            conn.execute("INSERT INTO logs (type,message,user,timestamp) VALUES (?,?,?,?)",
                         (l[0],l[1],l[2],datetime.now().strftime("%Y-%m-%d %H:%M")))
        conn.commit()
    except:
        pass
    conn.close()

def add_log(type, message, user="System"):
    conn = get_db()
    conn.execute("INSERT INTO logs (type,message,user,timestamp) VALUES (?,?,?,?)",
                 (type, message, user, datetime.now().strftime("%Y-%m-%d %H:%M")))
    conn.commit()
    conn.close()

# ══════════════════════════════════════════
#  حماية الصفحات
# ══════════════════════════════════════════
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated

# ══════════════════════════════════════════
#  الصفحات
# ══════════════════════════════════════════
@app.route("/")
@login_required
def index():
    return render_template("dashboard.html", user=session["user"])

@app.route("/login", methods=["GET","POST"])
def login_page():
    if "user" in session:
        return redirect(url_for("index"))
    error = None
    if request.method == "POST":
        u = request.form.get("username","").strip()
        p = request.form.get("password","").strip()
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE username=? AND password=?", (u,p)).fetchone()
        conn.close()
        if user:
            session["user"] = dict(user)
            conn2 = get_db()
            conn2.execute("UPDATE users SET last_login=?, status='online' WHERE id=?",
                          (datetime.now().strftime("%Y-%m-%d %H:%M"), user["id"]))
            conn2.commit(); conn2.close()
            add_log("ok", f"تسجيل دخول ناجح — {user['name']}", user["name"])
            return redirect(url_for("index"))
        else:
            error = "اسم المستخدم أو كلمة المرور غير صحيحة"
            add_log("error", f"محاولة دخول فاشلة — {u}", "مجهول")
    return render_template("login.html", error=error)

@app.route("/logout")
def logout():
    if "user" in session:
        conn = get_db()
        conn.execute("UPDATE users SET status='offline' WHERE id=?", (session["user"]["id"],))
        conn.commit(); conn.close()
        add_log("info", f"تسجيل خروج — {session['user']['name']}", session["user"]["name"])
    session.clear()
    return redirect(url_for("login_page"))

# ══════════════════════════════════════════
#  API — إحصائيات النظام
# ══════════════════════════════════════════
@app.route("/api/stats")
@login_required
def api_stats():
    if HAS_PSUTIL:
        cpu = round(psutil.cpu_percent(interval=0.3))
        mem = psutil.virtual_memory()
        dsk = psutil.disk_usage("/")
        net = psutil.net_io_counters()
        data = {
            "cpu": cpu,
            "ram": round(mem.percent),
            "ram_used": round(mem.used/1024**3, 1),
            "ram_total": round(mem.total/1024**3, 1),
            "disk": round(dsk.percent),
            "disk_used": round(dsk.used/1024**3, 1),
            "disk_total": round(dsk.total/1024**3, 1),
            "net_sent": round(net.bytes_sent/1024**2, 1),
            "net_recv": round(net.bytes_recv/1024**2, 1),
            "os": platform.system() + " " + platform.release(),
            "hostname": platform.node(),
        }
    else:
        import random
        data = {
            "cpu": random.randint(20,60), "ram": 67,
            "ram_used": 10.7, "ram_total": 16.0,
            "disk": 42, "disk_used": 210.0, "disk_total": 500.0,
            "net_sent": round(random.uniform(1,5),1),
            "net_recv": round(random.uniform(0.5,3),1),
            "os": "Ubuntu 24.04 LTS", "hostname": "munif-server",
        }
    return jsonify(data)

# ══════════════════════════════════════════
#  API — المستخدمون
# ══════════════════════════════════════════
@app.route("/api/users")
@login_required
def api_users():
    conn = get_db()
    rows = conn.execute("SELECT id,name,username,role,last_login,status FROM users ORDER BY id").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/users/add", methods=["POST"])
@login_required
def api_users_add():
    if session["user"]["role"] != "admin":
        return jsonify({"ok": False, "msg": "غير مصرّح"})
    d = request.json
    if not d.get("name") or not d.get("username") or not d.get("password"):
        return jsonify({"ok": False, "msg": "جميع الحقول مطلوبة"})
    try:
        conn = get_db()
        conn.execute("INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)",
                     (d["name"], d["username"], d["password"], d.get("role","user")))
        conn.commit(); conn.close()
        add_log("ok", f"إضافة مستخدم — {d['name']}", session["user"]["name"])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "msg": "اسم المستخدم موجود مسبقاً"})

@app.route("/api/users/delete/<int:uid>", methods=["DELETE"])
@login_required
def api_users_delete(uid):
    if session["user"]["role"] != "admin":
        return jsonify({"ok": False, "msg": "غير مصرّح"})
    if uid == session["user"]["id"]:
        return jsonify({"ok": False, "msg": "لا يمكن حذف حسابك"})
    conn = get_db()
    u = conn.execute("SELECT name FROM users WHERE id=?", (uid,)).fetchone()
    if u:
        conn.execute("DELETE FROM users WHERE id=?", (uid,))
        conn.commit()
        add_log("ok", f"حذف مستخدم — {u['name']}", session["user"]["name"])
    conn.close()
    return jsonify({"ok": True})

# ══════════════════════════════════════════
#  API — السجلات
# ══════════════════════════════════════════
@app.route("/api/logs")
@login_required
def api_logs():
    conn = get_db()
    rows = conn.execute("SELECT * FROM logs ORDER BY id DESC LIMIT 100").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/logs/clear", methods=["DELETE"])
@login_required
def api_logs_clear():
    if session["user"]["role"] != "admin":
        return jsonify({"ok": False})
    conn = get_db()
    conn.execute("DELETE FROM logs")
    conn.commit(); conn.close()
    add_log("info", "مسح جميع السجلات", session["user"]["name"])
    return jsonify({"ok": True})

# ══════════════════════════════════════════
#  API — الخدمات
# ══════════════════════════════════════════
@app.route("/api/services")
@login_required
def api_services():
    conn = get_db()
    rows = conn.execute("SELECT * FROM services ORDER BY id").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/services/toggle/<int:sid>", methods=["POST"])
@login_required
def api_services_toggle(sid):
    conn = get_db()
    svc = conn.execute("SELECT * FROM services WHERE id=?", (sid,)).fetchone()
    if svc:
        new_status = "stopped" if svc["status"] == "running" else "running"
        conn.execute("UPDATE services SET status=?, last_active=? WHERE id=?",
                     (new_status, datetime.now().strftime("%Y-%m-%d %H:%M"), sid))
        conn.commit()
        add_log("info" if new_status=="running" else "warn",
                f"{'تشغيل' if new_status=='running' else 'إيقاف'} خدمة {svc['name']}",
                session["user"]["name"])
    conn.close()
    return jsonify({"ok": True, "status": new_status})

# ══════════════════════════════════════════
#  API — الإعدادات
# ══════════════════════════════════════════
@app.route("/api/settings")
@login_required
def api_settings():
    conn = get_db()
    rows = conn.execute("SELECT * FROM settings").fetchall()
    conn.close()
    return jsonify({r["key"]: r["value"] for r in rows})

@app.route("/api/settings/update", methods=["POST"])
@login_required
def api_settings_update():
    d = request.json
    conn = get_db()
    for k, v in d.items():
        conn.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", (k, v))
    conn.commit(); conn.close()
    add_log("info", "تحديث الإعدادات", session["user"]["name"])
    return jsonify({"ok": True})

# ══════════════════════════════════════════
#  التشغيل
# ══════════════════════════════════════════
if __name__ == "__main__":
    init_db()
    print("\n" + "="*45)
    print("  🚀  SysPanel يعمل على: http://localhost:5000")
    print("  👤  المستخدم: munif  |  كلمة المرور: admin123")
    print("="*45 + "\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
