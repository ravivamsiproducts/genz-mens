const SUPABASE_URL="https://sxjswfvfwmibiumyrceb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_678HrTraImMobymHWNLq0Q_iSSqhh4O";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const loginScreen=document.getElementById("loginScreen");
const adminShell=document.getElementById("adminShell");
const loginForm=document.getElementById("loginForm");
const loginStatus=document.getElementById("loginStatus");
const connectionStatus=document.getElementById("connectionStatus");

function showLogin(message=""){
  loginScreen.hidden=false; adminShell.hidden=true;
  if(message) loginStatus.textContent=message;
}
function showAdmin(){
  loginScreen.hidden=true; adminShell.hidden=false;
  connectionStatus.textContent="Connected"; connectionStatus.style.color="#69e39a";
}
async function checkSession(){
  const {data,error}=await supabaseClient.auth.getSession();
  if(error){showLogin("Unable to check session.");return;}
  if(!data.session){showLogin();return;}
  const {data:allowed}=await supabaseClient.from("admin_users").select("email").eq("email",data.session.user.email).maybeSingle();
  if(allowed) showAdmin();
  else{await supabaseClient.auth.signOut();showLogin("This account is not authorized as an admin.");}
}
loginForm.addEventListener("submit",async event=>{
  event.preventDefault(); loginStatus.textContent="Signing in…";
  const email=document.getElementById("loginEmail").value.trim().toLowerCase();
  const password=document.getElementById("loginPassword").value;
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){loginStatus.textContent=error.message;return;}
  const {data:allowed,error:allowError}=await supabaseClient.from("admin_users").select("email").eq("email",data.user.email).maybeSingle();
  if(allowError||!allowed){await supabaseClient.auth.signOut();loginStatus.textContent="Login worked, but this email is not on the admin allow-list.";return;}
  loginStatus.textContent=""; showAdmin();
});
document.getElementById("logoutBtn").addEventListener("click",async()=>{await supabaseClient.auth.signOut();showLogin();});
const navItems=document.querySelectorAll(".nav-item"),sections=document.querySelectorAll(".section"),pageTitle=document.getElementById("pageTitle");
navItems.forEach(item=>item.addEventListener("click",()=>{const section=item.dataset.section;navItems.forEach(x=>x.classList.remove("active"));item.classList.add("active");sections.forEach(x=>x.classList.toggle("active",x.id===section));pageTitle.textContent=item.textContent.replace(/^\S+\s/,"").trim();}));
document.getElementById("addProductBtn").addEventListener("click",()=>alert("Product editor is the next Admin step."));
checkSession();
