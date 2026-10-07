const SUPABASE_URL="https://sxjswfvfwmibiumyrceb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_678HrTraImMobymHWNLq0Q_iSSqhh4O";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const loginScreen=document.getElementById("loginScreen");
const adminShell=document.getElementById("adminShell");
const loginForm=document.getElementById("loginForm");
const loginStatus=document.getElementById("loginStatus");
const connectionStatus=document.getElementById("connectionStatus");
let isLoggingIn=false;

function showLogin(message=""){
  loginScreen.hidden=false;
  adminShell.hidden=true;
  loginScreen.style.display="flex";
  adminShell.style.display="none";
  if(message) loginStatus.textContent=message;
}
function showAdmin(){
  loginScreen.hidden=true;
  adminShell.hidden=false;
  loginScreen.style.display="none";
  adminShell.style.display="grid";
  connectionStatus.textContent="Connected";
  connectionStatus.style.color="#69e39a";
  document.getElementById("pageTitle").textContent="Dashboard";
}

async function isAdminEmail(email){
  const normalizedEmail=(email||"").trim().toLowerCase();
  if(!normalizedEmail) return false;
  const {data,error}=await supabaseClient
    .from("admin_users")
    .select("email")
    .eq("email",normalizedEmail)
    .maybeSingle();
  if(error){
    console.error("Admin allow-list check failed:",error);
    return false;
  }
  return !!data;
}
async function checkSession(){
  const {data,error}=await supabaseClient.auth.getSession();
  if(error){
    if(!isLoggingIn) showLogin("Unable to check session. Please try again.");
    return;
  }
  if(!data.session){
    if(!isLoggingIn) showLogin();
    return;
  }
  const allowed=await isAdminEmail(data.session.user.email);
  if(allowed) showAdmin();
  else if(!isLoggingIn){
    await supabaseClient.auth.signOut();
    showLogin("This account is not authorized as an admin.");
  }
}
loginForm.addEventListener("submit",async event=>{
  event.preventDefault();
  if(isLoggingIn) return;
  isLoggingIn=true;
  loginStatus.style.color="#6f7b8e";
  loginStatus.textContent="Signing in…";

  const email=document.getElementById("loginEmail").value.trim().toLowerCase();
  const password=document.getElementById("loginPassword").value;
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});

  if(error){
    isLoggingIn=false;
    loginStatus.style.color="#d33";
    loginStatus.textContent=error.message;
    return;
  }

  const allowed=await isAdminEmail(data.user.email);
  if(!allowed){
    await supabaseClient.auth.signOut();
    isLoggingIn=false;
    loginStatus.style.color="#d33";
    loginStatus.textContent="Login worked, but this email is not on the admin allow-list.";
    return;
  }

  loginStatus.style.color="#2b8a3e";
  loginStatus.textContent="Login successful. Opening Admin Dashboard…";
  setTimeout(()=>{
    showAdmin();
    isLoggingIn=false;
  },100);
});
document.getElementById("logoutBtn").addEventListener("click",async()=>{await supabaseClient.auth.signOut();showLogin();});
const navItems=document.querySelectorAll(".nav-item"),sections=document.querySelectorAll(".section"),pageTitle=document.getElementById("pageTitle");
navItems.forEach(item=>item.addEventListener("click",()=>{const section=item.dataset.section;navItems.forEach(x=>x.classList.remove("active"));item.classList.add("active");sections.forEach(x=>x.classList.toggle("active",x.id===section));pageTitle.textContent=item.textContent.replace(/^\S+\s/,"").trim();}));
document.getElementById("addProductBtn").addEventListener("click",()=>alert("Product editor is the next Admin step."));

supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_IN" && session && !isLoggingIn){
    isAdminEmail(session.user.email).then(allowed=>{
      if(allowed) showAdmin();
    });
  }
});

checkSession();
