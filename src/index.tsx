import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/cloudflare-workers";
import profileRoutes from "./routes/profile";
import scholarshipRoutes from "./routes/scholarships";
import documentRoutes from "./routes/documents";
import applicationRoutes from "./routes/applications";
import agentRoutes from "./routes/agent";
import professorRoutes from "./routes/professors";

type Bindings = {
  DB: D1Database;
  GROQ_API_KEY?: string;
  SERPER_API_KEY?: string;
  JINA_API_KEY?: string;
  RESEND_API_KEY?: string;
};
const app = new Hono<{ Bindings: Bindings }>();

// ── Inject Cloudflare env secrets into globalThis for lib modules ─
// wrangler injects .dev.vars and wrangler secrets into c.env, not globalThis
// This middleware bridges them so lib functions (ai.ts, email.ts, search.ts) can read them
app.use("*", async (c, next) => {
  if (c.env.GROQ_API_KEY)   (globalThis as any).GROQ_API_KEY   = c.env.GROQ_API_KEY;
  if (c.env.SERPER_API_KEY) (globalThis as any).SERPER_API_KEY = c.env.SERPER_API_KEY;
  if (c.env.JINA_API_KEY)   (globalThis as any).JINA_API_KEY   = c.env.JINA_API_KEY;
  if (c.env.RESEND_API_KEY) (globalThis as any).RESEND_API_KEY = c.env.RESEND_API_KEY;
  await next();
});

app.use("/api/*", cors());
app.use("/static/*", serveStatic({ root: "./" }));

app.route("/api/profile", profileRoutes);
app.route("/api/scholarships", scholarshipRoutes);
app.route("/api/documents", documentRoutes);
app.route("/api/applications", applicationRoutes);
app.route("/api/agent", agentRoutes);
app.route("/api/professors", professorRoutes);

app.get("/api/health", (c) => c.json({ status: "ok", agent: "GETSCO", version: "2.0.0" }));

app.get("/", async (c) => c.html(getDashboardHTML()));
app.get("/scholarships", async (c) => c.html(getScholarshipsHTML()));
app.get("/applications", async (c) => c.html(getApplicationsHTML()));
app.get("/documents", async (c) => c.html(getDocumentsHTML()));
app.get("/profile", async (c) => c.html(getProfileHTML()));
app.get("/professors", async (c) => c.html(getProfessorsHTML()));
app.get("/data", async (c) => c.html(getDataExtractHTML()));

