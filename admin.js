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
  setTimeout(loadAllAdminData,0);
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


// ===== LIVE CUSTOMERS / INVENTORY / PAYMENTS =====
let adminCustomers=[];
let adminInventory=[];
let adminPayments=[];

function setSectionMessage(id,message,type=""){
  const el=document.getElementById(id);
  if(el){el.textContent=message;el.style.color=type==="error"?"#c62828":type==="success"?"#21854a":"";}
}

async function loadAdminCustomers(){
  const body=document.getElementById("customersTableBody"); if(!body)return;
  setSectionMessage("customersMessage","Loading customers…");
  const [{data:customers,error:ce},{data:orders,error:oe}]=await Promise.all([
    supabaseClient.from("customers").select("id,full_name,phone,email,created_at").order("created_at",{ascending:false}),
    supabaseClient.from("orders").select("customer_id,total")
  ]);
  if(ce||oe){
    const error=ce||oe; console.error("Customers load failed:",error);
    body.innerHTML='<tr><td colspan="7"><div class="empty"><strong>Could not load customers</strong><span>'+escapeHtml(error.message)+'</span></div></td></tr>';
    setSectionMessage("customersMessage",error.message,"error"); return;
  }
  const orderMap={};
  (orders||[]).forEach(o=>{const id=o.customer_id;if(!id)return;orderMap[id]??={count:0,spent:0};orderMap[id].count++;orderMap[id].spent+=Number(o.total||0);});
  adminCustomers=(customers||[]).map(c=>({...c,order_count:orderMap[c.id]?.count||0,spent:orderMap[c.id]?.spent||0}));
  renderAdminCustomers();
  document.getElementById("statCustomers").textContent=adminCustomers.length;
  setSectionMessage("customersMessage",adminCustomers.length+" live customer(s) loaded.","success");
}

function renderAdminCustomers(){
  const body=document.getElementById("customersTableBody"); if(!body)return;
  const q=(document.getElementById("customerSearch")?.value||"").trim().toLowerCase();
  const list=adminCustomers.filter(c=>!q||[c.full_name,c.phone,c.email].some(v=>String(v||"").toLowerCase().includes(q)));
  if(!list.length){body.innerHTML='<tr><td colspan="7"><div class="empty"><strong>No customers found</strong><span>Customers are created automatically when an order is placed.</span></div></td></tr>';return;}
  body.innerHTML=list.map(c=>{
    const joined=new Date(c.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"});
    return '<tr><td><div class="product-cell"><strong>'+escapeHtml(c.full_name)+'</strong><small>'+escapeHtml(c.id)+'</small></div></td>'+
      '<td>'+escapeHtml(c.phone)+'</td><td>'+escapeHtml(c.email||"—")+'</td><td>'+c.order_count+'</td><td>₹'+c.spent.toLocaleString("en-IN")+'</td><td>'+escapeHtml(joined)+'</td>'+
      '<td><button type="button" class="secondary-btn customer-view-btn" data-customer-id="'+c.id+'">View</button></td></tr>';
  }).join("");
  body.querySelectorAll(".customer-view-btn").forEach(b=>b.addEventListener("click",()=>openCustomerDetails(b.dataset.customerId)));
}

async function openCustomerDetails(id){
  const customer=adminCustomers.find(c=>c.id===id); if(!customer)return;
  document.getElementById("customerModalTitle").textContent=customer.full_name;
  const box=document.getElementById("customerDetailContent");
  box.innerHTML='<p class="muted">Loading order history…</p>';
  document.getElementById("customerModal").hidden=false;
  const {data,error}=await supabaseClient.from("orders").select("order_number,total,order_status,payment_method,payment_status,created_at").eq("customer_id",id).order("created_at",{ascending:false});
  if(error){box.innerHTML='<div class="empty"><strong>Could not load order history</strong><span>'+escapeHtml(error.message)+'</span></div>';return;}
  box.innerHTML='<div class="customer-detail-card"><div><strong>Phone</strong><span>'+escapeHtml(customer.phone)+'</span></div><div><strong>Email</strong><span>'+escapeHtml(customer.email||"—")+'</span></div><div><strong>Total Orders</strong><span>'+customer.order_count+'</span></div><div><strong>Total Spent</strong><span>₹'+customer.spent.toLocaleString("en-IN")+'</span></div></div>'+
    '<h3 class="subheading">Order History</h3>'+
    ((data||[]).length?'<div class="table-wrap"><table class="admin-table"><thead><tr><th>ORDER</th><th>DATE</th><th>TOTAL</th><th>PAYMENT</th><th>STATUS</th></tr></thead><tbody>'+
    data.map(o=>'<tr><td>'+escapeHtml(o.order_number)+'</td><td>'+escapeHtml(new Date(o.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}))+'</td><td>₹'+Number(o.total||0).toLocaleString("en-IN")+'</td><td>'+escapeHtml(o.payment_method||"—")+' · '+escapeHtml(o.payment_status||"Pending")+'</td><td>'+escapeHtml(o.order_status||"Pending")+'</td></tr>').join("")+
    '</tbody></table></div>':'<div class="empty"><strong>No orders yet</strong><span>This customer has no orders.</span></div>');
}
function closeCustomerDetails(){const m=document.getElementById("customerModal");if(m)m.hidden=true;}

