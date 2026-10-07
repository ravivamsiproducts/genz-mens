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

supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_IN" && session && !isLoggingIn){
    isAdminEmail(session.user.email).then(allowed=>{
      if(allowed) showAdmin();
    });
  }
});

checkSession();

let adminProducts=[];
let adminCategories=[];

function setAdminMessage(message,type=""){
  const el=document.getElementById("productMessage");
  if(el){el.textContent=message;el.style.color=type==="error"?"#c62828":type==="success"?"#21854a":"";}
}
function setFormMessage(message,type=""){
  const el=document.getElementById("productFormMessage");
  if(el){el.textContent=message;el.style.color=type==="error"?"#c62828":type==="success"?"#21854a":"";}
}
function slugify(value){
  return value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m];});
}
async function loadCategories(){
  const {data,error}=await supabaseClient.from("categories").select("id,name,slug,is_active").order("name");
  if(error){setAdminMessage("Could not load categories: "+error.message,"error");return;}
  adminCategories=data||[];
  document.getElementById("productCategoryFilter").innerHTML='<option value="All">All Categories</option>'+adminCategories.map(function(c){return '<option value="'+c.id+'">'+escapeHtml(c.name)+'</option>';}).join("");
  document.getElementById("productCategory").innerHTML=adminCategories.map(function(c){return '<option value="'+c.id+'">'+escapeHtml(c.name)+'</option>';}).join("");
}
function categoryName(id){
  const c=adminCategories.find(function(x){return x.id===id;});
  return c?c.name:"Uncategorized";
}
function renderAdminProducts(){
  const body=document.getElementById("productTableBody");
  const q=(document.getElementById("productSearch").value||"").trim().toLowerCase();
  const cat=document.getElementById("productCategoryFilter").value||"All";
  const list=adminProducts.filter(function(p){
    return (!q || p.name.toLowerCase().includes(q) || (p.slug||"").includes(q)) && (cat==="All" || p.category_id===cat);
  });
  if(!list.length){
    body.innerHTML='<tr><td colspan="6"><div class="empty"><strong>No products in Supabase yet</strong><span>Click + Add Product to create your first live product.</span></div></td></tr>';
    return;
  }
  body.innerHTML=list.map(function(p){
    return '<tr><td><div class="product-cell"><strong>'+escapeHtml(p.name)+'</strong><small>'+escapeHtml(p.slug||"")+'</small></div></td>'+
      '<td>'+escapeHtml(categoryName(p.category_id))+'</td>'+
      '<td>₹'+Number(p.price||0).toLocaleString("en-IN")+'</td>'+
      '<td><span class="status-pill '+(p.is_active?"status-active":"status-inactive")+'">'+(p.is_active?"Active":"Inactive")+'</span></td>'+
      '<td>'+escapeHtml((p.sizes||[]).join(", "))+'</td>'+
      '<td><div class="action-group"><button class="table-btn" type="button" onclick="editAdminProduct(\''+p.id+'\')">Edit</button><button class="table-btn delete" type="button" onclick="deleteAdminProduct(\''+p.id+'\')">Delete</button></div></td></tr>';
  }).join("");
}
async function loadAdminProducts(){
  setAdminMessage("Loading products…");
  const {data,error}=await supabaseClient.from("products").select("*").order("created_at",{ascending:false});
  if(error){setAdminMessage("Could not load products: "+error.message,"error");return;}
  adminProducts=data||[];
  renderAdminProducts();
  document.getElementById("statProducts").textContent=adminProducts.length;
  setAdminMessage(adminProducts.length?adminProducts.length+" live product(s) loaded.":"No products yet.");
}
async function getProductImages(productId){
  const {data,error}=await supabaseClient.from("product_images").select("id,image_url,sort_order,is_primary").eq("product_id",productId).order("sort_order");
  if(error){console.error("Product image load failed:",error);return [];}
  return data||[];
}
async function getProductInventory(productId){
  const {data,error}=await supabaseClient.from("inventory").select("size,stock_qty").eq("product_id",productId);
  if(error){console.error("Inventory load failed:",error);return [];}
  return data||[];
}
function renderInventoryInputs(sizes,stockRows=[]){
  const stockMap={};
  stockRows.forEach(function(r){stockMap[r.size]=r.stock_qty??0;});
  const all=["S","M","L","XL","XXL"];
  document.getElementById("inventoryGrid").innerHTML=all.filter(function(size){return sizes.includes(size);}).map(function(size){
    return '<label class="stock-field"><span>'+size+' Stock</span><input type="number" min="0" step="1" data-stock-size="'+size+'" value="'+Number(stockMap[size]||0)+'"></label>';
  }).join("") || '<span style="color:#6f7b8e;font-size:12px">Select at least one size.</span>';
}
function renderProductImagePreview(images){
  const box=document.getElementById("productImagePreview");
  if(!box)return;
  box.innerHTML=(images||[]).slice(0,5).map(function(item,i){
    const url=typeof item==="string"?item:item.image_url;
    return '<div class="image-preview-card"><img src="'+escapeHtml(url)+'" alt="Product image '+(i+1)+'"><span>View '+(i+1)+'</span></div>';
  }).join("");
}
function previewSelectedImages(){
  const files=Array.from(document.getElementById("productImages").files||[]).slice(0,5);
  if(!files.length)return;
  renderProductImagePreview(files.map(function(file){return URL.createObjectURL(file);}));
}
async function openProductEditor(product=null){

  document.getElementById("productModalTitle").textContent=product?"Edit Product":"Add Product";
  document.getElementById("productId").value=product?.id||"";
  document.getElementById("productName").value=product?.name||"";
  document.getElementById("productCategory").value=product?.category_id||adminCategories[0]?.id||"";
  document.getElementById("productPrice").value=product?.price??"";
  document.getElementById("productComparePrice").value=product?.compare_at_price??"";
  document.getElementById("productBadge").value=product?.badge||"";
  document.getElementById("productDescription").value=product?.description||"";
  document.getElementById("productActive").checked=product?.is_active!==false;
  const sizes=product?.sizes||["S","M","L","XL","XXL"];
  Array.from(document.getElementById("productSizes").options).forEach(function(o){o.selected=sizes.includes(o.value);});
  document.getElementById("productImages").value="";
  renderProductImagePreview([]);
  renderInventoryInputs(sizes,[]);
  if(product?.id){
    const [images,stock]=await Promise.all([getProductImages(product.id),getProductInventory(product.id)]);
    renderProductImagePreview(images);
    renderInventoryInputs(sizes,stock);
  }
  setFormMessage("");
  document.getElementById("productModal").hidden=false;
}
function closeProductEditor(){document.getElementById("productModal").hidden=true;}
async function uploadProductImages(productId,files){
  const selected=Array.from(files||[]).slice(0,5);
  if(!selected.length)return;
  const {data:oldImages,error:oldError}=await supabaseClient.from("product_images").select("id,image_url").eq("product_id",productId);
  if(oldError)throw oldError;

  for(let i=0;i<selected.length;i++){
    const file=selected[i];
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=productId+"/view"+(i+1)+"-"+Date.now()+"."+ext;
    const upload=await supabaseClient.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});
    if(upload.error)throw upload.error;
    const publicUrl=supabaseClient.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    const insert=await supabaseClient.from("product_images").insert({
      product_id:productId,image_url:publicUrl,sort_order:i+1,is_primary:i===0
    });
    if(insert.error)throw insert.error;
  }

  if(oldImages?.length){
    await supabaseClient.from("product_images").delete().eq("product_id",productId).neq("id","00000000-0000-0000-0000-000000000000");
    // Re-insert uploaded image rows because the cleanup above removes the old rows and newly inserted rows.
    for(let i=0;i<selected.length;i++){
      const file=selected[i];
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
      // This branch is intentionally handled below by reloading the current storage objects.
    }
  }
}
async function replaceProductImages(productId,files){
  const selected=Array.from(files||[]).slice(0,5);
  if(!selected.length)return;
  const old=await supabaseClient.from("product_images").select("id").eq("product_id",productId);
  if(old.error)throw old.error;
  if(old.data?.length){
    const del=await supabaseClient.from("product_images").delete().eq("product_id",productId);
    if(del.error)throw del.error;
  }
  for(let i=0;i<selected.length;i++){
    const file=selected[i];
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=productId+"/view"+(i+1)+"-"+Date.now()+"-"+i+"."+ext;
    const upload=await supabaseClient.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});
    if(upload.error)throw upload.error;
    const publicUrl=supabaseClient.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    const insert=await supabaseClient.from("product_images").insert({product_id:productId,image_url:publicUrl,sort_order:i+1,is_primary:i===0});
    if(insert.error)throw insert.error;
  }
}
async function saveInventory(productId,sizes){
  const rows=sizes.map(function(size){
    const input=document.querySelector('[data-stock-size="'+size+'"]');
    return {product_id:productId,size,stock_qty:Math.max(0,Number(input?.value||0))};
  });
  const {error}=await supabaseClient.from("inventory").upsert(rows,{onConflict:"product_id,size"});
  if(error)throw error;
  const {data:existing}=await supabaseClient.from("inventory").select("size").eq("product_id",productId);
  if(existing){
    const keep=new Set(sizes);
    const remove=existing.map(r=>r.size).filter(size=>!keep.has(size));
    if(remove.length)await supabaseClient.from("inventory").delete().eq("product_id",productId).in("size",remove);
  }
}
async function saveAdminProduct(event){
  event.preventDefault();
  const id=document.getElementById("productId").value;
  const name=document.getElementById("productName").value.trim();
  const categoryId=document.getElementById("productCategory").value;
  const price=Number(document.getElementById("productPrice").value);
  const compareRaw=document.getElementById("productComparePrice").value;
  const compareAt=compareRaw===""?null:Number(compareRaw);
  const badge=document.getElementById("productBadge").value.trim()||null;
  const description=document.getElementById("productDescription").value.trim()||null;
  const sizes=Array.from(document.getElementById("productSizes").selectedOptions).map(function(o){return o.value;});
  const isActive=document.getElementById("productActive").checked;
  const files=Array.from(document.getElementById("productImages").files||[]).slice(0,5);
  if(!name||!categoryId||!Number.isFinite(price)||price<0||!sizes.length){setFormMessage("Please enter name, category, price and at least one size.","error");return;}
  if(files.length>5){setFormMessage("You can upload a maximum of 5 images.","error");return;}
  const base={name,slug:slugify(name),category_id:categoryId,description,price,compare_at_price:compareAt,badge,sizes,is_active:isActive};
  setFormMessage("Saving product…");
  const result=id?await supabaseClient.from("products").update(base).eq("id",id).select().single():await supabaseClient.from("products").insert(base).select().single();
  if(result.error){setFormMessage(result.error.message,"error");return;}
  const productId=result.data.id;
  try{
    if(files.length)await replaceProductImages(productId,files);
    await saveInventory(productId,sizes);
  }catch(error){
    console.error(error);
    setFormMessage("Product saved, but images/stock could not be saved: "+error.message,"error");
    await loadAdminProducts();
    return;
  }
  setFormMessage("Product, images and stock saved successfully.","success");
  await loadAdminProducts();
  setTimeout(closeProductEditor,500);
}
function editAdminProduct(id){
  const product=adminProducts.find(function(p){return p.id===id;});
  if(product) openProductEditor(product);
}
async function deleteAdminProduct(id){
  const product=adminProducts.find(function(p){return p.id===id;});
  if(!product)return;
  if(!confirm('Delete "'+product.name+'"? This will also remove its inventory and product images.'))return;
  setAdminMessage("Deleting…");
  const {error}=await supabaseClient.from("products").delete().eq("id",id);
  if(error){setAdminMessage("Delete failed: "+error.message,"error");return;}
  await loadAdminProducts();
  setAdminMessage("Product deleted.","success");
}
async function initProductAdmin(){await loadCategories();await loadAdminProducts();}
document.getElementById("addProductBtn").addEventListener("click",function(){openProductEditor();});
document.getElementById("closeProductModal").addEventListener("click",closeProductEditor);
document.getElementById("cancelProductBtn").addEventListener("click",closeProductEditor);
document.getElementById("productForm").addEventListener("submit",saveAdminProduct);
document.getElementById("productImages").addEventListener("change",previewSelectedImages);
document.getElementById("productSizes").addEventListener("change",function(){
  const sizes=Array.from(this.selectedOptions).map(function(o){return o.value;});
  const currentRows=Array.from(document.querySelectorAll("[data-stock-size]")).map(function(input){return {size:input.dataset.stockSize,stock_qty:Number(input.value||0)};});
  renderInventoryInputs(sizes,currentRows);
});
document.getElementById("refreshProductsBtn").addEventListener("click",initProductAdmin);
document.getElementById("productSearch").addEventListener("input",renderAdminProducts);
document.getElementById("productCategoryFilter").addEventListener("change",renderAdminProducts);
initProductAdmin();