// ── SHARED BASE LAYOUT ───────────────────────────────────────
function getBaseLayout(title: string, activeNav: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} — GETSCO</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"/>
  <style>
    *{font-family:'Inter',sans-serif;box-sizing:border-box;}
    body{background:#f5f4f0;color:#2d2d2d;min-height:100vh;}

    /* Sidebar */
    .sidebar{background:#1a1a2e;width:240px;min-height:100vh;position:fixed;left:0;top:0;z-index:50;display:flex;flex-direction:column;}
    .sidebar-logo{padding:24px 20px 20px;border-bottom:1px solid rgba(255,255,255,0.07);}
    .logo-mark{width:40px;height:40px;background:linear-gradient(135deg,#c8a97e,#a07850);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:#fff;letter-spacing:0.5px;flex-shrink:0;}
    .logo-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#fff;letter-spacing:0.5px;}
    .logo-sub{font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:2px;text-transform:uppercase;margin-top:1px;}

    .nav-item{display:flex;align-items:center;gap:10px;padding:10px 18px;margin:2px 10px;border-radius:8px;font-size:13px;font-weight:500;color:rgba(255,255,255,0.55);text-decoration:none;transition:all 0.18s;cursor:pointer;}
    .nav-item:hover{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.9);}
    .nav-item.active{background:linear-gradient(135deg,rgba(200,169,126,0.2),rgba(160,120,80,0.15));color:#c8a97e;border:1px solid rgba(200,169,126,0.2);}
    .nav-item i{width:16px;text-align:center;font-size:13px;}

    .main{margin-left:240px;min-height:100vh;}

    /* Cards */
    .card{background:#fff;border-radius:14px;border:1px solid #ebe9e4;transition:all 0.2s;}
    .card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.06);}
    .card-warm{background:linear-gradient(135deg,#faf8f5,#f5f1ea);border:1px solid #e8e2d8;}

    /* Stat cards */
    .stat-card{background:#fff;border-radius:14px;border:1px solid #ebe9e4;padding:20px;transition:all 0.2s;}
    .stat-card:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(0,0,0,0.07);}

    /* Badges */
    .badge-gold{background:#fdf6ec;color:#a07030;border:1px solid #e8d5b0;font-size:11px;padding:3px 9px;border-radius:20px;font-weight:600;}
    .badge-green{background:#f0faf4;color:#2d7a4f;border:1px solid #b8e0c8;font-size:11px;padding:3px 9px;border-radius:20px;font-weight:600;}
    .badge-blue{background:#f0f5ff;color:#2d5fa8;border:1px solid #b8cfee;font-size:11px;padding:3px 9px;border-radius:20px;font-weight:600;}
    .badge-red{background:#fff5f5;color:#c0392b;border:1px solid #f0b8b8;font-size:11px;padding:3px 9px;border-radius:20px;font-weight:600;}

    /* Buttons */
    .btn-primary{background:#1a1a2e;color:#fff;border:none;padding:9px 20px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;display:inline-flex;align-items:center;gap:7px;}
    .btn-primary:hover{background:#2d2d4a;transform:translateY(-1px);}
    .btn-gold{background:linear-gradient(135deg,#c8a97e,#a07850);color:#fff;border:none;padding:9px 20px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;display:inline-flex;align-items:center;gap:7px;}
    .btn-gold:hover{opacity:0.9;transform:translateY(-1px);}
    .btn-outline{background:#fff;color:#2d2d2d;border:1px solid #ddd8d0;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.18s;display:inline-flex;align-items:center;gap:7px;}
    .btn-outline:hover{border-color:#c8a97e;color:#a07030;}
    .btn-sm{padding:6px 14px;font-size:12px;}

    /* Modal */
    .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200;overflow-y:auto;backdrop-filter:blur(2px);}
    .modal.open{display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;}
    .modal-box{background:#fff;border-radius:18px;width:100%;border:1px solid #ebe9e4;box-shadow:0 20px 60px rgba(0,0,0,0.15);}

    /* Toast */
    .toast{position:fixed;bottom:24px;right:24px;z-index:300;display:none;}
    .toast-inner{background:#1a1a2e;color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.2);}

    /* Typing */
    .dot-pulse span{display:inline-block;width:7px;height:7px;background:#c8a97e;border-radius:50%;margin:0 2px;animation:dp 1.4s infinite ease-in-out;}
    .dot-pulse span:nth-child(2){animation-delay:.2s}
    .dot-pulse span:nth-child(3){animation-delay:.4s}
    @keyframes dp{0%,80%,100%{transform:scale(0.5);opacity:0.4}40%{transform:scale(1);opacity:1}}

    /* Scrollbar */
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:#f0ede8}
    ::-webkit-scrollbar-thumb{background:#c8a97e;border-radius:3px}

    /* Score ring */
    .score-ring{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;}
    .score-high{background:#f0faf4;color:#2d7a4f;border:2px solid #b8e0c8;}
    .score-mid{background:#fdf8ec;color:#a07030;border:2px solid #e8d5a0;}
    .score-low{background:#fafafa;color:#888;border:2px solid #ddd;}

    /* Page header */
    .page-header{padding:32px 36px 0;}
    .page-title{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#1a1a2e;margin-bottom:4px;}
    .page-sub{font-size:14px;color:#888;margin-bottom:28px;}

    input,select,textarea{background:#fff;border:1px solid #ddd8d0;border-radius:9px;padding:9px 14px;font-size:13px;color:#2d2d2d;outline:none;width:100%;transition:border 0.15s;}
    input:focus,select:focus,textarea:focus{border-color:#c8a97e;}
  </style>
</head>
<body>

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div class="logo-mark">G</div>
        <div>
          <div class="logo-name">GETSCO</div>
          <div class="logo-sub">Scholarship Intelligence</div>
        </div>
      </div>
      <div style="background:rgba(200,169,126,0.1);border:1px solid rgba(200,169,126,0.2);border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:8px;">
        <div style="width:32px;height:32px;background:linear-gradient(135deg,#c8a97e,#a07850);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">SA</div>
        <div>
          <p style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.9);line-height:1.2;">Syed Ashmam Ali Shah</p>
          <p style="font-size:10px;color:rgba(255,255,255,0.4);">BSc Biotechnology · Peshawar</p>
        </div>
      </div>
    </div>

    <nav style="flex:1;padding:14px 0;">
      <div style="padding:0 10px 8px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.25);letter-spacing:1.5px;text-transform:uppercase;">Navigation</div>
      <a href="/" class="nav-item ${activeNav==="dashboard" ? "active" : ""}"><i class="fas fa-th-large"></i>Dashboard</a>
      <a href="/scholarships" class="nav-item ${activeNav==="scholarships" ? "active" : ""}"><i class="fas fa-medal"></i>Scholarships</a>
      <a href="/professors" class="nav-item ${activeNav==="professors" ? "active" : ""}"><i class="fas fa-user-tie"></i>Professors</a>
      <a href="/applications" class="nav-item ${activeNav==="applications" ? "active" : ""}"><i class="fas fa-paper-plane"></i>Applications</a>
      <a href="/documents" class="nav-item ${activeNav==="documents" ? "active" : ""}"><i class="fas fa-file-alt"></i>Documents</a>
      <a href="/profile" class="nav-item ${activeNav==="profile" ? "active" : ""}"><i class="fas fa-user"></i>My Profile</a>
      <a href="/data" class="nav-item ${activeNav==="data" ? "active" : ""}"><i class="fas fa-database"></i>Data Preview</a>
      <div style="padding:12px 10px 6px;margin-top:8px;border-top:1px solid rgba(255,255,255,0.06);font-size:10px;font-weight:600;color:rgba(255,255,255,0.25);letter-spacing:1.5px;text-transform:uppercase;">Tools</div>
      <div class="nav-item" onclick="openChat()"><i class="fas fa-robot"></i>AI Assistant</div>
      <div class="nav-item" onclick="runAgent()"><i class="fas fa-play-circle"></i>Run Agent</div>
      <div class="nav-item" onclick="testEmail()"><i class="fas fa-envelope-open-text"></i>Test Email</div>
    </nav>

    <div style="padding:14px 18px;border-top:1px solid rgba(255,255,255,0.07);">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:7px;height:7px;background:#4ade80;border-radius:50%;display:inline-block;animation:dp 2s infinite;"></span>
        <span style="font-size:11px;color:rgba(255,255,255,0.35);">GETSCO Agent · Online</span>
      </div>
      <div style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:4px;">Groq Llama 3.3 70B · ${new Date().getFullYear()}</div>
    </div>
  </aside>

  <!-- CONTENT -->
  <main class="main">${content}</main>

  <!-- AI CHAT MODAL -->
  <div id="chatModal" class="modal">
    <div class="modal-box" style="max-width:640px;">
      <div style="padding:20px 24px;border-bottom:1px solid #ebe9e4;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:#1a1a2e;border-radius:9px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-robot" style="color:#c8a97e;font-size:14px;"></i></div>
          <div><p style="font-weight:600;font-size:14px;">GETSCO AI Assistant</p><p style="font-size:11px;color:#aaa;">Groq Llama 3.3 · Trusted sources only</p></div>
        </div>
        <button onclick="closeChat()" style="background:none;border:none;font-size:20px;color:#aaa;cursor:pointer;">&times;</button>
      </div>
      <div id="chatMessages" style="height:360px;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:10px;">
          <div style="width:28px;height:28px;background:#1a1a2e;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-robot" style="color:#c8a97e;font-size:10px;"></i></div>
          <div style="background:#f5f4f0;border-radius:12px;border-radius-top-left:3px;padding:12px 14px;font-size:13px;line-height:1.6;max-width:80%;">Hello Ashmam. I'm GETSCO — your scholarship intelligence assistant. I only work with verified, official sources. Ask me anything about scholarships, professors, documents or strategy.</div>
        </div>
      </div>
      <div style="padding:16px 20px;border-top:1px solid #ebe9e4;">
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <button onclick="quickAsk('What are the best scholarships for me right now?')" style="font-size:11px;background:#f5f4f0;border:1px solid #e0dbd3;padding:5px 11px;border-radius:20px;cursor:pointer;color:#555;">Best matches</button>
          <button onclick="quickAsk('Which scholarships have deadlines in the next 6 months?')" style="font-size:11px;background:#f5f4f0;border:1px solid #e0dbd3;padding:5px 11px;border-radius:20px;cursor:pointer;color:#555;">Upcoming deadlines</button>
          <button onclick="quickAsk('How strong is my profile for DAAD?')" style="font-size:11px;background:#f5f4f0;border:1px solid #e0dbd3;padding:5px 11px;border-radius:20px;cursor:pointer;color:#555;">DAAD chances</button>
          <button onclick="quickAsk('Give me a step-by-step strategy for Fulbright 2026')" style="font-size:11px;background:#f5f4f0;border:1px solid #e0dbd3;padding:5px 11px;border-radius:20px;cursor:pointer;color:#555;">Fulbright strategy</button>
        </div>
        <div style="display:flex;gap:8px;">
          <input id="chatInput" placeholder="Ask about scholarships, professors, strategy..." style="flex:1;" onkeypress="if(event.key==='Enter')sendChat()"/>
          <button class="btn-primary btn-sm" onclick="sendChat()"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    </div>
  </div>

  <!-- RUN AGENT MODAL -->
  <div id="agentModal" class="modal">
    <div class="modal-box" style="max-width:500px;margin-top:60px;">
      <div style="padding:20px 24px;border-bottom:1px solid #ebe9e4;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:10px;"><i class="fas fa-play-circle" style="color:#c8a97e;font-size:18px;"></i><p style="font-weight:600;">Running GETSCO Agent</p></div>
        <button onclick="closeAgent()" style="background:none;border:none;font-size:20px;color:#aaa;cursor:pointer;">&times;</button>
      </div>
      <div id="agentOutput" style="padding:20px;min-height:160px;font-size:13px;"></div>
    </div>
  </div>

  <!-- DOC VIEW MODAL -->
  <div id="docModal" class="modal">
    <div class="modal-box" style="max-width:780px;">
      <div style="padding:18px 24px;border-bottom:1px solid #ebe9e4;display:flex;justify-content:space-between;align-items:center;">
        <p id="docModalTitle" style="font-weight:600;font-size:15px;"></p>
        <div style="display:flex;gap:8px;">
          <button onclick="copyDoc()" class="btn-outline btn-sm"><i class="fas fa-copy"></i> Copy</button>
          <button onclick="closeDocModal()" style="background:none;border:none;font-size:20px;color:#aaa;cursor:pointer;">&times;</button>
        </div>
      </div>
      <div id="docModalContent" style="padding:24px;max-height:70vh;overflow-y:auto;font-size:13.5px;line-height:1.85;white-space:pre-wrap;font-family:'Georgia',serif;color:#2d2d2d;background:#fafaf8;border-radius:0 0 18px 18px;"></div>
    </div>
  </div>

  <!-- TOAST -->
  <div id="toast" class="toast">
    <div class="toast-inner">
      <i id="toastIcon" class="fas fa-check-circle" style="color:#4ade80;"></i>
      <span id="toastMsg"></span>
    </div>
  </div>

  <script>
    function toast(msg, type='ok') {
      document.getElementById('toastMsg').textContent = msg;
      document.getElementById('toastIcon').className = type==='err' ? 'fas fa-times-circle' : 'fas fa-check-circle';
      document.getElementById('toastIcon').style.color = type==='err' ? '#f87171' : '#4ade80';
      const t = document.getElementById('toast');
      t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 3600);
    }

    // Chat
    function openChat(){document.getElementById('chatModal').classList.add('open');}
    function closeChat(){document.getElementById('chatModal').classList.remove('open');}
    function quickAsk(msg){document.getElementById('chatInput').value=msg;sendChat();}

    async function sendChat(){
      const inp = document.getElementById('chatInput');
      const msg = inp.value.trim();
      if(!msg)return;
      inp.value='';
      const box = document.getElementById('chatMessages');
      box.innerHTML += \`<div style="display:flex;justify-content:flex-end;"><div style="background:#1a1a2e;color:#fff;padding:10px 14px;border-radius:12px;border-top-right-radius:3px;font-size:13px;max-width:80%;">\${msg}</div></div>\`;
      box.innerHTML += \`<div id="typing" style="display:flex;gap:10px;"><div style="width:28px;height:28px;background:#1a1a2e;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-robot" style="color:#c8a97e;font-size:10px;"></i></div><div style="background:#f5f4f0;border-radius:12px;padding:12px 14px;"><div class="dot-pulse"><span></span><span></span><span></span></div></div></div>\`;
      box.scrollTop = box.scrollHeight;
      try{
        const r = await axios.post('/api/agent/chat',{message:msg});
        document.getElementById('typing')?.remove();
        box.innerHTML += \`<div style="display:flex;gap:10px;"><div style="width:28px;height:28px;background:#1a1a2e;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-robot" style="color:#c8a97e;font-size:10px;"></i></div><div style="background:#f5f4f0;border-radius:12px;border-top-left-radius:3px;padding:12px 14px;font-size:13px;line-height:1.6;max-width:80%;">\${r.data.response.replace(/\\n/g,'<br>')}</div></div>\`;
      }catch(e){
        document.getElementById('typing')?.remove();
        box.innerHTML += \`<div style="color:#c0392b;font-size:13px;padding:8px;">Error connecting to AI. Try again.</div>\`;
      }
      box.scrollTop = box.scrollHeight;
    }

    // Agent run
    function closeAgent(){document.getElementById('agentModal').classList.remove('open');}
    async function runAgent(){
      document.getElementById('agentModal').classList.add('open');
      const out = document.getElementById('agentOutput');
      out.innerHTML = '<div class="dot-pulse" style="padding:10px 0;"><span></span><span></span><span></span></div><p style="color:#888;margin-top:8px;">Starting agent...</p>';
      try{
        const r = await axios.post('/api/agent/run');
        const d = r.data;
        out.innerHTML = (d.steps||[]).map((s,i)=>\`<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f0ede8;"><span style="width:22px;height:22px;background:#f5f1ea;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#a07030;flex-shrink:0;">\${i+1}</span><p style="font-size:13px;color:#2d2d2d;">\${s}</p></div>\`).join('') +
          \`<div style="margin-top:14px;padding:12px;background:#f5f1ea;border-radius:9px;border:1px solid #e8d5a0;"><p style="font-size:12px;font-weight:600;color:#a07030;margin-bottom:4px;">Next Step</p><p style="font-size:13px;">\${d.next_action||''}</p></div>\`;
      }catch(e){out.innerHTML='<p style="color:#c0392b;font-size:13px;">Agent error. Check database.</p>';}
    }

    // Doc viewer
    function openDoc(title, content){
      document.getElementById('docModalTitle').textContent = title;
      document.getElementById('docModalContent').textContent = content;
      document.getElementById('docModal').classList.add('open');
    }
    function closeDocModal(){document.getElementById('docModal').classList.remove('open');}
    function copyDoc(){
      navigator.clipboard.writeText(document.getElementById('docModalContent').textContent).then(()=>toast('Copied to clipboard!'));
    }

    // Test email
    async function testEmail(){
      toast('Sending test email...');
      try{
        const r = await axios.post('/api/agent/test-email');
        toast(r.data.success ? '✓ Test email sent to ashmamali2002@gmail.com' : 'Email failed: '+(r.data.error||''), r.data.success?'ok':'err');
      }catch(e){toast('Email test failed','err');}
    }

    // Close modals on backdrop
    document.querySelectorAll('.modal').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});});
  </script>
</body>
</html>`;
}

// ── DASHBOARD ────────────────────────────────────────────────
function getDashboardHTML(): string {
  const c = `
  <div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:14px;">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Welcome back, Ashmam — GETSCO is watching for opportunities</div>
      </div>
      <div style="display:flex;gap:9px;">
        <button class="btn-outline" onclick="scanKnown()"><i class="fas fa-star"></i> Known Programs</button>
        <button class="btn-gold" onclick="doSearch()"><i class="fas fa-search"></i> Search Scholarships</button>
      </div>
    </div>
  </div>

  <div style="padding:0 36px 36px;">
    <!-- Search progress -->
    <div id="searchProgress" style="display:none;margin-bottom:18px;background:#f5f1ea;border:1px solid #e8d5a0;border-radius:12px;padding:16px 20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div class="dot-pulse"><span></span><span></span><span></span></div>
        <p id="searchTxt" style="font-size:13px;font-weight:500;color:#a07030;"></p>
      </div>
      <div style="height:3px;background:#e8d5a0;border-radius:2px;"><div id="searchBar" style="height:3px;background:#c8a97e;border-radius:2px;width:0%;transition:width 1s;"></div></div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;">
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div style="width:36px;height:36px;background:#f0f5ff;border-radius:9px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-medal" style="color:#2d5fa8;font-size:14px;"></i></div>
          <span class="badge-blue">Total</span>
        </div>
        <p class="stat-val" id="s1" style="font-size:32px;font-weight:700;color:#1a1a2e;line-height:1;">—</p>
        <p style="font-size:12px;color:#aaa;margin-top:4px;">Scholarships Found</p>
      </div>
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div style="width:36px;height:36px;background:#f0faf4;border-radius:9px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-star" style="color:#2d7a4f;font-size:14px;"></i></div>
          <span class="badge-green">≥70%</span>
        </div>
        <p id="s2" style="font-size:32px;font-weight:700;color:#2d7a4f;line-height:1;">—</p>
        <p style="font-size:12px;color:#aaa;margin-top:4px;">High Matches</p>
      </div>
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div style="width:36px;height:36px;background:#fdf6ec;border-radius:9px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-user-tie" style="color:#a07030;font-size:14px;"></i></div>
          <span class="badge-gold">DB</span>
        </div>
        <p id="s3" style="font-size:32px;font-weight:700;color:#a07030;line-height:1;">—</p>
        <p style="font-size:12px;color:#aaa;margin-top:4px;">Professors Found</p>
      </div>
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div style="width:36px;height:36px;background:#fff5f5;border-radius:9px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-file-alt" style="color:#c0392b;font-size:14px;"></i></div>
          <span class="badge-red">Made</span>
        </div>
        <p id="s4" style="font-size:32px;font-weight:700;color:#c0392b;line-height:1;">—</p>
        <p style="font-size:12px;color:#aaa;margin-top:4px;">Documents</p>
      </div>
    </div>

    <!-- Main content grid -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:18px;margin-bottom:18px;">
      <!-- Top scholarships -->
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid #f0ede8;display:flex;justify-content:space-between;align-items:center;">
          <p style="font-weight:600;font-size:14px;"><i class="fas fa-trophy" style="color:#c8a97e;margin-right:7px;"></i>Top Matched Scholarships</p>
          <a href="/scholarships" style="font-size:12px;color:#c8a97e;text-decoration:none;">View all →</a>
        </div>
        <div id="topList" style="padding:14px 20px;"></div>
      </div>

      <!-- Profile card -->
      <div class="card-warm" style="padding:0;overflow:hidden;border-radius:14px;">
        <div style="padding:18px 20px;border-bottom:1px solid #e8e2d8;">
          <p style="font-weight:600;font-size:14px;"><i class="fas fa-user-circle" style="color:#c8a97e;margin-right:7px;"></i>Your Profile</p>
        </div>
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
          ${[
            ["fas fa-user","#2d5fa8","Syed Ashmam Ali Shah","Name"],
            ["fas fa-graduation-cap","#2d7a4f","BSc Biotechnology · CGPA 2.75","Degree"],
            ["fas fa-university","#a07030","University of Peshawar","University"],
            ["fas fa-flask","#c0392b","3 Research Papers","Publications"],
            ["fas fa-envelope","#7c3aed","ashmamali2002@gmail.com","Email"],
            ["fas fa-phone","#059669","+92 347 1978085","Phone"],
            ["fas fa-globe","#c0392b","14 Countries · Fully Funded","Target"],
          ].map(([icon,col,val,label]) => `
          <div style="background:#fff;border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px;">
            <i class="${icon}" style="color:${col};width:14px;font-size:12px;"></i>
            <div><p style="font-size:10px;color:#aaa;">${label}</p><p style="font-size:12px;font-weight:600;color:#2d2d2d;">${val}</p></div>
          </div>`).join("")}
          <div style="background:#fff;border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-map-marker-alt" style="color:#e07b30;width:14px;font-size:12px;"></i>
            <div><p style="font-size:10px;color:#aaa;">Address</p><p style="font-size:11px;font-weight:600;color:#2d2d2d;line-height:1.3;">Back Street PMS Boys 3,<br/>Ring Road, Peshawar, PK</p></div>
          </div>
          <a href="/profile" class="btn-outline btn-sm" style="justify-content:center;margin-top:4px;">View Full Profile →</a>
          <button class="btn-outline btn-sm" style="justify-content:center;color:#2d7a4f;border-color:#b8e0c8;" onclick="testEmail()"><i class="fas fa-envelope"></i> Test Email</button>
        </div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="card" style="padding:20px;">
      <p style="font-weight:600;font-size:14px;margin-bottom:14px;"><i class="fas fa-bolt" style="color:#c8a97e;margin-right:7px;"></i>Quick Actions</p>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
        ${[
          ["fas fa-search","#2d5fa8","#f0f5ff","Search Official Sites","doSearch()"],
          ["fas fa-user-tie","#2d7a4f","#f0faf4","Find Professors","()=>window.location='/professors'"],
          ["fas fa-file-signature","#7c3aed","#f5f0ff","Generate Documents","()=>window.location='/documents'"],
          ["fas fa-robot","#c8a97e","#fdf8f0","Ask AI Assistant","openChat()"],
          ["fas fa-play-circle","#c0392b","#fff5f5","Full Auto Run","runAgent()"],
        ].map(([icon,col,bg,label,fn]) => `
        <button onclick="${fn}" style="background:${bg};border:1px solid ${col}22;border-radius:11px;padding:14px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;transition:all 0.18s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
          <i class="${icon}" style="font-size:20px;color:${col};"></i>
          <span style="font-size:11px;font-weight:600;color:#2d2d2d;text-align:center;">${label}</span>
        </button>`).join("")}
      </div>
    </div>
  </div>

  <script>
    async function loadStats(){
      try{
        const [sch,profs,docs] = await Promise.all([
          axios.get('/api/scholarships/stats/overview'),
          axios.get('/api/professors?min_score=0'),
          axios.get('/api/documents/list'),
        ]);
        const s = sch.data.stats;
        document.getElementById('s1').textContent = s.total||0;
        document.getElementById('s2').textContent = s.high_match||0;
        document.getElementById('s3').textContent = profs.data.count||0;
        document.getElementById('s4').textContent = docs.data.documents?.length||0;

        const top = sch.data.top_scholarships||[];
        const box = document.getElementById('topList');
        if(!top.length){box.innerHTML='<p style="text-align:center;padding:24px 0;color:#aaa;font-size:13px;"><i class="fas fa-search" style="display:block;font-size:28px;margin-bottom:10px;color:#ddd;"></i>No scholarships yet.<br>Click Search to begin.</p>';return;}
        box.innerHTML = top.map(s=>{
          const sc = s.match_score||0;
          const cls = sc>=70?'score-high':sc>=50?'score-mid':'score-low';
          return \`<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f5f2ee;cursor:pointer;" onclick="window.location='/scholarships'">
            <div class="score-ring \${cls}">\${Math.round(sc)}</div>
            <div style="flex:1;min-width:0;">
              <p style="font-size:13px;font-weight:600;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${s.title}</p>
              <p style="font-size:11px;color:#aaa;margin-top:1px;">\${s.organization||''} · \${s.country||''}</p>
              \${s.deadline?'<p style="font-size:11px;color:#c8a97e;margin-top:1px;"><i class="fas fa-clock" style="margin-right:3px;"></i>'+s.deadline+'</p>':''}
            </div>
          </div>\`;
        }).join('');
      }catch(e){console.error(e);}
    }

    async function doSearch(){
      const p = document.getElementById('searchProgress');
      const bar = document.getElementById('searchBar');
      const txt = document.getElementById('searchTxt');
      p.style.display='block'; bar.style.width='15%'; txt.textContent='Querying official scholarship sources...';
      try{
        bar.style.width='55%'; txt.textContent='AI verifying and scoring matches...';
        const r = await axios.post('/api/scholarships/search',{});
        bar.style.width='100%'; txt.textContent=r.data.message;
        setTimeout(()=>{p.style.display='none';bar.style.width='0%';},3500);
        loadStats(); toast(r.data.message);
      }catch(e){ txt.textContent='Search failed.'; setTimeout(()=>p.style.display='none',3000); }
    }

    async function scanKnown(){
      toast('Scanning official known programs...');
      try{
        const r = await axios.post('/api/scholarships/scan-known');
        toast('Added '+r.data.total+' official programs');
        loadStats();
      }catch(e){toast('Scan failed','err');}
    }

    loadStats();
  </script>`;
  return getBaseLayout("Dashboard", "dashboard", c);
}

// ── SCHOLARSHIPS PAGE ────────────────────────────────────────
function getScholarshipsHTML(): string {
  const c = `
  <div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div>
        <div class="page-title">Scholarships</div>
        <div class="page-sub">Only verified, official & HEC-recognised sources — no social media, no YouTube</div>
      </div>
      <div style="display:flex;gap:9px;">
        <button class="btn-outline" onclick="scanKnown()"><i class="fas fa-star"></i> Known Programs</button>
        <button class="btn-gold" onclick="doSearch()"><i class="fas fa-search"></i> Search Official Sources</button>
      </div>
    </div>
  </div>

  <div style="padding:0 36px 36px;">
    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;align-items:center;">
      <select id="fCtry" onchange="loadList()" style="width:160px;">
        <option value="">All Countries</option>
        <option value="Germany">Germany</option><option value="Japan">Japan</option>
        <option value="South Korea">South Korea</option><option value="China">China</option>
        <option value="USA">USA</option><option value="Canada">Canada</option>
        <option value="Australia">Australia</option><option value="UK">UK</option>
        <option value="France">France</option><option value="Sweden">Sweden</option>
      </select>
      <select id="fStat" onchange="loadList()" style="width:140px;">
        <option value="">All Status</option>
        <option value="found">Found</option><option value="applying">Applying</option><option value="applied">Applied</option>
      </select>
      <div style="flex:1;"></div>
      <span id="listCount" style="font-size:12px;color:#aaa;"></span>
    </div>

    <div id="schList" style="display:flex;flex-direction:column;gap:12px;">
      <div style="text-align:center;padding:60px 0;color:#aaa;">
        <i class="fas fa-search" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px;"></i>
        <p style="font-size:14px;font-weight:500;">No scholarships yet</p>
        <p style="font-size:12px;margin-top:4px;">Click Search Official Sources to begin</p>
      </div>
    </div>
  </div>

  <script>
    async function loadList(){
      const ctry = document.getElementById('fCtry').value;
      const stat = document.getElementById('fStat').value;
      let url='/api/scholarships?limit=50';
      if(ctry)url+='&country='+encodeURIComponent(ctry);
      if(stat)url+='&status='+stat;
      try{
        const r = await axios.get(url);
        const list = r.data.scholarships||[];
        document.getElementById('listCount').textContent=list.length+' scholarships';
        const box = document.getElementById('schList');
        if(!list.length){box.innerHTML='<div style="text-align:center;padding:60px 0;color:#aaa;"><i class="fas fa-search" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px;"></i><p>No results. Click Search!</p></div>';return;}
        box.innerHTML = list.map(s=>{
          const sc = s.match_score||0;
          const cls = sc>=70?'score-high':sc>=50?'score-mid':'score-low';
          const trust = s.source_trust_level==='official'?'<span class="badge-green"><i class="fas fa-shield-alt" style="margin-right:3px;"></i>Official</span>':'<span class="badge-blue">Recognised</span>';
          return \`<div class="card" style="padding:18px 20px;">
            <div style="display:flex;gap:14px;align-items:flex-start;">
              <div class="score-ring \${cls}" style="margin-top:3px;flex-shrink:0;">\${Math.round(sc)}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                  \${s.is_fully_funded?'<span class="badge-green"><i class="fas fa-check-circle" style="margin-right:3px;"></i>Fully Funded</span>':''}
                  <span class="badge-blue">\${s.country||'International'}</span>
                  \${trust}
                  \${s.status==='applying'?'<span class="badge-gold">Applying</span>':''}
                  \${s.status==='applied'?'<span class="badge-blue">Applied</span>':''}
                </div>
                <p style="font-size:15px;font-weight:600;color:#1a1a2e;margin-bottom:2px;">\${s.title}</p>
                <p style="font-size:12px;color:#888;margin-bottom:6px;">\${s.organization||''}</p>
                <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;">
                  \${s.deadline?'<span style="color:#c8a97e;"><i class="fas fa-clock" style="margin-right:3px;"></i>'+s.deadline+'</span>':''}
                  \${s.covers?'<span style="color:#2d7a4f;"><i class="fas fa-gift" style="margin-right:3px;"></i>'+s.covers.substring(0,55)+'</span>':''}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
                <a href="\${s.url}" target="_blank" class="btn-outline btn-sm"><i class="fas fa-external-link-alt"></i> View</a>
                <button onclick="applyFor(\${s.id},'\${(s.title||'').replace(/'/g,\\"\\\\'\\")')" class="btn-primary btn-sm"><i class="fas fa-plus"></i> Apply</button>
                <button onclick="genDocs(\${s.id},'\${(s.title||'').replace(/'/g,\\"\\\\'\\")')" class="btn-gold btn-sm"><i class="fas fa-file-alt"></i> Docs</button>
              </div>
            </div>
          </div>\`;
        }).join('');
      }catch(e){console.error(e);}
    }

    async function applyFor(id,title){
      try{await axios.post('/api/applications',{scholarship_id:id});toast('Application started for '+title);loadList();}
      catch(e){toast(e.response?.data?.error||'Failed','err');}
    }

    async function genDocs(id,title){
      toast('Generating documents — ~30-60 seconds...');
      try{await axios.post('/api/documents/generate/all',{scholarship_id:id});toast('Documents ready!');window.location='/documents';}
      catch(e){toast('Generation failed','err');}
    }

    async function doSearch(){toast('Searching official sources...');try{const r=await axios.post('/api/scholarships/search',{});toast(r.data.message);loadList();}catch(e){toast('Search failed','err');}}
    async function scanKnown(){toast('Scanning known official programs...');try{const r=await axios.post('/api/scholarships/scan-known');toast('Added '+r.data.total+' programs');loadList();}catch(e){toast('Scan failed','err');}}

    loadList();
  </script>`;
  return getBaseLayout("Scholarships", "scholarships", c);
}

// ── PROFESSORS PAGE ──────────────────────────────────────────
function getProfessorsHTML(): string {
  const c = `
  <div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <div class="page-title">Professor Intelligence</div>
        <div class="page-sub">Find the right supervisors — research interests, emails, LinkedIn, accepting-student status</div>
      </div>
      <button class="btn-gold" onclick="toggleFinder()"><i class="fas fa-search"></i> Find Professors</button>
    </div>
  </div>

  <div style="padding:0 36px 36px;">
    <!-- Finder panel -->
    <div id="finderPanel" style="display:none;margin-bottom:20px;" class="card" style="padding:20px;">
      <div style="padding:18px 20px;">
        <p style="font-weight:600;font-size:14px;margin-bottom:14px;"><i class="fas fa-search" style="color:#c8a97e;margin-right:7px;"></i>Search University Faculty</p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
          <div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">University Name *</label>
            <input id="uniName" placeholder="e.g. Heidelberg University"/></div>
          <div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Department</label>
            <input id="uniDept" placeholder="e.g. Molecular Biology" value="Biotechnology"/></div>
          <div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Country</label>
            <input id="uniCtry" placeholder="e.g. Germany"/></div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Faculty Page URL (Optional — paste official faculty/people page URL for best results)</label>
          <input id="uniUrl" placeholder="https://university.edu/department/people"/>
        </div>
        <div style="display:flex;gap:9px;align-items:center;">
          <button class="btn-gold" onclick="findProfs()"><i class="fas fa-search"></i> Find Professors</button>
          <button class="btn-outline" onclick="analyseDept()"><i class="fas fa-chart-bar"></i> Analyse Department</button>
          <div id="profStatus" style="font-size:13px;color:#a07030;display:none;"><div class="dot-pulse" style="display:inline-flex;margin-right:8px;"><span></span><span></span><span></span></div>Searching faculty...</div>
        </div>
        <div id="deptAnalysis" style="display:none;margin-top:16px;background:#f5f1ea;border:1px solid #e8d5a0;border-radius:10px;padding:16px;font-size:13px;line-height:1.6;"></div>
      </div>
    </div>

    <!-- Professor cards -->
    <div id="profGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">
      <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:#aaa;">
        <i class="fas fa-user-tie" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px;"></i>
        <p style="font-size:14px;font-weight:500;">No professors found yet</p>
        <p style="font-size:12px;margin-top:4px;">Enter a university and click Find Professors</p>
      </div>
    </div>
  </div>

  <script>
    function toggleFinder(){
      const p = document.getElementById('finderPanel');
      p.style.display = p.style.display==='none' ? 'block' : 'none';
    }

    async function findProfs(){
      const uni = document.getElementById('uniName').value.trim();
      if(!uni){toast('Please enter a university name','err');return;}
      const st = document.getElementById('profStatus');
      st.style.display='flex';
      try{
        const r = await axios.post('/api/professors/search',{
          university: uni,
          department: document.getElementById('uniDept').value||'Biotechnology',
          country: document.getElementById('uniCtry').value||'',
          profile_url: document.getElementById('uniUrl').value||'',
        });
        st.style.display='none';
        toast(r.data.message);
        loadProfs();
      }catch(e){st.style.display='none';toast(e.response?.data?.error||'Search failed','err');}
    }

    async function analyseDept(){
      const uni = document.getElementById('uniName').value.trim();
      if(!uni){toast('Enter a university name first','err');return;}
      const st = document.getElementById('profStatus');
      const da = document.getElementById('deptAnalysis');
      st.style.display='flex';
      try{
        const r = await axios.post('/api/professors/analyse-department',{
          university: uni,
          country: document.getElementById('uniCtry').value||'',
          department_url: document.getElementById('uniUrl').value||'',
        });
        st.style.display='none';
        const a = r.data.analysis;
        da.style.display='block';
        da.innerHTML = \`
          <p style="font-weight:600;color:#a07030;margin-bottom:8px;"><i class="fas fa-chart-bar" style="margin-right:6px;"></i>Department Analysis — \${uni}</p>
          \${a.recommendedField?'<p style="margin-bottom:6px;"><strong>Best Field for You:</strong> '+a.recommendedField+'</p>':''}
          \${a.programStrengths?'<p style="margin-bottom:6px;"><strong>Programme Strengths:</strong> '+a.programStrengths+'</p>':''}
          \${a.bestFitReason?'<p style="margin-bottom:6px;"><strong>Why You Fit:</strong> '+a.bestFitReason+'</p>':''}
          \${a.applicationTips?'<p style="margin-bottom:6px;"><strong>Application Tips:</strong> '+a.applicationTips+'</p>':''}
          \${a.topResearchAreas?.length?'<p style="margin-top:8px;"><strong>Top Research Areas:</strong> '+a.topResearchAreas.join(', ')+'</p>':''}
        \`;
      }catch(e){st.style.display='none';toast('Analysis failed','err');}
    }

    async function loadProfs(){
      try{
        const r = await axios.get('/api/professors');
        const list = r.data.professors||[];
        const box = document.getElementById('profGrid');
        if(!list.length){box.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:#aaa;"><i class="fas fa-user-tie" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px;"></i><p>No professors found yet.</p></div>';return;}
        box.innerHTML = list.map(p=>{
          const sc = p.relevance_score||0;
          const cls = sc>=70?'score-high':sc>=50?'score-mid':'score-low';
          const acc = p.accepting_students==='yes'?'<span class="badge-green"><i class="fas fa-check-circle" style="margin-right:3px;"></i>Accepting Students</span>':
                     p.accepting_students==='no'?'<span class="badge-red">Not Accepting</span>':'<span style="font-size:11px;color:#aaa;padding:3px 8px;">Status Unknown</span>';
          return \`<div class="card" style="padding:18px;">
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
              <div style="width:44px;height:44px;background:#f5f1ea;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-user-tie" style="color:#c8a97e;font-size:16px;"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <p style="font-size:15px;font-weight:600;color:#1a1a2e;">\${p.name}</p>
                <p style="font-size:12px;color:#888;">\${p.title||'Faculty'} · \${p.university}</p>
                <p style="font-size:11px;color:#aaa;">\${p.department||''}\${p.country?' · '+p.country:''}</p>
              </div>
              <div class="score-ring \${cls}" style="flex-shrink:0;">\${sc}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">\${acc}</div>
            \${p.research_interests?'<p style="font-size:12px;color:#555;margin-bottom:8px;line-height:1.5;"><strong>Research:</strong> '+p.research_interests+'</p>':''}
            \${p.lab_name?'<p style="font-size:12px;color:#888;margin-bottom:8px;"><i class="fas fa-flask" style="margin-right:4px;color:#c8a97e;"></i>'+p.lab_name+'</p>':''}
            \${p.raw_bio?'<p style="font-size:12px;color:#666;line-height:1.5;margin-bottom:10px;font-style:italic;">"'+p.raw_bio+'"</p>':''}
            <div style="display:flex;gap:7px;flex-wrap:wrap;">
              \${p.email?'<a href="mailto:'+p.email+'" class="btn-primary btn-sm" style="text-decoration:none;"><i class="fas fa-envelope"></i> '+p.email+'</a>':''}
              \${p.linkedin_url?'<a href="'+p.linkedin_url+'" target="_blank" class="btn-outline btn-sm" style="text-decoration:none;"><i class="fab fa-linkedin"></i> LinkedIn</a>':''}
              \${p.profile_url?'<a href="'+p.profile_url+'" target="_blank" class="btn-outline btn-sm" style="text-decoration:none;"><i class="fas fa-external-link-alt"></i> Profile</a>':''}
            </div>
          </div>\`;
        }).join('');
      }catch(e){console.error(e);}
    }

    loadProfs();
  </script>`;
  return getBaseLayout("Professors", "professors", c);
}

// ── APPLICATIONS PAGE ────────────────────────────────────────
function getApplicationsHTML(): string {
  const c = `
  <div class="page-header">
    <div class="page-title">Applications</div>
    <div class="page-sub">Track every scholarship application from start to decision</div>
  </div>
  <div style="padding:0 36px 36px;">
    <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;" id="tabs">
      ${["All","Preparing","Applied","Accepted","Rejected"].map((t,i)=>`<button onclick="tab('${t.toLowerCase()}',this)" class="${i===0?'btn-primary btn-sm':'btn-outline btn-sm'}">${t}</button>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px;" id="appStats"></div>
    <div id="appList" style="display:flex;flex-direction:column;gap:12px;"></div>
  </div>

  <script>
    let curTab='';
    async function loadStats(){
      try{
        const r = await axios.get('/api/applications/stats');
        const s = r.data.stats;
        document.getElementById('appStats').innerHTML=[
          {l:'Total',v:s.total,col:'#2d5fa8',bg:'#f0f5ff'},
          {l:'Preparing',v:s.pending,col:'#a07030',bg:'#fdf6ec'},
          {l:'Applied',v:s.applied,col:'#7c3aed',bg:'#f5f0ff'},
          {l:'Accepted',v:s.accepted,col:'#2d7a4f',bg:'#f0faf4'},
          {l:'Rejected',v:s.rejected,col:'#c0392b',bg:'#fff5f5'},
        ].map(x=>\`<div class="stat-card" style="text-align:center;padding:14px;"><p style="font-size:26px;font-weight:700;color:\${x.col};">\${x.v}</p><p style="font-size:11px;color:#aaa;margin-top:2px;">\${x.l}</p></div>\`).join('');
      }catch(e){}
    }

    async function tab(status, btn){
      curTab = status==='all'?'':status;
      document.querySelectorAll('#tabs button').forEach(b=>{b.className='btn-outline btn-sm';});
      btn.className='btn-primary btn-sm';
      loadApps();
    }

    async function loadApps(){
      try{
        const r = await axios.get('/api/applications'+(curTab?'?status='+curTab:''));
        const list = r.data.applications||[];
        const box = document.getElementById('appList');
        if(!list.length){box.innerHTML='<div style="text-align:center;padding:60px 0;color:#aaa;"><i class="fas fa-paper-plane" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px;"></i><p>No applications here.</p></div>';return;}
        const cols={preparing:'#a07030',pending:'#a07030',applied:'#2d5fa8',accepted:'#2d7a4f',rejected:'#c0392b'};
        box.innerHTML=list.map(a=>\`<div class="card" style="padding:18px 20px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;">
            <div style="flex:1;">
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px;">
                <span style="font-size:11px;font-weight:600;color:\${cols[a.status]||'#888'};background:\${cols[a.status]||'#888'}15;border:1px solid \${cols[a.status]||'#888'}33;padding:3px 9px;border-radius:20px;text-transform:capitalize;">\${a.status}</span>
                \${a.country?'<span class="badge-blue">'+a.country+'</span>':''}
              </div>
              <p style="font-size:15px;font-weight:600;color:#1a1a2e;">\${a.scholarship_title||'Scholarship'}</p>
              <p style="font-size:12px;color:#888;">\${a.organization||''}</p>
              \${a.deadline?'<p style="font-size:11px;color:#c8a97e;margin-top:5px;"><i class="fas fa-clock" style="margin-right:3px;"></i>'+a.deadline+'</p>':''}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
              <button onclick="sendAppEmail(\${a.id})" class="btn-primary btn-sm"><i class="fas fa-paper-plane"></i> Send</button>
              <button onclick="setStatus(\${a.id},'accepted')" class="btn-gold btn-sm"><i class="fas fa-check"></i> Accepted</button>
              <button onclick="setStatus(\${a.id},'rejected')" class="btn-outline btn-sm" style="color:#c0392b;border-color:#f0b8b8;"><i class="fas fa-times"></i> Rejected</button>
            </div>
          </div>
        </div>\`).join('');
      }catch(e){console.error(e);}
    }

    async function sendAppEmail(id){
      const email = prompt('Scholarship committee email address:');
      if(!email)return;
      toast('Sending application...');
      try{const r=await axios.post('/api/applications/'+id+'/send-email',{recipient_email:email});toast(r.data.message);loadApps();}
      catch(e){toast(e.response?.data?.error||'Failed','err');}
    }

    async function setStatus(id,status){
      try{await axios.put('/api/applications/'+id+'/status',{status});toast('Status updated');loadApps();loadStats();}
      catch(e){toast('Update failed','err');}
    }

    loadStats();loadApps();
  </script>`;
  return getBaseLayout("Applications", "applications", c);
}

// ── DOCUMENTS PAGE ───────────────────────────────────────────
function getDocumentsHTML(): string {
  const c = `
  <div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div>
        <div class="page-title">Documents</div>
        <div class="page-sub">Human-quality AI documents — cover letters, personal statements, CVs, research proposals</div>
      </div>
      <button class="btn-gold" onclick="toggleGen()"><i class="fas fa-plus"></i> Generate New</button>
    </div>
  </div>

  <div style="padding:0 36px 36px;">
    <!-- Generator -->
    <div id="genPanel" style="display:none;margin-bottom:20px;" class="card-warm" style="border-radius:14px;padding:20px;">
      <div style="padding:18px 20px;border-bottom:1px solid #e8e2d8;margin:-20px -20px 16px;">
        <p style="font-weight:600;font-size:14px;"><i class="fas fa-magic" style="color:#c8a97e;margin-right:7px;"></i>Generate Document</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Scholarship Title</label>
          <input id="gTitle" placeholder="e.g. DAAD Masters Scholarship 2026"/></div>
        <div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Organization</label>
          <input id="gOrg" placeholder="e.g. DAAD Germany"/></div>
        <div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Country</label>
          <input id="gCtry" placeholder="e.g. Germany"/></div>
        <div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Field</label>
          <input id="gFld" placeholder="e.g. Molecular Biology" value="Biotechnology"/></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button class="btn-primary btn-sm" onclick="gen('resume')"><i class="fas fa-file-alt"></i> Academic CV</button>
        <button class="btn-gold btn-sm" onclick="gen('cover_letter')"><i class="fas fa-envelope-open"></i> Cover Letter</button>
        <button class="btn-outline btn-sm" onclick="gen('personal_statement')"><i class="fas fa-pen-fancy"></i> Personal Statement</button>
        <button class="btn-outline btn-sm" onclick="gen('research_proposal')"><i class="fas fa-microscope"></i> Research Proposal</button>
        <button class="btn-primary btn-sm" style="background:#7c3aed;" onclick="genAll()"><i class="fas fa-layer-group"></i> Generate All 4</button>
        <div id="genSt" style="display:none;font-size:13px;color:#a07030;"><div class="dot-pulse" style="display:inline-flex;margin-right:6px;"><span></span><span></span><span></span></div>Generating...</div>
      </div>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:8px;margin-bottom:16px;" id="docTabs">
      ${["All","Resume/CV","Cover Letter","Personal Statement","Research Proposal"].map((t,i)=>
        `<button onclick="docTab('${["","resume","cover_letter","personal_statement","research_proposal"][i]}',this)" class="${i===0?'btn-primary btn-sm':'btn-outline btn-sm'}">${t}</button>`
      ).join("")}
    </div>

    <div id="docGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;"></div>
  </div>

  <script>
    let showGen=false;
    function toggleGen(){showGen=!showGen;document.getElementById('genPanel').style.display=showGen?'block':'none';}

    async function gen(type){
      const title=document.getElementById('gTitle').value||'Scholarship';
      const org=document.getElementById('gOrg').value||'Committee';
      const ctry=document.getElementById('gCtry').value||'International';
      const fld=document.getElementById('gFld').value||'Biotechnology';
      const st=document.getElementById('genSt');
      st.style.display='flex';
      try{
        const url='/api/documents/generate/'+type.replace(/_/g,'-');
        const r=await axios.post(url,{scholarship_title:title,organization:org,country:ctry,field:fld});
        st.style.display='none';
        toast('Document generated!');
        loadDocs();
        if(r.data.content) openDoc(r.data.title,r.data.content);
      }catch(e){st.style.display='none';toast('Generation failed','err');}
    }

    async function genAll(){
      const title=document.getElementById('gTitle').value||'General Scholarship';
      const st=document.getElementById('genSt');
      st.style.display='flex';
      try{
        const r=await axios.post('/api/documents/generate/all',{scholarship_id:null});
        st.style.display='none';
        toast('All 4 documents generated!');
        loadDocs();
      }catch(e){st.style.display='none';toast('Generation failed','err');}
    }

    function docTab(type,btn){
      document.querySelectorAll('#docTabs button').forEach(b=>b.className='btn-outline btn-sm');
      btn.className='btn-primary btn-sm';
      loadDocs(type);
    }

    async function loadDocs(type=''){
      try{
        let url='/api/documents/list';if(type)url+='?type='+type;
        const r=await axios.get(url);
        const docs=r.data.documents||[];
        const box=document.getElementById('docGrid');
        if(!docs.length){box.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:#aaa;"><i class="fas fa-file-alt" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px;"></i><p>No documents yet. Generate one!</p></div>';return;}
        const icons={resume:'file-alt',cover_letter:'envelope-open',personal_statement:'pen-fancy',research_proposal:'microscope'};
        const colors={resume:'#2d5fa8',cover_letter:'#c8a97e',personal_statement:'#2d7a4f',research_proposal:'#7c3aed'};
        const labels={resume:'Academic CV',cover_letter:'Cover Letter',personal_statement:'Personal Statement',research_proposal:'Research Proposal'};
        box.innerHTML=docs.map(d=>\`<div class="card" style="padding:18px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
            <div style="width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:\${colors[d.type]||'#888'}15;flex-shrink:0;">
              <i class="fas fa-\${icons[d.type]||'file'}" style="color:\${colors[d.type]||'#888'};font-size:14px;"></i>
            </div>
            <span style="font-size:10px;color:#aaa;">\${new Date(d.created_at).toLocaleDateString()}</span>
          </div>
          <p style="font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:2px;">\${d.title}</p>
          <p style="font-size:11px;color:#aaa;margin-bottom:12px;">\${labels[d.type]||d.type}</p>
          <div style="display:flex;gap:7px;">
            <button onclick="viewDoc(\${d.id})" class="btn-primary btn-sm" style="flex:1;justify-content:center;"><i class="fas fa-eye"></i> View</button>
            <button onclick="delDoc(\${d.id})" style="background:#fff5f5;border:1px solid #f0b8b8;color:#c0392b;padding:6px 12px;border-radius:7px;font-size:12px;cursor:pointer;"><i class="fas fa-trash"></i></button>
          </div>
        </div>\`).join('');
      }catch(e){console.error(e);}
    }

    async function viewDoc(id){
      try{const r=await axios.get('/api/documents/'+id);const d=r.data.document;openDoc(d.title,d.content);}
      catch(e){toast('Failed to load','err');}
    }

    async function delDoc(id){
      if(!confirm('Delete this document?'))return;
      try{await axios.delete('/api/documents/'+id);toast('Deleted');loadDocs();}
      catch(e){toast('Delete failed','err');}
    }

    loadDocs();
  </script>`;
  return getBaseLayout("Documents", "documents", c);
}

// ── PROFILE PAGE ─────────────────────────────────────────────
function getProfileHTML(): string {
  const c = `
  <div class="page-header">
    <div class="page-title">My Profile</div>
    <div class="page-sub">Complete profile used by GETSCO for all document generation and scholarship matching</div>
  </div>
  <div style="padding:0 36px 36px;display:grid;grid-template-columns:2fr 1fr;gap:18px;">
    <div style="display:flex;flex-direction:column;gap:16px;">

      <!-- Personal Info -->
      <div class="card" style="padding:22px;">
        <p style="font-weight:700;font-size:15px;margin-bottom:16px;"><i class="fas fa-user" style="color:#c8a97e;margin-right:8px;"></i>Personal Information</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${[
            ["Full Name","Syed Ashmam Ali Shah"],["Email","ashmamali2002@gmail.com"],
            ["Phone","+92 347 1978085"],["Age","23 Years"],
            ["Nationality","Pakistani"],["Country","Pakistan"],
            ["Languages","Urdu (Native) · Pashto (Native) · English"],
            ["Financial Status","Need-Based"],["Family","Father: Retired Government Officer"],
          ].map(([k,v])=>`
          <div style="background:#fafaf8;border-radius:9px;padding:11px 13px;border:1px solid #ede9e3;">
            <p style="font-size:10px;color:#aaa;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">${k}</p>
            <p style="font-size:13px;font-weight:600;color:#1a1a2e;">${v}</p>
          </div>`).join("")}
        </div>
        <!-- Address full width -->
        <div style="margin-top:10px;background:#fdf8f0;border:1px solid #e8d5a0;border-radius:9px;padding:11px 13px;display:flex;gap:10px;align-items:flex-start;">
          <i class="fas fa-map-marker-alt" style="color:#c8a97e;margin-top:2px;"></i>
          <div>
            <p style="font-size:10px;color:#aaa;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Home Address</p>
            <p style="font-size:13px;font-weight:600;color:#1a1a2e;">Back Street of PMS Boys 3, Ring Road, Peshawar, Pakistan</p>
          </div>
        </div>
        <button onclick="profileTestEmail()" class="btn-gold" style="margin-top:14px;width:100%;justify-content:center;">
          <i class="fas fa-envelope"></i> Send Test Email to ashmamali2002@gmail.com
        </button>
        <p id="emailResult" style="display:none;font-size:12px;text-align:center;margin-top:8px;"></p>
      </div>

      <!-- Academic Records -->
      <div class="card" style="padding:22px;">
        <p style="font-weight:700;font-size:15px;margin-bottom:14px;"><i class="fas fa-graduation-cap" style="color:#2d7a4f;margin-right:8px;"></i>Academic Records</p>
        <div style="display:flex;flex-direction:column;gap:9px;">
          ${[
            ["Bachelor's Degree","University of Peshawar","Biotechnology","CGPA 2.75 / 4.0","2020–2024"],
            ["Intermediate (F.Sc.)","Government College Peshawar","Pre-Medical","888 / 1100","2018–2020"],
            ["Matriculation (SSC)","Shower Model School","Science","973 / 1100","2016–2018"],
          ].map(([level,inst,field,marks,years])=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#fafaf8;border-radius:9px;border:1px solid #ede9e3;">
            <div><p style="font-size:13px;font-weight:600;color:#1a1a2e;">${level}</p><p style="font-size:11px;color:#888;margin-top:1px;">${inst} · ${field} · ${years}</p></div>
            <span class="badge-green">${marks}</span>
          </div>`).join("")}
        </div>
      </div>

      <!-- Publications -->
      <div class="card" style="padding:22px;">
        <p style="font-weight:700;font-size:15px;margin-bottom:14px;"><i class="fas fa-flask" style="color:#7c3aed;margin-right:8px;"></i>Research Publications <span class="badge-blue" style="margin-left:6px;">3 Papers</span></p>
        <div style="display:flex;flex-direction:column;gap:9px;">
          ${[
            ["Comparative In Silico Analysis of Wild-Type and Mutant-Type Akt2 Gene Mutation (C.58C>T) in Type-2 Diabetes Mellitus","International Journal of Applied and Clinical Research (IJACR)","https://www.ijacr.com/index.php/home/article/view/21"],
            ["Research Publication 2","International Journal of Applied and Clinical Research (IJACR)","https://www.ijacr.com/index.php/home/article/view/21"],
            ["Research Publication 3","Frontiers in Biotechnology and Therapeutics Journal","https://fbtjournal.com/index.php/fbt/article/view/177"],
          ].map(([title,journal,url])=>`
          <div style="padding:12px 14px;background:#fafaf8;border-radius:9px;border:1px solid #ede9e3;">
            <p style="font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:4px;">${title}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <p style="font-size:11px;color:#7c3aed;">${journal}</p>
              <a href="${url}" target="_blank" style="font-size:11px;color:#c8a97e;text-decoration:none;"><i class="fas fa-external-link-alt"></i> View</a>
            </div>
          </div>`).join("")}
        </div>
      </div>

      <!-- Career Goal -->
      <div class="card-warm" style="padding:22px;border-radius:14px;">
        <p style="font-weight:700;font-size:15px;margin-bottom:12px;"><i class="fas fa-bullseye" style="color:#c8a97e;margin-right:8px;"></i>Career Goal</p>
        <p style="font-size:13px;line-height:1.7;color:#444;">To become a biotechnology researcher dedicated to improving human health through meaningful scientific innovation and medical research. Coming from Pakistan, aspires to contribute to the discovery of affordable and effective solutions for diseases affecting millions — especially in underprivileged communities. Plans to bring advanced scientific knowledge and modern biotechnology practices back to Pakistan to contribute to scientific and healthcare development.</p>
      </div>
    </div>

    <!-- Right column -->
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- AI Score -->
      <div style="background:linear-gradient(135deg,#1a1a2e,#2d2d4a);border-radius:14px;padding:22px;color:#fff;">
        <p style="font-weight:600;font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:8px;"><i class="fas fa-robot" style="color:#c8a97e;margin-right:6px;"></i>GETSCO Profile Score</p>
        <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:4px;">
          <span style="font-size:52px;font-weight:800;color:#fff;line-height:1;">87</span>
          <span style="font-size:22px;color:#c8a97e;margin-bottom:6px;">/100</span>
        </div>
        <p style="font-size:11px;color:rgba(255,255,255,0.35);margin-bottom:16px;">Based on research output, academics & field alignment</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${[["Research Output","95","#4ade80"],["Academic Performance","65","#fbbf24"],["Field Relevance","95","#4ade80"],["Need-Based Fit","90","#4ade80"],["Country Coverage","88","#4ade80"]].map(([label,score,col])=>`
          <div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="color:rgba(255,255,255,0.5);">${label}</span><span style="font-weight:700;color:${col};">${score}%</span></div>
            <div style="height:3px;background:rgba(255,255,255,0.08);border-radius:2px;"><div style="height:3px;background:${col};border-radius:2px;width:${score}%;"></div></div>
          </div>`).join("")}
        </div>
      </div>

      <!-- Target Countries -->
      <div class="card" style="padding:18px;">
        <p style="font-weight:600;font-size:13px;margin-bottom:12px;"><i class="fas fa-globe" style="color:#c8a97e;margin-right:6px;"></i>Target Countries</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${["🇺🇸 USA","🇨🇦 Canada","🇦🇺 Australia","🇩🇪 Germany","🇯🇵 Japan","🇰🇷 S. Korea","🇹🇼 Taiwan","🇨🇳 China","🇸🇪 Sweden","🇫🇷 France","🇸🇦 Saudi Arabia","🇦🇪 UAE","🇶🇦 Qatar","🇰🇼 Kuwait"]
            .map(c=>`<span style="background:#fafaf8;border:1px solid #ede9e3;padding:4px 9px;border-radius:20px;font-size:11px;">${c}</span>`).join("")}
        </div>
      </div>

      <!-- Requirements -->
      <div class="card" style="padding:18px;">
        <p style="font-weight:600;font-size:13px;margin-bottom:12px;"><i class="fas fa-check-circle" style="color:#2d7a4f;margin-right:6px;"></i>Scholarship Requirements</p>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${["Full Tuition Fee","Monthly Stipend","Accommodation","Health Insurance","Airfare","Research Support","Lab Facilities"]
            .map(r=>`<div style="display:flex;align-items:center;gap:7px;"><i class="fas fa-check" style="color:#2d7a4f;font-size:11px;"></i><span style="font-size:12px;color:#444;">${r}</span></div>`).join("")}
          <div style="margin-top:8px;background:#f0faf4;border:1px solid #b8e0c8;border-radius:8px;padding:8px 12px;text-align:center;">
            <p style="font-size:12px;font-weight:700;color:#2d7a4f;">Fully Funded Only</p>
          </div>
        </div>
      </div>

      <!-- Top Fields -->
      <div class="card" style="padding:18px;">
        <p style="font-weight:600;font-size:13px;margin-bottom:12px;"><i class="fas fa-book" style="color:#7c3aed;margin-right:6px;"></i>Top Research Fields</p>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${["Biotechnology","Molecular Biology","Genetics","Microbiology","Immunology","Cancer Biology","Biomedical Sciences","Pharmacology"]
            .map((f,i)=>`<div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:12px;color:#444;">${f}</span><span style="font-size:10px;font-weight:600;color:#7c3aed;background:#f5f0ff;border-radius:20px;padding:2px 7px;">#${i+1}</span></div>`).join("")}
        </div>
      </div>
    </div>
  </div>

  <script>
    async function profileTestEmail(){
      const res = document.getElementById('emailResult');
      res.style.display='block'; res.style.color='#a07030'; res.textContent='Sending...';
      try{
        const r = await axios.post('/api/agent/test-email');
        res.style.color = r.data.success ? '#2d7a4f' : '#c0392b';
        res.textContent = r.data.success ? '✓ Test email sent! Check Gmail inbox (and Spam)' : '✗ Failed: '+(r.data.error||'');
      }catch(e){res.style.color='#c0392b';res.textContent='✗ Error sending email';}
    }
  </script>`;
  return getBaseLayout("Profile", "profile", c);
}

// ── DATA PREVIEW & EXTRACT ───────────────────────────────────
function getDataExtractHTML(): string {
  const c = `
  <div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:14px;">
      <div>
        <div class="page-title">Data Preview & Export</div>
        <div class="page-sub">All your GETSCO data in one place — scholarships, professors, documents, applications</div>
      </div>
      <div style="display:flex;gap:9px;flex-wrap:wrap;">
        <button class="btn-outline" onclick="exportCSV()"><i class="fas fa-file-csv"></i> Export CSV</button>
        <button class="btn-outline" onclick="exportJSON()"><i class="fas fa-file-code"></i> Export JSON</button>
        <button class="btn-gold" onclick="loadAll()"><i class="fas fa-sync-alt"></i> Refresh All</button>
      </div>
    </div>
  </div>

  <div style="padding:0 36px 36px;">

    <!-- Summary Strip -->
    <div id="summaryStrip" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px;">
      ${[1,2,3,4,5].map(i=>`<div class="stat-card" id="strip${i}" style="text-align:center;padding:16px 10px;">
        <p style="font-size:26px;font-weight:700;color:#1a1a2e;line-height:1;" id="sv${i}">—</p>
        <p style="font-size:11px;color:#aaa;margin-top:3px;" id="sl${i}">Loading…</p>
      </div>`).join("")}
    </div>

    <!-- Section tabs -->
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;border-bottom:2px solid #ebe9e4;padding-bottom:12px;" id="sectionTabs">
      ${[
        ["all","fas fa-th","All Data"],
        ["scholarships","fas fa-medal","Scholarships"],
        ["professors","fas fa-user-tie","Professors"],
        ["documents","fas fa-file-alt","Documents"],
        ["applications","fas fa-paper-plane","Applications"],
        ["profile","fas fa-user","Profile"],
      ].map(([key,icon,label],i)=>
        `<button onclick="switchTab('${key}',this)" id="tab-${key}" class="${i===0?'btn-primary btn-sm':'btn-outline btn-sm'}">
          <i class="${icon}"></i> ${label}
        </button>`
      ).join("")}
    </div>

    <!-- ── ALL OVERVIEW ── -->
    <div id="sec-all">
      <!-- Scholarships mini table -->
      <div class="card" style="margin-bottom:18px;overflow:hidden;">
        <div style="padding:14px 20px;border-bottom:1px solid #f0ede8;display:flex;justify-content:space-between;align-items:center;">
          <p style="font-weight:600;font-size:14px;"><i class="fas fa-medal" style="color:#c8a97e;margin-right:7px;"></i>Top Scholarships</p>
          <button onclick="switchTab('scholarships',document.getElementById('tab-scholarships'))" style="font-size:12px;color:#c8a97e;background:none;border:none;cursor:pointer;">View all →</button>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;" id="miniSchTable">
            <thead>
              <tr style="background:#fafaf8;border-bottom:1px solid #ede9e3;">
                <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Title</th>
                <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Country</th>
                <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Match</th>
                <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Trust</th>
                <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Deadline</th>
                <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;"></th>
              </tr>
            </thead>
            <tbody id="miniSchBody">
              <tr><td colspan="6" style="text-align:center;padding:30px;color:#aaa;font-size:13px;">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Professors + Documents side by side -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;">
        <!-- Professors mini -->
        <div class="card" style="overflow:hidden;">
          <div style="padding:14px 20px;border-bottom:1px solid #f0ede8;display:flex;justify-content:space-between;align-items:center;">
            <p style="font-weight:600;font-size:14px;"><i class="fas fa-user-tie" style="color:#c8a97e;margin-right:7px;"></i>Professors Found</p>
            <button onclick="switchTab('professors',document.getElementById('tab-professors'))" style="font-size:12px;color:#c8a97e;background:none;border:none;cursor:pointer;">View all →</button>
          </div>
          <div id="miniProfList" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
            <p style="text-align:center;padding:20px 0;color:#aaa;font-size:13px;">Loading...</p>
          </div>
        </div>

        <!-- Documents mini -->
        <div class="card" style="overflow:hidden;">
          <div style="padding:14px 20px;border-bottom:1px solid #f0ede8;display:flex;justify-content:space-between;align-items:center;">
            <p style="font-weight:600;font-size:14px;"><i class="fas fa-file-alt" style="color:#c8a97e;margin-right:7px;"></i>Recent Documents</p>
            <button onclick="switchTab('documents',document.getElementById('tab-documents'))" style="font-size:12px;color:#c8a97e;background:none;border:none;cursor:pointer;">View all →</button>
          </div>
          <div id="miniDocList" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
            <p style="text-align:center;padding:20px 0;color:#aaa;font-size:13px;">Loading...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SCHOLARSHIPS FULL TABLE ── -->
    <div id="sec-scholarships" style="display:none;">
      <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap;">
        <input id="schSearch" placeholder="Search title, country, organization..." style="max-width:300px;" oninput="filterScholarships()"/>
        <select id="schTrust" onchange="filterScholarships()" style="width:150px;">
          <option value="">All Sources</option>
          <option value="official">Official Only</option>
          <option value="recognised">Recognised Only</option>
        </select>
        <select id="schFunded" onchange="filterScholarships()" style="width:160px;">
          <option value="">All Funding</option>
          <option value="1">Fully Funded Only</option>
        </select>
        <span id="schCount" style="font-size:12px;color:#aaa;margin-left:auto;"></span>
      </div>
      <div class="card" style="overflow:hidden;">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;" id="fullSchTable">
            <thead>
              <tr style="background:#fafaf8;border-bottom:1px solid #ede9e3;">
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Title</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Org</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Country</th>
                <th style="padding:11px 16px;text-align:center;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Match</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Trust</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Funding</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Deadline</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Source Domain</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;"></th>
              </tr>
            </thead>
            <tbody id="fullSchBody">
              <tr><td colspan="9" style="text-align:center;padding:40px;color:#aaa;">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── PROFESSORS FULL TABLE ── -->
    <div id="sec-professors" style="display:none;">
      <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap;">
        <input id="profSearch" placeholder="Search name, university, email..." style="max-width:300px;" oninput="filterProfessors()"/>
        <select id="profAccept" onchange="filterProfessors()" style="width:180px;">
          <option value="">All Acceptance Status</option>
          <option value="yes">Accepting Students</option>
          <option value="no">Not Accepting</option>
          <option value="unknown">Unknown</option>
        </select>
        <span id="profCount" style="font-size:12px;color:#aaa;margin-left:auto;"></span>
      </div>
      <div class="card" style="overflow:hidden;">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;" id="fullProfTable">
            <thead>
              <tr style="background:#fafaf8;border-bottom:1px solid #ede9e3;">
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Name & Title</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">University</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Country</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Email</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Research Interests</th>
                <th style="padding:11px 16px;text-align:center;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Score</th>
                <th style="padding:11px 16px;text-align:center;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Accepting</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;"></th>
              </tr>
            </thead>
            <tbody id="fullProfBody">
              <tr><td colspan="8" style="text-align:center;padding:40px;color:#aaa;">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── DOCUMENTS PREVIEW ── -->
    <div id="sec-documents" style="display:none;">
      <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap;">
        <select id="docTypeFilter" onchange="filterDocs()" style="width:200px;">
          <option value="">All Document Types</option>
          <option value="resume">Academic CV / Resume</option>
          <option value="cover_letter">Cover Letter</option>
          <option value="personal_statement">Personal Statement</option>
          <option value="research_proposal">Research Proposal</option>
        </select>
        <span id="docCount" style="font-size:12px;color:#aaa;margin-left:auto;"></span>
      </div>
      <div id="docPreviewGrid" style="display:flex;flex-direction:column;gap:14px;"></div>
    </div>

    <!-- ── APPLICATIONS ── -->
    <div id="sec-applications" style="display:none;">
      <div class="card" style="overflow:hidden;">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;" id="fullAppTable">
            <thead>
              <tr style="background:#fafaf8;border-bottom:1px solid #ede9e3;">
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Scholarship</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Organization</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Country</th>
                <th style="padding:11px 16px;text-align:center;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Deadline</th>
                <th style="padding:11px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Started</th>
              </tr>
            </thead>
            <tbody id="fullAppBody">
              <tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa;">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── PROFILE SNAPSHOT ── -->
    <div id="sec-profile" style="display:none;">
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:18px;">
        <div style="display:flex;flex-direction:column;gap:14px;">
          <!-- Identity card -->
          <div class="card" style="padding:22px;">
            <p style="font-weight:700;font-size:15px;margin-bottom:16px;color:#1a1a2e;"><i class="fas fa-id-card" style="color:#c8a97e;margin-right:8px;"></i>Identity</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;" id="profileGrid">
              <p style="text-align:center;padding:20px;color:#aaa;grid-column:1/-1;">Loading...</p>
            </div>
          </div>
          <!-- Publications table -->
          <div class="card" style="overflow:hidden;">
            <div style="padding:14px 20px;border-bottom:1px solid #f0ede8;">
              <p style="font-weight:600;font-size:14px;"><i class="fas fa-flask" style="color:#7c3aed;margin-right:7px;"></i>Research Publications</p>
            </div>
            <div id="pubList" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
              <p style="text-align:center;padding:20px;color:#aaa;">Loading...</p>
            </div>
          </div>
          <!-- Academic records table -->
          <div class="card" style="overflow:hidden;">
            <div style="padding:14px 20px;border-bottom:1px solid #f0ede8;">
              <p style="font-weight:600;font-size:14px;"><i class="fas fa-graduation-cap" style="color:#2d7a4f;margin-right:7px;"></i>Academic Records</p>
            </div>
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="background:#fafaf8;border-bottom:1px solid #ede9e3;">
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;">Level</th>
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;">Institution</th>
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;">Field</th>
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#888;font-size:11px;text-transform:uppercase;">Marks</th>
                  </tr>
                </thead>
                <tbody id="acadBody">
                  <tr><td colspan="4" style="text-align:center;padding:30px;color:#aaa;">Loading...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <!-- Right: JSON raw view -->
        <div>
          <div class="card" style="padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <p style="font-weight:600;font-size:13px;"><i class="fas fa-code" style="color:#c8a97e;margin-right:6px;"></i>Raw Profile JSON</p>
              <button onclick="copyProfileJSON()" class="btn-outline btn-sm"><i class="fas fa-copy"></i> Copy</button>
            </div>
            <pre id="profileJSON" style="background:#1a1a2e;color:#c8a97e;padding:16px;border-radius:10px;font-size:11px;line-height:1.6;overflow-x:auto;max-height:480px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;">Loading...</pre>
          </div>
        </div>
      </div>
    </div>

  </div><!-- /padding -->

  <script>
    // ── State ────────────────────────────────────────────────
    let allScholarships = [], allProfessors = [], allDocuments = [], allApplications = [], profileData = {};
    let currentTab = 'all';

    // ── Section switcher ─────────────────────────────────────
    function switchTab(name, btn) {
      currentTab = name;
      ['all','scholarships','professors','documents','applications','profile'].forEach(s => {
        document.getElementById('sec-'+s).style.display = 'none';
      });
      document.getElementById('sec-'+name).style.display = 'block';
      document.querySelectorAll('#sectionTabs button').forEach(b => b.className = 'btn-outline btn-sm');
      if(btn) btn.className = 'btn-primary btn-sm';
      // Lazy load section data
      if(name === 'scholarships') renderFullSchTable();
      if(name === 'professors') renderFullProfTable();
      if(name === 'documents') renderDocPreview();
      if(name === 'applications') renderFullAppTable();
      if(name === 'profile') renderProfileSection();
    }

    // ── Load everything ──────────────────────────────────────
    async function loadAll() {
      try {
        const [statsRes, schRes, profRes, docRes, appRes, profDataRes] = await Promise.all([
          axios.get('/api/agent/preview-stats'),
          axios.get('/api/scholarships?limit=100'),
          axios.get('/api/professors?min_score=0'),
          axios.get('/api/documents/list'),
          axios.get('/api/applications'),
          axios.get('/api/profile/data'),
        ]);

        allScholarships  = schRes.data.scholarships || [];
        allProfessors    = profRes.data.professors || [];
        allDocuments     = docRes.data.documents || [];
        allApplications  = appRes.data.applications || [];
        profileData      = profDataRes.data;

        // Fill summary strip
        const s = statsRes.data.stats;
        const sc = s.scholarships || {};
        document.getElementById('sv1').textContent = sc.total || 0;   document.getElementById('sl1').textContent = 'Total Scholarships';
        document.getElementById('sv2').textContent = sc.high_match || 0; document.getElementById('sl2').textContent = 'High Match (≥70%)';
        document.getElementById('sv3').textContent = sc.official_count || 0; document.getElementById('sl3').textContent = 'Official Sources';
        document.getElementById('sv4').textContent = (s.professors || {}).total || 0; document.getElementById('sl4').textContent = 'Professors Found';
        document.getElementById('sv5').textContent = (s.documents || {}).total || 0; document.getElementById('sl5').textContent = 'Documents Made';

        renderMiniSchTable(statsRes.data.top_scholarships || []);
        renderMiniProfList(statsRes.data.top_professors || []);
        renderMiniDocList(statsRes.data.recent_documents || []);

      } catch(e) { console.error(e); }
    }

    // ── Mini Scholarship Table (All overview) ────────────────
    function renderMiniSchTable(list) {
      const tbody = document.getElementById('miniSchBody');
      if(!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:28px;color:#aaa;font-size:13px;"><i class="fas fa-search" style="display:block;font-size:24px;margin-bottom:10px;color:#ddd;"></i>No scholarships yet. Click Search on Dashboard.</td></tr>'; return; }
      tbody.innerHTML = list.map(s => {
        const sc = s.match_score || 0;
        const cls = sc>=70?'score-high':sc>=50?'score-mid':'score-low';
        const trust = s.source_trust_level==='official'
          ? '<span class="badge-green" style="font-size:10px;"><i class="fas fa-shield-alt" style="margin-right:2px;"></i>Official</span>'
          : s.source_trust_level==='recognised'
            ? '<span class="badge-blue" style="font-size:10px;">Recognised</span>'
            : '<span style="font-size:10px;color:#bbb;">—</span>';
        return \`<tr style="border-bottom:1px solid #f5f2ee;transition:background 0.12s;" onmouseover="this.style.background='#fafaf8'" onmouseout="this.style.background=''">
          <td style="padding:11px 16px;"><span style="font-weight:600;color:#1a1a2e;">\${s.title}</span><br><span style="font-size:11px;color:#aaa;">\${s.organization||''}</span></td>
          <td style="padding:11px 16px;"><span class="badge-blue" style="font-size:10px;">\${s.country||'Intl'}</span></td>
          <td style="padding:11px 16px;"><div class="score-ring \${cls}" style="width:36px;height:36px;font-size:13px;">\${Math.round(sc)}</div></td>
          <td style="padding:11px 16px;">\${trust}</td>
          <td style="padding:11px 16px;font-size:12px;color:\${s.deadline?'#c8a97e':'#bbb'}">\${s.deadline||'—'}</td>
          <td style="padding:11px 16px;"><a href="\${s.url}" target="_blank" class="btn-outline btn-sm" style="text-decoration:none;font-size:11px;"><i class="fas fa-external-link-alt"></i></a></td>
        </tr>\`;
      }).join('');
    }

    // ── Mini Professor List ──────────────────────────────────
    function renderMiniProfList(list) {
      const box = document.getElementById('miniProfList');
      if(!list.length) { box.innerHTML = '<p style="text-align:center;padding:20px;color:#aaa;font-size:13px;">No professors yet. Use Professors page to find them.</p>'; return; }
      box.innerHTML = list.map(p => {
        const acc = p.accepting_students==='yes'
          ? '<span class="badge-green" style="font-size:10px;"><i class="fas fa-check-circle" style="margin-right:2px;"></i>Open</span>'
          : p.accepting_students==='no'
            ? '<span class="badge-red" style="font-size:10px;">Closed</span>'
            : '<span style="font-size:10px;color:#bbb;">Unknown</span>';
        return \`<div style="background:#fafaf8;border:1px solid #ede9e3;border-radius:8px;padding:10px 12px;display:flex;align-items:flex-start;gap:10px;">
          <div style="width:34px;height:34px;background:#f5f1ea;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-user-tie" style="color:#c8a97e;font-size:12px;"></i></div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
              <p style="font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:1px;">\${p.name}</p>
              \${acc}
            </div>
            <p style="font-size:11px;color:#888;">\${p.university}</p>
            \${p.email?'<p style="font-size:11px;color:#2d5fa8;margin-top:2px;"><i class="fas fa-envelope" style="margin-right:3px;"></i>'+p.email+'</p>':''}
            \${p.research_interests?'<p style="font-size:11px;color:#666;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+p.research_interests.substring(0,60)+'…</p>':''}
          </div>
        </div>\`;
      }).join('');
    }

    // ── Mini Document List ───────────────────────────────────
    function renderMiniDocList(list) {
      const box = document.getElementById('miniDocList');
      if(!list.length) { box.innerHTML = '<p style="text-align:center;padding:20px;color:#aaa;font-size:13px;">No documents yet. Generate from Documents page.</p>'; return; }
      const icons = {resume:'file-alt',cover_letter:'envelope-open',personal_statement:'pen-fancy',research_proposal:'microscope'};
      const colors = {resume:'#2d5fa8',cover_letter:'#c8a97e',personal_statement:'#2d7a4f',research_proposal:'#7c3aed'};
      const labels = {resume:'Academic CV',cover_letter:'Cover Letter',personal_statement:'Personal Statement',research_proposal:'Research Proposal'};
      box.innerHTML = list.map(d => \`
        <div style="background:#fafaf8;border:1px solid #ede9e3;border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;background:\${colors[d.type]||'#888'}15;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fas fa-\${icons[d.type]||'file'}" style="color:\${colors[d.type]||'#888'};font-size:12px;"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <p style="font-size:12px;font-weight:600;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${d.title}</p>
            <p style="font-size:11px;color:#aaa;">\${labels[d.type]||d.type} · \${new Date(d.created_at).toLocaleDateString()}</p>
          </div>
          <button onclick="viewDoc(\${d.id})" class="btn-outline btn-sm" style="flex-shrink:0;font-size:11px;"><i class="fas fa-eye"></i></button>
        </div>\`).join('');
    }

    // ── Full Scholarships Table ──────────────────────────────
    function filterScholarships() {
      const q = (document.getElementById('schSearch')?.value||'').toLowerCase();
      const trust = document.getElementById('schTrust')?.value||'';
      const funded = document.getElementById('schFunded')?.value||'';
      const filtered = allScholarships.filter(s =>
        (!q || (s.title+s.organization+s.country+s.url).toLowerCase().includes(q)) &&
        (!trust || s.source_trust_level === trust) &&
        (!funded || String(s.is_fully_funded) === funded)
      );
      document.getElementById('schCount').textContent = filtered.length + ' of ' + allScholarships.length + ' scholarships';
      renderFullSchTable(filtered);
    }

    function renderFullSchTable(list) {
      if(!list) { filterScholarships(); return; }
      document.getElementById('schCount').textContent = list.length + ' of ' + allScholarships.length + ' scholarships';
      const tbody = document.getElementById('fullSchBody');
      if(!list.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:#aaa;">No scholarships match this filter.</td></tr>'; return; }
      tbody.innerHTML = list.map(s => {
        const sc = s.match_score||0;
        const cls = sc>=70?'score-high':sc>=50?'score-mid':'score-low';
        const trust = s.source_trust_level==='official'
          ? '<span class="badge-green" style="font-size:10px;"><i class="fas fa-shield-alt" style="margin-right:2px;"></i>Official</span>'
          : s.source_trust_level==='recognised'
            ? '<span class="badge-blue" style="font-size:10px;">Recognised</span>'
            : '<span style="font-size:10px;color:#bbb;">—</span>';
        return \`<tr style="border-bottom:1px solid #f5f2ee;transition:background 0.12s;" onmouseover="this.style.background='#fafaf8'" onmouseout="this.style.background=''">
          <td style="padding:11px 16px;max-width:240px;"><span style="font-weight:600;color:#1a1a2e;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${s.title}</span></td>
          <td style="padding:11px 16px;font-size:12px;color:#666;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${s.organization||'—'}</td>
          <td style="padding:11px 16px;"><span class="badge-blue" style="font-size:10px;white-space:nowrap;">\${s.country||'Intl'}</span></td>
          <td style="padding:11px 16px;text-align:center;"><div class="score-ring \${cls}" style="width:34px;height:34px;font-size:12px;margin:0 auto;">\${Math.round(sc)}</div></td>
          <td style="padding:11px 16px;">\${trust}</td>
          <td style="padding:11px 16px;">\${s.is_fully_funded?'<span class="badge-green" style="font-size:10px;"><i class="fas fa-check-circle" style="margin-right:2px;"></i>Funded</span>':'<span style="font-size:10px;color:#bbb;">Partial</span>'}</td>
          <td style="padding:11px 16px;font-size:12px;color:#c8a97e;white-space:nowrap;">\${s.deadline||'—'}</td>
          <td style="padding:11px 16px;font-size:11px;color:#aaa;white-space:nowrap;">\${s.source_domain||'—'}</td>
          <td style="padding:11px 16px;"><a href="\${s.url}" target="_blank" class="btn-outline btn-sm" style="text-decoration:none;font-size:11px;white-space:nowrap;"><i class="fas fa-external-link-alt"></i> Open</a></td>
        </tr>\`;
      }).join('');
    }

    // ── Full Professors Table ────────────────────────────────
    function filterProfessors() {
      const q = (document.getElementById('profSearch')?.value||'').toLowerCase();
      const acc = document.getElementById('profAccept')?.value||'';
      const filtered = allProfessors.filter(p =>
        (!q || (p.name+p.university+p.email+p.research_interests+'').toLowerCase().includes(q)) &&
        (!acc || p.accepting_students === acc)
      );
      document.getElementById('profCount').textContent = filtered.length + ' of ' + allProfessors.length + ' professors';
      renderFullProfTable(filtered);
    }

    function renderFullProfTable(list) {
      if(!list) { filterProfessors(); return; }
      document.getElementById('profCount').textContent = list.length + ' of ' + allProfessors.length + ' professors';
      const tbody = document.getElementById('fullProfBody');
      if(!list.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#aaa;">No professors match this filter. Use the Professors page to find them.</td></tr>'; return; }
      tbody.innerHTML = list.map(p => {
        const sc = p.relevance_score||0;
        const cls = sc>=70?'score-high':sc>=50?'score-mid':'score-low';
        const acc = p.accepting_students==='yes'
          ? '<span class="badge-green" style="font-size:10px;"><i class="fas fa-check-circle" style="margin-right:2px;"></i>Yes</span>'
          : p.accepting_students==='no'
            ? '<span class="badge-red" style="font-size:10px;"><i class="fas fa-times-circle" style="margin-right:2px;"></i>No</span>'
            : '<span style="font-size:10px;color:#bbb;">Unknown</span>';
        return \`<tr style="border-bottom:1px solid #f5f2ee;transition:background 0.12s;" onmouseover="this.style.background='#fafaf8'" onmouseout="this.style.background=''">
          <td style="padding:11px 16px;"><p style="font-weight:600;color:#1a1a2e;">\${p.name}</p><p style="font-size:11px;color:#aaa;">\${p.title||'Faculty'}</p></td>
          <td style="padding:11px 16px;font-size:12px;color:#444;max-width:180px;">\${p.university}</td>
          <td style="padding:11px 16px;font-size:12px;color:#666;">\${p.country||'—'}</td>
          <td style="padding:11px 16px;">\${p.email?'<a href="mailto:'+p.email+'" style="font-size:12px;color:#2d5fa8;text-decoration:none;"><i class="fas fa-envelope" style="margin-right:3px;"></i>'+p.email+'</a>':'<span style="color:#bbb;font-size:12px;">—</span>'}</td>
          <td style="padding:11px 16px;font-size:12px;color:#555;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${(p.research_interests||'—').substring(0,70)}</td>
          <td style="padding:11px 16px;text-align:center;"><div class="score-ring \${cls}" style="width:34px;height:34px;font-size:12px;margin:0 auto;">\${sc}</div></td>
          <td style="padding:11px 16px;text-align:center;">\${acc}</td>
          <td style="padding:11px 16px;display:flex;gap:5px;flex-wrap:nowrap;">
            \${p.linkedin_url?'<a href="'+p.linkedin_url+'" target="_blank" class="btn-outline btn-sm" style="text-decoration:none;font-size:11px;"><i class="fab fa-linkedin"></i></a>':''}
            \${p.profile_url?'<a href="'+p.profile_url+'" target="_blank" class="btn-outline btn-sm" style="text-decoration:none;font-size:11px;"><i class="fas fa-external-link-alt"></i></a>':''}
          </td>
        </tr>\`;
      }).join('');
    }

    // ── Documents Preview ────────────────────────────────────
    function filterDocs() {
      const type = document.getElementById('docTypeFilter')?.value||'';
      const filtered = allDocuments.filter(d => !type || d.type === type);
      document.getElementById('docCount').textContent = filtered.length + ' documents';
      renderDocPreview(filtered);
    }

    function renderDocPreview(list) {
      if(!list) { filterDocs(); return; }
      const colors = {resume:'#2d5fa8',cover_letter:'#c8a97e',personal_statement:'#2d7a4f',research_proposal:'#7c3aed'};
      const icons = {resume:'file-alt',cover_letter:'envelope-open',personal_statement:'pen-fancy',research_proposal:'microscope'};
      const labels = {resume:'Academic CV / Resume',cover_letter:'Cover Letter',personal_statement:'Personal Statement',research_proposal:'Research Proposal'};
      const box = document.getElementById('docPreviewGrid');
      document.getElementById('docCount').textContent = list.length + ' documents';
      if(!list.length) { box.innerHTML = '<div style="text-align:center;padding:60px;color:#aaa;"><i class="fas fa-file-alt" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px;"></i><p>No documents. Generate from Documents page.</p></div>'; return; }
      box.innerHTML = list.map(d => \`
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:14px 20px;border-bottom:1px solid #f0ede8;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:34px;height:34px;background:\${colors[d.type]||'#888'}15;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-\${icons[d.type]||'file'}" style="color:\${colors[d.type]||'#888'};font-size:13px;"></i>
              </div>
              <div>
                <p style="font-weight:600;font-size:13px;color:#1a1a2e;">\${d.title}</p>
                <p style="font-size:11px;color:#aaa;">\${labels[d.type]||d.type} · Created \${new Date(d.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
              </div>
            </div>
            <div style="display:flex;gap:7px;">
              <button onclick="viewDoc(\${d.id})" class="btn-primary btn-sm"><i class="fas fa-eye"></i> Preview</button>
            </div>
          </div>
          <div id="docSnippet-\${d.id}" style="padding:0;max-height:0;overflow:hidden;transition:max-height 0.3s,padding 0.3s;">
            <div style="padding:16px 20px;background:#fafaf8;font-family:'Georgia',serif;font-size:13px;line-height:1.85;color:#333;border-top:1px solid #f0ede8;" id="docSnippetContent-\${d.id}">Loading preview...</div>
          </div>
        </div>\`).join('');
    }

    // ── Applications Table ───────────────────────────────────
    function renderFullAppTable(list) {
      if(!list) list = allApplications;
      const tbody = document.getElementById('fullAppBody');
      if(!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa;"><i class="fas fa-paper-plane" style="display:block;font-size:28px;margin-bottom:12px;color:#ddd;"></i>No applications yet. Start one from the Scholarships page.</td></tr>'; return; }
      const cols = {preparing:'#a07030',pending:'#a07030',applied:'#2d5fa8',accepted:'#2d7a4f',rejected:'#c0392b'};
      tbody.innerHTML = list.map(a => \`<tr style="border-bottom:1px solid #f5f2ee;transition:background 0.12s;" onmouseover="this.style.background='#fafaf8'" onmouseout="this.style.background=''">
        <td style="padding:11px 16px;font-weight:600;color:#1a1a2e;">\${a.scholarship_title||'—'}</td>
        <td style="padding:11px 16px;font-size:12px;color:#666;">\${a.organization||'—'}</td>
        <td style="padding:11px 16px;"><span class="badge-blue" style="font-size:10px;">\${a.country||'—'}</span></td>
        <td style="padding:11px 16px;text-align:center;"><span style="font-size:11px;font-weight:600;color:\${cols[a.status]||'#888'};background:\${cols[a.status]||'#888'}18;border:1px solid \${cols[a.status]||'#888'}33;padding:3px 10px;border-radius:20px;text-transform:capitalize;">\${a.status}</span></td>
        <td style="padding:11px 16px;font-size:12px;color:#c8a97e;">\${a.deadline||'—'}</td>
        <td style="padding:11px 16px;font-size:11px;color:#aaa;">\${new Date(a.created_at||'').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
      </tr>\`).join('');
    }

    // ── Profile Section ──────────────────────────────────────
    function renderProfileSection() {
      const p = profileData.profile || {};
      const pubs = profileData.publications || [];
      const acad = profileData.academic_records || [];

      // Identity grid
      const fields = [
        ['Full Name', p.full_name],['Email', p.email],['Phone', p.phone||'Not set'],
        ['Age', p.age+' years'],['Nationality', p.nationality],['Country', p.country_of_residence],
        ['Degree', p.current_qualification],['University', p.university],
        ['CGPA', p.cgpa+' / 4.0'],['Field', p.field_of_study],
        ['Languages', p.languages],['Financial Status', p.financial_status],
      ];
      document.getElementById('profileGrid').innerHTML = fields.map(([k,v]) => \`
        <div style="background:#fafaf8;border:1px solid #ede9e3;border-radius:9px;padding:11px 13px;">
          <p style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">\${k}</p>
          <p style="font-size:13px;font-weight:600;color:#1a1a2e;">\${v||'—'}</p>
        </div>\`).join('');

      // Publications
      const pubBox = document.getElementById('pubList');
      if(!pubs.length) { pubBox.innerHTML = '<p style="text-align:center;padding:20px;color:#aaa;">No publications.</p>'; }
      else pubBox.innerHTML = pubs.map((pub,i) => \`
        <div style="background:#fafaf8;border:1px solid #ede9e3;border-radius:9px;padding:12px 14px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div style="flex:1;">
              <span style="font-size:10px;font-weight:700;color:#7c3aed;background:#f5f0ff;padding:2px 7px;border-radius:20px;border:1px solid #d8c8f8;">#\${i+1}</span>
              <p style="font-size:13px;font-weight:600;color:#1a1a2e;margin-top:6px;margin-bottom:4px;">\${pub.title}</p>
              <p style="font-size:11px;color:#7c3aed;">\${pub.journal||pub.publication_venue||''}</p>
              \${pub.year?'<p style="font-size:11px;color:#aaa;margin-top:2px;">'+pub.year+'</p>':''}
            </div>
            \${pub.url?'<a href="'+pub.url+'" target="_blank" class="btn-outline btn-sm" style="text-decoration:none;font-size:11px;flex-shrink:0;"><i class="fas fa-external-link-alt"></i> View</a>':''}
          </div>
        </div>\`).join('');

      // Academic records
      const acadTbody = document.getElementById('acadBody');
      if(!acad.length) acadTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#aaa;">No records.</td></tr>';
      else acadTbody.innerHTML = acad.map(r => \`<tr style="border-bottom:1px solid #f5f2ee;">
        <td style="padding:11px 16px;font-weight:600;color:#1a1a2e;">\${r.level}</td>
        <td style="padding:11px 16px;font-size:12px;color:#555;">\${r.institution}</td>
        <td style="padding:11px 16px;font-size:12px;color:#666;">\${r.field||'—'}</td>
        <td style="padding:11px 16px;"><span class="badge-green">\${r.marks_obtained||'—'}</span></td>
      </tr>\`).join('');

      // Raw JSON
      document.getElementById('profileJSON').textContent = JSON.stringify({
        profile: p, publications: pubs, academic_records: acad
      }, null, 2);
    }

    function copyProfileJSON() {
      const text = document.getElementById('profileJSON').textContent;
      navigator.clipboard.writeText(text).then(() => toast('Profile JSON copied!'));
    }

    // ── Document viewer ──────────────────────────────────────
    async function viewDoc(id) {
      try {
        const r = await axios.get('/api/documents/'+id);
        const d = r.data.document;
        openDoc(d.title, d.content);
      } catch(e) { toast('Failed to load document','err'); }
    }

    // ── Exports ──────────────────────────────────────────────
    function exportCSV() {
      window.open('/api/agent/export?format=csv&section=scholarships', '_blank');
      toast('Downloading scholarships as CSV…');
    }
    function exportJSON() {
      window.open('/api/agent/export?format=json&section=all', '_blank');
      toast('Downloading full data export as JSON…');
    }

    // ── Init ─────────────────────────────────────────────────
    loadAll();
  </script>`;
  return getBaseLayout("Data Preview", "data", c);
}

export default app;