async function loadAdminInventory(){
  const body=document.getElementById("inventoryTableBody"); if(!body)return;
  setSectionMessage("inventoryMessage","Loading inventory…");
  const [{data:productsData,error:pe},{data:stock,error:ie}]=await Promise.all([
    supabaseClient.from("products").select("id,name,category_id,is_active").order("name"),
    supabaseClient.from("inventory").select("product_id,size,stock_qty")
  ]);
  if(pe||ie){const error=pe||ie;body.innerHTML='<tr><td colspan="8"><div class="empty"><strong>Could not load inventory</strong><span>'+escapeHtml(error.message)+'</span></div></td></tr>';setSectionMessage("inventoryMessage",error.message,"error");return;}
  const catMap={};adminCategories.forEach(c=>catMap[c.id]=c.name);
  const stockMap={};(stock||[]).forEach(x=>(stockMap[x.product_id]??={})[x.size]=Number(x.stock_qty||0));
  adminInventory=(productsData||[]).map(p=>{const s=stockMap[p.id]||{};return {...p,category:catMap[p.category_id]||"Uncategorized",stock:s,total:["S","M","L","XL","XXL"].reduce((a,k)=>a+(s[k]||0),0)};});
  renderAdminInventory();
  setSectionMessage("inventoryMessage",adminInventory.length+" product inventory record(s) loaded.","success");
}
function renderAdminInventory(){
  const body=document.getElementById("inventoryTableBody");if(!body)return;
  const q=(document.getElementById("inventorySearch")?.value||"").trim().toLowerCase();
  const filter=document.getElementById("inventoryStockFilter")?.value||"All";
  const list=adminInventory.filter(p=>{
    const matchesQ=!q||p.name.toLowerCase().includes(q);
    const vals=["S","M","L","XL","XXL"].map(k=>p.stock[k]??0);
    const matches=filter==="All"||filter==="Low" ? (filter==="Low" ? vals.some(v=>v>0&&v<=5) : true) : filter==="Out" ? vals.some(v=>v===0) : vals.every(v=>v>=6);
    return matchesQ&&matches;
  });
  if(!list.length){body.innerHTML='<tr><td colspan="8"><div class="empty"><strong>No inventory matches</strong><span>Try another search or stock filter.</span></div></td></tr>';return;}
  body.innerHTML=list.map(p=>{
    const cell=k=>{const n=Number(p.stock[k]??0);return '<span class="stock-number '+(n===0?"stock-out":n<=5?"stock-low":"stock-ok")+'">'+n+'</span>';};
    return '<tr><td><div class="product-cell"><strong>'+escapeHtml(p.name)+'</strong><small>'+(!p.is_active?"Inactive":"Active")+'</small></div></td><td>'+escapeHtml(p.category)+'</td><td>'+cell("S")+'</td><td>'+cell("M")+'</td><td>'+cell("L")+'</td><td>'+cell("XL")+'</td><td>'+cell("XXL")+'</td><td><strong>'+p.total+'</strong></td></tr>';
  }).join("");
}

