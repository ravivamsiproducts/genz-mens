const navItems=document.querySelectorAll(".nav-item");
const sections=document.querySelectorAll(".section");
const pageTitle=document.getElementById("pageTitle");

navItems.forEach(item=>{
  item.addEventListener("click",()=>{
    const section=item.dataset.section;
    navItems.forEach(x=>x.classList.remove("active"));
    item.classList.add("active");
    sections.forEach(x=>x.classList.toggle("active",x.id===section));
    pageTitle.textContent=item.textContent.replace(/^\S+\s/,"").trim();
  });
});

document.getElementById("logoutBtn").addEventListener("click",()=>{
  alert("Supabase Auth will control admin login/logout after project credentials are configured.");
});

document.getElementById("addProductBtn").addEventListener("click",()=>{
  alert("Product editor will be connected to Supabase in the next step.");
});