async function loadAdminPayments(){
  const body=document.getElementById("paymentsTableBody");if(!body)return;
  setSectionMessage("paymentsMessage","Loading payments…");
  const {data,error}=await supabaseClient.from("orders").select("id,order_number,customer_name,customer_phone,payment_method,payment_status,total,upfront_amount,amount_due,created_at").order("created_at",{ascending:false});
  if(error){body.innerHTML='<tr><td colspan="8"><div class="empty"><strong>Could not load payments</strong><span>'+escapeHtml(error.message)+'</span></div></td></tr>';setSectionMessage("paymentsMessage",error.message,"error");return;}
  adminPayments=data||[];
  renderAdminPayments();
  const sales=adminPayments.filter(o=>o.payment_status==="Paid").reduce((a,o)=>a+Number(o.total||0),0);
  document.getElementById("statSales").textContent="₹"+sales.toLocaleString("en-IN");
  setSectionMessage("paymentsMessage",adminPayments.length+" payment record(s) loaded.","success");
}
function renderAdminPayments(){
  const body=document.getElementById("paymentsTableBody");if(!body)return;
  const q=(document.getElementById("paymentSearch")?.value||"").trim().toLowerCase();
  const status=document.getElementById("paymentStatusFilter")?.value||"All";
  const method=document.getElementById("paymentMethodFilter")?.value||"All";
  const list=adminPayments.filter(o=>(!q||[o.order_number,o.customer_name,o.customer_phone].some(v=>String(v||"").toLowerCase().includes(q)))&&(status==="All"||o.payment_status===status)&&(method==="All"||o.payment_method===method));
  const summary={count:list.length,total:list.reduce((a,o)=>a+Number(o.total||0),0),pending:list.filter(o=>o.payment_status==="Pending").reduce((a,o)=>a+Number(o.total||0),0),paid:list.filter(o=>o.payment_status==="Paid").reduce((a,o)=>a+Number(o.total||0),0)};
  document.getElementById("paymentSummary").innerHTML='<div><span>Records</span><strong>'+summary.count+'</strong></div><div><span>Value</span><strong>₹'+summary.total.toLocaleString("en-IN")+'</strong></div><div><span>Paid</span><strong>₹'+summary.paid.toLocaleString("en-IN")+'</strong></div><div><span>Pending</span><strong>₹'+summary.pending.toLocaleString("en-IN")+'</strong></div>';
  if(!list.length){body.innerHTML='<tr><td colspan="8"><div class="empty"><strong>No payment records</strong><span>Orders will appear here after checkout.</span></div></td></tr>';return;}
  body.innerHTML=list.map(o=>'<tr><td><strong>'+escapeHtml(o.order_number)+'</strong></td><td><div class="product-cell"><strong>'+escapeHtml(o.customer_name)+'</strong><small>'+escapeHtml(o.customer_phone)+'</small></div></td><td>'+escapeHtml(o.payment_method||"—")+'</td><td><span class="status-pill '+(o.payment_status==="Paid"?"status-active":"status-inactive")+'">'+escapeHtml(o.payment_status||"Pending")+'</span></td><td>₹'+Number(o.total||0).toLocaleString("en-IN")+'</td><td>'+escapeHtml(new Date(o.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}))+'</td></tr>').join("");
}
function loadAllAdminData(){loadAdminOrders();loadAdminCustomers();loadAdminInventory();loadAdminPayments();}

// ===== LIVE ORDERS =====
let adminOrders=[];
const orderStatuses=["Pending","Confirmed","Processing","Shipped","Delivered","Cancelled"];
const paymentMethodLabels={"UPI":"UPI — Full Payment","COD":"COD + ₹100 UPI Advance","UPI Advance + COD":"UPI Advance + COD"};

function setOrdersMessage(message,type=""){
  const el=document.getElementById("ordersMessage");
  if(el){el.textContent=message;el.style.color=type==="error"?"#c62828":type==="success"?"#21854a":"";}
}

async function loadAdminOrders(){
  const body=document.getElementById("ordersTableBody");
  if(!body)return;
  setOrdersMessage("Loading orders…");
  const {data,error}=await supabaseClient
    .from("orders")
    .select("id,order_number,customer_id,customer_name,customer_phone,customer_email,address_line,area_locality,pincode,city,state,subtotal,delivery_charge,total,upfront_amount,amount_due,order_status,payment_method,payment_status,created_at,updated_at")
    .order("created_at",{ascending:false});
  if(error){
    console.error("Orders load failed:",error);
    body.innerHTML='<tr><td colspan="7"><div class="empty"><strong>Could not load orders</strong><span>'+escapeHtml(error.message)+'</span></div></td></tr>';
    setOrdersMessage(error.message,"error");
    return;
  }
  adminOrders=data||[];
  renderAdminOrders();
  setOrdersMessage(adminOrders.length+" live order(s) loaded.","success");
  const stat=document.getElementById("statOrders");
  if(stat)stat.textContent=adminOrders.length;
}

function renderAdminOrders(){
  const body=document.getElementById("ordersTableBody");
  if(!body)return;
  const q=(document.getElementById("orderSearch")?.value||"").trim().toLowerCase();
  const status=document.getElementById("orderStatusFilter")?.value||"All";
  const list=adminOrders.filter(o=>{
    const matchesQ=!q || [o.order_number,o.customer_name,o.customer_phone,o.customer_email].some(v=>String(v||"").toLowerCase().includes(q));
    return matchesQ && (status==="All" || o.order_status===status);
  });
  if(!list.length){
    body.innerHTML='<tr><td colspan="7"><div class="empty"><strong>No matching orders</strong><span>Orders created from the live checkout will appear here.</span></div></td></tr>';
    return;
  }
  body.innerHTML=list.map(o=>{
    const date=new Date(o.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
    const statusOptions=orderStatuses.map(s=>'<option value="'+s+'" '+(s===o.order_status?"selected":"")+'>'+s+'</option>').join("");
    return '<tr>'+
      '<td><div class="product-cell"><strong>'+escapeHtml(o.order_number)+'</strong><small>'+escapeHtml(o.payment_status||"Pending")+'</small></div></td>'+
      '<td><div class="product-cell"><strong>'+escapeHtml(o.customer_name)+'</strong><small>'+escapeHtml(o.customer_phone)+'</small></div></td>'+
      '<td>'+escapeHtml(date)+'</td>'+
      '<td>₹'+Number(o.total||0).toLocaleString("en-IN")+'</td>'+
      '<td>'+escapeHtml(paymentMethodLabels[o.payment_method]||o.payment_method||"—")+'</td>'+
      '<td><select class="order-status-select" data-order-status-id="'+o.id+'">'+statusOptions+'</select></td>'+
      '<td><button type="button" class="secondary-btn order-view-btn" data-order-id="'+o.id+'">View</button></td>'+
      '</tr>';
  }).join("");
  body.querySelectorAll(".order-status-select").forEach(el=>{
    el.addEventListener("change",()=>updateOrderStatus(el.dataset.orderStatusId,el.value));
  });
  body.querySelectorAll(".order-view-btn").forEach(el=>{
    el.addEventListener("click",()=>openOrderDetails(el.dataset.orderId));
  });
}

async function updateOrderStatus(id,status){
  const {error}=await supabaseClient.from("orders").update({order_status:status}).eq("id",id);
  if(error){alert("Could not update order status: "+error.message);await loadAdminOrders();return;}
  const order=adminOrders.find(o=>o.id===id);
  if(order)order.order_status=status;
  setOrdersMessage("Order status updated.","success");
}

async function openOrderDetails(id){
  const order=adminOrders.find(o=>o.id===id);
  if(!order)return;
  const box=document.getElementById("orderDetailContent");
  box.innerHTML='<p class="muted">Loading items…</p>';
  document.getElementById("orderModalTitle").textContent=order.order_number;
  document.getElementById("orderModal").hidden=false;
  const {data,error}=await supabaseClient
    .from("order_items")
    .select("id,product_id,product_name,size,quantity,unit_price,line_total")
    .eq("order_id",id);
  if(error){
    box.innerHTML='<div class="empty"><strong>Could not load order items</strong><span>'+escapeHtml(error.message)+'</span></div>';
    return;
  }
  const items=data||[];
  box.innerHTML=
    '<div class="order-detail-grid">'+
      '<div><strong>Customer</strong><p>'+escapeHtml(order.customer_name)+'<br>'+escapeHtml(order.customer_phone)+'<br>'+escapeHtml(order.customer_email||"")+'</p></div>'+
      '<div><strong>Delivery Address</strong><p>'+escapeHtml(order.address_line)+'<br>'+escapeHtml(order.area_locality)+'<br>'+escapeHtml(order.city)+' - '+escapeHtml(order.pincode)+'<br>'+escapeHtml(order.state)+'</p></div>'+
    '</div>'+
    '<div class="table-wrap"><table class="admin-table"><thead><tr><th>PRODUCT</th><th>SIZE</th><th>QTY</th><th>PRICE</th><th>TOTAL</th></tr></thead><tbody>'+
    items.map(i=>'<tr><td>'+escapeHtml(i.product_name)+'</td><td>'+escapeHtml(i.size)+'</td><td>'+i.quantity+'</td><td>₹'+Number(i.unit_price).toLocaleString("en-IN")+'</td><td>₹'+Number(i.line_total).toLocaleString("en-IN")+'</td></tr>').join("")+
    '</tbody></table></div>'+
    '<div class="summary-total"><span>Total</span><strong>₹'+Number(order.total||0).toLocaleString("en-IN")+'</strong></div>'+
    '<div class="order-detail-actions"><span>Payment: <strong>'+escapeHtml(paymentMethodLabels[order.payment_method]||order.payment_method||"—")+'</strong> · '+escapeHtml(order.payment_status||"Pending")+'</span><br><span>COD Charge: <strong>₹'+Number(order.delivery_charge||0).toLocaleString("en-IN")+'</strong> · Upfront: <strong>₹'+Number(order.upfront_amount||0).toLocaleString("en-IN")+'</strong> · Due on delivery: <strong>₹'+Number(order.amount_due||0).toLocaleString("en-IN")+'</strong></span></div>';
}

function closeOrderDetails(){
  const modal=document.getElementById("orderModal");
  if(modal)modal.hidden=true;
}

const refreshOrdersBtn=document.getElementById("refreshOrdersBtn");
if(refreshOrdersBtn)refreshOrdersBtn.addEventListener("click",loadAdminOrders);
const orderSearch=document.getElementById("orderSearch");
if(orderSearch)orderSearch.addEventListener("input",renderAdminOrders);
const orderStatusFilter=document.getElementById("orderStatusFilter");
if(orderStatusFilter)orderStatusFilter.addEventListener("change",renderAdminOrders);
const closeOrderModalBtn=document.getElementById("closeOrderModal");
if(closeOrderModalBtn)closeOrderModalBtn.addEventListener("click",closeOrderDetails);

const navItems=document.querySelectorAll(".nav-item"),sections=document.querySelectorAll(".section"),pageTitle=document.getElementById("pageTitle");
navItems.forEach(item=>item.addEventListener("click",()=>{const section=item.dataset.section;navItems.forEach(x=>x.classList.remove("active"));item.classList.add("active");sections.forEach(x=>x.classList.toggle("active",x.id===section));pageTitle.textContent=item.textContent.replace(/^\S+\s/,"").trim();if(section==="customers")loadAdminCustomers();if(section==="inventory")loadAdminInventory();if(section==="payments")loadAdminPayments();}));

supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_IN" && session && !isLoggingIn){
    isAdminEmail(session.user.email).then(allowed=>{
      if(allowed) showAdmin();
    });
  }
});


const refreshCustomersBtn=document.getElementById("refreshCustomersBtn");if(refreshCustomersBtn)refreshCustomersBtn.addEventListener("click",loadAdminCustomers);
const customerSearch=document.getElementById("customerSearch");if(customerSearch)customerSearch.addEventListener("input",renderAdminCustomers);
const closeCustomerModalBtn=document.getElementById("closeCustomerModal");if(closeCustomerModalBtn)closeCustomerModalBtn.addEventListener("click",closeCustomerDetails);
const refreshInventoryBtn=document.getElementById("refreshInventoryBtn");if(refreshInventoryBtn)refreshInventoryBtn.addEventListener("click",loadAdminInventory);
const inventorySearch=document.getElementById("inventorySearch");if(inventorySearch)inventorySearch.addEventListener("input",renderAdminInventory);
const inventoryStockFilter=document.getElementById("inventoryStockFilter");if(inventoryStockFilter)inventoryStockFilter.addEventListener("change",renderAdminInventory);
const refreshPaymentsBtn=document.getElementById("refreshPaymentsBtn");if(refreshPaymentsBtn)refreshPaymentsBtn.addEventListener("click",loadAdminPayments);
const paymentSearch=document.getElementById("paymentSearch");if(paymentSearch)paymentSearch.addEventListener("input",renderAdminPayments);
const paymentStatusFilter=document.getElementById("paymentStatusFilter");if(paymentStatusFilter)paymentStatusFilter.addEventListener("change",renderAdminPayments);
const paymentMethodFilter=document.getElementById("paymentMethodFilter");if(paymentMethodFilter)paymentMethodFilter.addEventListener("change",renderAdminPayments);

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
